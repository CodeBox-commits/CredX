"""End-to-end API tests: auth & RBAC, case lifecycle, upload -> ingest -> analyze -> CAM, workflow, copilot."""

import pytest

PASSWORD = "Sup3r-secret!"


@pytest.fixture(scope="module")
def tokens(app_client):
    admin = app_client.post("/api/v1/auth/register", json={"email": "admin@test.dev", "password": PASSWORD, "full_name": "Admin User"})
    assert admin.status_code == 201, admin.text
    assert admin.json()["user"]["role"] == "admin"  # first account bootstraps as admin
    h = {"Authorization": f"Bearer {admin.json()['access_token']}"}
    out = {"admin": h}
    for role in ("credit_manager", "analyst", "viewer"):
        r = app_client.post("/api/v1/users", headers=h, json={"email": f"{role}@test.dev", "password": PASSWORD, "full_name": role.title(), "role": role})
        assert r.status_code == 201, r.text
        login = app_client.post("/api/v1/auth/login", json={"email": f"{role}@test.dev", "password": PASSWORD})
        out[role] = {"Authorization": f"Bearer {login.json()['access_token']}"}
    return out


def test_health(app_client):
    assert app_client.get("/health").json()["status"] == "ok"
    ready = app_client.get("/health/ready").json()
    assert ready["database"] == "ok" and ready["job_backend"] == "inline"
    assert b"credx_http_requests_total" in app_client.get("/metrics").content


def test_auth_errors_use_envelope(app_client, tokens):
    r = app_client.get("/api/v1/cases")
    assert r.status_code == 401 and r.json()["error"]["code"] == "unauthorized"
    r = app_client.post("/api/v1/auth/login", json={"email": "admin@test.dev", "password": "wrong-pass"})
    assert r.status_code == 401 and r.json()["error"]["code"] == "invalid_credentials"
    assert app_client.get("/api/v1/auth/me", headers=tokens["viewer"]).json()["role"] == "viewer"


def test_viewer_cannot_create_case(app_client, tokens):
    r = app_client.post("/api/v1/cases", headers=tokens["viewer"], json={"requested_amount": 1e7, "company": {"name": "Some Co Pvt Ltd"}})
    assert r.status_code == 403


def test_company_validation(app_client, tokens):
    r = app_client.post("/api/v1/companies", headers=tokens["analyst"], json={"name": "Bad GST Co", "gstin": "27AAGCN2290H1Z0"})
    assert r.status_code == 422 and "GSTIN" in r.text


@pytest.fixture(scope="module")
def analysed_case(app_client, tokens, demo_pack_dir):
    h = tokens["analyst"]
    case = app_client.post("/api/v1/cases", headers=h, json={
        "requested_amount": 25e7, "facility_type": "Cash Credit", "tenure_months": 12, "collateral_value": 18e7,
        "company": {"name": "Nebula Components Private Limited", "sector": "auto_components", "incorporation_year": 2011,
                    "promoters": [{"name": "Rakesh Malhotra", "din": "03344556"}]},
    })
    assert case.status_code == 201, case.text
    case_id = case.json()["id"]
    folder = demo_pack_dir / "nebula"
    files = [("files", (p.name, p.read_bytes(), "application/pdf")) for p in sorted(folder.glob("*.pdf"))]
    files.append(("files", ("evil.exe", b"MZ", "application/octet-stream")))
    up = app_client.post(f"/api/v1/cases/{case_id}/documents", headers=h, files=files)
    assert up.status_code == 202, up.text
    body = up.json()
    assert len(body["documents"]) == len(files) - 1 and body["rejected"][0]["filename"] == "evil.exe"
    assert all(j["status"] == "queued" for j in body["jobs"])  # response snapshot; inline jobs finish right after
    dup = app_client.post(f"/api/v1/cases/{case_id}/documents", headers=h, files=files[:1])
    assert "Duplicate" in dup.json()["rejected"][0]["reason"]
    job = app_client.post(f"/api/v1/cases/{case_id}/analyze", headers=h).json()
    final = app_client.get(f"/api/v1/jobs/{job['id']}", headers=h).json()
    assert final["status"] == "succeeded", final
    assert [s["status"] for s in final["steps"]] == ["done"] * 4
    return case_id


def test_documents_processed(app_client, tokens, analysed_case):
    docs = app_client.get(f"/api/v1/cases/{analysed_case}/documents", headers=tokens["viewer"]).json()
    assert {d["status"] for d in docs} == {"processed"}
    types = {d["doc_type"] for d in docs}
    assert {"gst_return", "bank_statement", "legal_notice", "mca_filing", "shareholding_pattern"} <= types
    detail = app_client.get(f"/api/v1/documents/{docs[0]['id']}", headers=tokens["viewer"]).json()
    assert "headline" in detail["extracted"]


def test_financials_and_manual_edit(app_client, tokens, analysed_case):
    fin = app_client.get(f"/api/v1/cases/{analysed_case}/financials", headers=tokens["analyst"]).json()
    fy25 = next(s for s in fin["statements"] if s["fiscal_year"] == "FY25")
    assert fy25["values"]["revenue"] == pytest.approx(186e7)
    assert fy25["provenance"]["revenue"]["filename"] == "annual_report_FY25.pdf"
    r = app_client.put(f"/api/v1/cases/{analysed_case}/financials/FY25", headers=tokens["analyst"],
                       json={"values": {"cash": 1.5e7}, "reason": "Per bank confirmation"})
    assert r.status_code == 200 and r.json()["values"]["cash"] == 1.5e7


def test_score_research_fraud_cam(app_client, tokens, analysed_case):
    h = tokens["viewer"]
    score = app_client.get(f"/api/v1/cases/{analysed_case}/score", headers=h).json()
    assert score["decision"] == "DECLINE"
    assert score["base_points"] + sum(c["points"] for c in score["contributions"]) == score["model_score"]
    research = app_client.get(f"/api/v1/cases/{analysed_case}/research", headers=h).json()
    assert research["litigation_risk"] in ("MEDIUM", "HIGH")
    fraud = app_client.get(f"/api/v1/cases/{analysed_case}/fraud", headers=h).json()
    assert any(c["check"] == "GSTR-2A/2B vs GSTR-3B" for c in fraud["gst_checks"])
    cam = app_client.get(f"/api/v1/cases/{analysed_case}/cam", headers=h).json()
    assert cam["version"] == 1 and len(cam["sections"]) >= 12
    pdf = app_client.get(f"/api/v1/cam/{cam['id']}/download?format=pdf", headers=h)
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")
    docx = app_client.get(f"/api/v1/cam/{cam['id']}/download?format=docx", headers=h)
    assert docx.content[:2] == b"PK"


def test_notes_influence_rescoring_and_cam(app_client, tokens, analysed_case):
    h = tokens["analyst"]
    before = app_client.get(f"/api/v1/cases/{analysed_case}/score", headers=h).json()
    preview = app_client.post("/api/v1/notes/preview-impact", headers=h, json={"body": "Factory operating at 40% capacity."}).json()
    assert preview["points"] < 0
    note = app_client.post(f"/api/v1/cases/{analysed_case}/notes", headers=h,
                           json={"body": "Factory operating at 40% capacity.", "category": "site_visit"})
    assert note.status_code == 201 and note.json()["preview_impact"] < 0
    app_client.post(f"/api/v1/cases/{analysed_case}/score", headers=h)
    after = app_client.get(f"/api/v1/cases/{analysed_case}/score", headers=h).json()
    assert after["version"] == before["version"] + 1
    assert any(o["source"] == "analyst_note" for o in after["overlays"])
    r = app_client.put(f"/api/v1/cases/{analysed_case}/cam/comments", headers=h,
                       json={"comments": {"fraud": "Refer to FRMU before any re-submission."}, "regenerate": True})
    assert r.status_code == 200
    cam = app_client.get(f"/api/v1/cases/{analysed_case}/cam", headers=h).json()
    assert cam["version"] == 2 and cam["analyst_comments"]["fraud"].startswith("Refer to FRMU")
    assert any("40% capacity" in b for s in cam["sections"] if s["id"] == "analyst_observations" for b in s["content"]["bullets"])


def test_maker_checker_override(app_client, tokens, analysed_case):
    ov = app_client.post(f"/api/v1/cases/{analysed_case}/overrides", headers=tokens["analyst"],
                         json={"field": "decision", "new_value": "REFER", "reason": "Promoter offered additional collateral"})
    assert ov.status_code == 201
    assert app_client.post(f"/api/v1/overrides/{ov.json()['id']}/review", headers=tokens["analyst"], json={"approve": True}).status_code == 403
    r = app_client.post(f"/api/v1/overrides/{ov.json()['id']}/review", headers=tokens["credit_manager"], json={"approve": True, "comment": "OK"})
    assert r.json()["status"] == "approved"
    case = app_client.get(f"/api/v1/cases/{analysed_case}", headers=tokens["viewer"]).json()
    assert case["final_decision"] == "REFER" and case["status"] == "escalated"


def test_escalation_flow(app_client, tokens, analysed_case):
    esc = app_client.post(f"/api/v1/cases/{analysed_case}/escalations", headers=tokens["analyst"],
                          json={"reason": "Fraud indicators need FRMU review"}).json()
    res = app_client.post(f"/api/v1/escalations/{esc['id']}/resolve", headers=tokens["credit_manager"], json={"resolution": "Reviewed"})
    assert res.json()["status"] == "resolved"


def test_copilot_grounded_answer(app_client, tokens, analysed_case):
    r = app_client.post("/api/v1/copilot/chat", headers=tokens["analyst"], json={"case_id": analysed_case, "message": "Why was this declined?"})
    body = r.json()
    assert r.status_code == 200 and body["provider"] == "local" and "DECLINE" in body["answer"]
    fraud = app_client.post("/api/v1/copilot/chat", headers=tokens["analyst"], json={"case_id": analysed_case, "message": "Any circular trading?"}).json()
    assert "Fraud score" in fraud["answer"]
    history = app_client.get(f"/api/v1/copilot/history?case_id={analysed_case}", headers=tokens["analyst"]).json()
    assert len(history) == 4


def test_audit_trail_and_dashboard(app_client, tokens, analysed_case):
    assert app_client.get("/api/v1/audit", headers=tokens["analyst"]).status_code == 403
    actions = {a["action"] for a in app_client.get(f"/api/v1/audit?case_id={analysed_case}", headers=tokens["credit_manager"]).json()}
    assert {"case.create", "document.upload", "note.note", "override.review"} <= actions
    dash = app_client.get("/api/v1/dashboard/summary", headers=tokens["viewer"]).json()
    assert dash["totals"]["cases"] >= 1 and dash["by_risk"]
    timeline = app_client.get(f"/api/v1/cases/{analysed_case}/timeline", headers=tokens["viewer"]).json()
    assert {e["type"] for e in timeline} >= {"audit", "note", "job"}


def test_identifier_conflict_does_not_break_ingestion(app_client, tokens, analysed_case, demo_pack_dir):
    """A second borrower whose documents carry a CIN already owned by another company: the document
    still processes, the CIN is not overwritten, and the conflict is surfaced as a warning."""
    h = tokens["analyst"]
    case = app_client.post("/api/v1/cases", headers=h, json={"requested_amount": 1e7, "company": {"name": "Lookalike Components Pvt Ltd"}}).json()
    mca = demo_pack_dir / "nebula" / "mca_mgt7_extract.pdf"
    app_client.post(f"/api/v1/cases/{case['id']}/documents", headers=h, files=[("files", (mca.name, mca.read_bytes(), "application/pdf"))],
                    data={"auto_analyze": "true"})
    doc = app_client.get(f"/api/v1/cases/{case['id']}/documents", headers=h).json()[0]
    assert doc["status"] == "processed"
    detail = app_client.get(f"/api/v1/documents/{doc['id']}", headers=h).json()
    assert any("already registered" in w for w in detail["extracted"]["warnings"])
    assert app_client.get(f"/api/v1/cases/{case['id']}", headers=h).json()["company"]["cin"] is None
    jobs = app_client.get(f"/api/v1/jobs?case_id={case['id']}", headers=h).json()
    assert any(j["kind"] == "full_analysis" for j in jobs)  # auto-analysis still triggered
