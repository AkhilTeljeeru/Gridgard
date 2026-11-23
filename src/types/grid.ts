export type UserRole =
  | 'ADMIN'
  | 'GRID_ENGINEER'
  | 'REVIEWER_APPROVER'
  | 'FIELD_ENGINEER'
  | 'VIEWER';

export type AssetSource = 'DEMO' | 'OSM' | 'SIMULATED' | 'UTILITY';

export type SelectionSource =
  | 'overview'
  | 'map'
  | 'graph'
  | 'search'
  | 'events'
  | 'integrity'
  | 'simulator'
  | 'decisions'
  | 'field'
  | 'notifications'
  | 'workflow';

export type OverviewDashboardMode = 'OPERATIONAL' | 'EXECUTIVE';

export type SimulatorWorkspaceTab = 'studio' | 'governance';

export type AdminWorkspaceTab = 'users' | 'import' | 'settings' | 'logs' | 'backups';

export type WorkflowStageId =
  | 'incident'
  | 'map'
  | 'graph'
  | 'events'
  | 'rca'
  | 'simulator'
  | 'decisions'
  | 'field'
  | 'audit';

export interface FocusRequest {
  assetId: string;
  source: SelectionSource;
  zoom?: number;
  openPopup?: boolean;
  nonce: number;
}

export type OsmPowerType =
  | 'substation'
  | 'transformer'
  | 'switch'
  | 'tower'
  | 'pole'
  | 'plant'
  | 'generator'
  | 'converter'
  | 'compensator'
  | 'portal'
  | 'busbar'
  | 'bay'
  | 'terminal'
  | 'insulator'
  | 'connection'
  | 'cabinet'
  | 'line'
  | 'minor_line'
  | 'cable'
  | 'unknown';

export interface OsmAsset {
  id: string;
  type: OsmPowerType;
  name: string | null;
  voltage: string | null;
  operator: string | null;
  lat: number;
  lon: number;
  geometry:
    | {
        type: 'Point';
        coordinates: [number, number];
      }
    | {
        type: 'LineString';
        coordinates: [number, number][];
      };
  source: 'OSM';
  tags?: Record<string, string>;
}

export type TelemetryHealthStatus = 'NORMAL' | 'WARNING' | 'FAULT';

export interface AssetTelemetryStatus {
  assetId: string;
  status: TelemetryHealthStatus;
  loadKw: number | null;
  voltage: string | null;
  lastUpdated: string;
  source: AssetSource;
  faultCode?: string;
  faultReason?: string;
}

export type AssetType =
  | 'SUBSTATION'
  | 'FEEDER'
  | 'CIRCUIT_BREAKER'
  | 'RECLOSER'
  | 'SECTIONALIZER'
  | 'TRANSFORMER'
  | 'TOWER'
  | 'POLE'
  | 'PLANT'
  | 'GENERATOR'
  | 'ELECTRICAL_EQUIPMENT'
  | 'CAPACITOR_BANK'
  | 'LOAD_POINT';

export type ConflictStatus = 'DETECTED' | 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED';

export type DecisionStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'IMPLEMENTED'
  | 'CLOSED';

export type PriorityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type Severity = 'INFO' | 'WARNING' | 'CRITICAL';

export type BoundaryLevel =
  | 'STATE'
  | 'DISTRICT'
  | 'CITY'
  | 'LOCALITY'
  | 'SERVICE_AREA';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  department: string;
}

export interface InfrastructureAsset {
  id: string;
  canonicalId: string;
  name: string;
  rawName: string | null;
  osmType: OsmPowerType;
  assetType: AssetType;
  substationId: string | null;
  feederId: string | null;
  voltage: string | null;
  operator: string | null;
  nominalVoltageKv: number | null;
  ratedCapacityKva?: number | null;
  peakLoadPct: number | null;
  status: 'ACTIVE' | 'WARNING' | 'DE_ENERGIZED' | 'FAULTED' | 'MAINTENANCE' | 'UNKNOWN';
  latitude: number;
  longitude: number;
  geometry:
    | {
        type: 'Point';
        coordinates: [number, number];
      }
    | {
        type: 'LineString';
        coordinates: [number, number][];
      };
  source: AssetSource;
  tags?: Record<string, string>;
  parentAssetId?: string;
  country: string;
  state: string;
  district: string;
  division?: string;
  subdivision?: string;
  city: string;
  village?: string;
  area: string;
  administrativeArea?: string;
  pincode?: string;
  utilityServiceArea?: string;
  streetAddress?: string;
  landmarks?: string;
  installationDate?: string | null;
  lastInspectionDate?: string | null;
  hasConflict?: boolean;
  sourceAliases: {
    system: string;
    aliasId: string;
  }[];
}

export type AssetStatus = InfrastructureAsset['status'];

export interface GeographicBoundary {
  id: string;
  name: string;
  level: BoundaryLevel;
  country: string;
  state: string;
  district?: string;
  city?: string;
  area?: string;
  utilityCode?: string;
  coordinates: [number, number][];
}

export interface GeographicFilterState {
  country: string;
  state: string;
  district: string;
  division: string;
  subdivision: string;
  city: string;
  area: string;
  substationId: string;
  feederId: string;
  transformerId: string;
}

export interface ActiveFault {
  id: string;
  faultCode: string;
  title: string;
  latitude: number;
  longitude: number;
  faultRadiusMeters?: number;
  severity: Severity;
  status: 'ACTIVE_LOCKOUT' | 'INVESTIGATING' | 'LINE_GROUNDED' | 'RESTORED';
  affectedAssetId: string;
  affectedAssetName: string;
  affectedSubstationId: string | null;
  affectedFeederId: string | null;
  affectedTransformerId?: string;
  affectedTransformerIds?: string[];
  detectedAt: string;
  lastUpdated: string;
  source: AssetSource;
  telemetrySource: AssetSource;
  customersInterrupted: number | null;
  relatedEventId: string;
  description: string;
}

export interface MaintenanceZone {
  id: string;
  zoneName: string;
  feederId: string;
  coordinates: [number, number][];
  scheduledStart: string;
  scheduledEnd: string;
  workOrderNumber: string;
  crewLead: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED';
  purpose: string;
  source: AssetSource;
}

export interface PowerLine {
  id: string;
  canonicalId: string;
  name: string;
  rawName: string | null;
  osmType: OsmPowerType;
  substationId: string | null;
  feederId: string;
  voltage: string | null;
  operator: string | null;
  voltageKv: number | null;
  status: 'ENERGIZED' | 'WARNING' | 'FAULTED' | 'ISOLATED' | 'TIE_OPEN' | 'TIE_CLOSED';
  path: [number, number][];
  source: AssetSource;
}

export interface MapFilterLayers {
  states: boolean;
  districtBoundaries: boolean;
  cityBoundaries: boolean;
  localityBoundaries: boolean;
  serviceAreas: boolean;
  substations: boolean;
  feeders: boolean;
  transformers: boolean;
  circuitBreakers: boolean;
  switches: boolean;
  towersAndPoles: boolean;
  powerLines: boolean;
  faults: boolean;
  maintenance: boolean;
  conflicts: boolean;
  recentIncidents: boolean;
  simulationOverlay: boolean;
  riskOverlay: boolean;
}

export interface GeographicSearchResult {
  kind: 'ASSET' | 'LOCATION';
  id: string;
  label: string;
  sublabel: string;
  asset?: InfrastructureAsset;
  filterPatch: Partial<GeographicFilterState>;
  latitude: number;
  longitude: number;
  zoom: number;
}

export interface DataQualityIssue {
  id: string;
  issueType:
    | 'IDENTIFIER_MISMATCH'
    | 'ORPHANED_ASSET'
    | 'TIMESTAMP_INVERSION'
    | 'CAPACITY_CONFLICT'
    | 'MISSING_OSM_TAG';
  severity: Severity;
  canonicalAssetId: string;
  assetName: string;
  conflictingSourceA: string;
  conflictingValueA: string;
  conflictingSourceB: string;
  conflictingValueB: string;
  explanation: string;
  status: ConflictStatus;
  detectedAt: string;
  source: AssetSource;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  chosenCanonicalValue?: string;
}

export interface OperationalEvent {
  id: string;
  timestamp: string;
  sourceSystem: 'SCADA_OSI' | 'OMS_ORACLE' | 'WMS_SAP' | 'LINEWORKER_RADIO' | 'WEATHER_RADAR';
  source: AssetSource;
  telemetrySource?: AssetSource;
  assetCanonicalId: string;
  assetName: string;
  eventType: string;
  summary: string;
  isInferred: boolean;
  confidenceScore: number;
  hasContradiction: boolean;
  contradictionDetail?: string;
  verifiedByEngineer?: boolean;
}

export type ReconstructionStepPhase =
  | 'TRIGGER'
  | 'PROTECTION_TRIP'
  | 'FEEDER_LOCKOUT'
  | 'TRANSFORMER_OUTAGE'
  | 'AFFECTED_AREA';

export interface EventReconstructionStep {
  stepId: string;
  stepNumber: number;
  phase: ReconstructionStepPhase;
  title: string;
  assetId: string;
  assetName: string;
  timestamp: string;
  sourceSystem: OperationalEvent['sourceSystem'];
  source: AssetSource;
  summary: string;
  targetStatus: 'WARNING' | 'FAULTED';
  latitude: number;
  longitude: number;
  hasContradiction?: boolean;
  contradictionDetail?: string;
}

export interface EventReconstructionIncident {
  id: string;
  faultId: string;
  faultCode: string;
  title: string;
  description: string;
  severity: Severity;
  status: ActiveFault['status'];
  source: AssetSource;
  detectedAt: string;
  substationId: string | null;
  feederId: string | null;
  affectedTransformerIds: string[];
  affectedAssetIds: string[];
  affectedConsumersCount: number | null;
  affectedAreaPolygon: [number, number][];
  steps: EventReconstructionStep[];
}

export type GraphNodeType =
  | AssetType
  | 'STATE'
  | 'DISTRICT'
  | 'CONSUMER_CLUSTER'
  | 'FIELD_ENGINEER'
  | 'INCIDENT'
  | 'HISTORICAL_INCIDENT';

export interface GraphNodeData {
  id: string;
  canonicalId: string;
  label: string;
  assetName: string;
  type: GraphNodeType;
  osmType?: OsmPowerType;
  feederId: string | null;
  substationId: string | null;
  status: 'ACTIVE' | 'WARNING' | 'DE_ENERGIZED' | 'FAULTED' | 'MAINTENANCE' | 'UNKNOWN';
  voltage: string | null;
  operator: string | null;
  voltageKv: number | null;
  loadPct?: number | null;
  hasConflict?: boolean;
  source: AssetSource;
  geographicLocation: string;
  stateName?: string;
  districtName?: string;
  consumersCount?: number | null;
  targetAssetId?: string;
  engineerStatus?: FieldEngineerStatus;
  engineerId?: string;
  etaMinutes?: number;
}

export interface GraphEdgeData {
  id: string;
  source: string;
  target: string;
  label: string;
  status: 'NORMAL' | 'ISOLATED' | 'TIE_OPEN' | 'TIE_CLOSED';
  capacityMva?: number;
}

export interface RootCauseAnalysis {
  id: string;
  canonicalAssetId: string;
  faultId: string | null;
  incidentId: string | null;
  substationId: string | null;
  feederId: string | null;
  title: string;
  severity: Severity;
  source: AssetSource;
  confidencePct: number;
  initiatingTrigger: string;
  rootCauseSummary: string;
  protectionSequence: string[];
  affectedPathIds: string[];
  affectedConsumersCount: number | null;
  consumerClusterLabel: string;
  dataIntegrityCaveats: string[];
  recommendedActionTitle: string;
  recommendedTransferMva: number;
  recommendedTargetFeederId: string | null;
  recommendedTieSwitchId: string | null;
  evidenceEventIds: string[];
  evidenceIssueIds: string[];
}

export interface PendingDecisionDraft {
  title: string;
  rationale: string;
  riskAssessment: string;
  targetAssetId: string;
  conflictIssueIds: string[];
  eventTimelineIds: string[];
  simulationScenarioId?: string;
  affectedCustomersCount: number | null;
  reliabilityImpact: string;
  aiRecommendationSummary?: string;
  aiConfidenceScore?: number;
  aiReasons?: string[];
}

export type SimulationType =
  | 'FEEDER_TRANSFER'
  | 'TRANSFORMER_ISOLATION'
  | 'PLANNED_MAINTENANCE'
  | 'ALTERNATIVE_SUPPLY'
  | 'LOAD_REDISTRIBUTION';

export type SimulationRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type SimulationAssetRole =
  | 'SOURCE'
  | 'TARGET'
  | 'AFFECTED'
  | 'SWITCH'
  | 'SUBSTATION'
  | 'ISOLATED';

export interface SimulationAssetLink {
  assetId: string;
  assetName: string;
  assetType: string;
  role: SimulationAssetRole;
  source: AssetSource;
}

export interface EquipmentUtilizationComparison {
  assetId: string;
  assetName: string;
  assetType: string;
  role: SimulationAssetRole;
  capacityMva: number | null;
  beforeLoadMva: number;
  afterLoadMva: number;
  beforeLoadPct: number;
  afterLoadPct: number;
  statusBefore: string;
  statusAfter: string;
}

export interface SimulationImpactAnalysis {
  consumersAffectedBefore: number | null;
  consumersAffectedAfter: number | null;
  consumersRestored: number | null;
  transformersAffectedCount: number;
  affectedTransformerIds: string[];
  feedersAffectedCount: number;
  affectedFeederIds: string[];
  expectedOutageDurationMin: number;
  networkUtilizationBeforePct: number;
  networkUtilizationAfterPct: number;
  loadRedistributionSummary: string;
  equipmentUtilization: EquipmentUtilizationComparison[];
}

export interface SimulationRiskAssessment {
  level: SimulationRiskLevel;
  reasons: string[];
}

export interface SimulationRecommendation {
  title: string;
  reasons: string[];
  estimatedRestorationMinutes: number;
  switchingSequence: string[];
  advisoryOnly: boolean;
}

export interface SimulationMapOverlay {
  simulationId: string;
  scenarioCode: string;
  scenarioType: SimulationType;
  isPlaying: boolean;
  sourceFeederId: string;
  targetFeederId: string;
  tieSwitchId: string;
  isolatedAssetIds: string[];
  participatingAssetIds: string[];
  proposedFeederPath: [number, number][];
  temporarySupplyPath: [number, number][];
  affectedAreaPolygon: [number, number][];
  riskLevel: SimulationRiskLevel;
}

export interface SimulationInputParams {
  scenarioType: SimulationType;
  title?: string;
  substationId?: string | null;
  sourceFeeder: string;
  targetFeeder: string;
  transformerId?: string | null;
  tieSwitch: string;
  loadTransferMva?: number;
  loadTransferPct?: number;
  expectedDurationMin?: number;
  timeOfOperation?: string;
  incidentId?: string | null;
  faultId?: string | null;
  engineerName?: string;
  engineerEmail?: string;
}

export interface SimulationScenario {
  id: string;
  scenarioCode: string;
  title: string;
  scenarioType: SimulationType;
  status: 'DRAFT' | 'COMPLETED' | 'SUBMITTED';
  creatorName: string;
  creatorEmail?: string;
  substationId: string | null;
  sourceFeederId: string;
  targetFeederId: string;
  transformerId: string | null;
  tieSwitchId: string;
  sectionalizerId: string;
  transferredLoadMva: number;
  loadTransferPct: number;
  expectedDurationMin: number;
  timeOfOperation: string;
  incidentId: string | null;
  faultId: string | null;
  isDemonstrationMode: boolean;
  source: AssetSource;
  assumptionsLog: string;
  targetFeederCapacityMva: number;
  targetFeederPreLoadMva: number;
  targetFeederPostLoadMva: number;
  minBusVoltagePu: number;
  thermalViolation: boolean;
  voltageViolation: boolean;
  opendssScript: string;
  createdAt: string;
  simulationAssets: SimulationAssetLink[];
  impactAnalysis: SimulationImpactAnalysis;
  riskAssessment: SimulationRiskAssessment;
  recommendation: SimulationRecommendation;
  mapOverlay: SimulationMapOverlay;
}

export interface SimulationComparisonResult {
  scenarioIds: string[];
  recommendedScenarioId: string;
  summary: string;
  rows: Array<{
    simulationId: string;
    scenarioCode: string;
    scenarioType: SimulationType;
    riskLevel: SimulationRiskLevel;
    postLoadPct: number;
    minBusVoltagePu: number;
    consumersAffectedAfter: number | null;
    expectedOutageDurationMin: number;
    thermalViolation: boolean;
    voltageViolation: boolean;
  }>;
}

export interface VerificationChecklistState {
  faultResolved: boolean;
  equipmentTested: boolean;
  powerRestored: boolean;
  safetyChecksCompleted: boolean;
  documentationCompleted: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
  verificationNotes?: string;
}

export interface EngineeringDecision {
  id: string;
  decisionCode: string;
  incidentId?: string | null;
  faultId?: string | null;
  title: string;
  rationale: string;
  riskAssessment: string;
  recommendationSummary?: string;
  targetAssetId: string;
  priority?: PriorityLevel;
  riskLevel?: RiskLevel;
  escalated?: boolean;
  escalationReason?: string;
  assignedTaskId?: string | null;
  state?: string;
  district?: string;
  area?: string;
  proposedBy: string;
  proposedByEmail: string;
  reviewedBy?: string;
  reviewedByEmail?: string;
  status: DecisionStatus;
  source: AssetSource;
  evidenceBundle: {
    conflictIssueIds: string[];
    eventTimelineIds: string[];
    simulationScenarioId?: string;
    affectedCustomersCount: number | null;
    reliabilityImpact: string;
    aiRecommendationSummary?: string;
    aiConfidenceScore?: number;
    aiReasons?: string[];
  };
  verificationChecklist?: VerificationChecklistState;
  resolutionSummary?: string;
  resolutionTimeMinutes?: number;
  closedAt?: string;
  closedBy?: string;
  signatureHash: string;
  createdAt: string;
  updatedAt: string;
  comments: {
    author: string;
    role: UserRole;
    timestamp: string;
    text: string;
  }[];
}

export interface ApprovalRecord {
  id: string;
  decisionId: string;
  decisionCode: string;
  action: 'APPROVED' | 'REJECTED' | 'ESCALATED';
  approverName: string;
  approverEmail: string;
  approverRole: UserRole;
  comments: string;
  timestamp: string;
  signatureHash: string;
}

export type FieldTaskStatus =
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'TRAVELING'
  | 'ON_SITE'
  | 'INSPECTION'
  | 'REPAIR'
  | 'VERIFICATION'
  | 'IN_PROGRESS'
  | 'PAUSED'
  | 'COMPLETED'
  | 'VERIFIED';

export interface FieldTaskNavigationWaypoint {
  step: string;
  distanceLabel: string;
}

export interface FieldTask {
  id: string;
  taskCode: string;
  decisionId: string;
  decisionCode: string;
  incidentId?: string | null;
  faultId?: string | null;
  title: string;
  engineerId?: string;
  assignedEngineer: string;
  assignedEngineerEmail: string;
  assignedTeam: string;
  assetId: string;
  assetName: string;
  faultLocation: string;
  state: string;
  district: string;
  area: string;
  gpsLat: number;
  gpsLon: number;
  navigationRoute: FieldTaskNavigationWaypoint[];
  safetyNotes: string;
  maintenanceHistoryNotes: string;
  previousIncidentsSummary: string;
  scheduledTime: string;
  dueDate: string;
  etaMinutes?: number;
  distanceKm?: number;
  estimatedCompletionAt?: string;
  acceptedAt?: string;
  arrivedAt?: string;
  routeProgressPct?: number;
  priority: PriorityLevel;
  status: FieldTaskStatus;
  source: AssetSource;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  pausedAt?: string;
  completedAt?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  pauseReason?: string;
  completionNotes?: string;
}

export interface FieldEvidence {
  id: string;
  taskId: string;
  taskCode: string;
  decisionId?: string;
  fileName: string;
  filePath?: string;
  mimeType: string;
  fileSizeBytes: number;
  filePreviewUrl?: string;
  videoFileName?: string;
  voiceNoteSummary?: string;
  repairNotes?: string;
  gpsLat: number;
  gpsLon: number;
  notes: string;
  inspectionResult: 'PASS' | 'REPAIR_COMPLETED' | 'FURTHER_WORK_REQUIRED';
  equipmentCondition: 'GOOD' | 'DEGRADED' | 'REPLACED' | 'FAULTED';
  meterReadings: {
    voltageKv?: string;
    loadAmps?: string;
    insulationMohm?: string;
    temperatureC?: string;
  };
  uploadedBy: string;
  uploadedByEmail: string;
  uploadedAt: string;
  source: AssetSource;
}

export type NotificationType =
  | 'NEW_INCIDENT'
  | 'APPROVAL_REQUIRED'
  | 'TASK_ASSIGNED'
  | 'TASK_OVERDUE'
  | 'INCIDENT_RESOLVED'
  | 'HIGH_RISK_SIMULATION'
  | 'ROUTE_UPDATED'
  | 'HIGH_PRIORITY_INCIDENT'
  | 'TASK_REMINDER'
  | 'ENGINEER_ARRIVED'
  | 'REPAIR_STARTED'
  | 'REPAIR_COMPLETED'
  | 'EVIDENCE_UPLOADED';

export interface GridNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  severity: Severity;
  timestamp: string;
  read: boolean;
  relatedAssetId?: string;
  relatedIncidentId?: string;
  relatedDecisionId?: string;
  relatedTaskId?: string;
  targetView?: string;
  source: AssetSource;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actorEmail: string;
  actorRole: UserRole;
  actionType:
    | 'USER_LOGIN'
    | 'ASSET_SELECTED'
    | 'DATA_RECONCILED'
    | 'SCENARIO_SIMULATED'
    | 'SIMULATION_CREATED'
    | 'REPORT_EXPORTED'
    | 'DECISION_SUBMITTED'
    | 'DECISION_APPROVED'
    | 'DECISION_REJECTED'
    | 'DECISION_CLOSED'
    | 'FIELD_TASK_ASSIGNED'
    | 'FIELD_TASK_UPDATED'
    | 'FIELD_TASK_ACCEPTED'
    | 'FIELD_TASK_COMPLETED'
    | 'ENGINEER_LOCATION_UPDATED'
    | 'GEOFENCE_EVENT'
    | 'EVIDENCE_UPLOADED'
    | 'CASE_VERIFIED'
    | 'INCIDENT_CLOSED'
    | 'EVENT_ANNOTATED'
    | 'AI_RECALCULATED'
    | 'AI_RECOMMENDATION_GENERATED';
  module?: string;
  targetEntity: string;
  entityId: string;
  relatedAssetId?: string;
  relatedIncidentId?: string;
  summary: string;
  metadata?: Record<string, unknown>;
  ipAddress: string;
}

export interface SystemStats {
  totalAssets: number;
  dataQualityScore: number;
  activeConflictsCount: number;
  reconstructedEventsCount: number;
  activeScenariosCount: number;
  pendingApprovalsCount: number;
  orphanedAssetsCount: number;
}

// ----------------------------------------------------------------------------
// Phase 7: AI Intelligence Engine & Predictive Analytics
// ----------------------------------------------------------------------------

export type AssetHealthCategory = 'HEALTHY' | 'WARNING' | 'CRITICAL';

export type GridRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface AiHealthFactor {
  factor: string;
  impactPoints: number;
  observation: string;
}

export interface AssetHealthScore {
  assetId: string;
  assetName: string;
  assetType: AssetType;
  state: string;
  district: string;
  area: string;
  substationId: string | null;
  feederId: string | null;
  healthScore: number;
  category: AssetHealthCategory;
  riskLevel: GridRiskLevel;
  ageYears: number;
  maintenanceOverdueDays: number;
  historicalFaultCount: number;
  downtimeHours90d: number;
  voltageDeviationPct: number;
  peakLoadPct: number;
  temperatureTrendC: number | null;
  factors: AiHealthFactor[];
  lastUpdated: string;
  source: AssetSource;
}

export type FailurePredictionType =
  | 'TRANSFORMER_FAILURE'
  | 'FEEDER_OVERLOAD'
  | 'BREAKER_WEAR'
  | 'SWITCH_RELIABILITY'
  | 'SUBSTATION_RISK';

export interface FailurePrediction {
  id: string;
  assetId: string;
  assetName: string;
  assetType: AssetType;
  failureType: FailurePredictionType;
  probabilityPct: number;
  confidenceScore: number;
  estimatedFailureWindow: string;
  predictedDate: string;
  riskLevel: GridRiskLevel;
  contributingFactors: string[];
  historicalComparison: string;
  recommendedAction: string;
  supportingEvidence: string[];
  source: AssetSource;
}

export type GridRiskScopeLevel = 'STATE' | 'DISTRICT' | 'AREA' | 'SUBSTATION' | 'FEEDER';

export interface GridRiskIndexEntry {
  id: string;
  scopeLevel: GridRiskScopeLevel;
  name: string;
  parentLabel: string;
  riskScore: number;
  riskLevel: GridRiskLevel;
  activeIncidentsCount: number;
  historicalFailuresCount: number;
  avgAssetHealth: number;
  maintenanceBacklogCount: number;
  avgLoadPct: number;
  latitude?: number;
  longitude?: number;
}

export interface AiRecommendation {
  id: string;
  assetId: string;
  assetName: string;
  healthScore: number;
  priority: PriorityLevel;
  recommendation: string;
  reasons: string[];
  expectedRiskReductionPct: number;
  confidenceScore: number;
  targetView: 'decisions' | 'simulator' | 'field';
  linkedPredictionId?: string;
  linkedScenarioParams?: {
    sourceFeeder?: string;
    targetFeeder?: string;
    tieSwitch?: string;
    loadTransferMva?: number;
  };
  createdAt: string;
  source: AssetSource;
}

export type IncidentPatternType =
  | 'REPEATED_FEEDER_FAILURE'
  | 'OVERLOADED_TRANSFORMER'
  | 'SEASONAL_OUTAGE_TREND'
  | 'HIGH_RISK_MAINTENANCE_ZONE';

export interface IncidentPattern {
  id: string;
  patternType: IncidentPatternType;
  title: string;
  summary: string;
  affectedAssetIds: string[];
  occurrencesCount: number;
  geographicScope: string;
  severity: Severity;
  seasonalityTag?: string;
}

export interface MaintenancePriorityItem {
  id: string;
  assetId: string;
  assetName: string;
  assetType: AssetType;
  healthScore: number;
  failureProbabilityPct: number;
  customerImpactCount: number | null;
  networkImportanceScore: number;
  safetyRiskNote: string;
  priorityRankScore: number;
  priority: PriorityLevel;
  recommendedWindow: string;
  reasonSummary: string;
}

export type AssetTimelineStageKey =
  | 'INSTALLATION'
  | 'ROUTINE_MAINTENANCE'
  | 'MINOR_FAULT'
  | 'MAJOR_FAULT'
  | 'REPAIR'
  | 'CURRENT_HEALTH'
  | 'PREDICTED_RISK';

export interface AssetTimelineStage {
  stage: AssetTimelineStageKey;
  label: string;
  timestamp: string;
  detail: string;
  status: 'NOMINAL' | 'WARNING' | 'CRITICAL' | 'FUTURE';
}

export interface ModelPerformanceMetrics {
  modelVersion: string;
  algorithm: string;
  trainingSamples: number;
  precisionPct: number;
  recallPct: number;
  f1Score: number;
  rocAuc: number;
  lastTrainedAt: string;
  nextScheduledRunAt: string;
  driftStatus: 'STABLE' | 'WATCH';
}

export interface AiIntelligenceSnapshot {
  healthScores: AssetHealthScore[];
  predictions: FailurePrediction[];
  riskIndices: GridRiskIndexEntry[];
  recommendations: AiRecommendation[];
  patterns: IncidentPattern[];
  maintenanceQueue: MaintenancePriorityItem[];
  monthlyFailureTrends: Array<{
    month: string;
    actualFaults: number;
    predictedFaults: number;
    preventiveActions: number;
  }>;
  modelMetrics: ModelPerformanceMetrics;
  recalculatedAt: string;
}

// ----------------------------------------------------------------------------
// Phase 8: Real-Time Streaming, Alert Center, Auth Session, Health & Export
// ----------------------------------------------------------------------------

export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'INFO';

export type AlertCategory =
  | 'OUTAGE_FAULT'
  | 'AI_RISK'
  | 'DATA_INTEGRITY'
  | 'FIELD_OPERATION'
  | 'MAINTENANCE'
  | 'SYSTEM_SECURITY';

export interface GridAlert {
  id: string;
  title: string;
  assetId: string;
  assetName: string;
  locationLabel: string;
  severity: AlertSeverity;
  category: AlertCategory;
  timestamp: string;
  recommendedAction: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  targetView: string;
  source: AssetSource;
}

export interface GridToast {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  timestamp: string;
  relatedAssetId?: string;
  targetView?: string;
}

export type WebSocketConnectionState =
  | 'CONNECTING'
  | 'CONNECTED'
  | 'RECONNECTING'
  | 'DISCONNECTED';

export interface SystemHealthSnapshot {
  status: string;
  apiStatus: 'HEALTHY' | 'DEGRADED';
  databaseStatus: string;
  aiServiceStatus: 'HEALTHY' | 'DEGRADED';
  webSocketStatus: {
    status: 'ACTIVE' | 'IDLE';
    connectedClients: number;
    sseClients: number;
  };
  uptimeSeconds: number;
  avgLatencyMs: number;
  totalRequests: number;
  errorCount: number;
  failedLoginAttempts: number;
  aiRecalculationsCount: number;
  assetCount: number;
  demoMode: boolean;
  checkedAt: string;
}

export interface AuthSession {
  authenticated: boolean;
  mode: 'DEMO' | 'CREDENTIALS';
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  accessToken: string;
  refreshToken: string;
  expiresAtMs: number;
}

export type ExportReportType =
  | 'INCIDENTS'
  | 'ASSETS'
  | 'MAINTENANCE'
  | 'SIMULATIONS'
  | 'AUDIT_LOGS'
  | 'AI_RECOMMENDATIONS'
  | 'GRID_HEALTH'
  | 'REGIONAL_PERFORMANCE'
  | 'ASSET_RELIABILITY'
  | 'DECISION_GOVERNANCE';

export type ExportFormat = 'PDF' | 'EXCEL' | 'CSV';

// ----------------------------------------------------------------------------
// Phase 9: Enterprise Readiness, Digital Twin & Innovation Layer
// ----------------------------------------------------------------------------

export type DigitalTwinNodeLevel =
  | 'COUNTRY'
  | 'STATE'
  | 'DISTRICT'
  | 'SUBSTATION'
  | 'FEEDER'
  | 'TRANSFORMER'
  | 'SWITCH'
  | 'POWER_LINE'
  | 'CONSUMER_CLUSTER';

export interface DigitalTwinNode {
  id: string;
  canonicalId: string;
  name: string;
  nodeLevel: DigitalTwinNodeLevel;
  parentId: string | null;
  status: AssetStatus;
  healthScore: number;
  riskLevel: GridRiskLevel;
  activeIncidentsCount: number;
  connectedAssetIds: string[];
  maintenanceStatus: 'NOMINAL' | 'SCHEDULED' | 'OVERDUE' | 'IN_REPAIR';
  loadPct: number | null;
  voltage: string | null;
  state: string;
  district: string;
  area: string;
  source: AssetSource;
  children: DigitalTwinNode[];
}

export interface DigitalTwinNetworkState {
  roots: DigitalTwinNode[];
  flatNodes: DigitalTwinNode[];
  totalNodes: number;
  totalEdges: number;
  faultedNodesCount: number;
  avgHealthScore: number;
  synchronizedAt: string;
}

export type RegionalKpiScope = 'NATIONAL' | 'STATE' | 'DISTRICT' | 'AREA' | 'SUBSTATION';

export interface RegionalPerformanceKpi {
  regionId: string;
  regionName: string;
  scopeLevel: RegionalKpiScope;
  parentRegion: string;
  gridReliabilityPct: number;
  assetAvailabilityPct: number;
  faultFrequencyPer100Km: number;
  mttrHours: number;
  mtbfHours: number;
  maintenanceCompliancePct: number;
  avgResponseTimeMin: number;
  activeIncidents: number;
  assetCount: number;
}

export type AiOperationalInsightCategory =
  | 'FREQUENT_FAILURE'
  | 'INVESTMENT_NEEDED'
  | 'RECURRING_PATTERN'
  | 'MAINTENANCE_BOTTLENECK'
  | 'HIGH_RISK_REGION';

export interface AiOperationalInsight {
  id: string;
  category: AiOperationalInsightCategory;
  title: string;
  summary: string;
  supportingMetrics: string[];
  impactedRegion: string;
  relatedAssetIds: string[];
  priority: PriorityLevel;
}

export type AssetLifecycleStage =
  | 'INSTALLATION'
  | 'COMMISSIONING'
  | 'ROUTINE_INSPECTION'
  | 'MAINTENANCE'
  | 'REPAIR'
  | 'UPGRADE'
  | 'REPLACEMENT';

export interface AssetLifecycleEvent {
  id: string;
  stage: AssetLifecycleStage;
  date: string;
  performedBy: string;
  summary: string;
  costInrLakhs?: number;
}

export interface AssetLifecycleRecord {
  assetId: string;
  assetName: string;
  assetType: AssetType;
  currentStage: AssetLifecycleStage;
  installationDate: string;
  commissioningDate: string;
  expectedReplacementDate: string;
  totalInspections: number;
  events: AssetLifecycleEvent[];
}

export interface EnterpriseScenarioComparisonRow {
  scenarioId: string;
  label: string;
  scenarioType: string;
  customerImpactCount: number;
  riskLevel: GridRiskLevel;
  estimatedRestorationMin: number;
  resourceUtilizationPct: number;
  estimatedCostInrLakhs: number;
  minVoltagePu: number;
  isBaseline: boolean;
}

export type DashboardWidgetId =
  | 'EXECUTIVE_KPI_STRIP'
  | 'REGIONAL_PERFORMANCE'
  | 'AI_INSIGHTS'
  | 'SCENARIO_COMPARISON'
  | 'INCIDENT_TRENDS'
  | 'LIFECYCLE_WATCH';

export interface SavedMapFilterPreset {
  id: string;
  name: string;
  geoFilter: Partial<GeographicFilterState>;
}

export interface DashboardCustomizationPrefs {
  widgetOrder: DashboardWidgetId[];
  hiddenWidgets: DashboardWidgetId[];
  favoriteRegions: string[];
  savedFilterPresets: SavedMapFilterPreset[];
  customKpiTargets: {
    reliabilityTargetPct: number;
    mttrMaxHours: number;
    complianceTargetPct: number;
  };
}

export interface ExecutiveReportRecord {
  reportId: string;
  reportType: ExportReportType;
  format: ExportFormat;
  generatedBy: string;
  scopeLabel: string;
  rowCount: number;
  filename: string;
  generatedAt: string;
}

export interface AdminUserRecord {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: 'ACTIVE' | 'SUSPENDED';
  lastActiveAt: string;
}

export interface AdminAiModelSettings {
  riskThresholdHigh: number;
  riskThresholdMedium: number;
  predictionWindowDays: number;
  autoRecalculateOnWsFault: boolean;
  maintenanceWeightLoadPct: number;
}

export interface AdminNotificationSettings {
  notifyCriticalAlerts: boolean;
  notifyAiRecommendations: boolean;
  notifyFieldUpdates: boolean;
  escalateUnacknowledgedMin: number;
}

export interface AdminBackupSnapshot {
  id: string;
  createdAt: string;
  createdBy: string;
  assetCount: number;
  decisionCount: number;
  auditCount: number;
  checksum: string;
}

// ----------------------------------------------------------------------------
// Phase 11: Live Field Operations & Real-Time Workforce Tracking
// ----------------------------------------------------------------------------

export type FieldEngineerStatus =
  | 'AVAILABLE'
  | 'TRAVELING'
  | 'WORKING'
  | 'ON_BREAK'
  | 'OFFLINE';

export type EngineerNetworkStatus = '5G' | '4G_LTE' | '3G' | 'OFFLINE';

export interface FieldEngineer {
  engineerId: string;
  employeeId: string;
  name: string;
  email: string;
  phone: string;
  team: string;
  assignedArea: string;
  state: string;
  district: string;
  skills: string[];
  status: FieldEngineerStatus;
  currentTaskId: string | null;
  currentTaskCode: string | null;
  currentAssetId: string | null;
  latitude: number;
  longitude: number;
  speedKmh: number;
  headingDeg: number;
  batteryPct: number;
  networkStatus: EngineerNetworkStatus;
  activeWorkloadCount: number;
  lastLocationUpdate: string;
  source: AssetSource;
}

export interface EngineerRecommendation {
  engineerId: string;
  employeeId: string;
  name: string;
  email: string;
  team: string;
  status: FieldEngineerStatus;
  distanceKm: number;
  etaMinutes: number;
  workloadCount: number;
  skillMatchPct: number;
  compositeScore: number;
  recommended: boolean;
  reason: string;
}

export interface LiveRouteInfo {
  routeId: string;
  taskId: string;
  taskCode: string;
  engineerId: string;
  engineerName: string;
  assetId: string;
  assetName: string;
  originLat: number;
  originLon: number;
  currentLat: number;
  currentLon: number;
  destLat: number;
  destLon: number;
  coordinates: [number, number][]; // [lng, lat] pairs for GeoJSON LineString
  totalDistanceKm: number;
  remainingDistanceKm: number;
  etaMinutes: number;
  speedKmh: number;
  progressPct: number;
  provider: 'MAPBOX_DIRECTIONS' | 'GRIDGUARD_CORRIDOR';
  updatedAt: string;
}

export type GeoFenceType =
  | 'SUBSTATION'
  | 'TRANSFORMER'
  | 'MAINTENANCE_ZONE'
  | 'FAULT_LOCATION';

export interface GeoFenceZone {
  id: string;
  name: string;
  fenceType: GeoFenceType;
  assetId: string;
  centerLat: number;
  centerLon: number;
  radiusMeters: number;
  active: boolean;
}

export type GeoFenceEventType =
  | 'ENTER_WORK_ZONE'
  | 'LEAVE_WORK_ZONE'
  | 'REACHED_ASSET'
  | 'COMPLETED_WORK';

export interface GeoFenceEvent {
  id: string;
  engineerId: string;
  engineerName: string;
  taskId: string | null;
  fenceId: string;
  fenceName: string;
  fenceType: GeoFenceType;
  assetId: string;
  eventType: GeoFenceEventType;
  latitude: number;
  longitude: number;
  distanceToCenterMeters: number;
  timestamp: string;
  summary: string;
}

export type IncidentTimelineStage =
  | 'FAULT_DETECTED'
  | 'MANAGER_NOTIFIED'
  | 'ENGINEER_ASSIGNED'
  | 'ENGINEER_ACCEPTED'
  | 'NAVIGATION_STARTED'
  | 'ARRIVED_ON_SITE'
  | 'INSPECTION_COMPLETED'
  | 'REPAIR_COMPLETED'
  | 'POWER_RESTORED'
  | 'INCIDENT_CLOSED';

export interface LiveIncidentTimelineStep {
  id: string;
  stage: IncidentTimelineStage;
  label: string;
  timestamp: string | null;
  status: 'COMPLETED' | 'ACTIVE' | 'PENDING';
  actor: string;
  detail: string;
}

export interface FieldOperationsDashboardMetrics {
  engineersOnline: number;
  engineersAvailable: number;
  engineersTraveling: number;
  engineersOnSite: number;
  openTasks: number;
  completedTasksToday: number;
  highPriorityIncidents: number;
  avgResponseTimeMin: number;
  avgRepairTimeMin: number;
  activeRoutesCount: number;
  geofenceAlertsCount: number;
  calculatedAt: string;
}

export type WebSocketEventType =
  | 'WELCOME'
  | 'PONG'
  | 'TELEMETRY_BATCH'
  | 'ALERT_CREATED'
  | 'INCIDENT_TRIGGERED'
  | 'ALERT_ACKNOWLEDGED'
  | 'DEMO_RESET'
  | 'DIGITAL_TWIN_UPDATE'
  | 'GOVERNANCE_UPDATE'
  | 'FIELD_UPDATE'
  | 'ENGINEER_LOCATION_UPDATED'
  | 'FIELD_ROUTE_UPDATED'
  | 'GEOFENCE_EVENT'
  | 'INCIDENT_TIMELINE_UPDATED';



