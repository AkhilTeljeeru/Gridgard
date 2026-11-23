"""Phase 9 Enterprise Readiness, Digital Twin, Asset Lifecycle, Regional KPIs & Executive Reports."""

from typing import Union
from alembic import op
import sqlalchemy as sa


revision: str = "20261121_0005"
down_revision: Union[str, None] = "20261116_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "asset_lifecycle",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("asset_id", sa.String(length=100), nullable=False, unique=True),
        sa.Column("asset_name", sa.String(length=255), nullable=False),
        sa.Column("asset_type", sa.String(length=60), nullable=False),
        sa.Column("lifecycle_stage", sa.String(length=40), nullable=False),
        sa.Column("installation_date", sa.String(length=20), nullable=True),
        sa.Column("commissioning_date", sa.String(length=20), nullable=True),
        sa.Column("inspection_history", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("replacement_date", sa.String(length=20), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_asset_lifecycle_stage", "asset_lifecycle", ["lifecycle_stage"])

    op.create_table(
        "regional_kpis",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("region_id", sa.String(length=100), nullable=False, unique=True),
        sa.Column("region", sa.String(length=150), nullable=False),
        sa.Column("scope_level", sa.String(length=30), nullable=False),
        sa.Column("parent_region", sa.String(length=150), nullable=False, server_default="India"),
        sa.Column("mttr", sa.Numeric(6, 2), nullable=False, server_default="2.10"),
        sa.Column("mtbf", sa.Numeric(8, 2), nullable=False, server_default="640.00"),
        sa.Column("availability", sa.Numeric(5, 2), nullable=False, server_default="99.10"),
        sa.Column("reliability", sa.Numeric(5, 2), nullable=False, server_default="98.40"),
        sa.Column("fault_frequency", sa.Numeric(6, 2), nullable=False, server_default="1.40"),
        sa.Column("maintenance_compliance", sa.Numeric(5, 2), nullable=False, server_default="91.50"),
        sa.Column("response_time_min", sa.Numeric(6, 1), nullable=False, server_default="18.0"),
        sa.Column("calculated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_regional_kpis_scope", "regional_kpis", ["scope_level"])
    op.create_index("idx_regional_kpis_region", "regional_kpis", ["region"])

    op.create_table(
        "executive_reports",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("report_id", sa.String(length=100), nullable=False, unique=True),
        sa.Column("generated_by", sa.String(length=255), nullable=False),
        sa.Column("report_type", sa.String(length=60), nullable=False),
        sa.Column("export_format", sa.String(length=20), nullable=False, server_default="PDF"),
        sa.Column("scope_label", sa.String(length=150), nullable=False, server_default="All Regions"),
        sa.Column("row_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("generated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_executive_reports_type", "executive_reports", ["report_type"])


def downgrade() -> None:
    op.drop_index("idx_executive_reports_type", table_name="executive_reports")
    op.drop_table("executive_reports")
    op.drop_index("idx_regional_kpis_region", table_name="regional_kpis")
    op.drop_index("idx_regional_kpis_scope", table_name="regional_kpis")
    op.drop_table("regional_kpis")
    op.drop_index("idx_asset_lifecycle_stage", table_name="asset_lifecycle")
    op.drop_table("asset_lifecycle")
