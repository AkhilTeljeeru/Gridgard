"""Phase 5 What-If Simulation tables (simulations, simulation_assets, simulation_results)

Revision ID: 20261116_0002
Revises: 20261116_0001
Create Date: 2026-11-16 00:02:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20261116_0002"
down_revision: Union[str, None] = "20261116_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "simulations",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("simulation_id", sa.String(length=100), nullable=False),
        sa.Column("scenario_code", sa.String(length=50), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("engineer_id", sa.String(length=150), nullable=False),
        sa.Column("scenario_type", sa.String(length=40), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("substation_id", sa.String(length=100), nullable=True),
        sa.Column("source_feeder_id", sa.String(length=100), nullable=False),
        sa.Column("target_feeder_id", sa.String(length=100), nullable=False),
        sa.Column("transformer_id", sa.String(length=100), nullable=True),
        sa.Column("tie_switch_id", sa.String(length=100), nullable=False),
        sa.Column("load_transfer_pct", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column("transferred_load_mva", sa.Numeric(precision=6, scale=2), nullable=False),
        sa.Column("expected_duration_min", sa.Integer(), nullable=False),
        sa.Column("time_of_operation", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("incident_id", sa.String(length=100), nullable=True),
        sa.Column("fault_id", sa.String(length=100), nullable=True),
        sa.Column("source", sa.String(length=20), nullable=False),
        sa.Column("advisory_only", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("opendss_script", sa.Text(), nullable=True),
        sa.Column("created_time", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("simulation_id"),
        sa.UniqueConstraint("scenario_code"),
    )
    op.create_index("idx_simulations_type", "simulations", ["scenario_type"], unique=False)
    op.create_index("idx_simulations_created", "simulations", ["created_time"], unique=False)

    op.create_table(
        "simulation_assets",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("simulation_id", sa.String(length=100), nullable=False),
        sa.Column("asset_id", sa.String(length=100), nullable=False),
        sa.Column("role", sa.String(length=30), nullable=False),
        sa.Column("asset_name", sa.String(length=200), nullable=True),
        sa.Column("asset_type", sa.String(length=60), nullable=True),
        sa.Column("source", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["simulation_id"], ["simulations.simulation_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_sim_assets_sim_id", "simulation_assets", ["simulation_id"], unique=False)
    op.create_index("idx_sim_assets_asset_id", "simulation_assets", ["asset_id"], unique=False)

    op.create_table(
        "simulation_results",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("simulation_id", sa.String(length=100), nullable=False),
        sa.Column("risk_level", sa.String(length=20), nullable=False),
        sa.Column("risk_reasons", sa.JSON(), nullable=False),
        sa.Column("consumers_affected", sa.Integer(), nullable=True),
        sa.Column("consumers_affected_before", sa.Integer(), nullable=True),
        sa.Column("consumers_restored", sa.Integer(), nullable=True),
        sa.Column("transformers_affected", sa.Integer(), nullable=False),
        sa.Column("feeders_affected", sa.Integer(), nullable=False),
        sa.Column("load_distribution", sa.JSON(), nullable=False),
        sa.Column("estimated_duration", sa.Integer(), nullable=False),
        sa.Column("min_bus_voltage_pu", sa.Numeric(precision=4, scale=3), nullable=False),
        sa.Column("thermal_violation", sa.Boolean(), nullable=False),
        sa.Column("voltage_violation", sa.Boolean(), nullable=False),
        sa.Column("recommendation", sa.Text(), nullable=False),
        sa.Column("recommendation_reasons", sa.JSON(), nullable=False),
        sa.Column("switching_sequence", sa.JSON(), nullable=False),
        sa.Column("map_overlay", sa.JSON(), nullable=False),
        sa.Column("advisory_only", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["simulation_id"], ["simulations.simulation_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("simulation_id"),
    )
    op.create_index("idx_sim_results_risk", "simulation_results", ["risk_level"], unique=False)


def downgrade() -> None:
    op.drop_table("simulation_results")
    op.drop_table("simulation_assets")
    op.drop_table("simulations")
