from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class SimulationTypeEnum(str, Enum):
    FEEDER_TRANSFER = "FEEDER_TRANSFER"
    TRANSFORMER_ISOLATION = "TRANSFORMER_ISOLATION"
    PLANNED_MAINTENANCE = "PLANNED_MAINTENANCE"
    ALTERNATIVE_SUPPLY = "ALTERNATIVE_SUPPLY"
    LOAD_REDISTRIBUTION = "LOAD_REDISTRIBUTION"


class SimulationRiskLevelEnum(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class SimulationAssetRoleEnum(str, Enum):
    SOURCE = "SOURCE"
    TARGET = "TARGET"
    AFFECTED = "AFFECTED"
    SWITCH = "SWITCH"
    SUBSTATION = "SUBSTATION"
    ISOLATED = "ISOLATED"


class SimulationCreateRequest(BaseModel):
    scenario_type: SimulationTypeEnum = Field(default=SimulationTypeEnum.FEEDER_TRANSFER)
    title: Optional[str] = None
    engineer_id: str = Field(default="m.vance@utilitygrid.org", max_length=150)
    substation_id: Optional[str] = None
    source_feeder_id: str = Field(..., min_length=2, max_length=100)
    target_feeder_id: str = Field(..., min_length=2, max_length=100)
    transformer_id: Optional[str] = None
    tie_switch_id: str = Field(..., min_length=2, max_length=100)
    load_transfer_pct: float = Field(default=65.0, ge=5.0, le=100.0)
    transferred_load_mva: float = Field(default=3.4, ge=0.1, le=25.0)
    expected_duration_min: int = Field(default=15, ge=1, le=720)
    time_of_operation: Optional[datetime] = None
    incident_id: Optional[str] = None
    fault_id: Optional[str] = None
    source: str = Field(default="SIMULATED", max_length=20)


class SimulationAssetOut(BaseModel):
    asset_id: str
    role: SimulationAssetRoleEnum
    asset_name: Optional[str] = None
    asset_type: Optional[str] = None
    source: str

    model_config = ConfigDict(from_attributes=True)


class SimulationResultOut(BaseModel):
    simulation_id: str
    risk_level: SimulationRiskLevelEnum
    risk_reasons: List[str]
    consumers_affected: Optional[int] = None
    consumers_affected_before: Optional[int] = None
    consumers_restored: Optional[int] = None
    transformers_affected: int
    feeders_affected: int
    load_distribution: Dict[str, Any]
    estimated_duration: int
    min_bus_voltage_pu: float
    thermal_violation: bool
    voltage_violation: bool
    recommendation: str
    recommendation_reasons: List[str]
    switching_sequence: List[str]
    map_overlay: Dict[str, Any]
    advisory_only: bool = True

    model_config = ConfigDict(from_attributes=True)


class SimulationResponse(BaseModel):
    simulation_id: str
    scenario_code: str
    title: str
    engineer_id: str
    scenario_type: SimulationTypeEnum
    status: str
    substation_id: Optional[str] = None
    source_feeder_id: str
    target_feeder_id: str
    transformer_id: Optional[str] = None
    tie_switch_id: str
    load_transfer_pct: float
    transferred_load_mva: float
    expected_duration_min: int
    time_of_operation: datetime
    incident_id: Optional[str] = None
    fault_id: Optional[str] = None
    source: str
    advisory_only: bool = True
    created_time: datetime
    assets: List[SimulationAssetOut] = Field(default_factory=list)
    result: Optional[SimulationResultOut] = None

    model_config = ConfigDict(from_attributes=True)


class SimulationCompareRequest(BaseModel):
    scenario_ids: List[str] = Field(..., min_length=1)


class SimulationComparisonRow(BaseModel):
    simulation_id: str
    scenario_code: str
    scenario_type: SimulationTypeEnum
    risk_level: SimulationRiskLevelEnum
    post_load_pct: float
    min_bus_voltage_pu: float
    consumers_affected_after: Optional[int] = None
    expected_outage_duration_min: int
    thermal_violation: bool
    voltage_violation: bool


class SimulationCompareResponse(BaseModel):
    scenario_ids: List[str]
    recommended_scenario_id: str
    summary: str
    rows: List[SimulationComparisonRow]
