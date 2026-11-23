from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy import DateTime, Index, Integer, JSON, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class AssetLifecycleModel(Base):
    __tablename__ = "asset_lifecycle"
    __table_args__ = (Index("idx_asset_lifecycle_stage", "lifecycle_stage"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    asset_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    asset_name: Mapped[str] = mapped_column(String(255), nullable=False)
    asset_type: Mapped[str] = mapped_column(String(60), nullable=False)
    lifecycle_stage: Mapped[str] = mapped_column(String(40), nullable=False)
    installation_date: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    commissioning_date: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    inspection_history: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, nullable=False, default=list)
    replacement_date: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class RegionalKpiModel(Base):
    __tablename__ = "regional_kpis"
    __table_args__ = (
        Index("idx_regional_kpis_scope", "scope_level"),
        Index("idx_regional_kpis_region", "region"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    region_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    region: Mapped[str] = mapped_column(String(150), nullable=False)
    scope_level: Mapped[str] = mapped_column(String(30), nullable=False)
    parent_region: Mapped[str] = mapped_column(String(150), nullable=False, default="India")
    mttr: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False, default=2.1)
    mtbf: Mapped[float] = mapped_column(Numeric(8, 2), nullable=False, default=640.0)
    availability: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=99.1)
    reliability: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=98.4)
    fault_frequency: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False, default=1.4)
    maintenance_compliance: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=91.5)
    response_time_min: Mapped[float] = mapped_column(Numeric(6, 1), nullable=False, default=18.0)
    calculated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class ExecutiveReportModel(Base):
    __tablename__ = "executive_reports"
    __table_args__ = (Index("idx_executive_reports_type", "report_type"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    report_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    generated_by: Mapped[str] = mapped_column(String(255), nullable=False)
    report_type: Mapped[str] = mapped_column(String(60), nullable=False)
    export_format: Mapped[str] = mapped_column(String(20), nullable=False, default="PDF")
    scope_label: Mapped[str] = mapped_column(String(150), nullable=False, default="All Regions")
    row_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
