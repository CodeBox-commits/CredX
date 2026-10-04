from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.database.base import Base
from app.schemas.cases import CaseSyncRequest
from app.schemas.platform import CamPreviewResponse, CreditDecisionResponse
from app.schemas.uploads import StructuredExtraction, UploadedFileMeta
from app.services.case_store import sync_case, transition_case_status


def test_case_sync_persists_underwriting_snapshot_and_audit_history() -> None:
    engine = create_engine("sqlite:///:memory:", future=True)
    Base.metadata.create_all(engine)
    session = Session(engine, future=True)

    try:
        response = sync_case(
            session,
            CaseSyncRequest(
                company_name="Northwind Industries",
                cin="U74999MH2020PTC123456",
                sector="Manufacturing",
                requested_amount_cr=40.0,
                due_diligence_note="Strong collections and improving order book.",
                documents=[
                    UploadedFileMeta(
                        document_id="doc-1",
                        company_id=None,
                        document_type="annual-report",
                        original_filename="annual.pdf",
                        stored_filename="annual.pdf",
                        storage_path="/tmp/annual.pdf",
                        content_type="application/pdf",
                        size_bytes=1024,
                        uploaded_at="2026-01-01T00:00:00Z",
                    )
                ],
                analysis_bundle={
                    "extracted": StructuredExtraction(
                        company_name="Northwind Industries",
                        revenue=120_000_000.0,
                        ebitda=15_000_000.0,
                        debt=24_000_000.0,
                        current_assets=28_000_000.0,
                        current_liabilities=10_000_000.0,
                        net_profit=9_000_000.0,
                        financial_health="STRONG",
                        confidence_score=0.88,
                    ),
                    "research": None,
                    "fraud": None,
                    "decision": CreditDecisionResponse(
                        credit_score=812,
                        risk_level="LOW",
                        approval_probability=0.86,
                        recommended_loan_amount=35.0,
                        suggested_interest_rate=9.2,
                        decision="APPROVE",
                        top_risk_factors=["Leverage profile"],
                        factors=[],
                        five_cs={"character": 82.0, "capacity": 81.0, "capital": 78.0, "collateral": 74.0, "conditions": 84.0},
                        pricing_rationale="Strong margins and healthy liquidity support pricing.",
                    ),
                    "cam": CamPreviewResponse(sections=[], export_formats=["pdf"], summary="CAM ready"),
                    "documents": [],
                    "synced_at": "2026-01-01T00:00:00Z",
                },
            ),
        )

        assert response.case.credit_score == 812
        assert response.case.recommended_loan_amount_cr == 35.0
        assert response.case.analysis_status == "scoring_complete"
        assert response.case.status == "draft"
        assert response.case.audit_history
    finally:
        session.close()


def test_case_status_transition_records_audit_entry() -> None:
    engine = create_engine("sqlite:///:memory:", future=True)
    Base.metadata.create_all(engine)
    session = Session(engine, future=True)

    try:
        response = sync_case(
            session,
            CaseSyncRequest(
                company_name="Southwind Labs",
                sector="Tech",
                documents=[],
            ),
        )
        updated = transition_case_status(
            session,
            response.case.case_id,
            "analyst_review",
            actor="analyst",
            details="Analyst reviewed underwriting recommendation.",
        )

        assert updated.status == "analyst_review"
        assert updated.analysis_status == "analyst_review"
        assert updated.audit_history
        assert updated.audit_history[0].action == "status_transition"
    finally:
        session.close()
