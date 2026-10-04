from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from ...core.config import get_settings
from ...extraction.pipeline import run_ingestion_pipeline
from ...schemas.uploads import ParseSummary, UploadMultipleResponse, UploadedFileMeta

router = APIRouter()


def _safe_name(filename: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9._-]", "_", filename).strip("._")
    return cleaned or "upload.bin"


async def _store_file(
    *,
    file: UploadFile,
    company_id: str | None,
    document_type: str | None,
) -> UploadedFileMeta:
    settings = get_settings()
    original_name = _safe_name(file.filename or "")
    suffix = Path(original_name).suffix
    stored_name = f"{uuid4().hex}{suffix}"
    output_path = settings.storage_dir / stored_name

    size_bytes = 0
    max_bytes = settings.max_upload_mb * 1024 * 1024

    with output_path.open("wb") as out:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            size_bytes += len(chunk)
            if size_bytes > max_bytes:
                raise HTTPException(
                    status_code=413,
                    detail=f"File exceeds maximum size of {settings.max_upload_mb} MB.",
                )
            out.write(chunk)

    await file.close()

    return UploadedFileMeta(
        document_id=uuid4().hex,
        company_id=company_id,
        document_type=document_type,
        original_filename=original_name,
        stored_filename=stored_name,
        storage_path=str(output_path),
        content_type=file.content_type,
        size_bytes=size_bytes,
        uploaded_at=datetime.now(timezone.utc).isoformat(),
        parse_summary=None,
    )


def _supports_ingestion(file_meta: UploadedFileMeta) -> bool:
    filename = file_meta.original_filename.lower()
    content_type = (file_meta.content_type or "").lower()
    return filename.endswith((".pdf", ".txt", ".json", ".csv")) or "pdf" in content_type


def _attach_parse_summary(file_meta: UploadedFileMeta) -> UploadedFileMeta:
    if not _supports_ingestion(file_meta):
        file_meta.parse_summary = ParseSummary(
            parsed=False,
            status="skipped",
            reason="Unsupported file type for the current ingestion pipeline.",
        )
        return file_meta

    file_meta.parse_summary = run_ingestion_pipeline(
        file_path=Path(file_meta.storage_path),
        document_id=file_meta.document_id,
    )
    return file_meta


@router.post("/single")
async def upload_single(
    file: UploadFile = File(...),
    company_id: str | None = Form(default=None),
    document_type: str | None = Form(default=None),
) -> dict[str, object]:
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file was provided.")

    stored = await _store_file(file=file, company_id=company_id, document_type=document_type)
    parsed = _attach_parse_summary(stored)
    return {"success": True, "file": parsed.model_dump(mode="json")}


@router.post("/multiple", response_model=UploadMultipleResponse)
async def upload_multiple(
    files: list[UploadFile] = File(...),
    company_id: str | None = Form(default=None),
    document_type: str | None = Form(default=None),
) -> UploadMultipleResponse:
    if not files:
        raise HTTPException(status_code=400, detail="No files were provided.")

    uploaded: list[UploadedFileMeta] = []
    for file in files:
        if not file.filename:
            continue
        stored = await _store_file(
            file=file,
            company_id=company_id,
            document_type=document_type,
        )
        uploaded.append(_attach_parse_summary(stored))

    if not uploaded:
        raise HTTPException(status_code=400, detail="No valid files were provided.")

    return UploadMultipleResponse(success=True, count=len(uploaded), files=uploaded)
