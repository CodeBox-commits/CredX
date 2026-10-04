from __future__ import annotations

from fastapi import APIRouter

from ...cam.generators.service import build_cam_preview
from ...schemas.platform import CamPreviewRequest, CamPreviewResponse

router = APIRouter()


@router.post("/preview", response_model=CamPreviewResponse)
def preview_cam(request: CamPreviewRequest) -> CamPreviewResponse:
    return build_cam_preview(request)
