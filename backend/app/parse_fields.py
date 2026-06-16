import re
from typing import Dict, Any


def _first_match(pattern, text, flags=0):
    m = re.search(pattern, text, flags)
    if not m:
        return None
    if m.lastindex is None:
        return m.group(0).strip()
    return m.group(1).strip()


def parse_fields(text: str) -> Dict[str, Any]:
    t = text or ""
    lines = [line.strip() for line in t.splitlines() if line.strip()]
    fields: Dict[str, Any] = {}
    address_lines = []
    collecting_address = False

    for line in lines:
        low = line.lower()

        if not fields.get("totalFloors"):
            floors = _first_match(r"^\s*total\s+floors?\s*[:\-]\s*([0-9]+)\b", line, re.I)
            if floors:
                fields["totalFloors"] = int(floors)
                continue

        if not fields.get("approvalNumber"):
            approval = _first_match(r"^\s*(?:ba|approval)(?:\s*(?:no\.?|number))?\s*[:\-]\s*(.+)$", line, re.I)
            if approval:
                fields["approvalNumber"] = approval
                continue

        if not fields.get("projectName"):
            project = _first_match(r"^\s*project(?:\s+name)?\s*[:\-]\s*(.+)$", line, re.I)
            if project:
                fields["projectName"] = project
                continue

        if not fields.get("ownerName"):
            owner = _first_match(r"^\s*owner(?:\s+name)?\s*[:\-]\s*(.+)$", line, re.I)
            if owner:
                fields["ownerName"] = owner
                continue

        if not fields.get("builderName"):
            builder = _first_match(r"^\s*(?:builder|contractor)(?:\s+name)?\s*[:\-]\s*(.+)$", line, re.I)
            if builder:
                fields["builderName"] = builder
                continue

        if not fields.get("locality"):
            locality = _first_match(r"^\s*(?:locality|colony)\s*[:\-]\s*(.+)$", line, re.I)
            if locality:
                fields["locality"] = locality
                continue

        if not fields.get("city"):
            city = _first_match(r"^\s*city\s*[:\-]\s*(.+)$", line, re.I)
            if city:
                fields["city"] = city
                continue

        if collecting_address:
            if re.match(r"^\s*(?:ba|approval|project|owner|builder|contractor|facing|road(?:\s+width)?|plot(?:\s+dimensions)?|locality|city|floor|config|colony)\b", low):
                collecting_address = False
            else:
                address_lines.append(line)
                continue

        if not fields.get("siteAddress") and re.match(r"^\s*(?:address|site address)\s*[:\-]?", low):
            address = re.sub(r"^\s*(?:address|site address)\s*[:\-]?\s*", "", line, flags=re.I).strip()
            if address:
                address_lines.append(address)
            collecting_address = True
            continue

        if not fields.get("plotLength"):
            plot_len = _first_match(r"^\s*plot\s+length\s*[:\-]\s*([0-9]+(?:\.[0-9]+)?)\b", line, re.I)
            if plot_len:
                fields["plotLength"] = plot_len
                continue

        if not fields.get("plotWidth"):
            plot_wid = _first_match(r"^\s*plot\s+width\s*[:\-]\s*([0-9]+(?:\.[0-9]+)?)\b", line, re.I)
            if plot_wid:
                fields["plotWidth"] = plot_wid
                continue

        if (not fields.get("plotLength") or not fields.get("plotWidth")) and "x" in line.lower():
            dims = re.search(r"([0-9]+(?:\.[0-9]+)?)\s*[x×]\s*([0-9]+(?:\.[0-9]+)?)", line, re.I)
            if dims:
                fields["plotLength"] = dims.group(1)
                fields["plotWidth"] = dims.group(2)
                continue

        if not fields.get("facing"):
            facing = _first_match(r"^\s*(?:facing|direction)\s*[:\-]\s*(north(?:east|west)?|south(?:east|west)?|east|west|ne|nw|se|sw|n|s|e|w)\b", line, re.I)
            if facing:
                fields["facing"] = facing
                continue

        if not fields.get("roadWidth"):
            road = _first_match(r"^\s*road\s*width\s*[:\-]\s*([0-9]+(?:\.[0-9]+)?)\b", line, re.I)
            if road:
                fields["roadWidth"] = road
                continue

        if not fields.get("floorConfig"):
            floor = _first_match(r"^\s*(?:floor\s*config(?:uration)?|building\s*config)\s*[:\-]\s*(.+)$", line, re.I)
            if floor:
                fields["floorConfig"] = floor
                fields["hasStilt"] = bool(re.search(r"stilt", line, re.I))
                continue

            floor_match = re.match(r"^\s*([GS]?\+?\d+[A-Z]*.*?)\b", line, re.I)
            if floor_match and "config" in " ".join(lines[:lines.index(line)+1]).lower():
                fields["floorConfig"] = floor_match.group(1).strip()
                fields["hasStilt"] = bool(re.search(r"stilt", line, re.I))
                continue

    if address_lines:
        addr = ", ".join(address_lines)
        fields["siteAddress"] = addr
        if not fields.get("city"):
            segs = [s.strip() for s in addr.split(",") if s.strip()]
            if segs:
                fields["city"] = segs[-1]

    return fields
