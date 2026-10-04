# CredX API

* Base URL: `/api/v1` (the Next.js app proxies it same-origin; the FastAPI server also serves it directly).
* Interactive docs: `http://localhost:8000/docs` (Swagger) and `/redoc`. Machine-readable: [`openapi.json`](openapi.json).
* Auth: `Authorization: Bearer <JWT>` from `POST /auth/login`. Roles (lowest → highest):
  `viewer` (read) · `analyst` (create cases, upload, notes, run analysis, request overrides) ·
  `credit_manager` (decisions, approve overrides, resolve escalations, audit log) · `admin` (users).
* Every error uses one envelope, with the request id echoed in the `X-Request-ID` header:

```json
{ "error": { "code": "validation_failed", "message": "Request validation failed",
             "details": [{ "loc": "body.company.gstin", "msg": "Invalid GSTIN (format or checksum)" }],
             "request_id": "6c0e…" } }
```

* Long-running work returns `202` with a **Job**; poll `GET /jobs/{id}` (`status`, `progress`, `stage`,
  `message`, `steps[]`, `result`, `error`).

## Quick tour

```bash
API=http://localhost:8000/api/v1
TOKEN=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"analyst@credx.demo","password":"CredX@2026"}' | jq -r .access_token)
H="Authorization: Bearer $TOKEN"

# 1. open a case (company created inline; GSTIN/PAN/CIN validated)
CASE=$(curl -s -X POST $API/cases -H "$H" -H 'Content-Type: application/json' -d '{
  "requested_amount": 250000000, "facility_type": "Cash Credit", "tenure_months": 12,
  "collateral_value": 180000000,
  "company": {"name": "Nebula Components Private Limited", "sector": "auto_components"}}' | jq -r .id)

# 2. upload the document pack and let analysis start automatically
curl -s -X POST $API/cases/$CASE/documents -H "$H" -F auto_analyze=true \
  $(for f in demo/documents/nebula/*.pdf; do printf -- '-F files=@%s ' "$f"; done)

# 3. watch the jobs, then read the explainable decision and download the CAM
curl -s "$API/jobs?case_id=$CASE" -H "$H" | jq '.[] | {kind, status, progress, stage}'
curl -s $API/cases/$CASE/score -H "$H" | jq '{credit_score, decision, rating, top_risk_factors}'
CAM=$(curl -s $API/cases/$CASE/cam -H "$H" | jq -r .id)
curl -s -o cam.pdf "$API/cam/$CAM/download?format=pdf" -H "$H"
```

## Example payloads

`GET /cases/{id}/score` (abridged):

```json
{
  "credit_score": 709, "model_score": 730, "rating": "CX4", "risk_level": "MEDIUM",
  "decision": "APPROVE_WITH_CONDITIONS", "probability_of_default": 0.0238, "approval_probability": 0.82,
  "recommended_amount": 128000000, "suggested_rate": 12.0,
  "base_points": 657,
  "contributions": [{ "feature": "receivable_days", "label": "Receivable days", "display_value": "161 days", "points": -14 }],
  "overlays": [{ "source": "analyst_note", "label": "Delayed stock statements…", "points": -8, "rationale": "Delayed stock statements (-8 pts)" }],
  "policy": { "deviations": [{ "id": "DV-07", "name": "Collateral coverage", "threshold": ">= 1.0x", "actual": 0.8 }] },
  "loan_sizing": { "binding_constraint": "Security cover", "methods": ["…"] },
  "pricing": { "components": [{ "component": "Credit risk premium (CX4)", "bps": 200 }] },
  "top_risk_factors": ["Collateral coverage 0.80x (-8 pts)", "…"],
  "what_if": [{ "label": "Receivable days", "current": "161 days", "target": "60 days", "score_gain": 11 }]
}
```

Document extraction (`GET /documents/{id}` → `extracted.headline`):

```json
{ "company_name": "ABC Textiles Pvt Ltd", "revenue": 12000000, "debt": 5000000,
  "gst_number": "29ABCDE1234F1Z5", "financial_health": "MODERATE" }
```

## Endpoints

### Auth

| Method | Path | Summary |
|---|---|---|
| `POST` | `/api/v1/auth/login` | Login |
| `POST` | `/api/v1/auth/register` | Register |
| `GET` | `/api/v1/auth/me` | Me |
| `GET` | `/api/v1/users` | List Users |
| `POST` | `/api/v1/users` | Create User |
| `PATCH` | `/api/v1/users/{user_id}` | Update User |

### Cases

| Method | Path | Summary |
|---|---|---|
| `GET` | `/api/v1/companies` | List Companies |
| `POST` | `/api/v1/companies` | Create Company |
| `PATCH` | `/api/v1/companies/{company_id}` | Update Company |
| `GET` | `/api/v1/cases` | List Cases |
| `POST` | `/api/v1/cases` | Create Case |
| `GET` | `/api/v1/cases/{case_id}` | Get Case |
| `PATCH` | `/api/v1/cases/{case_id}` | Update Case |
| `GET` | `/api/v1/cases/{case_id}/overview` | Case Overview |
| `POST` | `/api/v1/cases/{case_id}/analyze` | Analyze Case |
| `POST` | `/api/v1/cases/{case_id}/score` | Rescore Case |
| `POST` | `/api/v1/cases/{case_id}/research` | Research Case |
| `POST` | `/api/v1/cases/{case_id}/fraud` | Fraud Case |
| `POST` | `/api/v1/cases/{case_id}/decision` | Record Decision |
| `GET` | `/api/v1/cases/{case_id}/timeline` | Case Timeline |
| `GET` | `/api/v1/meta/sectors` | Sectors |

### Documents

| Method | Path | Summary |
|---|---|---|
| `POST` | `/api/v1/cases/{case_id}/documents` | Upload Documents |
| `GET` | `/api/v1/cases/{case_id}/documents` | List Documents |
| `GET` | `/api/v1/documents/{document_id}` | Get Document |
| `GET` | `/api/v1/documents/{document_id}/file` | Download Document |
| `POST` | `/api/v1/documents/{document_id}/reprocess` | Reprocess Document |
| `GET` | `/api/v1/cases/{case_id}/financials` | Get Financials |
| `PUT` | `/api/v1/cases/{case_id}/financials/{fiscal_year}` | Update Financials |

### Intelligence

| Method | Path | Summary |
|---|---|---|
| `GET` | `/api/v1/cases/{case_id}/score` | Get Score |
| `GET` | `/api/v1/cases/{case_id}/research` | Get Research |
| `GET` | `/api/v1/cases/{case_id}/fraud` | Get Fraud |
| `PATCH` | `/api/v1/fraud/alerts/{alert_id}` | Update Alert |
| `GET` | `/api/v1/cases/{case_id}/fraud/cypher` | Export Cypher |
| `GET` | `/api/v1/cases/{case_id}/scores` | Score History |
| `GET` | `/api/v1/model/info` | Model Info |
| `GET` | `/api/v1/cases/{case_id}/cam` | Get Cam |
| `POST` | `/api/v1/cases/{case_id}/cam` | Generate Cam Job |
| `PUT` | `/api/v1/cases/{case_id}/cam/comments` | Save Cam Comments |
| `GET` | `/api/v1/cam/{cam_id}/download` | Download Cam |

### Workflow

| Method | Path | Summary |
|---|---|---|
| `GET` | `/api/v1/cases/{case_id}/notes` | List Notes |
| `POST` | `/api/v1/cases/{case_id}/notes` | Create Note |
| `POST` | `/api/v1/notes/preview-impact` | Preview Impact |
| `PATCH` | `/api/v1/notes/{note_id}` | Update Note |
| `DELETE` | `/api/v1/notes/{note_id}` | Delete Note |
| `GET` | `/api/v1/cases/{case_id}/overrides` | List Overrides |
| `POST` | `/api/v1/cases/{case_id}/overrides` | Request Override |
| `POST` | `/api/v1/overrides/{override_id}/review` | Review Override |
| `GET` | `/api/v1/cases/{case_id}/escalations` | List Escalations |
| `POST` | `/api/v1/cases/{case_id}/escalations` | Escalate |
| `POST` | `/api/v1/escalations/{escalation_id}/resolve` | Resolve |

### Platform

| Method | Path | Summary |
|---|---|---|
| `POST` | `/api/v1/copilot/chat` | Chat |
| `GET` | `/api/v1/copilot/history` | Chat History |
| `GET` | `/api/v1/copilot/providers` | Providers |
| `GET` | `/api/v1/jobs` | List Jobs |
| `GET` | `/api/v1/jobs/{job_id}` | Get Job |
| `GET` | `/api/v1/audit` | Audit Log |
| `GET` | `/api/v1/cases/{case_id}/audit` | Case Audit |
| `GET` | `/api/v1/dashboard/summary` | Dashboard |

### Health

| Method | Path | Summary |
|---|---|---|
| `GET` | `/health` | Health |
| `GET` | `/health/ready` | Ready |
| `GET` | `/metrics` | Metrics |

Health & observability (unauthenticated): `GET /health`, `GET /health/ready`, `GET /metrics` (Prometheus).
