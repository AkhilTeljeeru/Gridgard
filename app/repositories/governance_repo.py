from typing import Optional, Sequence
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.governance import (
    Approval,
    AuditLogModel,
    Decision,
    Evidence,
    FieldTaskModel,
    NotificationModel,
)


class GovernanceRepository:
    """Async SQLAlchemy repository for Phase 6 Governance, Field Ops, Evidence, Audit, and Notifications."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_decisions(
        self,
        status: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Sequence[Decision]:
        stmt = select(Decision).order_by(Decision.created_at.desc()).limit(limit).offset(offset)
        if status:
            stmt = stmt.where(Decision.status == status)
        res = await self.db.execute(stmt)
        return res.scalars().all()

    async def get_decision(self, decision_id: str) -> Optional[Decision]:
        stmt = select(Decision).where(
            (Decision.decision_id == decision_id) | (Decision.decision_code == decision_id)
        )
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def save_decision(self, decision: Decision) -> Decision:
        self.db.add(decision)
        await self.db.commit()
        await self.db.refresh(decision)
        return decision

    async def save_approval(self, approval: Approval) -> Approval:
        self.db.add(approval)
        await self.db.commit()
        await self.db.refresh(approval)
        return approval

    async def list_tasks(
        self,
        status: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Sequence[FieldTaskModel]:
        stmt = select(FieldTaskModel).order_by(FieldTaskModel.created_at.desc()).limit(limit).offset(offset)
        if status:
            stmt = stmt.where(FieldTaskModel.status == status)
        res = await self.db.execute(stmt)
        return res.scalars().all()

    async def get_task(self, task_id: str) -> Optional[FieldTaskModel]:
        stmt = select(FieldTaskModel).where(
            (FieldTaskModel.task_id == task_id) | (FieldTaskModel.task_code == task_id)
        )
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def save_task(self, task: FieldTaskModel) -> FieldTaskModel:
        self.db.add(task)
        await self.db.commit()
        await self.db.refresh(task)
        return task

    async def save_evidence(self, evidence: Evidence) -> Evidence:
        self.db.add(evidence)
        await self.db.commit()
        await self.db.refresh(evidence)
        return evidence

    async def list_evidence_by_task(self, task_id: str) -> Sequence[Evidence]:
        stmt = (
            select(Evidence)
            .where(Evidence.task_id == task_id)
            .order_by(Evidence.uploaded_at.desc())
        )
        res = await self.db.execute(stmt)
        return res.scalars().all()

    async def save_audit(self, entry: AuditLogModel) -> AuditLogModel:
        self.db.add(entry)
        await self.db.commit()
        await self.db.refresh(entry)
        return entry

    async def list_audits(
        self,
        action_type: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Sequence[AuditLogModel]:
        stmt = (
            select(AuditLogModel)
            .order_by(AuditLogModel.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        if action_type:
            stmt = stmt.where(AuditLogModel.action_type == action_type)
        res = await self.db.execute(stmt)
        return res.scalars().all()

    async def list_notifications(self, limit: int = 50, offset: int = 0) -> Sequence[NotificationModel]:
        stmt = (
            select(NotificationModel)
            .order_by(NotificationModel.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        res = await self.db.execute(stmt)
        return res.scalars().all()

    async def get_notification(self, notification_id: str) -> Optional[NotificationModel]:
        stmt = select(NotificationModel).where(NotificationModel.notification_id == notification_id)
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def save_notification(self, notif: NotificationModel) -> NotificationModel:
        self.db.add(notif)
        await self.db.commit()
        await self.db.refresh(notif)
        return notif
