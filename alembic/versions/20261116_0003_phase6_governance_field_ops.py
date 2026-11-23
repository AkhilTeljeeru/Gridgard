"""Phase 6 Decision Governance, Approvals, Field Tasks, Evidence, Audit, and Notifications schema

Revision ID: 20261116_0003
Revises: 20261116_0002
Create Date: 2026-11-16 00:03:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20261116_0003"
down_revision: Union[str, None] = "20261116_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "decisions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("decision_id", sa.String(length=100), nullable=False),
        sa.Column("decision_code", sa.String(length=60), nullable=False),
        sa.Column("incident_id", sa.String(length=100), nullable=True),
        sa.Column("fault_id", sa.String(length=100), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("rationale", sa.Text(), nullable=False),
        sa.Column("risk_assessment", sa.Text(), nullable=False),
        sa.Column("recommendation_summary", sa.Text(), nullable=False),
        sa.Column("target_asset_id", sa.String(length=100), nullable=False),
        sa.Column("priority", sa.String(length=20), nullable=False),
        sa.Column("risk_level", sa.String(length=20), nullable=False),
        sa.Column("escalated", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("state", sa.String(length=100), nullable=False),
        sa.Column("district", sa.String(length=100), nullable=False),
        sa.Column("area", sa.String(length=100), nullable=False),
        sa.Column("proposed_by", sa.String(length=150), nullable=False),
        sa.Column("proposed_by_email", sa.String(length=255), nullable=False),
        sa.Column("reviewed_by", sa.String(length=150), nullable=True),
        sa.Column("reviewed_by_email", sa.String(length=255), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("source", sa.String(length=20), nullable=False),
        sa.Column("evidence_bundle", sa.JSON(), nullable=False),
        sa.Column("verification_checklist", sa.JSON(), nullable=True),
        sa.Column("resolution_summary", sa.Text(), nullable=True),
        sa.Column("digital_signature_hash", sa.String(length=128), nullable=True),
        sa.Column("closed_by", sa.String(length=150), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("decision_id"),
        sa.UniqueConstraint("decision_code"),
    )
    op.create_index("idx_gov_decisions_status", "decisions", ["status"], unique=False)
    op.create_index("idx_gov_decisions_asset", "decisions", ["target_asset_id"], unique=False)

    op.create_table(
        "approvals",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("approval_id", sa.String(length=100), nullable=False),
        sa.Column("decision_id", sa.String(length=100), nullable=False),
        sa.Column("action", sa.String(length=20), nullable=False),
        sa.Column("approver_name", sa.String(length=150), nullable=False),
        sa.Column("approver_email", sa.String(length=255), nullable=False),
        sa.Column("approver_role", sa.String(length=50), nullable=False),
        sa.Column("comments", sa.Text(), nullable=False),
        sa.Column("signature_hash", sa.String(length=128), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["decision_id"], ["decisions.decision_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("approval_id"),
    )
    op.create_index("idx_approvals_decision", "approvals", ["decision_id"], unique=False)

    op.create_table(
        "field_tasks",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("task_id", sa.String(length=100), nullable=False),
        sa.Column("task_code", sa.String(length=60), nullable=False),
        sa.Column("decision_id", sa.String(length=100), nullable=False),
        sa.Column("incident_id", sa.String(length=100), nullable=True),
        sa.Column("fault_id", sa.String(length=100), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("assigned_engineer", sa.String(length=150), nullable=False),
        sa.Column("assigned_engineer_email", sa.String(length=255), nullable=False),
        sa.Column("assigned_team", sa.String(length=150), nullable=False),
        sa.Column("asset_id", sa.String(length=100), nullable=False),
        sa.Column("fault_location", sa.String(length=255), nullable=False),
        sa.Column("gps_lat", sa.Numeric(precision=10, scale=7), nullable=False),
        sa.Column("gps_lon", sa.Numeric(precision=10, scale=7), nullable=False),
        sa.Column("safety_notes", sa.Text(), nullable=False),
        sa.Column("priority", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("scheduled_time", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completion_notes", sa.Text(), nullable=True),
        sa.Column("verified_by", sa.String(length=150), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("source", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["decision_id"], ["decisions.decision_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("task_id"),
        sa.UniqueConstraint("task_code"),
    )
    op.create_index("idx_field_tasks_status", "field_tasks", ["status"], unique=False)
    op.create_index("idx_field_tasks_asset", "field_tasks", ["asset_id"], unique=False)

    op.create_table(
        "evidence",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("evidence_id", sa.String(length=100), nullable=False),
        sa.Column("task_id", sa.String(length=100), nullable=False),
        sa.Column("decision_id", sa.String(length=100), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("mime_type", sa.String(length=80), nullable=False),
        sa.Column("file_size_bytes", sa.Integer(), nullable=False),
        sa.Column("gps_lat", sa.Numeric(precision=10, scale=7), nullable=False),
        sa.Column("gps_lon", sa.Numeric(precision=10, scale=7), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False),
        sa.Column("inspection_result", sa.String(length=40), nullable=False),
        sa.Column("equipment_condition", sa.String(length=40), nullable=False),
        sa.Column("meter_readings", sa.JSON(), nullable=False),
        sa.Column("uploaded_by", sa.String(length=150), nullable=False),
        sa.Column("uploaded_by_email", sa.String(length=255), nullable=False),
        sa.Column("source", sa.String(length=20), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["task_id"], ["field_tasks.task_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("evidence_id"),
    )
    op.create_index("idx_evidence_task", "evidence", ["task_id"], unique=False)

    op.create_table(
        "audit_logs_v2",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("audit_id", sa.String(length=100), nullable=False),
        sa.Column("actor_email", sa.String(length=255), nullable=False),
        sa.Column("actor_role", sa.String(length=50), nullable=False),
        sa.Column("action_type", sa.String(length=100), nullable=False),
        sa.Column("module", sa.String(length=80), nullable=False),
        sa.Column("target_entity", sa.String(length=100), nullable=False),
        sa.Column("entity_id", sa.String(length=100), nullable=False),
        sa.Column("related_asset_id", sa.String(length=100), nullable=True),
        sa.Column("related_incident_id", sa.String(length=100), nullable=True),
        sa.Column("change_summary", sa.Text(), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=False),
        sa.Column("ip_address", sa.String(length=45), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("audit_id"),
    )
    op.create_index("idx_audit_v2_action", "audit_logs_v2", ["action_type"], unique=False)
    op.create_index("idx_audit_v2_created", "audit_logs_v2", ["created_at"], unique=False)

    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("notification_id", sa.String(length=100), nullable=False),
        sa.Column("notification_type", sa.String(length=50), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("severity", sa.String(length=20), nullable=False),
        sa.Column("read", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("related_asset_id", sa.String(length=100), nullable=True),
        sa.Column("related_incident_id", sa.String(length=100), nullable=True),
        sa.Column("related_decision_id", sa.String(length=100), nullable=True),
        sa.Column("related_task_id", sa.String(length=100), nullable=True),
        sa.Column("target_view", sa.String(length=40), nullable=True),
        sa.Column("source", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("notification_id"),
    )
    op.create_index("idx_notifications_read", "notifications", ["read"], unique=False)


def downgrade() -> None:
    op.drop_table("notifications")
    op.drop_table("audit_logs_v2")
    op.drop_table("evidence")
    op.drop_table("field_tasks")
    op.drop_table("approvals")
    op.drop_table("decisions")
