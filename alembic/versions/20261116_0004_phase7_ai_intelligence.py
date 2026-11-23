"""Phase 7 AI Predictive Intelligence, Asset Health, Predictions, Recommendations & Grid Risk Index schema

Revision ID: 20261116_0004
Revises: 20261116_0003
Create Date: 2026-11-16 00:04:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20261116_0004"
down_revision: Union[str, None] = "20261116_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "asset_health",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("asset_id", sa.String(length=100), nullable=False),
        sa.Column("asset_name", sa.String(length=255), nullable=False),
        sa.Column("asset_type", sa.String(length=60), nullable=False),
        sa.Column("state", sa.String(length=100), nullable=False),
        sa.Column("district", sa.String(length=100), nullable=False),
        sa.Column("area", sa.String(length=100), nullable=False),
        sa.Column("substation_id", sa.String(length=100), nullable=True),
        sa.Column("feeder_id", sa.String(length=100), nullable=True),
        sa.Column("health_score", sa.Integer(), nullable=False),
        sa.Column("category", sa.String(length=20), nullable=False),
        sa.Column("risk_level", sa.String(length=20), nullable=False),
        sa.Column("age_years", sa.Numeric(precision=5, scale=1), nullable=False),
        sa.Column("maintenance_overdue_days", sa.Integer(), nullable=False),
        sa.Column("historical_fault_count", sa.Integer(), nullable=False),
        sa.Column("downtime_hours_90d", sa.Numeric(precision=6, scale=1), nullable=False),
        sa.Column("voltage_deviation_pct", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column("peak_load_pct", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column("temperature_trend_c", sa.Numeric(precision=5, scale=1), nullable=True),
        sa.Column("factors", sa.JSON(), nullable=False),
        sa.Column("source", sa.String(length=20), nullable=False),
        sa.Column("calculated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("asset_id"),
    )
    op.create_index("idx_asset_health_category", "asset_health", ["category"], unique=False)
    op.create_index("idx_asset_health_score", "asset_health", ["health_score"], unique=False)

    op.create_table(
        "predictions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("prediction_id", sa.String(length=100), nullable=False),
        sa.Column("asset_id", sa.String(length=100), nullable=False),
        sa.Column("asset_name", sa.String(length=255), nullable=False),
        sa.Column("asset_type", sa.String(length=60), nullable=False),
        sa.Column("failure_type", sa.String(length=60), nullable=False),
        sa.Column("probability_pct", sa.Integer(), nullable=False),
        sa.Column("confidence_score", sa.Integer(), nullable=False),
        sa.Column("estimated_failure_window", sa.String(length=80), nullable=False),
        sa.Column("predicted_date", sa.String(length=20), nullable=False),
        sa.Column("risk_level", sa.String(length=20), nullable=False),
        sa.Column("contributing_factors", sa.JSON(), nullable=False),
        sa.Column("recommended_action", sa.Text(), nullable=False),
        sa.Column("supporting_evidence", sa.JSON(), nullable=False),
        sa.Column("source", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("prediction_id"),
    )
    op.create_index("idx_predictions_asset", "predictions", ["asset_id"], unique=False)
    op.create_index("idx_predictions_risk", "predictions", ["risk_level"], unique=False)

    op.create_table(
        "ai_recommendations",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("recommendation_id", sa.String(length=100), nullable=False),
        sa.Column("asset_id", sa.String(length=100), nullable=False),
        sa.Column("asset_name", sa.String(length=255), nullable=False),
        sa.Column("health_score", sa.Integer(), nullable=False),
        sa.Column("priority", sa.String(length=20), nullable=False),
        sa.Column("recommendation", sa.Text(), nullable=False),
        sa.Column("reasons", sa.JSON(), nullable=False),
        sa.Column("expected_risk_reduction_pct", sa.Integer(), nullable=False),
        sa.Column("confidence_score", sa.Integer(), nullable=False),
        sa.Column("linked_prediction_id", sa.String(length=100), nullable=True),
        sa.Column("source", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("recommendation_id"),
    )
    op.create_index("idx_ai_recs_asset", "ai_recommendations", ["asset_id"], unique=False)
    op.create_index("idx_ai_recs_priority", "ai_recommendations", ["priority"], unique=False)

    op.create_table(
        "grid_risk_indices",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("risk_id", sa.String(length=100), nullable=False),
        sa.Column("scope_level", sa.String(length=30), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("parent_label", sa.String(length=150), nullable=False),
        sa.Column("risk_score", sa.Integer(), nullable=False),
        sa.Column("risk_level", sa.String(length=20), nullable=False),
        sa.Column("active_incidents_count", sa.Integer(), nullable=False),
        sa.Column("historical_failures_count", sa.Integer(), nullable=False),
        sa.Column("avg_asset_health", sa.Integer(), nullable=False),
        sa.Column("avg_load_pct", sa.Integer(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("risk_id"),
    )
    op.create_index("idx_grid_risk_scope", "grid_risk_indices", ["scope_level"], unique=False)
    op.create_index("idx_grid_risk_level", "grid_risk_indices", ["risk_level"], unique=False)

    op.create_table(
        "ai_model_runs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("run_id", sa.String(length=100), nullable=False),
        sa.Column("model_version", sa.String(length=80), nullable=False),
        sa.Column("algorithm", sa.String(length=150), nullable=False),
        sa.Column("trigger_source", sa.String(length=40), nullable=False),
        sa.Column("training_samples", sa.Integer(), nullable=False),
        sa.Column("precision_pct", sa.Float(), nullable=False),
        sa.Column("recall_pct", sa.Float(), nullable=False),
        sa.Column("f1_score", sa.Float(), nullable=False),
        sa.Column("roc_auc", sa.Float(), nullable=False),
        sa.Column("drift_status", sa.String(length=30), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("run_id"),
    )
    op.create_index("idx_ai_model_runs_created", "ai_model_runs", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_table("ai_model_runs")
    op.drop_table("grid_risk_indices")
    op.drop_table("ai_recommendations")
    op.drop_table("predictions")
    op.drop_table("asset_health")
