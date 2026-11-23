from datetime import date, datetime
from typing import Any, Dict, List, Optional
from geoalchemy2 import Geometry
from sqlalchemy import Date, DateTime, Float, ForeignKey, Index, Integer, JSON, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin


class Substation(Base, TimestampMixin):
    __tablename__ = "substations"
    __table_args__ = (
        Index("idx_substations_geometry", "geometry", postgresql_using="gist"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    substation_code: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    capacity: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)  # kVA
    voltage_level: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    operator: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="ACTIVE")
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    geometry: Mapped[object] = mapped_column(
        Geometry(geometry_type="POINT", srid=4326, spatial_index=False),
        nullable=False,
    )

    feeders: Mapped[List["Feeder"]] = relationship(back_populates="substation")


class Feeder(Base, TimestampMixin):
    __tablename__ = "feeders"
    __table_args__ = (
        Index("idx_feeders_geometry", "geometry", postgresql_using="gist"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    feeder_code: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False, index=True
    )
    feeder_name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    substation_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("substations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    voltage_level: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="ENERGIZED")
    operator: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    geometry: Mapped[object] = mapped_column(
        Geometry(geometry_type="LINESTRING", srid=4326, spatial_index=False),
        nullable=False,
    )

    substation: Mapped[Optional["Substation"]] = relationship(back_populates="feeders")
    transformers: Mapped[List["Transformer"]] = relationship(back_populates="feeder")


class Transformer(Base, TimestampMixin):
    __tablename__ = "transformers"
    __table_args__ = (
        Index("idx_transformers_geometry", "geometry", postgresql_using="gist"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    transformer_code: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False, index=True
    )
    name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    feeder_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("feeders.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    capacity: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)  # kVA
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="ACTIVE", index=True)
    voltage_level: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    geometry: Mapped[object] = mapped_column(
        Geometry(geometry_type="POINT", srid=4326, spatial_index=False),
        nullable=False,
    )

    feeder: Mapped[Optional["Feeder"]] = relationship(back_populates="transformers")


class UtilityAsset(Base, TimestampMixin):
    __tablename__ = "utility_assets"
    __table_args__ = (
        Index("idx_utility_assets_geometry", "geometry", postgresql_using="gist"),
        Index(
            "idx_utility_assets_hierarchy",
            "state_id",
            "district_id",
            "city_id",
            "area_id",
        ),
        Index(
            "idx_utility_assets_type_status",
            "asset_type",
            "operational_status",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    asset_id: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False, index=True
    )
    asset_name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    asset_type: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    geometry: Mapped[object] = mapped_column(
        Geometry(geometry_type="GEOMETRY", srid=4326, spatial_index=False),
        nullable=False,
    )
    voltage_level: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    operational_status: Mapped[str] = mapped_column(
        String(40), nullable=False, default="ACTIVE", index=True
    )
    installation_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    last_maintenance: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    # Hierarchical & Topological Foreign Keys
    state_id: Mapped[int] = mapped_column(
        ForeignKey("states.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    district_id: Mapped[int] = mapped_column(
        ForeignKey("districts.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    city_id: Mapped[int] = mapped_column(
        ForeignKey("cities.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    area_id: Mapped[int] = mapped_column(
        ForeignKey("areas.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    feeder_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("feeders.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    substation_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("substations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Provenance & Cross-Module Canonical Fields
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="DEMO")
    operator: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    rated_capacity_kva: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    substation_code: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    feeder_code: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    extra_metadata: Mapped[Dict[str, Any]] = mapped_column(
        JSON, nullable=False, default=dict
    )


class Fault(Base, TimestampMixin):
    __tablename__ = "faults"
    __table_args__ = (
        Index("idx_faults_geometry", "geometry", postgresql_using="gist"),
        Index("idx_faults_status_severity", "status", "severity"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    fault_id: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False, index=True
    )
    asset_id: Mapped[str] = mapped_column(
        ForeignKey("utility_assets.asset_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    severity: Mapped[str] = mapped_column(String(30), nullable=False, default="CRITICAL")
    fault_type: Mapped[str] = mapped_column(String(120), nullable=False)
    detected_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    resolved_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    geometry: Mapped[object] = mapped_column(
        Geometry(geometry_type="POINT", srid=4326, spatial_index=False),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="ACTIVE_LOCKOUT")
    radius_meters: Mapped[int] = mapped_column(Integer, nullable=False, default=250)
    related_event_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="DEMO")
