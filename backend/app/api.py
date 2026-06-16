"""
NirmanIQ backend API  v2 — SQLite storage
──────────────────────────────────────────────────────────────────────────────
All persistent data now lives in SQLite (data/nirmaniq.db).
The generic kv_store table still handles any keys the frontend sends via
/api/storage/{key}, giving full backward compatibility.

AI endpoints use Claude vision — no OCR, no regex.
"""

import base64
import json
import logging
import os
from typing import Optional

import httpx
from fastapi import APIRouter, Body, HTTPException, UploadFile, File, Request

from .schemas import ExtractRequest, ExtractResponse, ProjectResponse, StorageResponse
from .extractor import extract_from_bytes
from .auth import (
    init_auth_tables, find_user_by_identifier, create_user,
    hash_password, verify_password, create_access_token, decode_access_token,
    generate_otp, send_otp, store_otp, verify_otp, update_last_login,
    verify_user_account, find_user_by_id,
)
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import Depends
from .database import (
    save_project, load_project,
    save_storage, load_storage,
    save_stage_tasks, load_stage_tasks,
    save_materials, load_materials,
    save_payment, delete_payment, load_payments,
    save_log, load_logs,
    save_photo, load_photos,
    save_team, load_team,
    save_customer, load_customers,
    save_loan_items, load_loan_items,
    get_ai_cache, set_ai_cache,
    save_issue, load_issues, delete_issue,
    load_stage_master, save_stage, delete_stage, reorder_stages, reset_stage_master,
    load_market_rates, load_market_rates_full, save_market_rate,
    load_material_master, load_team_roles, seed_config_master,
    save_cash_flow, load_cash_flow, delete_cash_flow,
    save_money_out, load_money_out, delete_money_out,
    save_stage_estimate, load_stage_estimate,
    save_mat_actual, load_mat_actuals,
    save_required_photo, load_required_photos,
    audit, load_audit_log,
    check_and_save_budget_alert, load_budget_alerts, ack_budget_alert,
)

router = APIRouter()
logger = logging.getLogger("nirmaniq_api")

CLAUDE_API_URL = "https://api.anthropic.com/v1/messages"
CLAUDE_MODEL   = "claude-opus-4-5"


# ── helpers ───────────────────────────────────────────────────────────────────

def _api_key() -> str:
    key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not key:
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY not configured. Add it to .env")
    return key


def _headers(key: str) -> dict:
    return {"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"}


def _doc_block(doc) -> Optional[dict]:
    """Convert a single doc object to Claude content block. Returns None if unusable."""
    if not doc or not isinstance(doc, dict) or not doc.get("data"):
        return None
    mime = doc.get("type", "")
    raw  = doc["data"]
    if "," in raw:
        raw = raw.split(",", 1)[1]
    if not raw:
        return None
    if "pdf" in mime:
        return {"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": raw}}
    if mime.startswith("image/"):
        return {"type": "image", "source": {"type": "base64", "media_type": mime, "data": raw}}
    return None


def _doc_blocks_for(docs: dict, doc_id: str, label: str) -> list:
    """
    Get all content blocks for a doc slot.
    Handles both single doc (dict) and array of docs (list).
    """
    val = docs.get(doc_id)
    if not val:
        return []

    items = val if isinstance(val, list) else [val]
    blocks = []
    for i, item in enumerate(items):
        block = _doc_block(item)
        if block:
            suffix = f" (page {i+1} of {len(items)})" if len(items) > 1 else ""
            blocks.append({"type": "text", "text": f"[{label}{suffix}]"})
            blocks.append(block)
    return blocks


async def _claude(messages: list, max_tokens: int = 2048) -> str:
    key = _api_key()
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            CLAUDE_API_URL, headers=_headers(key),
            json={"model": CLAUDE_MODEL, "max_tokens": max_tokens, "messages": messages},
        )
    try:
        resp.raise_for_status()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Claude API error {e.response.status_code}")
    return resp.json()["content"][0]["text"].strip()


def _parse_json(text: str) -> dict:
    text = text.replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"AI returned invalid JSON: {e}")


# ── Project ───────────────────────────────────────────────────────────────────

@router.get("/project", response_model=ProjectResponse)
async def get_project_endpoint():
    p = load_project()
    if not p:
        raise HTTPException(status_code=404, detail="No project saved yet")
    return ProjectResponse(success=True, project=p)


@router.post("/project", response_model=ProjectResponse)
async def save_project_endpoint(project: dict = Body(...)):
    if not project:
        raise HTTPException(status_code=400, detail="Empty project")
    saved = save_project(project)
    return ProjectResponse(success=True, project=saved)


# ── Generic KV (backward-compat — frontend sends everything via /api/storage) ─

@router.get("/storage/{key}", response_model=StorageResponse)
async def get_storage_endpoint(key: str):
    # Try specialised tables first, fall back to kv_store
    value = _load_by_key(key)
    return StorageResponse(success=True, key=key, value=value)


@router.post("/storage/{key}", response_model=StorageResponse)
async def set_storage_endpoint(key: str, body: dict = Body(...)):
    if "value" not in body:
        raise HTTPException(status_code=400, detail="Missing 'value'")
    value = body["value"]
    _save_by_key(key, value)
    return StorageResponse(success=True, key=key, value=value)


def _load_by_key(key: str, user_id: str = 'default'):
    """Route storage key to specialised SQLite table, fallback to kv_store."""
    if key == "bs_stages":
        tasks = load_stage_tasks()
        # Return in the shape the frontend expects (list of stage objects stored as JSON)
        stored = load_storage(key, None, user_id)
        if stored:
            # Merge task completion from stages table into stored stage structure
            task_map = {f"{t['stage_id']}_{t['task_id']}": t for t in tasks}
            # Also index by just task_id
            by_task = {t['task_id']: t for t in tasks}
            for stage in (stored or []):
                for task in stage.get("tasks", []):
                    t = by_task.get(task["id"])
                    if t:
                        task["done"]     = bool(t["done"])
                        task["doneDate"] = t.get("done_date", "")
                for group in stage.get("groups", []):
                    for item in group.get("items", []):
                        t = by_task.get(item["id"])
                        if t:
                            item["done"]     = bool(t["done"])
                            item["doneDate"] = t.get("done_date", "")
        return stored

    if key == "bs_mats":
        saved_mats = load_storage(key, None)
        mat_rows   = {r["mat_id"]: r for r in load_materials()}
        if saved_mats and mat_rows:
            for m in saved_mats:
                row = mat_rows.get(m["id"])
                if row:
                    m["ordered"]  = row["ordered"]
                    m["received"] = row["received"]
                    m["rate"]     = row["rate"]
                    m["supplier"] = row["supplier"]
        return saved_mats

    if key == "bs_pays":
        return load_payments()

    if key == "bs_logs":
        return load_logs()

    if key == "bs_photos":
        return load_photos()

    if key == "bs_team":
        team = load_team()
        return team if team else load_storage(key, None)

    if key == "bs_customers":
        return load_customers()

    if key == "bs_loan":
        return load_loan_items()

    return load_storage(key, None)


def _save_by_key(key: str, value, user_id: str = 'default') -> None:
    """Route storage key to specialised SQLite table, also persist to kv_store."""
    # Always save to kv_store for full backup
    save_storage(key, value, user_id)

    if key == "bs_stages" and isinstance(value, list):
        tasks = []
        for stage in value:
            for task in stage.get("tasks", []):
                tasks.append({**task, "stageId": stage["id"]})
            for group in stage.get("groups", []):
                for item in group.get("items", []):
                    tasks.append({**item, "stageId": stage["id"]})
        if tasks:
            save_stage_tasks(tasks)

    elif key == "bs_mats" and isinstance(value, list):
        save_materials(value)

    elif key == "bs_pays" and isinstance(value, list):
        # Diff: we handle pays individually via add/delete endpoints,
        # but bulk save on startup is fine
        for pay in value:
            save_payment(pay)

    elif key == "bs_logs" and isinstance(value, list):
        for log in value:
            save_log(log)

    elif key == "bs_photos" and isinstance(value, list):
        for photo in value:
            save_photo(photo)

    elif key == "bs_team" and isinstance(value, list):
        save_team(value)

    elif key == "bs_customers" and isinstance(value, list):
        for c in value:
            save_customer(c)

    elif key == "bs_loan" and isinstance(value, dict):
        save_loan_items(value)


# ── Dedicated payment endpoints ───────────────────────────────────────────────

@router.post("/payments")
async def add_payment_endpoint(body: dict = Body(...)):
    import uuid as _uuid
    pay = dict(body)
    if not pay.get("id"):
        pay["id"] = f"pay_{_uuid.uuid4().hex[:10]}"
    pay["amount"] = float(pay.get("amount") or 0)
    save_payment(pay)
    audit("payment.added", "payment", pay["id"],
          f"₹{pay['amount']:.0f} — {pay.get('desc','')}",
          stage_id=pay.get("stageId",""))
    return {"success": True, "id": pay["id"]}


@router.delete("/payments/{pay_id}")
async def delete_payment_endpoint(pay_id: str):
    delete_payment(pay_id)
    return {"success": True}


# ── AI: Analyze Documents ─────────────────────────────────────────────────────

@router.post("/analyze-documents")
async def analyze_documents(body: dict = Body(...)):
    """
    Send uploaded project documents to Claude vision.
    Returns project fields, material schedule, and cost estimate.
    """
    docs = body.get("docs", {})

    doc_order = [
        ("approvedPlan",       "Approved Building Plan (GVMC / APDPMS)"),
        ("structuralDrawings", "Structural Drawings (foundation, column, beam, slab)"),
        ("soilTestReport",     "Soil Test Report"),
        ("elevationDrawing",   "Elevation Drawing"),
        ("slabDesign",         "Slab Design Document"),
        ("builderContract",    "Builder Contract / Quote"),
    ]

    content_blocks = []
    docs_attached  = []

    for doc_id, doc_label in doc_order:
        new_blocks = _doc_blocks_for(docs, doc_id, doc_label)
        if new_blocks:
            content_blocks.extend(new_blocks)
            docs_attached.append(doc_label)

    if not content_blocks:
        raise HTTPException(status_code=400, detail="No readable documents provided")

    content_blocks.append({"type": "text", "text": f"""
You are a senior structural engineer and quantity surveyor reading construction documents
for a residential building project in Visakhapatnam (Vizag), Andhra Pradesh, India.
Documents provided: {', '.join(docs_attached)}

TASK 1 — Extract project details.
TASK 2 — Generate a complete Bill of Materials from the structural drawings.
TASK 3 — Estimate total project cost at Vizag market rates (mid-2025).

Respond ONLY with valid JSON, no markdown fences:
{{
  "projectFields": {{
    "approvalNumber": null, "ownerName": null, "projectName": null,
    "siteAddress": null, "locality": null, "city": null,
    "plotLength": null, "plotWidth": null, "plotArea": null,
    "facing": null, "roadWidth": null, "floorConfig": null,
    "hasStilt": null, "totalFloors": null, "floorHeight": null,
    "hasLift": null, "builderName": null,
    "sbcValue": null, "fodDepth": null
  }},
  "materialSchedule": {{
    "steel": [{{"dia":"20mm","grade":"Fe415","qty_kg":0,"qty_mt":0,"use":""}}],
    "concrete": [{{"grade":"M20","volume_cum":0,"use":""}}],
    "cement_bags": {{"opc53":0,"ppc":0,"total":0}},
    "sand_cum": 0, "aggregate_20mm_cum": 0, "aggregate_40mm_cum": 0,
    "bricks": {{"nine_inch_nos":0,"four_inch_nos":0,"total_nos":0}},
    "flooring": {{"tiles_2x4ft_boxes":0,"tiles_2x2ft_boxes":0,"granite_sqft":0}},
    "notes": ""
  }},
  "costEstimate": {{
    "foundation":0,"structure_rcc":0,"masonry_plaster":0,"mep":0,
    "flooring_tiling":0,"doors_windows":0,"painting":0,
    "systems_handover":0,"contingency_8pct":0,"total":0,
    "rate_per_sft":0,"slab_area_sft":0,
    "currency":"INR","basis":"Vizag market rates mid-2025","notes":""
  }},
  "documentSummary": "",
  "confidence": "high|medium|low"
}}
Use null for any value not determinable from the documents.
"""})

    text   = await _claude([{"role": "user", "content": content_blocks}], max_tokens=4000)
    result = _parse_json(text)

    return {"success": True, "docsAnalyzed": docs_attached, **result}


# ── AI: Stage Materials (with doc attachment + caching) ───────────────────────

@router.post("/ai-stage-materials")
async def ai_stage_materials(body: dict = Body(...)):
    """
    Generate per-stage BOM + cost with Claude.
    Attaches relevant drawings from the saved project.
    Results are cached in SQLite for 7 days.
    """
    stage_id    = body.get("stageId", "")
    stage_label = body.get("stageLabel", "")
    project     = body.get("project", {})
    local_items = body.get("localItems", [])
    force_refresh = body.get("forceRefresh", False)

    # Check cache (skip if forceRefresh)
    if not force_refresh:
        cached = get_ai_cache(stage_id, project)
        if cached:
            logger.info(f"Returning cached AI result for {stage_id}")
            return {"success": True, "stageId": stage_id, "cached": True, **cached}

    # Project context
    plot_dims = f"{project.get('plotLength',60)}×{project.get('plotWidth',35)} ft"
    floors    = project.get("totalFloors", 4)
    floor_ht  = project.get("floorHeight", 10.5)
    has_stilt = project.get("hasStilt", True)
    slab_area = project.get("slabArea", 6636)
    city      = project.get("city", "Visakhapatnam")
    sbc       = project.get("sbcValue", "14.4 t/m²")
    fod       = project.get("fodDepth", "2.4m")

    local_summary = ""
    if local_items:
        lines = [f"  - {i['name']}: {i['qty']} {i['unit']} @ ₹{i['rate']} = ₹{int(i['amount']):,}" for i in local_items]
        local_summary = "Pre-computed estimates:\n" + "\n".join(lines)

    project_ctx = (
        f"Plot: {plot_dims} | {'Stilt+' if has_stilt else ''}G+{floors-(2 if has_stilt else 1)} floors\n"
        f"Floor height: {floor_ht} ft | Slab area: {slab_area} sft\n"
        f"Soil: SBC {sbc}, FOD {fod} | City: {city}\n"
        f"{local_summary}"
    )

    # Get docs — from request or from saved project
    docs = project.get("docs", {})
    if not docs:
        saved = load_project() or {}
        docs  = saved.get("docs", {})

    STAGE_DOCS = {
        "s0": ["approvedPlan", "soilTestReport"],
        "s_borewell": ["soilTestReport"],
        "s1": ["approvedPlan", "soilTestReport"],
        "s2": ["structuralDrawings", "soilTestReport"],
        "s3": ["structuralDrawings"],
        "s4": ["structuralDrawings", "slabDesign"],
        "s5": ["structuralDrawings", "slabDesign"],
        "s6": ["structuralDrawings", "slabDesign"],
        "s7": ["structuralDrawings", "slabDesign"],
        "s8": ["approvedPlan", "structuralDrawings"],
        "s9": ["approvedPlan"],
        "s10": ["approvedPlan"],
        "s11": ["approvedPlan", "elevationDrawing"],
        "s12": ["approvedPlan", "elevationDrawing"],
        "s13": ["elevationDrawing"],
        "s14": ["approvedPlan"],
    }
    relevant = STAGE_DOCS.get(stage_id, ["approvedPlan", "structuralDrawings"])

    content_blocks = []
    docs_attached  = []
    DOC_LABELS = {
        "approvedPlan": "Approved Building Plan",
        "structuralDrawings": "Structural Drawings",
        "soilTestReport": "Soil Test Report",
        "elevationDrawing": "Elevation Drawing",
        "slabDesign": "Slab Design",
        "builderContract": "Builder Contract",
    }

    for doc_id in relevant:
        label = DOC_LABELS.get(doc_id, doc_id)
        new_blocks = _doc_blocks_for(docs, doc_id, label)
        if new_blocks:
            content_blocks.extend(new_blocks)
            docs_attached.append(label)

    using_docs = bool(docs_attached)
    doc_note   = f"Reading: {', '.join(docs_attached)}." if using_docs else "No drawings — using dimensions only."

    content_blocks.append({"type": "text", "text": f"""You are a senior structural engineer and quantity surveyor in Visakhapatnam, AP, India.

PROJECT:
{project_ctx}

STAGE: {stage_label} (ID: {stage_id})
{doc_note}

{'Derive quantities from the actual reinforcement schedules and drawing dimensions.' if using_docs else 'Use IS 456-2000 standard ratios for this building size.'}

Generate a complete Bill of Materials with current Vizag market rates (mid-2025).
Include materials, labour, shuttering, curing, wastage. Be specific to this project size.

Respond ONLY with valid JSON, no markdown:
{{
  "items": [{{
    "id": "slug",
    "name": "item name",
    "unit": "MT|bags|cum|nos|sqm|sft|rft|ltr|set|mtr",
    "qty": 0,
    "rate": 0,
    "amount": 0,
    "spec": "specification",
    "category": "steel|cement|aggregate|masonry|labour|shuttering|tiles|paint|systems|civil|electrical|plumbing|chemical|curing|misc"
  }}],
  "totalCost": 0,
  "labourCost": 0,
  "materialCost": 0,
  "notes": "engineer notes",
  "marketContext": "Vizag market note",
  "quantityBasis": "drawings|dimensions|estimate"
}}"""})

    text   = await _claude([{"role": "user", "content": content_blocks}], max_tokens=3000)
    result = _parse_json(text)

    # Cache the result
    set_ai_cache(stage_id, project, result)

    return {
        "success": True,
        "stageId": stage_id,
        "usedDocuments": docs_attached,
        "documentBased": using_docs,
        "cached": False,
        **result,
    }


# ── Legacy OCR endpoint ───────────────────────────────────────────────────────

@router.post("/extract-plan", response_model=ExtractResponse)
async def extract_plan(body: ExtractRequest = Body(...)):
    if not body.data:
        raise HTTPException(status_code=400, detail="No file data provided")
    try:
        file_bytes = base64.b64decode(body.data)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 data")
    try:
        result = await extract_from_bytes(file_bytes, body.type)
        return ExtractResponse(success=True, fields=result.get("fields", {}), text=result.get("text", ""))
    except Exception as e:
        logger.exception("extract-plan error")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/extract-plan-multipart")
async def extract_plan_multipart(file: UploadFile = File(...)):
    content = await file.read()
    result  = await extract_from_bytes(content, file.content_type)
    return {"success": True, "fields": result.get("fields", {}), "text": result.get("text", "")}


# ── Quality Issues ────────────────────────────────────────────────────────────

@router.get("/issues")
async def get_issues(stage_id: str = None):
    return {"success": True, "issues": load_issues(stage_id)}


@router.post("/issues")
async def create_issue(body: dict = Body(...)):
    import uuid
    issue = {**body, "id": body.get("id") or f"iss_{uuid.uuid4().hex[:8]}"}
    save_issue(issue)
    audit("issue.created", "issue", issue["id"],
          f"Severity:{issue.get('severity','medium')} Stage:{issue.get('stageId','')}",
          stage_id=issue.get("stageId",""))
    return {"success": True, "issue": issue}


@router.put("/issues/{issue_id}")
async def update_issue(issue_id: str, body: dict = Body(...)):
    issue = {**body, "id": issue_id}
    save_issue(issue)
    audit("issue.updated", "issue", issue_id,
          f"Status:{issue.get('status','')}",
          stage_id=issue.get("stageId",""))
    return {"success": True, "issue": issue}


@router.delete("/issues/{issue_id}")
async def delete_issue_endpoint(issue_id: str):
    delete_issue(issue_id)
    audit("issue.deleted", "issue", issue_id)
    return {"success": True}


# ── AI Photo Review ───────────────────────────────────────────────────────────

@router.post("/ai-photo-review")
async def ai_photo_review(body: dict = Body(...)):
    """
    Send a site photo to Claude vision. Returns:
    - progress assessment
    - visible quality issues (with severity)
    - missing evidence flags
    - recommendations
    """
    photo_data  = body.get("photoData")    # base64 data URL
    stage_id    = body.get("stageId", "")
    stage_label = body.get("stageLabel", "")
    context     = body.get("context", "")  # optional: what photo is supposed to show

    if not photo_data:
        raise HTTPException(status_code=400, detail="No photo data provided")

    # Strip data-URL prefix
    raw  = photo_data
    mime = "image/jpeg"
    if photo_data.startswith("data:"):
        parts = photo_data.split(",", 1)
        mime  = parts[0].split(":")[1].split(";")[0]
        raw   = parts[1]

    project = load_project() or {}

    content = [
        {"type": "image", "source": {"type": "base64", "media_type": mime, "data": raw}},
        {"type": "text", "text": f"""You are a senior structural engineer and quality inspector reviewing a residential construction site photo.

Project: {project.get('plotLength',60)}×{project.get('plotWidth',35)} ft, {project.get('floorConfig','S+G+2')}, Visakhapatnam
Stage: {stage_label} (ID: {stage_id})
{f'Photo context: {context}' if context else ''}

Review this site photo carefully and respond ONLY with valid JSON, no markdown:
{{
  "progressAssessment": "brief description of what stage of work is visible",
  "workQuality": "good|acceptable|poor|cannot_determine",
  "issues": [
    {{
      "title": "short issue title",
      "description": "what is wrong and why it matters",
      "severity": "low|medium|high|critical",
      "recommendation": "what should be done"
    }}
  ],
  "missingEvidence": ["list of things that should be visible but are not"],
  "positiveObservations": ["things done correctly that are visible"],
  "aiConfidence": 0.0 to 1.0,
  "reviewNotes": "overall engineer note for the owner",
  "requiresExpertReview": true or false
}}

Be specific about IS code requirements where relevant (IS 456-2000, IS 13920).
If the photo is unclear or too far/dark, set aiConfidence below 0.4 and note it.
Critical issues: missing cover blocks, wrong rebar spacing, visible honeycombing,
no curing, inadequate concrete consolidation, rebar corrosion."""}
    ]

    text   = await _claude([{"role": "user", "content": content}], max_tokens=1500)
    result = _parse_json(text)

    # Auto-create issues for high/critical findings
    created_issues = []
    for iss in result.get("issues", []):
        if iss.get("severity") in ("high", "critical"):
            import uuid
            issue = {
                "id": f"ai_{uuid.uuid4().hex[:8]}",
                "stageId": stage_id,
                "stageLabel": stage_label,
                "title": iss["title"],
                "description": iss["description"],
                "severity": iss["severity"],
                "status": "open",
                "aiDetected": True,
                "aiConfidence": result.get("aiConfidence", 0.8),
            }
            save_issue(issue)
            audit("issue.ai_created", "issue", issue["id"],
                  f"AI detected {iss['severity']}: {iss['title']}", stage_id=stage_id)
            created_issues.append(issue)

    return {
        "success":       True,
        "stageId":       stage_id,
        "createdIssues": created_issues,
        **result,
    }


# ── Required photos ───────────────────────────────────────────────────────────

@router.get("/required-photos/{stage_id}")
async def get_required_photos(stage_id: str):
    return {"success": True, "photos": load_required_photos(stage_id)}


@router.put("/required-photos/{rp_id}")
async def update_required_photo(rp_id: str, body: dict = Body(...)):
    rp = {**body, "id": rp_id}
    save_required_photo(rp)
    return {"success": True}


# ── Audit log ─────────────────────────────────────────────────────────────────

@router.get("/audit")
async def get_audit_log(limit: int = 100, stage_id: str = None):
    return {"success": True, "entries": load_audit_log(limit, stage_id)}


@router.post("/audit")
async def add_audit_entry(body: dict = Body(...)):
    audit(body.get("action","action"), body.get("entityType",""),
          body.get("entityId",""), body.get("detail",""),
          body.get("stageId",""), body.get("userId","owner"))
    return {"success": True}


# ── Budget alerts ─────────────────────────────────────────────────────────────

@router.get("/budget-alerts")
async def get_budget_alerts():
    return {"success": True, "alerts": load_budget_alerts(unack_only=True)}


@router.post("/budget-alerts/check")
async def check_budget_alert(body: dict = Body(...)):
    """Called when a payment is added. Checks if threshold is crossed."""
    cat_id   = body.get("catId","")
    pct_used = float(body.get("pctUsed", 0))
    alert    = check_and_save_budget_alert(cat_id, pct_used)
    return {"success": True, "alert": alert}


@router.post("/budget-alerts/{alert_id}/ack")
async def acknowledge_budget_alert(alert_id: str):
    ack_budget_alert(alert_id)
    return {"success": True}


# ── Stage estimates ────────────────────────────────────────────────────────────

@router.get("/stage-estimate/{stage_id}")
async def get_stage_estimate(stage_id: str):
    est = load_stage_estimate(stage_id)
    return {"success": True, "estimate": est}


@router.post("/stage-estimate/{stage_id}")
async def save_stage_estimate_endpoint(stage_id: str, body: dict = Body(...)):
    save_stage_estimate(
        stage_id,
        float(body.get("estimatedCost", 0)),
        body.get("items", []),
        body.get("source", "local"),
    )
    audit("estimate.saved", "stage", stage_id,
          f"Cost: {body.get('estimatedCost', 0)}", stage_id=stage_id)
    return {"success": True}


# ── Material actuals ───────────────────────────────────────────────────────────

@router.get("/mat-actuals/{stage_id}")
async def get_mat_actuals(stage_id: str):
    return {"success": True, "actuals": load_mat_actuals(stage_id)}


@router.post("/mat-actuals/{stage_id}/{item_id}")
async def save_mat_actual_endpoint(stage_id: str, item_id: str, body: dict = Body(...)):
    save_mat_actual(stage_id, item_id, body)
    audit("actual.updated", "material", f"{stage_id}_{item_id}",
          f"qty:{body.get('actualQty',0)} amt:{body.get('actualAmt',0)}",
          stage_id=stage_id)
    return {"success": True}


# ── Stage Master CRUD ──────────────────────────────────────────────────────────

@router.get("/stages/master")
async def get_stage_master():
    stages = load_stage_master()
    return {"success": True, "stages": stages}


@router.post("/stages/master")
async def create_or_update_stage(body: dict = Body(...)):
    import uuid as _uuid
    if not body.get("id"):
        body["id"] = f"s_{_uuid.uuid4().hex[:6]}"
    saved = save_stage(body)
    audit("stage.saved", "stage", body["id"], f"label:{body.get('label','')}")
    return {"success": True, "stage": saved}


@router.delete("/stages/master/{stage_id}")
async def delete_stage_endpoint(stage_id: str):
    delete_stage(stage_id)
    audit("stage.deleted", "stage", stage_id)
    return {"success": True}


@router.post("/stages/master/reorder")
async def reorder_stages_endpoint(body: dict = Body(...)):
    ordered_ids = body.get("orderedIds", [])
    if ordered_ids:
        reorder_stages(ordered_ids)
    return {"success": True}


@router.post("/stages/master/reset-and-reseed")
async def reset_and_reseed():
    """Delete all stage master data and re-seed from stages_seed.py. Use after contract update."""
    from .stages_seed import STAGES_SEED
    reset_stage_master()
    from .database import seed_stage_master as _seed
    _seed.__globals__['_stage_master_seeded'] = lambda conn: False  # force re-seed
    # Direct re-seed
    from .database import db as _db
    import json as _json
    with _db() as conn:
        for order, s in enumerate(STAGES_SEED):
            conn.execute(
                """INSERT OR REPLACE INTO stage_master
                   (id, label, icon, color, phase, budget_pct, duration_wks,
                    budget_cat_id, sort_order, contract_amount, payment_rule)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                (s["id"], s["label"], s.get("icon","🏗"), s.get("color","#3D7EFF"),
                 s.get("phase","foundation"), s.get("budgetPct",0),
                 s.get("durationWks",4), s.get("budgetCatId",""), order,
                 s.get("contractAmount",0), s.get("paymentRule",""))
            )
            for seq, text in enumerate(s.get("checklist", [])):
                conn.execute(
                    "INSERT OR IGNORE INTO stage_checklist(id, stage_id, seq, text) VALUES (?,?,?,?)",
                    (f"{s['id']}_{seq}", s["id"], seq, text)
                )
            for seq, rp in enumerate(s.get("requiredPhotos", [])):
                conn.execute(
                    "INSERT OR IGNORE INTO stage_photo_defs(id, stage_id, seq, label, description, mandatory) VALUES (?,?,?,?,?,?)",
                    (rp["id"], s["id"], seq, rp["label"], rp.get("description",""), 1 if rp.get("mandatory",True) else 0)
                )
            for seq, qc in enumerate(s.get("qualityChecks", [])):
                conn.execute(
                    "INSERT OR IGNORE INTO stage_quality_defs(id, stage_id, seq, check_text, severity) VALUES (?,?,?,?,?)",
                    (qc["id"], s["id"], seq, qc["check"], qc.get("severity","medium"))
                )
            for seq, mid in enumerate(s.get("materialIds", [])):
                conn.execute(
                    "INSERT OR IGNORE INTO stage_material_ids(stage_id, mat_id, seq) VALUES (?,?,?)",
                    (s["id"], mid, seq)
                )
    audit("stage.reseeded", "stage_master", "all", f"{len(STAGES_SEED)} stages from contract")
    return {"success": True, "stagesSeeded": len(STAGES_SEED)}


# ── Auth endpoints ─────────────────────────────────────────────────────────────

_bearer = HTTPBearer(auto_error=False)

def get_current_user(creds: HTTPAuthorizationCredentials = Depends(_bearer)) -> Optional[dict]:
    if not creds:
        return None
    return decode_access_token(creds.credentials)


def get_user_id(request) -> str:
    """Extract user_id from Bearer token in request headers. Falls back to 'default'."""
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
        payload = decode_access_token(token)
        if payload and payload.get("sub"):
            return payload["sub"]
    return "default"


@router.post("/auth/register")
async def auth_register(body: dict = Body(...)):
    """
    Step 1: Create account with name, email/phone, password.
    Step 2: OTP is sent to verify identity.
    """
    import uuid as _uuid
    name      = (body.get("name") or "").strip()
    email     = (body.get("email") or "").strip().lower()
    phone     = (body.get("phone") or "").strip()
    password  = body.get("password") or ""

    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    if not email and not phone:
        raise HTTPException(status_code=400, detail="Email or phone is required")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    # Check duplicate
    identifier = email or phone
    existing   = find_user_by_identifier(identifier)
    if existing:
        raise HTTPException(status_code=409, detail="Account already exists with this email/phone")

    # Create user (unverified)
    user_id = f"usr_{_uuid.uuid4().hex[:12]}"
    pw_hash = hash_password(password)
    user    = create_user(user_id, name, email, phone, pw_hash)

    # Generate + send OTP for verification
    otp      = generate_otp()
    store_otp(identifier, otp, "register")
    channel  = "email" if email else "sms"
    otp_info = send_otp(identifier, otp, channel)

    audit("auth.register", "user", user_id, f"name:{name} identifier:{identifier}")
    return {
        "success": True,
        "userId":  user_id,
        "step":    "verify_otp",
        "message": f"OTP sent to your {channel}. Enter it to verify your account.",
        **otp_info,
    }


@router.post("/auth/send-otp")
async def auth_send_otp(body: dict = Body(...)):
    """
    Send OTP for login or re-verification.
    Call this before /auth/login when MFA is required.
    """
    identifier = (body.get("identifier") or "").strip()
    purpose    = body.get("purpose", "login")  # 'login' | 'register' | 'reset'

    if not identifier:
        raise HTTPException(status_code=400, detail="Email or phone required")

    if purpose == "login":
        user = find_user_by_identifier(identifier)
        if not user:
            # Don't reveal if account exists
            return {"success": True, "message": "If an account exists, OTP has been sent"}

    otp     = generate_otp()
    store_otp(identifier, otp, purpose)
    channel = "email" if "@" in identifier else "sms"
    otp_info = send_otp(identifier, otp, channel)

    return {"success": True, "message": f"OTP sent via {channel}", **otp_info}


@router.post("/auth/login")
async def auth_login(body: dict = Body(...)):
    """
    Two-factor login:
    Step 1: identifier + password → triggers OTP send if MFA enabled
    Step 2: identifier + password + otp → returns JWT token
    """
    identifier = (body.get("identifier") or "").strip()
    password   = body.get("password") or ""
    otp        = (body.get("otp") or "").strip()

    if not identifier or not password:
        raise HTTPException(status_code=400, detail="Email/phone and password required")

    user = find_user_by_identifier(identifier)
    if not user or not verify_password(password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # If MFA enabled and no OTP provided → send OTP and ask for it
    if user["mfa_enabled"] and not otp:
        otp_val  = generate_otp()
        norm_id  = (user["email"] or user["phone"]).strip()
        store_otp(norm_id, otp_val, "login")
        channel  = "email" if user["email"] else "sms"
        otp_info = send_otp(norm_id, otp_val, channel)
        return {
            "success": True,
            "step":    "otp_required",
            "message": f"OTP sent to your {channel}. Enter it to complete login.",
            **otp_info,
        }

    # If MFA enabled and OTP provided → verify it
    if user["mfa_enabled"] and otp:
        norm_id = user["email"] or user["phone"]
        ok, reason = verify_otp(norm_id, otp, "login")
        if not ok:
            msgs = {
                "expired":          "OTP has expired. Please request a new one.",
                "wrong":            "Incorrect OTP. Please try again.",
                "too_many_attempts":"Too many incorrect attempts. Request a new OTP.",
                "not_found":        "No OTP found. Please request a new one.",
            }
            raise HTTPException(status_code=401, detail=msgs.get(reason, "OTP verification failed"))

    # Mark verified if first login with OTP
    if not user["is_verified"]:
        verify_user_account(user["id"])

    update_last_login(user["id"])
    token = create_access_token(user["id"], user["email"] or "", user["name"])
    audit("auth.login", "user", user["id"], f"identifier:{identifier}")

    return {
        "success":  True,
        "step":     "authenticated",
        "token":    token,
        "user": {
            "id":    user["id"],
            "name":  user["name"],
            "email": user["email"],
            "phone": user["phone"],
            "role":  user["role"],
        },
    }


@router.post("/auth/verify-otp")
async def auth_verify_otp(body: dict = Body(...)):
    """Verify OTP for registration / password reset without logging in."""
    raw_id     = (body.get("identifier") or "").strip()
    identifier = raw_id.lower() if "@" in raw_id else raw_id  # normalise
    otp        = (body.get("otp") or "").strip()
    purpose    = body.get("purpose", "register")

    if not identifier or not otp:
        raise HTTPException(status_code=400, detail="Identifier and OTP required")

    ok, reason = verify_otp(identifier, otp, purpose)
    if not ok:
        msgs = {"expired":"OTP expired","wrong":"Incorrect OTP",
                "too_many_attempts":"Too many attempts","not_found":"No OTP found"}
        raise HTTPException(status_code=400, detail=msgs.get(reason, "Invalid OTP"))

    user = find_user_by_identifier(identifier)
    if user and purpose == "register":
        verify_user_account(user["id"])

    return {"success": True, "message": "OTP verified"}


@router.get("/auth/me")
async def auth_me(current_user: dict = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = find_user_by_id(current_user["sub"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "success": True,
        "user": {
            "id":    user["id"],
            "name":  user["name"],
            "email": user["email"],
            "phone": user["phone"],
            "role":  user["role"],
        },
    }


@router.post("/auth/logout")
async def auth_logout(current_user: dict = Depends(get_current_user)):
    if current_user:
        audit("auth.logout", "user", current_user.get("sub",""))
    return {"success": True}


# ── Config Master endpoints ────────────────────────────────────────────────────

@router.get("/config/market-rates")
async def get_market_rates():
    return {"success": True, "rates": load_market_rates_full()}


@router.put("/config/market-rates/{rate_id}")
async def update_market_rate(rate_id: str, body: dict = Body(...)):
    save_market_rate(rate_id, float(body.get("value", 0)))
    audit("config.rate_updated", "market_rate", rate_id, f"value:{body.get('value')}")
    return {"success": True}


@router.get("/config/materials")
async def get_materials():
    return {"success": True, "materials": load_material_master()}


@router.get("/config/team-roles")
async def get_team_roles():
    return {"success": True, "roles": load_team_roles()}


@router.post("/config/reseed")
async def reseed_config():
    """Reset config master tables to defaults.""",
    from .database import db as _db
    with _db() as conn:
        conn.execute("DELETE FROM market_rates")
        conn.execute("DELETE FROM material_master")
        conn.execute("DELETE FROM team_roles")
    seed_config_master()
    return {"success": True, "message": "Config reseeded to defaults"}


# ── Cash Flow endpoints ────────────────────────────────────────────────────────

@router.get("/cash-flow")
async def get_cash_flow():
    entries = load_cash_flow()
    return {"success": True, "entries": entries}


@router.post("/cash-flow")
async def add_cash_flow(body: dict = Body(...)):
    entry = save_cash_flow(body)
    audit("cash_flow.added", "cash_flow", entry["id"],
          f"type:{entry['type']} amount:{entry['amount']}")
    return {"success": True, "entry": entry}


@router.put("/cash-flow/{entry_id}")
async def update_cash_flow(entry_id: str, body: dict = Body(...)):
    body["id"] = entry_id
    entry = save_cash_flow(body)
    return {"success": True, "entry": entry}


@router.delete("/cash-flow/{entry_id}")
async def remove_cash_flow(entry_id: str):
    delete_cash_flow(entry_id)
    return {"success": True}


# ── Money Out endpoints ────────────────────────────────────────────────────────

@router.get("/money-out")
async def get_money_out():
    return {"success": True, "entries": load_money_out()}


@router.post("/money-out")
async def add_money_out(body: dict = Body(...)):
    entry = save_money_out(body)
    audit("money_out.added", "money_out", entry["id"],
          f"cat:{entry['category']} amount:{entry['amount']}")
    return {"success": True, "entry": entry}


@router.put("/money-out/{entry_id}")
async def update_money_out(entry_id: str, body: dict = Body(...)):
    body["id"] = entry_id
    return {"success": True, "entry": save_money_out(body)}


@router.delete("/money-out/{entry_id}")
async def remove_money_out(entry_id: str):
    delete_money_out(entry_id)
    return {"success": True}
