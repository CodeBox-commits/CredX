"""Merge per-document extractions into one case-level fact base.

Financial fields resolve by confidence (ties: the earlier document wins); every fact keeps the
document it came from so the UI, copilot and CAM can cite it.
"""

from __future__ import annotations

from typing import Any

_SEVERITY = {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 3}


def merge_case_facts(documents: list[dict[str, Any]]) -> dict[str, Any]:
    """``documents``: [{id, filename, doc_type, extracted}] in upload order."""
    facts: dict[str, Any] = {
        "documents": [], "financials": {}, "gst": [], "bank": [], "legal": [], "sanctions": [], "shareholding": None,
        "mca": None, "directors": [], "red_flags": [], "positive_signals": [], "gstins": [], "cins": [], "company_names": [],
    }
    flags: dict[str, dict[str, Any]] = {}
    directors: dict[str, dict[str, Any]] = {}
    for doc in documents:
        ext = doc.get("extracted") or {}
        source = {"document_id": doc["id"], "filename": doc["filename"]}
        facts["documents"].append({"id": doc["id"], "filename": doc["filename"], "doc_type": doc.get("doc_type"),
                                   "confidence": (ext.get("confidence") or {}).get("overall", 0)})
        for fy, fields in (ext.get("financials") or {}).items():
            year = facts["financials"].setdefault(fy, {})
            for name, info in fields.items():
                if name not in year or info["confidence"] > year[name]["confidence"]:
                    year[name] = {**info, **source}
        if ext.get("gst"):
            facts["gst"].append({**ext["gst"], **source})
        if ext.get("bank"):
            facts["bank"].append({**ext["bank"], **source})
        if ext.get("legal"):
            facts["legal"].append({**ext["legal"], **source})
        if ext.get("sanction"):
            facts["sanctions"].append({**ext["sanction"], **source})
        if (sh := ext.get("shareholding")) and (facts["shareholding"] is None or doc.get("doc_type") == "shareholding_pattern"):
            facts["shareholding"] = {**sh, **source}
        if ext.get("mca"):
            facts["mca"] = {**(facts["mca"] or {}), **ext["mca"], **source}
        for d in ext.get("directors") or []:
            directors.setdefault(d.get("din") or d["name"].lower(), d)
        for flag in ext.get("red_flags") or []:
            current = flags.get(flag["label"])
            if current is None or _SEVERITY.get(flag["severity"], 0) > _SEVERITY.get(current["severity"], 0):
                flags[flag["label"]] = {**flag, **source}
        for signal in ext.get("positive_signals") or []:
            if signal not in facts["positive_signals"]:
                facts["positive_signals"].append(signal)
        ids = ext.get("identifiers") or {}
        facts["gstins"] = list(dict.fromkeys([*facts["gstins"], *(ids.get("gstins") or [])]))
        facts["cins"] = list(dict.fromkeys([*facts["cins"], *(ids.get("cins") or [])]))
        if ext.get("company_name") and ext["company_name"] not in facts["company_names"]:
            facts["company_names"].append(ext["company_name"])
    facts["financials"] = dict(sorted(facts["financials"].items(), reverse=True))
    facts["directors"] = list(directors.values())
    facts["red_flags"] = sorted(flags.values(), key=lambda f: -_SEVERITY.get(f["severity"], 0))
    return facts
