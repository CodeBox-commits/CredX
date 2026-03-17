from __future__ import annotations

import asyncio
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

PARSED_DIR = Path(__file__).resolve().parents[2] / "storage" / "parsed"
PARSED_DIR.mkdir(parents=True, exist_ok=True)


def _llamaparse_is_available() -> tuple[bool, str | None]:
    try:
        import llama_parse  # noqa: F401

        return True, None
    except Exception as exc:  # pragma: no cover - environment-dependent
        return False, str(exc)


def _parse_pdf_sync(file_path: Path, api_key: str, result_type: str) -> dict[str, Any]:
    from llama_parse import LlamaParse

    parser = LlamaParse(
        api_key=api_key,
        result_type=result_type,
        verbose=False,
    )
    documents = parser.load_data(str(file_path))
    text_parts = [doc.text for doc in documents if getattr(doc, "text", None)]
    full_text = "\n\n".join(text_parts).strip()

    return {
        "page_count": len(documents),
        "character_count": len(full_text),
        "full_text": full_text,
    }


def _write_artifact(document_id: str, payload: dict[str, Any]) -> str:
    output_path = PARSED_DIR / f"{document_id}.json"
    output_path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=True),
        encoding="utf-8",
    )
    return str(output_path)


async def parse_pdf_document(file_path: Path, document_id: str) -> dict[str, Any]:
    api_key = os.getenv("LLAMA_CLOUD_API_KEY")
    if not api_key:
        return {
            "parsed": False,
            "status": "skipped",
            "reason": "LLAMA_CLOUD_API_KEY is not configured.",
        }

    available, import_error = _llamaparse_is_available()
    if not available:
        return {
            "parsed": False,
            "status": "failed",
            "reason": f"llama_parse import failed: {import_error}",
        }

    result_type = os.getenv("LLAMAPARSE_RESULT_TYPE", "markdown")

    try:
        parse_result = await asyncio.to_thread(
            _parse_pdf_sync,
            file_path,
            api_key,
            result_type,
        )
        artifact_payload = {
            "document_id": document_id,
            "source_file": str(file_path),
            "parser": "llamaparse",
            "result_type": result_type,
            "parsed_at": datetime.now(timezone.utc).isoformat(),
            "page_count": parse_result["page_count"],
            "character_count": parse_result["character_count"],
            "full_text": parse_result["full_text"],
        }
        artifact_path = _write_artifact(document_id=document_id, payload=artifact_payload)
        return {
            "parsed": True,
            "status": "parsed",
            "parser": "llamaparse",
            "result_type": result_type,
            "page_count": parse_result["page_count"],
            "character_count": parse_result["character_count"],
            "artifact_path": artifact_path,
        }
    except Exception as exc:  # pragma: no cover - external service dependency
        error_payload = {
            "document_id": document_id,
            "source_file": str(file_path),
            "parser": "llamaparse",
            "status": "failed",
            "failed_at": datetime.now(timezone.utc).isoformat(),
            "error": str(exc),
        }
        artifact_path = _write_artifact(document_id=document_id, payload=error_payload)
        return {
            "parsed": False,
            "status": "failed",
            "reason": str(exc),
            "artifact_path": artifact_path,
        }

