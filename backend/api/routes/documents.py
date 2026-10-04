"""Secure document upload, ingestion status, extraction results and financial-statement editing."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.deps import Analyst, AnyUser, get_case_or_404
from core.errors import CredXError, NotFoundError, ValidationFailed
from core.storage import get_storage
from database.session import get_db
from models import Document, FinancialStatement, User
from models.enums import CaseStatus, DocumentStatus, DocumentType, JobKind
from schemas.common import DocumentDetail, DocumentOut, FinancialUpdate, JobOut, UploadResult
from scoring.feature_engineering.features import compute_ratios
from services import case_context as cc
from services.audit import audit
from services.jobs import enqueue
from utils.files import validate_upload

router = APIRouter(tags=["documents"])
MAX_FILES_PER_UPLOAD = 20


@router.post("/cases/{case_id}/documents", response_model=UploadResult, status_code=202)
async def upload_documents(
    case_id: str,
    files: list[UploadFile] = File(...),
    declared_type: str | None = Form(None),
    auto_analyze: bool = Form(False),
    db: Session = Depends(get_db),
    user: User = Analyst,
) -> UploadResult:
    case = get_case_or_404(db, case_id)
    if len(files) > MAX_FILES_PER_UPLOAD:
        raise ValidationFailed(f"At most {MAX_FILES_PER_UPLOAD} files per upload")
    if declared_type and declared_type not in {t.value for t in DocumentType}:
        raise ValidationFailed("Unknown declared document type")
    storage = get_storage()
    accepted: list[Document] = []
    rejected: list[dict[str, str]] = []
    for upload in files:
        data = await upload.read()
        try:
            meta = validate_upload(upload.filename or "upload", data)
        except CredXError as exc:
            rejected.append({"filename": upload.filename or "upload", "reason": exc.message})
            continue
        existing = db.scalars(select(Document).where(Document.case_id == case.id, Document.sha256 == meta.sha256)).first()
        if existing:
            rejected.append({"filename": meta.filename, "reason": f"Duplicate of already uploaded '{existing.filename}'"})
            continue
        doc = Document(case_id=case.id, filename=meta.filename, content_type=meta.content_type, size_bytes=meta.size,
                       sha256=meta.sha256, declared_type=declared_type, status=DocumentStatus.UPLOADED, uploaded_by_id=user.id,
                       storage_key="pending", classification_signals=[], extracted={})
        db.add(doc)
        db.flush()
        doc.storage_key = storage.put(f"documents/{case.id}/{doc.id}{meta.extension}", data, meta.content_type)
        accepted.append(doc)
        audit(db, user, "document.upload", "document", doc.id, case.id, summary=f"Uploaded {meta.filename}",
              details={"size": meta.size, "sha256": meta.sha256})
    if accepted and case.status in (CaseStatus.DRAFT, CaseStatus.IN_REVIEW):
        case.status = CaseStatus.INGESTING
    db.commit()
    jobs = [enqueue(db, JobKind.INGEST_DOCUMENT, case_id=case.id, document_id=d.id,
                    params={"auto_analyze": auto_analyze}, created_by_id=user.id) for d in accepted]
    return UploadResult(documents=[DocumentOut.model_validate(d) for d in accepted],
                        jobs=[JobOut.model_validate(j) for j in jobs], rejected=rejected)


@router.get("/cases/{case_id}/documents", response_model=list[DocumentOut])
def list_documents(case_id: str, db: Session = Depends(get_db), _: User = AnyUser) -> list[Document]:
    get_case_or_404(db, case_id)
    return list(db.scalars(select(Document).where(Document.case_id == case_id).order_by(Document.created_at.desc())).all())


def _doc(db: Session, document_id: str) -> Document:
    doc = db.get(Document, document_id)
    if doc is None:
        raise NotFoundError("Document not found")
    return doc


@router.get("/documents/{document_id}", response_model=DocumentDetail)
def get_document(document_id: str, db: Session = Depends(get_db), _: User = AnyUser) -> Document:
    return _doc(db, document_id)


@router.get("/documents/{document_id}/file")
def download_document(document_id: str, db: Session = Depends(get_db), user: User = AnyUser) -> Response:
    doc = _doc(db, document_id)
    audit(db, user, "document.download", "document", doc.id, doc.case_id, summary=f"Downloaded {doc.filename}")
    return Response(get_storage().get(doc.storage_key), media_type=doc.content_type,
                    headers={"Content-Disposition": f'inline; filename="{doc.filename}"'})


@router.post("/documents/{document_id}/reprocess", response_model=JobOut, status_code=202)
def reprocess_document(document_id: str, declared_type: str | None = None, db: Session = Depends(get_db), user: User = Analyst):
    doc = _doc(db, document_id)
    if declared_type:
        if declared_type not in {t.value for t in DocumentType}:
            raise ValidationFailed("Unknown document type")
        doc.declared_type = declared_type
    doc.status = DocumentStatus.UPLOADED
    audit(db, user, "document.reprocess", "document", doc.id, doc.case_id, summary=f"Re-processing {doc.filename}",
          details={"declared_type": declared_type})
    db.commit()
    return enqueue(db, JobKind.INGEST_DOCUMENT, case_id=doc.case_id, document_id=doc.id, created_by_id=user.id)


@router.get("/cases/{case_id}/financials")
def get_financials(case_id: str, db: Session = Depends(get_db), _: User = AnyUser) -> dict[str, Any]:
    get_case_or_404(db, case_id)
    rows = db.scalars(select(FinancialStatement).where(FinancialStatement.case_id == case_id)).all()
    years = sorted(rows, key=lambda r: int(r.fiscal_year[2:]), reverse=True)
    statements = [{"fiscal_year": r.fiscal_year, "source": r.source, "confidence": r.confidence,
                   "values": {f: getattr(r, f) for f in cc.FIN_FIELDS}, "provenance": r.provenance} for r in years]
    return {"statements": statements, "ratios": compute_ratios(cc.financials_by_year(db, case_id))}


@router.put("/cases/{case_id}/financials/{fiscal_year}")
def update_financials(case_id: str, fiscal_year: str, body: FinancialUpdate, db: Session = Depends(get_db),
                      user: User = Analyst) -> dict[str, Any]:
    get_case_or_404(db, case_id)
    if not (fiscal_year.startswith("FY") and fiscal_year[2:].isdigit() and len(fiscal_year) == 4):
        raise ValidationFailed("Fiscal year must look like FY25")
    unknown = set(body.values) - set(cc.FIN_FIELDS)
    if unknown:
        raise ValidationFailed(f"Unknown fields: {', '.join(sorted(unknown))}")
    row = db.scalars(select(FinancialStatement).where(FinancialStatement.case_id == case_id,
                                                      FinancialStatement.fiscal_year == fiscal_year)).first()
    if row is None:
        row = FinancialStatement(case_id=case_id, fiscal_year=fiscal_year, provenance={})
        db.add(row)
    before = {k: getattr(row, k) for k in body.values}
    provenance = dict(row.provenance or {})
    for k, v in body.values.items():
        setattr(row, k, v)
        provenance[k] = {"method": "manual", "confidence": 1.0, "snippet": body.reason, "by": user.email}
    row.provenance = provenance
    row.source = "manual"
    audit(db, user, "financials.update", "financial_statement", row.id, case_id, summary=f"Edited {fiscal_year} financials",
          details={"before": before, "after": body.values, "reason": body.reason})
    return {"fiscal_year": fiscal_year, "values": {f: getattr(row, f) for f in cc.FIN_FIELDS}}
