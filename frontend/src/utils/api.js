// ── Auth headers helper ─────────────────────────────────────────────────────
// Several API calls use authHeaders(), but it was missing. In the browser this
// causes ReferenceError: authHeaders is not defined and can stop stage/config API calls.
export function authHeaders() {
    const token = localStorage.getItem('nirmaniq_token');
    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
}

export async function getProject() {
    const response = await fetch('/api/project');

    if (response.status === 404) {
        return null;
    }

    if (!response.ok) {
        const errorInfo = await response.json().catch(() => null);
        throw new Error(errorInfo?.detail || `API error ${response.status}`);
    }

    const data = await response.json();
    return data.project || null;
}

export async function saveProject(project) {
    const response = await fetch('/api/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(project),
    });

    if (!response.ok) {
        const errorInfo = await response.json().catch(() => null);
        throw new Error(errorInfo?.detail || `API error ${response.status}`);
    }

    const data = await response.json();
    return data.project;
}

export async function getStorage(key, defaultValue = null) {
    const response = await fetch(`/api/storage/${encodeURIComponent(key)}`);
    if (!response.ok) {
        const errorInfo = await response.json().catch(() => null);
        if (response.status === 404) {
            return defaultValue;
        }
        throw new Error(errorInfo?.detail || `API error ${response.status}`);
    }
    const data = await response.json();
    return data?.value ?? defaultValue;
}

export async function setStorage(key, value) {
    const response = await fetch(`/api/storage/${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
    });
    if (!response.ok) {
        const errorInfo = await response.json().catch(() => null);
        throw new Error(errorInfo?.detail || `API error ${response.status}`);
    }
    const data = await response.json();
    return data?.value;
}

/**
 * Call the local backend AI endpoint to get stage-specific material estimates.
 * Falls back gracefully if backend is unavailable.
 */
export async function getAIStageMaterials(stageId, stageLabel, project, localItems = []) {
    try {
        const response = await fetch('/api/ai-stage-materials', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stageId, stageLabel, project, localItems }),
        });
        if (!response.ok) {
            const err = await response.json().catch(() => null);
            throw new Error(err?.detail || `API error ${response.status}`);
        }
        return await response.json();
    } catch (e) {
        throw new Error(e.message || 'AI service unavailable');
    }
}

// ── Direct payment persistence (guaranteed save to payments table) ────────────
export async function addPaymentApi(pay) {
    const r = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pay),
    });
    if (!r.ok) throw new Error(`Payment save failed ${r.status}`);
    return await r.json();
}

export async function updatePaymentApi(pay) {
    const r = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pay),
    });
    if (!r.ok) throw new Error(`Payment update failed ${r.status}`);
    return await r.json();
}

export async function deletePaymentApi(payId) {
    const r = await fetch(`/api/payments/${payId}`, { method: 'DELETE' });
    if (!r.ok) throw new Error(`Payment delete failed ${r.status}`);
}

/**
 * Send uploaded project documents to Claude vision for analysis.
 * Returns extracted project fields, a complete material schedule,
 * and a whole-project cost estimate.
 * @param {object} docs  — map of docId → {name, type, data (base64 dataURL)}
 */
export async function analyzeDocuments(docs) {
    const response = await fetch('/api/analyze-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docs }),
    });
    if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.detail || `API error ${response.status}`);
    }
    return await response.json();
}

// ── Quality Issues ────────────────────────────────────────────────────────────
export async function fetchIssues(stageId = null) {
    const url = stageId ? `/api/issues?stage_id=${stageId}` : '/api/issues';
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Issues fetch error ${r.status}`);
    return (await r.json()).issues || [];
}

export async function createIssue(issue) {
    const r = await fetch('/api/issues', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify(issue),
    });
    if (!r.ok) throw new Error(`Create issue error ${r.status}`);
    return (await r.json()).issue;
}

export async function updateIssue(id, issue) {
    const r = await fetch(`/api/issues/${id}`, {
        method: 'PUT', headers: {'Content-Type':'application/json'},
        body: JSON.stringify(issue),
    });
    if (!r.ok) throw new Error(`Update issue error ${r.status}`);
    return (await r.json()).issue;
}

export async function deleteIssueApi(id) {
    await fetch(`/api/issues/${id}`, { method: 'DELETE' });
}

// ── AI Photo Review ───────────────────────────────────────────────────────────
export async function reviewPhoto(photoData, stageId, stageLabel, context = '') {
    const r = await fetch('/api/ai-photo-review', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ photoData, stageId, stageLabel, context }),
    });
    if (!r.ok) throw new Error(`Photo review error ${r.status}`);
    return await r.json();
}

// ── Budget Alerts ─────────────────────────────────────────────────────────────
export async function fetchBudgetAlerts() {
    const r = await fetch('/api/budget-alerts');
    if (!r.ok) return [];
    return (await r.json()).alerts || [];
}

export async function checkBudgetAlert(catId, pctUsed) {
    const r = await fetch('/api/budget-alerts/check', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ catId, pctUsed }),
    });
    if (!r.ok) return null;
    return (await r.json()).alert;
}

export async function ackAlert(alertId) {
    await fetch(`/api/budget-alerts/${alertId}/ack`, { method: 'POST' });
}

// ── Audit log ─────────────────────────────────────────────────────────────────
export async function logAudit(action, entityType = '', entityId = '', detail = '', stageId = '') {
    try {
        await fetch('/api/audit', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ action, entityType, entityId, detail, stageId }),
        });
    } catch { /* audit failures are silent */ }
}

export async function fetchAuditLog(limit = 100, stageId = null) {
    const url = stageId ? `/api/audit?limit=${limit}&stage_id=${stageId}` : `/api/audit?limit=${limit}`;
    const r = await fetch(url);
    if (!r.ok) return [];
    return (await r.json()).entries || [];
}

// ── Stage estimates (estimated vs actual) ─────────────────────────────────────
export async function loadStageEstimate(stageId) {
    const r = await fetch(`/api/stage-estimate/${stageId}`, { headers: authHeaders() });
    if (!r.ok) return null;
    return (await r.json()).estimate || null;
}

export async function saveStageEstimate(stageId, estimatedCost, items, source = 'local') {
    await fetch(`/api/stage-estimate/${stageId}`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ estimatedCost, items, source }),
    });
}

export async function loadMatActuals(stageId) {
    const r = await fetch(`/api/mat-actuals/${stageId}`, { headers: authHeaders() });
    if (!r.ok) return {};
    return (await r.json()).actuals || {};
}

export async function saveMatActual(stageId, itemId, data) {
    await fetch(`/api/mat-actuals/${stageId}/${itemId}`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(data),
    });
}

// ── Stage Master ──────────────────────────────────────────────────────────────
export async function fetchStageMaster() {
    try {
        const r = await fetch('/api/stages/master', { headers: authHeaders() });
        if (!r.ok) return [];
        return (await r.json()).stages || [];
    } catch { return []; }
}

export async function saveStageMasterItem(stage) {
    const r = await fetch('/api/stages/master', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(stage),
    });
    if (!r.ok) throw new Error(`Stage save failed ${r.status}`);
    return (await r.json()).stage;
}

export async function deleteStageMasterItem(stageId) {
    await fetch(`/api/stages/master/${stageId}`, { method: 'DELETE', headers: authHeaders() });
}

export async function reorderStageMaster(orderedIds) {
    await fetch('/api/stages/master/reorder', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ orderedIds }),
    });
}

// ── Config master (market rates, materials, team roles) ───────────────────────
export async function fetchMarketRates() {
    const r = await fetch('/api/config/market-rates', { headers: authHeaders() });
    if (!r.ok) return null;
    const data = await r.json();
    // Return as a dict keyed by id for easy lookup
    return Object.fromEntries((data.rates || []).map(rate => [rate.id, rate.value]));
}

export async function fetchMarketRatesFull() {
    const r = await fetch('/api/config/market-rates', { headers: authHeaders() });
    if (!r.ok) return [];
    return (await r.json()).rates || [];
}

export async function updateMarketRate(rateId, value) {
    await fetch(`/api/config/market-rates/${rateId}`, {
        method: 'PUT', headers: authHeaders(),
        body: JSON.stringify({ value }),
    });
}

export async function fetchMaterialMaster() {
    const r = await fetch('/api/config/materials', { headers: authHeaders() });
    if (!r.ok) return [];
    return (await r.json()).materials || [];
}

export async function fetchTeamRoles() {
    const r = await fetch('/api/config/team-roles', { headers: authHeaders() });
    if (!r.ok) return [];
    return (await r.json()).roles || [];
}
