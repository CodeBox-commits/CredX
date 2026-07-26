from __future__ import annotations

from fastapi import APIRouter

from .routes.cam import router as cam_router
from .routes.copilot import router as copilot_router
from .routes.fraud import router as fraud_router
from .routes.health import router as health_router
from .routes.research import router as research_router
from .routes.scoring import router as scoring_router
from .routes.uploads import router as uploads_router

api_router = APIRouter()
api_router.include_router(health_router, tags=["system"])
api_router.include_router(uploads_router, prefix="/uploads", tags=["uploads"])
api_router.include_router(research_router, prefix="/research", tags=["research"])
api_router.include_router(fraud_router, prefix="/fraud", tags=["fraud"])
api_router.include_router(scoring_router, prefix="/underwriting", tags=["underwriting"])
api_router.include_router(cam_router, prefix="/cam", tags=["cam"])
api_router.include_router(copilot_router, prefix="/copilot", tags=["copilot"])
