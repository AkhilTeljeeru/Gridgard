"""Phase 11 Live Field Operations & Real-Time Workforce Tracking schema."""

from typing import Union
from alembic import op
import sqlalchemy as sa


revision: str = "20261121_0006"
down_revision: Union[str, None] = "20261121_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("field_tasks", sa.Column("engineer_id", sa.String(length=100), nullable=True))
    op.add_column("field_tasks", sa.Column("eta_minutes", sa.Integer(), nullable=True))
    op.add_column("field_tasks", sa.Column("distance_km", sa.Numeric(8, 2), nullable=True))
    op.add_column("field_tasks", sa.Column("estimated_completion_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("field_tasks", sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("field_tasks", sa.Column("arrived_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("field_tasks", sa.Column("route_progress_pct", sa.Integer(), nullable=False, server_default="0"))

    op.add_column("evidence", sa.Column("file_path", sa.String(length=500), nullable=True))
    op.add_column("evidence", sa.Column("repair_notes", sa.Text(), nullable=True))
    op.add_column("evidence", sa.Column("video_file_name", sa.String(length=255), nullable=True))
    op.add_column("evidence", sa.Column("voice_note_summary", sa.Text(), nullable=True))

    op.create_table(
        "engineers",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("engineer_id", sa.String(length=100), nullable=False, unique=True),
        sa.Column("employee_id", sa.String(length=60), nullable=False, unique=True),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False, unique=True),
        sa.Column("phone", sa.String(length=50), nullable=False),
        sa.Column("team", sa.String(length=150), nullable=False),
        sa.Column("assigned_area", sa.String(length=150), nullable=False),
        sa.Column("state", sa.String(length=100), nullable=False, server_default="Telangana"),
        sa.Column("district", sa.String(length=100), nullable=False, server_default="Hyderabad"),
        sa.Column("skills", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="AVAILABLE"),
        sa.Column("current_task_id", sa.String(length=100), nullable=True),
        sa.Column("current_asset_id", sa.String(length=100), nullable=True),
        sa.Column("latitude", sa.Numeric(10, 7), nullable=False),
        sa.Column("longitude", sa.Numeric(10, 7), nullable=False),
        sa.Column("speed_kmh", sa.Numeric(6, 2), nullable=False, server_default="0.00"),
        sa.Column("battery_pct", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("network_status", sa.String(length=20), nullable=False, server_default="4G_LTE"),
        sa.Column("last_location_update", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_engineers_status", "engineers", ["status"])

    op.create_table(
        "live_locations",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("location_id", sa.String(length=100), nullable=False, unique=True),
        sa.Column("engineer_id", sa.String(length=100), sa.ForeignKey("engineers.engineer_id", ondelete="CASCADE"), nullable=False),
        sa.Column("task_id", sa.String(length=100), nullable=True),
        sa.Column("latitude", sa.Numeric(10, 7), nullable=False),
        sa.Column("longitude", sa.Numeric(10, 7), nullable=False),
        sa.Column("speed_kmh", sa.Numeric(6, 2), nullable=False, server_default="0.00"),
        sa.Column("heading_deg", sa.Numeric(6, 2), nullable=False, server_default="0.00"),
        sa.Column("battery_pct", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("network_status", sa.String(length=20), nullable=False, server_default="4G_LTE"),
        sa.Column("recorded_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_live_locations_engineer", "live_locations", ["engineer_id", "recorded_at"])

    op.create_table(
        "geofence_events",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("event_id", sa.String(length=100), nullable=False, unique=True),
        sa.Column("engineer_id", sa.String(length=100), sa.ForeignKey("engineers.engineer_id", ondelete="CASCADE"), nullable=False),
        sa.Column("task_id", sa.String(length=100), nullable=True),
        sa.Column("fence_id", sa.String(length=100), nullable=False),
        sa.Column("fence_name", sa.String(length=200), nullable=False),
        sa.Column("fence_type", sa.String(length=40), nullable=False),
        sa.Column("asset_id", sa.String(length=100), nullable=False),
        sa.Column("event_type", sa.String(length=40), nullable=False),
        sa.Column("latitude", sa.Numeric(10, 7), nullable=False),
        sa.Column("longitude", sa.Numeric(10, 7), nullable=False),
        sa.Column("distance_meters", sa.Numeric(8, 2), nullable=False, server_default="0.00"),
        sa.Column("summary", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_geofence_events_engineer", "geofence_events", ["engineer_id", "created_at"])
    op.create_index("idx_geofence_events_asset", "geofence_events", ["asset_id"])


def downgrade() -> None:
    op.drop_index("idx_geofence_events_asset", table_name="geofence_events")
    op.drop_index("idx_geofence_events_engineer", table_name="geofence_events")
    op.drop_table("geofence_events")
    op.drop_index("idx_live_locations_engineer", table_name="live_locations")
    op.drop_table("live_locations")
    op.drop_index("idx_engineers_status", table_name="engineers")
    op.drop_table("engineers")
    op.drop_column("evidence", "voice_note_summary")
    op.drop_column("evidence", "video_file_name")
    op.drop_column("evidence", "repair_notes")
    op.drop_column("evidence", "file_path")
    op.drop_column("field_tasks", "route_progress_pct")
    op.drop_column("field_tasks", "arrived_at")
    op.drop_column("field_tasks", "accepted_at")
    op.drop_column("field_tasks", "estimated_completion_at")
    op.drop_column("field_tasks", "distance_km")
    op.drop_column("field_tasks", "eta_minutes")
    op.drop_column("field_tasks", "engineer_id")
