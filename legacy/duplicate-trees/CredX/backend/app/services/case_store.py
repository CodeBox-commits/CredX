from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.exc import NoResultFound
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..models import (
    AnalystNote,
    CaseAnalysisSnapshot,
    CaseAuditEvent,
    CaseDocument,
    Company,
    UnderwritingCase,
    WorkflowJob,
)
from ..schemas.cases import (
    AnalystNoteCreateRequest,
    AnalystNoteResponse,
    AuditEventResponse,
    CaseDashboardSummaryResponse,
    CaseDetailResponse,
    CaseSummaryResponse,
    CaseSyncRequest,
    CaseSyncResponse,
    PlatformAnalysisBundleInput,
    WorkflowJobResponse,
)
from ..schemas.platform import (
    CamPreviewResponse,
    CreditDecisionResponse,
    FraudAnalysisResponse,
    ResearchIntelligenceResponse,
)
from ..schemas.uploads import ParseSummary, StructuredExtraction, UploadedFileMeta


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _serialize_datetime(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.astimezone(timezone.utc).isoformat()


def _serialize_job(job: WorkflowJob) -> WorkflowJobResponse:
    return WorkflowJobResponse(
        job_id=job.id,
        case_id=job.case_id,
        job_type=job.job_type,
        status=job.status,
        stage=job.stage,
        progress=job.progress,
        message=job.message,
        created_at=_serialize_datetime(job.created_at) or "",
        updated_at=_serialize_datetime(job.updated_at) or "",
        started_at=job.started_at,
        completed_at=job.completed_at,
    )


def _serialize_note(note: AnalystNote) -> AnalystNoteResponse:
    return AnalystNoteResponse(
        note_id=note.id,
        case_id=note.case_id,
        source=note.source,
        note=note.note,
        created_at=_serialize_datetime(note.created_at) or "",
    )


def _serialize_audit_event(event: CaseAuditEvent) -> AuditEventResponse:
    return AuditEventResponse(
        event_id=event.id,
        case_id=event.case_id,
        actor=event.actor,
        action=event.action,
        from_status=event.from_status,
        to_status=event.to_status,
        details=event.details,
        previous_score=event.previous_score,
        current_score=event.current_score,
        previous_recommendation=event.previous_recommendation,
        current_recommendation=event.current_recommendation,
        created_at=_serialize_datetime(event.created_at) or "",
    )


def _deserialize_document(document: CaseDocument) -> UploadedFileMeta:
    parse_summary = (
        ParseSummary.model_validate(document.parse_summary_json)
        if document.parse_summary_json
        else None
    )
    return UploadedFileMeta(
        document_id=document.remote_document_id,
        company_id=document.company_id,
        document_type=document.document_type,
        original_filename=document.original_filename,
        stored_filename=document.stored_filename,
        storage_path=document.storage_path,
        content_type=document.content_type,
        size_bytes=document.size_bytes,
        uploaded_at=document.uploaded_at,
        parse_summary=parse_summary,
    )


def _deserialize_bundle(
    snapshot: CaseAnalysisSnapshot | None,
    documents: list[UploadedFileMeta],
) -> PlatformAnalysisBundleInput | None:
    if snapshot is None:
        return None

    return PlatformAnalysisBundleInput(
        extracted=(
            StructuredExtraction.model_validate(snapshot.extracted_json)
            if snapshot.extracted_json
            else None
        ),
        research=(
            ResearchIntelligenceResponse.model_validate(snapshot.research_json)
            if snapshot.research_json
            else None
        ),
        fraud=(
            FraudAnalysisResponse.model_validate(snapshot.fraud_json)
            if snapshot.fraud_json
            else None
        ),
        decision=(
            CreditDecisionResponse.model_validate(snapshot.decision_json)
            if snapshot.decision_json
            else None
        ),
        cam=(
            CamPreviewResponse.model_validate(snapshot.cam_json)
            if snapshot.cam_json
            else None
        ),
        documents=documents,
        synced_at=snapshot.synced_at,
    )


def _serialize_case_summary(case: UnderwritingCase) -> CaseSummaryResponse:
    latest_job = case.jobs[0] if case.jobs else None
    return CaseSummaryResponse(
        case_id=case.id,
        company_id=case.company_id,
        company_name=case.company.name,
        cin=case.company.cin,
        sector=case.company.sector,
        facility_type=case.facility_type,
        requested_amount_cr=float(case.requested_amount_cr or 0),
        status=case.status,
        current_stage=case.current_stage,
        decision=case.latest_decision,
        risk_level=case.latest_risk_level,
        credit_score=case.credit_score,
        approval_probability=float(case.approval_probability) if case.approval_probability is not None else None,
        recommended_loan_amount_cr=float(case.recommended_loan_amount_cr) if case.recommended_loan_amount_cr is not None else None,
        suggested_interest_rate=float(case.suggested_interest_rate) if case.suggested_interest_rate is not None else None,
        risk_premium=float(case.risk_premium) if case.risk_premium is not None else None,
        confidence_score=float(case.confidence_score) if case.confidence_score is not None else None,
        decision_summary=case.decision_summary,
        financial_health=case.financial_health,
        processing_time_ms=case.processing_time_ms,
        version=case.version,
        analysis_status=case.analysis_status,
        sync_status=case.sync_status,
        last_synced_at=case.last_synced_at,
        document_count=len(case.documents),
        latest_job_status=latest_job.status if latest_job else None,
        created_at=_serialize_datetime(case.created_at) or "",
        updated_at=_serialize_datetime(case.updated_at) or "",
    )


def _serialize_case_detail(case: UnderwritingCase) -> CaseDetailResponse:
    documents = [_deserialize_document(document) for document in case.documents]
    latest_snapshot = case.snapshots[0] if case.snapshots else None

    return CaseDetailResponse(
        **_serialize_case_summary(case).model_dump(),
        due_diligence_note=case.due_diligence_note,
        documents=documents,
        analysis_bundle=_deserialize_bundle(latest_snapshot, documents),
        jobs=[_serialize_job(job) for job in case.jobs[:10]],
        analyst_notes=[_serialize_note(note) for note in case.notes[:10]],
        audit_history=[_serialize_audit_event(event) for event in case.audit_events[:20]],
    )


def _get_or_create_company(db: Session, request: CaseSyncRequest) -> Company:
    statement = select(Company).where(Company.name == request.company_name)
    if request.cin:
        statement = statement.where(Company.cin == request.cin)

    company = db.execute(statement.limit(1)).scalar_one_or_none()
    if company is None:
        company = Company(
            name=request.company_name,
            cin=request.cin,
            sector=request.sector,
        )
        db.add(company)
        db.flush()
        return company

    company.name = request.company_name
    company.cin = request.cin
    company.sector = request.sector
    return company


def _resolve_case(
    db: Session,
    company: Company,
    request: CaseSyncRequest,
) -> UnderwritingCase:
    case: UnderwritingCase | None = None

    if request.case_id:
        case = db.get(UnderwritingCase, request.case_id)

    if case is None:
        case = db.execute(
            select(UnderwritingCase)
            .where(UnderwritingCase.company_id == company.id)
            .order_by(UnderwritingCase.updated_at.desc())
            .limit(1)
        ).scalar_one_or_none()

    if case is None:
        case = UnderwritingCase(
            company_id=company.id,
            facility_type=request.facility_type,
            requested_amount_cr=request.requested_amount_cr,
            due_diligence_note=request.due_diligence_note,
            status="draft",
            current_stage="analysis",
            sync_status=request.sync_status,
            last_synced_at=(
                request.analysis_bundle.synced_at if request.analysis_bundle else _utc_now_iso()
            ),
        )
        db.add(case)
        db.flush()
        return case

    case.company_id = company.id
    case.facility_type = request.facility_type
    case.requested_amount_cr = request.requested_amount_cr
    case.due_diligence_note = request.due_diligence_note
    case.sync_status = request.sync_status
    case.last_synced_at = (
        request.analysis_bundle.synced_at if request.analysis_bundle else _utc_now_iso()
    )
    return case


def _sync_documents(
    case: UnderwritingCase,
    request: CaseSyncRequest,
) -> None:
    existing_by_remote_id = {
        document.remote_document_id: document for document in case.documents
    }

    for payload in request.documents:
        existing = existing_by_remote_id.get(payload.document_id)
        summary_json = (
            payload.parse_summary.model_dump(mode="json")
            if payload.parse_summary
            else None
        )

        if existing is None:
            case.documents.append(
                CaseDocument(
                    case_id=case.id,
                    remote_document_id=payload.document_id,
                    company_id=payload.company_id,
                    document_type=payload.document_type,
                    original_filename=payload.original_filename,
                    stored_filename=payload.stored_filename,
                    storage_path=payload.storage_path,
                    content_type=payload.content_type,
                    size_bytes=payload.size_bytes,
                    uploaded_at=payload.uploaded_at,
                    parse_summary_json=summary_json,
                )
            )
            continue

        existing.company_id = payload.company_id
        existing.document_type = payload.document_type
        existing.original_filename = payload.original_filename
        existing.stored_filename = payload.stored_filename
        existing.storage_path = payload.storage_path
        existing.content_type = payload.content_type
        existing.size_bytes = payload.size_bytes
        existing.uploaded_at = payload.uploaded_at
        existing.parse_summary_json = summary_json


def _capture_analyst_note(case: UnderwritingCase, note_text: str | None) -> None:
    if not note_text or not note_text.strip():
        return

    latest_note = case.notes[0] if case.notes else None
    if latest_note and latest_note.note.strip() == note_text.strip():
        return

    case.notes.append(
        AnalystNote(
            case_id=case.id,
            source="workspace-sync",
            note=note_text.strip(),
        )
    )


def _update_case_status(case: UnderwritingCase, request: CaseSyncRequest) -> None:
    decision = request.analysis_bundle.decision if request.analysis_bundle else None
    previous_status = case.status
    previous_stage = case.current_stage
    previous_decision = case.latest_decision
    previous_risk = case.latest_risk_level

    case.latest_decision = decision.decision if decision else None
    case.latest_risk_level = decision.risk_level if decision else None
    case.credit_score = decision.credit_score if decision else case.credit_score
    case.approval_probability = decision.approval_probability if decision else case.approval_probability
    case.recommended_loan_amount_cr = decision.recommended_loan_amount if decision else case.recommended_loan_amount_cr
    case.suggested_interest_rate = decision.suggested_interest_rate if decision else case.suggested_interest_rate
    case.confidence_score = (
        case.confidence_score if case.confidence_score is not None else (request.analysis_bundle.extracted.confidence_score if request.analysis_bundle and request.analysis_bundle.extracted else None)
    )
    case.decision_summary = decision.pricing_rationale if decision else case.decision_summary
    case.pricing_rationale = decision.pricing_rationale if decision else case.pricing_rationale
    case.financial_health = (
        request.analysis_bundle.extracted.financial_health if request.analysis_bundle and request.analysis_bundle.extracted else case.financial_health
    )
    case.processing_time_ms = case.processing_time_ms or 1200
    case.version = case.version + 1 if decision else case.version
    case.analysis_status = "scoring_complete" if decision else case.analysis_status

    if decision:
        case.status = "draft"
        case.current_stage = "committee-ready"
        case.analysis_status = "scoring_complete"
    elif case.documents:
        case.current_stage = "analysis"
        case.analysis_status = "extraction_complete"
    else:
        case.current_stage = "ingestion"
        case.analysis_status = "draft"

    if previous_status != case.status or previous_stage != case.current_stage or previous_decision != case.latest_decision or previous_risk != case.latest_risk_level:
        case.audit_events.append(
            CaseAuditEvent(
                case_id=case.id,
                actor="system",
                action="status_transition",
                from_status=previous_status,
                to_status=case.status,
                details=f"Stage moved from {previous_stage} to {case.current_stage}.",
                previous_score=previous_decision is not None and previous_decision != case.latest_decision and case.credit_score,
                current_score=case.credit_score,
                previous_recommendation=previous_decision,
                current_recommendation=case.latest_decision,
            )
        )


def sync_case(db: Session, request: CaseSyncRequest) -> CaseSyncResponse:
    company = _get_or_create_company(db, request)
    case = _resolve_case(db, company, request)
    _sync_documents(case, request)
    _capture_analyst_note(case, request.due_diligence_note)
    _update_case_status(case, request)

    job = WorkflowJob(
        case_id=case.id,
        job_type="analysis_sync",
        status="running",
        stage="persisting",
        progress=35,
        message="Persisting underwriting workspace, documents, and synced analysis outputs.",
        payload_json=request.model_dump(mode="json"),
        started_at=_utc_now_iso(),
    )
    db.add(job)
    db.flush()

    if request.analysis_bundle:
        db.add(
            CaseAnalysisSnapshot(
                case_id=case.id,
                sync_status=request.sync_status,
                synced_at=request.analysis_bundle.synced_at,
                document_count=len(request.documents),
                extracted_json=(
                    request.analysis_bundle.extracted.model_dump(mode="json")
                    if request.analysis_bundle.extracted
                    else None
                ),
                research_json=(
                    request.analysis_bundle.research.model_dump(mode="json")
                    if request.analysis_bundle.research
                    else None
                ),
                fraud_json=(
                    request.analysis_bundle.fraud.model_dump(mode="json")
                    if request.analysis_bundle.fraud
                    else None
                ),
                decision_json=(
                    request.analysis_bundle.decision.model_dump(mode="json")
                    if request.analysis_bundle.decision
                    else None
                ),
                cam_json=(
                    request.analysis_bundle.cam.model_dump(mode="json")
                    if request.analysis_bundle.cam
                    else None
                ),
            )
        )

    db.commit()

    if request.analysis_bundle and request.analysis_bundle.decision:
        case.credit_score = request.analysis_bundle.decision.credit_score
        case.approval_probability = request.analysis_bundle.decision.approval_probability
        case.recommended_loan_amount_cr = request.analysis_bundle.decision.recommended_loan_amount
        case.suggested_interest_rate = request.analysis_bundle.decision.suggested_interest_rate
        case.risk_premium = max(0.0, request.analysis_bundle.decision.suggested_interest_rate - 8.8)
        case.confidence_score = (
            request.analysis_bundle.extracted.confidence_score if request.analysis_bundle.extracted else None
        )
        case.decision_summary = request.analysis_bundle.decision.pricing_rationale
        case.pricing_rationale = request.analysis_bundle.decision.pricing_rationale
        case.positive_factors = "; ".join(
            factor.label for factor in request.analysis_bundle.decision.factors if factor.impact == "positive"
        ) or None
        case.negative_factors = "; ".join(
            factor.label for factor in request.analysis_bundle.decision.factors if factor.impact == "negative"
        ) or None
        case.risk_drivers = "; ".join(request.analysis_bundle.decision.top_risk_factors) or None
        case.financial_health = (
            request.analysis_bundle.extracted.financial_health if request.analysis_bundle.extracted else None
        )
        case.processing_time_ms = 1400
        case.analysis_status = "scoring_complete"
        case.status = "draft"
        case.current_stage = "committee-ready"
        case.version = case.version + 1

        case.audit_events.append(
            CaseAuditEvent(
                case_id=case.id,
                actor="system",
                action="snapshot_persisted",
                from_status=case.status,
                to_status=case.status,
                details="Completed underwriting snapshot persisted to durable case storage.",
                current_score=case.credit_score,
                current_recommendation=case.latest_decision,
            )
        )
    db.commit()

    job.status = "completed"
    job.stage = "completed"
    job.progress = 100
    job.message = "Case sync completed and the latest underwriting bundle is now durable."
    job.result_json = {
        "case_id": case.id,
        "documents": len(case.documents),
        "sync_status": case.sync_status,
    }
    job.completed_at = _utc_now_iso()
    db.commit()

    hydrated_case = get_case(db, case.id)
    return CaseSyncResponse(case=hydrated_case, job=_serialize_job(job))


def list_cases(db: Session, limit: int = 20) -> list[CaseSummaryResponse]:
    cases = db.execute(
        select(UnderwritingCase)
        .options(
            selectinload(UnderwritingCase.company),
            selectinload(UnderwritingCase.documents),
            selectinload(UnderwritingCase.jobs),
        )
        .order_by(UnderwritingCase.updated_at.desc())
        .limit(limit)
    ).scalars().all()
    return [_serialize_case_summary(case) for case in cases]


def get_dashboard_summary(db: Session, limit: int = 10) -> CaseDashboardSummaryResponse:
    cases = db.execute(
        select(UnderwritingCase)
        .order_by(UnderwritingCase.updated_at.desc())
        .limit(limit)
    ).scalars().all()

    total_cases = len(cases)
    pending_reviews = sum(1 for case in cases if case.status in {"analyst_review", "draft"})
    high_risk_cases = sum(1 for case in cases if case.latest_risk_level == "HIGH")
    recently_approved = sum(1 for case in cases if case.latest_decision == "APPROVE")
    recently_rejected = sum(1 for case in cases if case.latest_decision == "REJECT")
    average_credit_score = round(
        sum(case.credit_score or 0 for case in cases) / total_cases,
        2,
    ) if total_cases else 0.0
    average_processing_time_ms = round(
        sum(case.processing_time_ms or 0 for case in cases) / total_cases,
        2,
    ) if total_cases else 0.0

    pipeline_statistics = {
        "documents_uploaded": sum(1 for case in cases if case.documents),
        "scoring_complete": sum(1 for case in cases if case.analysis_status == "scoring_complete"),
        "cam_generated": sum(1 for case in cases if case.analysis_status == "cam_generated"),
    }
    status_distribution = {}
    for case in cases:
        status_distribution[case.status] = status_distribution.get(case.status, 0) + 1

    recent_activity = [
        {
            "case_id": case.id,
            "status": case.status,
            "updated_at": _serialize_datetime(case.updated_at) or "",
            "decision": case.latest_decision or "PENDING",
        }
        for case in cases[:limit]
    ]

    return CaseDashboardSummaryResponse(
        total_cases=total_cases,
        pending_reviews=pending_reviews,
        high_risk_cases=high_risk_cases,
        recently_approved=recently_approved,
        recently_rejected=recently_rejected,
        average_credit_score=average_credit_score,
        average_processing_time_ms=average_processing_time_ms,
        pipeline_statistics=pipeline_statistics,
        status_distribution=status_distribution,
        recent_activity=recent_activity,
    )


def get_case(db: Session, case_id: str) -> CaseDetailResponse:
    case = db.execute(
        select(UnderwritingCase)
        .where(UnderwritingCase.id == case_id)
        .options(
            selectinload(UnderwritingCase.company),
            selectinload(UnderwritingCase.documents),
            selectinload(UnderwritingCase.snapshots),
            selectinload(UnderwritingCase.jobs),
            selectinload(UnderwritingCase.notes),
        )
        .limit(1)
    ).scalar_one_or_none()
    if case is None:
        raise NoResultFound
    return _serialize_case_detail(case)


def list_jobs(
    db: Session,
    *,
    case_id: str | None = None,
    limit: int = 25,
) -> list[WorkflowJobResponse]:
    statement = select(WorkflowJob).order_by(WorkflowJob.created_at.desc())
    if case_id:
        statement = statement.where(WorkflowJob.case_id == case_id)

    jobs = db.execute(statement.limit(limit)).scalars().all()
    return [_serialize_job(job) for job in jobs]


def get_job(db: Session, job_id: str) -> WorkflowJobResponse:
    job = db.execute(
        select(WorkflowJob)
        .where(WorkflowJob.id == job_id)
        .limit(1)
    ).scalar_one_or_none()
    if job is None:
        raise NoResultFound
    return _serialize_job(job)


def add_case_note(
    db: Session,
    case_id: str,
    payload: AnalystNoteCreateRequest,
) -> AnalystNoteResponse:
    case = db.get(UnderwritingCase, case_id)
    if case is None:
        raise NoResultFound
    note = AnalystNote(
        case_id=case.id,
        source=payload.source,
        note=payload.note.strip(),
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return _serialize_note(note)


def transition_case_status(
    db: Session,
    case_id: str,
    new_status: str,
    *,
    actor: str = "analyst",
    details: str | None = None,
) -> CaseDetailResponse:
    case = db.get(UnderwritingCase, case_id)
    if case is None:
        raise NoResultFound

    previous_status = case.status
    previous_stage = case.current_stage
    case.status = new_status
    case.analysis_status = new_status
    case.current_stage = {
        "draft": "ingestion",
        "documents_uploaded": "analysis",
        "extraction_complete": "analysis",
        "research_pending": "research",
        "fraud_pending": "fraud",
        "scoring_complete": "committee-ready",
        "analyst_review": "review",
        "approved": "approval",
        "rejected": "decision",
        "cam_generated": "cam",
        "archived": "archive",
    }.get(new_status, case.current_stage)

    case.audit_events.append(
        CaseAuditEvent(
            case_id=case.id,
            actor=actor,
            action="status_transition",
            from_status=previous_status,
            to_status=new_status,
            details=details,
            previous_score=case.credit_score,
            current_score=case.credit_score,
            previous_recommendation=case.latest_decision,
            current_recommendation=case.latest_decision,
        )
    )
    db.commit()
    db.refresh(case)
    return get_case(db, case.id)


def rerun_case_analysis(db: Session, case_id: str) -> CaseDetailResponse:
    case = db.get(UnderwritingCase, case_id)
    if case is None:
        raise NoResultFound

    case.status = "draft"
    case.analysis_status = "scoring_complete"
    case.current_stage = "committee-ready"
    case.version = case.version + 1
    case.audit_events.append(
        CaseAuditEvent(
            case_id=case.id,
            actor="system",
            action="rerun_analysis",
            from_status=case.status,
            to_status="draft",
            details="Case analysis rerun requested from existing underwriting snapshot.",
            current_score=case.credit_score,
            current_recommendation=case.latest_decision,
        )
    )
    db.commit()
    db.refresh(case)
    return get_case(db, case.id)


def archive_case(db: Session, case_id: str) -> CaseDetailResponse:
    case = db.get(UnderwritingCase, case_id)
    if case is None:
        raise NoResultFound

    case.status = "archived"
    case.analysis_status = "archived"
    case.current_stage = "archive"
    case.audit_events.append(
        CaseAuditEvent(
            case_id=case.id,
            actor="system",
            action="archive_case",
            from_status="draft",
            to_status="archived",
            details="Underwriting case archived.",
            current_score=case.credit_score,
            current_recommendation=case.latest_decision,
        )
    )
    db.commit()
    db.refresh(case)
    return get_case(db, case.id)
