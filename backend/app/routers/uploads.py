from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from ..services.pdf_parser import parse_pdf_document

router = APIRouter()

UPLOAD_DIR = Path(__file__).resolve().parents[2] / "storage" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def _safe_name(filename: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9._-]", "_", filename).strip("._")
    return cleaned or "upload.bin"


async def _store_file(
    file: UploadFile, company_id: str | None, document_type: str | None
) -> dict[str, Any]:
    original_name = _safe_name(file.filename or "")
    suffix = Path(original_name).suffix
    stored_name = f"{uuid4().hex}{suffix}"
    output_path = UPLOAD_DIR / stored_name

    size_bytes = 0
    with output_path.open("wb") as out:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            out.write(chunk)
            size_bytes += len(chunk)

    await file.close()

    document_id = uuid4().hex
    metadata: dict[str, Any] = {
        "document_id": document_id,
        "company_id": company_id,
        "document_type": document_type,
        "original_filename": original_name,
        "stored_filename": stored_name,
        "storage_path": str(output_path),
        "content_type": file.content_type,
        "size_bytes": size_bytes,
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "parse_summary": None,
    }
    return metadata


def _is_pdf(file_meta: dict[str, Any]) -> bool:
    filename = str(file_meta.get("original_filename") or "").lower()
    content_type = str(file_meta.get("content_type") or "").lower()
    return filename.endswith(".pdf") or content_type == "application/pdf"


async def _attach_pdf_parse_summary(
    file_meta: dict[str, Any],
) -> dict[str, Any]:
    if not _is_pdf(file_meta):
        file_meta["parse_summary"] = {
            "parsed": False,
            "status": "skipped",
            "reason": "Not a PDF document.",
        }
        return file_meta

    storage_path = file_meta.get("storage_path")
    document_id = file_meta.get("document_id")

    if not storage_path or not document_id:
        file_meta["parse_summary"] = {
            "parsed": False,
            "status": "failed",
            "reason": "Missing storage metadata for parsing.",
        }
        return file_meta

    file_meta["parse_summary"] = await parse_pdf_document(
        file_path=Path(str(storage_path)),
        document_id=str(document_id),
    )
    return file_meta


@router.post("/uploads/single")
async def upload_single(
    file: UploadFile = File(...),
    company_id: str | None = Form(default=None),
    document_type: str | None = Form(default=None),
) -> dict[str, object]:
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file was provided.")

    result = await _store_file(file=file, company_id=company_id, document_type=document_type)
    result = await _attach_pdf_parse_summary(result)
    return {"success": True, "file": result}


@router.post("/uploads/multiple")
async def upload_multiple(
    files: list[UploadFile] = File(...),
    company_id: str | None = Form(default=None),
    document_type: str | None = Form(default=None),
) -> dict[str, object]:
    if not files:
        raise HTTPException(status_code=400, detail="No files were provided.")

    uploaded: list[dict[str, Any]] = []
    for file in files:
        if not file.filename:
            continue
        file_meta = await _store_file(
            file=file,
            company_id=company_id,
            document_type=document_type,
        )
        uploaded.append(await _attach_pdf_parse_summary(file_meta))

    if not uploaded:
        raise HTTPException(status_code=400, detail="No valid files were provided.")

    return {"success": True, "count": len(uploaded), "files": uploaded}
