from __future__ import annotations

from fastapi import APIRouter

from ...fraud.detection.service import build_fraud_analysis
from ...schemas.platform import FraudAnalysisRequest, FraudAnalysisResponse

router = APIRouter()


@router.post("/analyze", response_model=FraudAnalysisResponse)
def analyze_fraud(request: FraudAnalysisRequest) -> FraudAnalysisResponse:
    return build_fraud_analysis(request)
