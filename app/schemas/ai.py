from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class AiHealthFactorSchema(BaseModel):
    factor: str
    impact_points: int
    observation: str


class AssetHealthOut(BaseModel):
    asset_id: str
    asset_name: str
    asset_type: str
    state: str
    district: str
    area: str
    substation_id: Optional[str] = None
    feeder_id: Optional[str] = None
    health_score: int = Field(..., ge=0, le=100)
    category: str
    risk_level: str
    age_years: float
    maintenance_overdue_days: int
    historical_fault_count: int
    downtime_hours_90d: float
    voltage_deviation_pct: float
    peak_load_pct: float
    temperature_trend_c: Optional[float] = None
    factors: List[AiHealthFactorSchema]
    last_updated: str
    source: str

    model_config = ConfigDict(from_attributes=True)


class AssetHealthResponse(BaseModel):
    count: int
    recalculated_at: str
    items: List[AssetHealthOut]


class FailurePredictionOut(BaseModel):
    prediction_id: str
    asset_id: str
    asset_name: str
    asset_type: str
    failure_type: str
    probability_pct: int = Field(..., ge=0, le=100)
    confidence_score: int = Field(..., ge=0, le=100)
    estimated_failure_window: str
    predicted_date: str
    risk_level: str
    contributing_factors: List[str]
    recommended_action: str
    supporting_evidence: List[str]
    source: str

    model_config = ConfigDict(from_attributes=True)


class FailurePredictionsResponse(BaseModel):
    count: int
    recalculated_at: str
    items: List[FailurePredictionOut]


class GridRiskIndexOut(BaseModel):
    risk_id: str
    scope_level: str
    name: str
    parent_label: str
    risk_score: int = Field(..., ge=0, le=100)
    risk_level: str
    active_incidents_count: int
    historical_failures_count: int
    avg_asset_health: int
    avg_load_pct: int

    model_config = ConfigDict(from_attributes=True)


class GridRiskResponse(BaseModel):
    count: int
    recalculated_at: str
    items: List[GridRiskIndexOut]


class AiRecommendationOut(BaseModel):
    recommendation_id: str
    asset_id: str
    asset_name: str
    health_score: int
    priority: str
    recommendation: str
    reasons: List[str]
    expected_risk_reduction_pct: int
    confidence_score: int
    linked_prediction_id: Optional[str] = None
    created_at: str
    source: str

    model_config = ConfigDict(from_attributes=True)


class AiRecommendationsResponse(BaseModel):
    count: int
    recalculated_at: str
    items: List[AiRecommendationOut]


class IncidentPatternOut(BaseModel):
    pattern_id: str
    pattern_type: str
    title: str
    summary: str
    affected_asset_ids: List[str]
    occurrences_count: int
    geographic_scope: str
    severity: str


class IncidentPatternsResponse(BaseModel):
    count: int
    recalculated_at: str
    items: List[IncidentPatternOut]


class ModelPerformanceMetricsOut(BaseModel):
    model_version: str
    algorithm: str
    training_samples: int
    precision_pct: float
    recall_pct: float
    f1_score: float
    roc_auc: float
    drift_status: str
    backend_engine: str
    last_trained_at: str
    next_scheduled_run_at: str
    trigger_source: str


class AiRecalculateRequest(BaseModel):
    reason: str = Field(default="Manual engineer AI model recalculation")


class AiRecalculateResponse(BaseModel):
    status: str
    recalculated_at: str
    assets_scored: int
    predictions_generated: int
    recommendations_generated: int
    model_metrics: ModelPerformanceMetricsOut
