from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, JSON, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class Simulation(Base):
    __tablename__ = "simulations"
    __table_args__ = (
        Index("idx_simulations_type", "scenario_type"),
        Index("idx_simulations_created", "created_time"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    simulation_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    scenario_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    engineer_id: Mapped[str] = mapped_column(String(150), nullable=False)
    scenario_type: Mapped[str] = mapped_column(String(40), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="COMPLETED")
    substation_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    source_feeder_id: Mapped[str] = mapped_column(String(100), nullable=False)
    target_feeder_id: Mapped[str] = mapped_column(String(100), nullable=False)
    transformer_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    tie_switch_id: Mapped[str] = mapped_column(String(100), nullable=False)
    load_transfer_pct: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=65.0)
    transferred_load_mva: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False)
    expected_duration_min: Mapped[int] = mapped_column(Integer, nullable=False, default=15)
    time_of_operation: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    incident_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    fault_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="SIMULATED")
    advisory_only: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    opendss_script: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    assets: Mapped[List["SimulationAsset"]] = relationship(
        back_populates="simulation", cascade="all, delete-orphan"
    )
    result: Mapped[Optional["SimulationResult"]] = relationship(
        back_populates="simulation", uselist=False, cascade="all, delete-orphan"
    )


class SimulationAsset(Base):
    __tablename__ = "simulation_assets"
    __table_args__ = (
        Index("idx_sim_assets_sim_id", "simulation_id"),
        Index("idx_sim_assets_asset_id", "asset_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    simulation_id: Mapped[str] = mapped_column(
        ForeignKey("simulations.simulation_id", ondelete="CASCADE"), nullable=False
    )
    asset_id: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[str] = mapped_column(String(30), nullable=False)
    asset_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    asset_type: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="SIMULATED")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    simulation: Mapped["Simulation"] = relationship(back_populates="assets")


class SimulationResult(Base):
    __tablename__ = "simulation_results"
    __table_args__ = (Index("idx_sim_results_risk", "risk_level"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    simulation_id: Mapped[str] = mapped_column(
        ForeignKey("simulations.simulation_id", ondelete="CASCADE"), unique=True, nullable=False
    )
    risk_level: Mapped[str] = mapped_column(String(20), nullable=False)
    risk_reasons: Mapped[List[str]] = mapped_column(JSON, nullable=False, default=list)
    consumers_affected: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    consumers_affected_before: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    consumers_restored: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    transformers_affected: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    feeders_affected: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    load_distribution: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    estimated_duration: Mapped[int] = mapped_column(Integer, nullable=False, default=15)
    min_bus_voltage_pu: Mapped[float] = mapped_column(Numeric(4, 3), nullable=False, default=1.0)
    thermal_violation: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    voltage_violation: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    recommendation: Mapped[str] = mapped_column(Text, nullable=False)
    recommendation_reasons: Mapped[List[str]] = mapped_column(JSON, nullable=False, default=list)
    switching_sequence: Mapped[List[str]] = mapped_column(JSON, nullable=False, default=list)
    map_overlay: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    advisory_only: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    simulation: Mapped["Simulation"] = relationship(back_populates="result")
