"""Seed demo users and the five-borrower demo portfolio, running every case through the real pipeline.

    python -m database.seed            # idempotent: skips if demo cases already exist
    python -m database.seed --reset    # drop & recreate all tables first (DEV ONLY)
    python -m database.seed --export-only ../demo/documents   # just write the demo PDFs

Demo accounts (password for all: CredX@2026):
    admin@credx.demo    admin
    manager@credx.demo  credit_manager
    analyst@credx.demo  analyst
    viewer@credx.demo   viewer
"""

from __future__ import annotations

import argparse
import hashlib
import time
from pathlib import Path

from sqlalchemy import select

from core.logging import configure_logging, get_logger
from core.security import hash_password
from core.storage import get_storage
from database.base import Base
from database.demo.documents import document_pack
from database.demo.portfolio import PORTFOLIO, gstin_for
from database.session import get_engine, init_db, session_scope
from models import AnalystNote, Company, CreditCase, Document, Job, User
from models.enums import CaseStatus, DocumentStatus, JobKind
from services.audit import audit
from workers.runner import run_job

log = get_logger("credx.seed")
DEMO_PASSWORD = "CredX@2026"
USERS = [
    ("admin@credx.demo", "Aditi Rao", "admin"),
    ("manager@credx.demo", "Rahul Mehta", "credit_manager"),
    ("analyst@credx.demo", "Priya Nair", "analyst"),
    ("viewer@credx.demo", "Arjun Iyer", "viewer"),
]


def export_documents(target: Path) -> None:
    for i, spec in enumerate(PORTFOLIO):
        folder = target / spec["key"]
        folder.mkdir(parents=True, exist_ok=True)
        for name, data in document_pack(spec, seed=11 + i):
            (folder / name).write_bytes(data)
    log.info("demo documents exported", extra={"path": str(target)})


def _run(db, kind: JobKind, case_id: str, user_id: str, document_id: str | None = None) -> Job:
    job = Job(kind=kind, case_id=case_id, document_id=document_id, params={}, created_by_id=user_id, backend="inline")
    db.add(job)
    db.commit()
    run_job(job.id)
    db.refresh(job)
    if job.status != "succeeded":
        raise RuntimeError(f"{kind} failed for case {case_id}: {job.error}")
    return job


def seed(reset: bool = False) -> None:
    if reset:
        import models  # noqa: F401

        Base.metadata.drop_all(get_engine())
    init_db()
    started = time.perf_counter()
    with session_scope() as db:
        users = {}
        for email, name, role in USERS:
            user = db.scalars(select(User).where(User.email == email)).first()
            if user is None:
                user = User(email=email, full_name=name, role=role, hashed_password=hash_password(DEMO_PASSWORD))
                db.add(user)
            users[role] = user
        db.commit()
        if db.scalars(select(CreditCase).where(CreditCase.is_demo.is_(True))).first():
            log.info("demo portfolio already present; use --reset to rebuild")
            return
        analyst = users["analyst"]
        storage = get_storage()
        for i, spec in enumerate(PORTFOLIO):
            c = spec["company"]
            company = Company(name=c["name"], cin=c["cin"], pan=c["pan"], gstin=gstin_for(spec), sector=c["sector"],
                              sub_sector=c["sub_sector"], constitution=c["constitution"], incorporation_year=c["incorporation_year"],
                              city=c["city"], state=c["state"], external_rating=c["external_rating"], promoters=c["promoters"],
                              created_by_id=analyst.id)
            db.add(company)
            db.flush()
            case = CreditCase(reference=f"CX-2026-{i + 1:04d}", company_id=company.id, status=CaseStatus.INGESTING, is_demo=True,
                              created_by_id=analyst.id, assigned_to_id=analyst.id, network=spec["network"], **spec["case"])
            db.add(case)
            db.flush()
            audit(db, analyst, "case.create", "case", case.id, case.id, summary=f"Opened {case.reference} for {company.name}",
                  details={"requested_amount": case.requested_amount, "facility": case.facility_type, "seeded": True})
            db.commit()
            for name, data in document_pack(spec, seed=11 + i):
                doc = Document(case_id=case.id, filename=name, content_type="application/pdf", size_bytes=len(data),
                               sha256=hashlib.sha256(data).hexdigest(), status=DocumentStatus.UPLOADED, uploaded_by_id=analyst.id,
                               storage_key="pending", classification_signals=[], extracted={})
                db.add(doc)
                db.flush()
                doc.storage_key = storage.put(f"documents/{case.id}/{doc.id}.pdf", data, "application/pdf")
                audit(db, analyst, "document.upload", "document", doc.id, case.id, summary=f"Uploaded {name}",
                      details={"size": len(data), "sha256": doc.sha256})
                db.commit()
                _run(db, JobKind.INGEST_DOCUMENT, case.id, analyst.id, doc.id)
            for note in spec["notes"]:
                db.add(AnalystNote(case_id=case.id, author_id=analyst.id, kind="note", category=note["category"], body=note["body"]))
                audit(db, analyst, "note.note", "note", None, case.id, summary=note["body"][:200], details={"category": note["category"]})
            audit(db, analyst, "job.full_analysis", "case", case.id, case.id, summary="Started full analysis")
            db.commit()
            job = _run(db, JobKind.FULL_ANALYSIS, case.id, analyst.id)
            log.info("seeded demo case", extra={"company": c["name"], **(job.result or {})})
    log.info("seed complete", extra={"seconds": round(time.perf_counter() - started, 1)})


def main() -> None:
    configure_logging("INFO")
    parser = argparse.ArgumentParser(description="Seed the CredX demo portfolio")
    parser.add_argument("--reset", action="store_true", help="drop and recreate all tables first (dev only)")
    parser.add_argument("--export-only", metavar="DIR", help="only write demo PDFs to DIR")
    args = parser.parse_args()
    if args.export_only:
        export_documents(Path(args.export_only))
        return
    seed(reset=args.reset)


if __name__ == "__main__":
    main()
