from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy import DateTime, Float, Index, Integer, JSON, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class AssetHealthModel(Base):
    __tablename__ = "asset_health"
    __table_args__ = (
        Index("idx_asset_health_category", "category"),
        Index("idx_asset_health_score", "health_score"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    asset_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    asset_name: Mapped[str] = mapped_column(String(255), nullable=False)
    asset_type: Mapped[str] = mapped_column(String(60), nullable=False)
    state: Mapped[str] = mapped_column(String(100), nullable=False, default="Telangana")
    district: Mapped[str] = mapped_column(String(100), nullable=False, default="Hyderabad")
    area: Mapped[str] = mapped_column(String(100), nullable=False, default="HITEC City")
    substation_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    feeder_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    health_score: Mapped[int] = mapped_column(Integer, nullable=False)
    category: Mapped[str] = mapped_column(String(20), nullable=False)
    risk_level: Mapped[str] = mapped_column(String(20), nullable=False)
    age_years: Mapped[float] = mapped_column(Numeric(5, 1), nullable=False, default=5.0)
    maintenance_overdue_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    historical_fault_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    downtime_hours_90d: Mapped[float] = mapped_column(Numeric(6, 1), nullable=False, default=0.0)
    voltage_deviation_pct: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=1.2)
    peak_load_pct: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=58.0)
    temperature_trend_c: Mapped[Optional[float]] = mapped_column(Numeric(5, 1), nullable=True)
    factors: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, nullable=False, default=list)
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="DEMO")
    calculated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class PredictionModel(Base):
    __tablename__ = "predictions"
    __table_args__ = (
        Index("idx_predictions_asset", "asset_id"),
        Index("idx_predictions_risk", "risk_level"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    prediction_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    asset_id: Mapped[str] = mapped_column(String(100), nullable=False)
    asset_name: Mapped[str] = mapped_column(String(255), nullable=False)
    asset_type: Mapped[str] = mapped_column(String(60), nullable=False)
    failure_type: Mapped[str] = mapped_column(String(60), nullable=False)
    probability_pct: Mapped[int] = mapped_column(Integer, nullable=False)
    confidence_score: Mapped[int] = mapped_column(Integer, nullable=False)
    estimated_failure_window: Mapped[str] = mapped_column(String(80), nullable=False)
    predicted_date: Mapped[str] = mapped_column(String(20), nullable=False)
    risk_level: Mapped[str] = mapped_column(String(20), nullable=False)
    contributing_factors: Mapped[List[str]] = mapped_column(JSON, nullable=False, default=list)
    recommended_action: Mapped[str] = mapped_column(Text, nullable=False)
    supporting_evidence: Mapped[List[str]] = mapped_column(JSON, nullable=False, default=list)
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="DEMO")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class AiRecommendationModel(Base):
    __tablename__ = "ai_recommendations"
    __table_args__ = (
        Index("idx_ai_recs_asset", "asset_id"),
        Index("idx_ai_recs_priority", "priority"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    recommendation_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    asset_id: Mapped[str] = mapped_column(String(100), nullable=False)
    asset_name: Mapped[str] = mapped_column(String(255), nullable=False)
    health_score: Mapped[int] = mapped_column(Integer, nullable=False)
    priority: Mapped[str] = mapped_column(String(20), nullable=False)
    recommendation: Mapped[str] = mapped_column(Text, nullable=False)
    reasons: Mapped[List[str]] = mapped_column(JSON, nullable=False, default=list)
    expected_risk_reduction_pct: Mapped[int] = mapped_column(Integer, nullable=False)
    confidence_score: Mapped[int] = mapped_column(Integer, nullable=False)
    linked_prediction_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="DEMO")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class GridRiskIndexModel(Base):
    __tablename__ = "grid_risk_indices"
    __table_args__ = (
        Index("idx_grid_risk_scope", "scope_level"),
        Index("idx_grid_risk_level", "risk_level"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    risk_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    scope_level: Mapped[str] = mapped_column(String(30), nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    parent_label: Mapped[str] = mapped_column(String(150), nullable=False, default="")
    risk_score: Mapped[int] = mapped_column(Integer, nullable=False)
    risk_level: Mapped[str] = mapped_column(String(20), nullable=False)
    active_incidents_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    historical_failures_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    avg_asset_health: Mapped[int] = mapped_column(Integer, nullable=False, default=80)
    avg_load_pct: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class ModelRunLogModel(Base):
    __tablename__ = "ai_model_runs"
    __table_args__ = (Index("idx_ai_model_runs_created", "created_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    model_version: Mapped[str] = mapped_column(String(80), nullable=False)
    algorithm: Mapped[str] = mapped_column(String(150), nullable=False)
    trigger_source: Mapped[str] = mapped_column(String(40), nullable=False, default="MANUAL")
    training_samples: Mapped[int] = mapped_column(Integer, nullable=False)
    precision_pct: Mapped[float] = mapped_column(Float, nullable=False)
    recall_pct: Mapped[float] = mapped_column(Float, nullable=False)
    f1_score: Mapped[float] = mapped_column(Float, nullable=False)
    roc_auc: Mapped[float] = mapped_column(Float, nullable=False)
    drift_status: Mapped[str] = mapped_column(String(30), nullable=False, default="STABLE")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
