from datetime import datetime
from typing import Any, List, Optional
from sqlalchemy import DateTime, ForeignKey, Index, Integer, JSON, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class EngineerModel(Base):
    __tablename__ = "engineers"
    __table_args__ = (Index("idx_engineers_status", "status"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    engineer_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    employee_id: Mapped[str] = mapped_column(String(60), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    phone: Mapped[str] = mapped_column(String(50), nullable=False)
    team: Mapped[str] = mapped_column(String(150), nullable=False)
    assigned_area: Mapped[str] = mapped_column(String(150), nullable=False)
    state: Mapped[str] = mapped_column(String(100), nullable=False, default="Telangana")
    district: Mapped[str] = mapped_column(String(100), nullable=False, default="Hyderabad")
    skills: Mapped[List[str]] = mapped_column(JSON, nullable=False, default=list)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="AVAILABLE")
    current_task_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    current_asset_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    latitude: Mapped[float] = mapped_column(Numeric(10, 7), nullable=False)
    longitude: Mapped[float] = mapped_column(Numeric(10, 7), nullable=False)
    speed_kmh: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False, default=0.0)
    battery_pct: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    network_status: Mapped[str] = mapped_column(String(20), nullable=False, default="4G_LTE")
    last_location_update: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    locations: Mapped[List["LiveLocationModel"]] = relationship(
        back_populates="engineer", cascade="all, delete-orphan"
    )
    geofence_events: Mapped[List["GeoFenceEventModel"]] = relationship(
        back_populates="engineer", cascade="all, delete-orphan"
    )


class LiveLocationModel(Base):
    __tablename__ = "live_locations"
    __table_args__ = (
        Index("idx_live_locations_engineer", "engineer_id", "recorded_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    location_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    engineer_id: Mapped[str] = mapped_column(
        ForeignKey("engineers.engineer_id", ondelete="CASCADE"), nullable=False
    )
    task_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    latitude: Mapped[float] = mapped_column(Numeric(10, 7), nullable=False)
    longitude: Mapped[float] = mapped_column(Numeric(10, 7), nullable=False)
    speed_kmh: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False, default=0.0)
    heading_deg: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False, default=0.0)
    battery_pct: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    network_status: Mapped[str] = mapped_column(String(20), nullable=False, default="4G_LTE")
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    engineer: Mapped["EngineerModel"] = relationship(back_populates="locations")


class GeoFenceEventModel(Base):
    __tablename__ = "geofence_events"
    __table_args__ = (
        Index("idx_geofence_events_engineer", "engineer_id", "created_at"),
        Index("idx_geofence_events_asset", "asset_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    engineer_id: Mapped[str] = mapped_column(
        ForeignKey("engineers.engineer_id", ondelete="CASCADE"), nullable=False
    )
    task_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    fence_id: Mapped[str] = mapped_column(String(100), nullable=False)
    fence_name: Mapped[str] = mapped_column(String(200), nullable=False)
    fence_type: Mapped[str] = mapped_column(String(40), nullable=False)
    asset_id: Mapped[str] = mapped_column(String(100), nullable=False)
    event_type: Mapped[str] = mapped_column(String(40), nullable=False)
    latitude: Mapped[float] = mapped_column(Numeric(10, 7), nullable=False)
    longitude: Mapped[float] = mapped_column(Numeric(10, 7), nullable=False)
    distance_meters: Mapped[float] = mapped_column(Numeric(8, 2), nullable=False, default=0.0)
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    engineer: Mapped["EngineerModel"] = relationship(back_populates="geofence_events")
