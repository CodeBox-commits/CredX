"""Test configuration: isolated SQLite DB, local storage and inline job execution per session."""

from __future__ import annotations

import os
import shutil
import sys
import tempfile
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

_tmp = Path(tempfile.mkdtemp(prefix="credx-test-"))
_model_dir = _tmp / "model"
_existing = BACKEND / "scoring" / "models" / "artifacts"
if _existing.exists():  # reuse a trained model to keep the suite fast
    shutil.copytree(_existing, _model_dir)

os.environ.update({
    "ENVIRONMENT": "test",
    "DATABASE_URL": f"sqlite:///{(_tmp / 'test.db').as_posix()}",
    "JOB_BACKEND": "inline",
    "STORAGE_DIR": str(_tmp / "storage"),
    "MODEL_DIR": str(_model_dir),
    "RESEARCH_LIVE": "false",
    "AI_PROVIDER_ORDER": "local",
    "ANTHROPIC_API_KEY": "",
    "OPENAI_API_KEY": "",
    "GEMINI_API_KEY": "",
    "ENABLE_CAMELOT": "false",
    "LOG_LEVEL": "WARNING",
})


@pytest.fixture(scope="session")
def demo_specs():
    from database.demo.portfolio import PORTFOLIO

    return {p["key"]: p for p in PORTFOLIO}


@pytest.fixture(scope="session")
def demo_pack_dir(demo_specs, tmp_path_factory):
    from database.demo.documents import document_pack

    root = tmp_path_factory.mktemp("demo-docs")
    for key, spec in demo_specs.items():
        folder = root / key
        folder.mkdir()
        for name, data in document_pack(spec):
            (folder / name).write_bytes(data)
    return root


@pytest.fixture(scope="session")
def app_client():
    from fastapi.testclient import TestClient

    from main import app

    with TestClient(app) as client:
        yield client


def pytest_sessionfinish(session, exitstatus):  # noqa: ARG001
    shutil.rmtree(_tmp, ignore_errors=True)
