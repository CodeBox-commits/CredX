from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers.uploads import router as uploads_router

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

app = FastAPI(
    title="CredX Backend",
    description="Backend APIs for CredX Intelli-Credit workflows.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(uploads_router, prefix="/api/v1", tags=["uploads"])


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
