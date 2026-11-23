import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type {
  ActiveFault,
  AdminAiModelSettings,
  AdminBackupSnapshot,
  AdminNotificationSettings,
  AdminUserRecord,
  AdminWorkspaceTab,
  AiIntelligenceSnapshot,
  AiOperationalInsight,
  AiRecommendation,
  ApprovalRecord,
  AssetHealthScore,
  AssetLifecycleRecord,
  AssetSource,
  AssetTelemetryStatus,
  AssetTimelineStage,
  AuditLog,
  AuthSession,
  DashboardCustomizationPrefs,
  DashboardWidgetId,
  DataQualityIssue,
  DigitalTwinNetworkState,
  EngineerRecommendation,
  EngineeringDecision,
  EnterpriseScenarioComparisonRow,
  EventReconstructionIncident,
  ExecutiveReportRecord,
  ExportFormat,
  ExportReportType,
  FieldEngineer,
  FieldEngineerStatus,
  FieldEvidence,
  FieldOperationsDashboardMetrics,
  FieldTask,
  FieldTaskStatus,
  FocusRequest,
  GeoFenceEvent,
  GeoFenceZone,
  GeographicBoundary,
  GeographicFilterState,
  GeographicSearchResult,
  GraphNodeData,
  GridAlert,
  GridNotification,
  GridToast,
  InfrastructureAsset,
  LiveIncidentTimelineStep,
  LiveRouteInfo,
  MaintenanceZone,
  MapFilterLayers,
  OperationalEvent,
  OsmAsset,
  OverviewDashboardMode,
  PendingDecisionDraft,
  PowerLine,
  PriorityLevel,
  RegionalPerformanceKpi,
  RootCauseAnalysis,
  SavedMapFilterPreset,
  SelectionSource,
  SimulationComparisonResult,
  SimulationInputParams,
  SimulationMapOverlay,
  SimulationScenario,
  SimulatorWorkspaceTab,
  SystemHealthSnapshot,
  SystemStats,
  UserRole,
  VerificationChecklistState,
  WebSocketConnectionState,
  WorkflowStageId
} from '../types/grid';
import {
  INITIAL_APPROVALS,
  INITIAL_ASSETS,
  INITIAL_AUDIT_LOGS,
  INITIAL_DATA_QUALITY_ISSUES,
  INITIAL_ENGINEERING_DECISIONS,
  INITIAL_EVENT_RECONSTRUCTIONS,
  INITIAL_FAULTS,
  INITIAL_FIELD_EVIDENCE,
  INITIAL_FIELD_TASKS,
  INITIAL_MAINTENANCE_ZONES,
  INITIAL_NOTIFICATIONS,
  INITIAL_OPERATIONAL_EVENTS,
  INITIAL_POWER_LINES,
  INITIAL_SIMULATION_SCENARIOS,
  INITIAL_STATS,
  buildOsmTagIntegrityIssues,
  formatMissingValue,
  getConnectedPathForAsset,
  normalizeOsmToInfrastructureAsset,
  normalizeOsmToPowerLine
} from '../services/syntheticData';
import { GEOGRAPHIC_BOUNDARIES } from '../services/geographyBoundariesData';
import {
  DEFAULT_GEO_FILTER,
  INDIA_CENTER,
  INDIA_ZOOM,
  INITIAL_MAP_CENTER,
  INITIAL_MAP_ZOOM,
  type ScopedAssetCounts,
  computeViewportForSelection,
  filterAssetsByHierarchy,
  formatGeoBreadcrumb,
  hasRegionalSelection,
  scopePlatformData
} from '../services/geographyService';
import { buildRootCauseAnalysis } from '../services/intelligenceService';
import {
  compareSimulationScenarios,
  executeWhatIfSimulation
} from '../services/simulationEngine';
import { createTelemetryProvider } from '../services/telemetry/telemetryFactory';
import {
  getRolePermissions,
  isChecklistComplete,
  type RolePermissions,
  validateEvidenceFile
} from '../services/governanceHelpers';
import {
  buildAssetAiTimeline,
  computeAiIntelligenceSnapshot
} from '../services/aiIntelligenceEngine';
import {
  buildAssetLifecycleRegistry,
  buildDigitalTwinNetwork,
  compareEnterpriseScenarios,
  computeRegionalPerformanceKpis,
  generateAiOperationalInsights
} from '../services/digitalTwinEngine';
import {
  INITIAL_FIELD_ENGINEERS,
  buildGeoFencesForGrid,
  buildLiveIncidentTimeline,
  computeFallbackRoute,
  computeFieldDashboardMetrics,
  evaluateGeoFenceTransitions,
  haversineDistanceKm,
  mapTaskStatusToEngineerStatus,
  recommendEngineersForAsset
} from '../services/fieldOperationsEngine';
import { exportOperationalReport } from '../services/exportReportsService';

const HIERARCHY_ORDER: Array<keyof GeographicFilterState> = [
  'country',
  'state',
  'district',
  'division',
  'subdivision',
  'city',
  'area',
  'substationId',
  'feederId',
  'transformerId'
];

export interface MapBoundingBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

interface GridContextType {
  assets: InfrastructureAsset[];
  issues: DataQualityIssue[];
  events: OperationalEvent[];
  scenarios: SimulationScenario[];
  decisions: EngineeringDecision[];
  approvals: ApprovalRecord[];
  fieldTasks: FieldTask[];
  fieldEvidence: FieldEvidence[];
  notifications: GridNotification[];
  unreadNotificationsCount: number;
  activeTaskId: string | null;
  rolePermissions: RolePermissions;
  auditLogs: AuditLog[];
  stats: SystemStats;
  boundaries: GeographicBoundary[];
  currentRole: UserRole;
  isDark: boolean;
  activeView: string;
  overviewMode: OverviewDashboardMode;
  setOverviewMode: (mode: OverviewDashboardMode) => void;
  simulatorTab: SimulatorWorkspaceTab;
  setSimulatorTab: (tab: SimulatorWorkspaceTab) => void;
  adminTab: AdminWorkspaceTab;
  setAdminTab: (tab: AdminWorkspaceTab) => void;
  faults: ActiveFault[];
  maintenanceZones: MaintenanceZone[];
  powerLines: PowerLine[];
  // Canonical Shared Selection & Bidirectional Map <-> Knowledge Graph Sync
  selectedAssetId: string | null;
  hoveredAssetId: string | null;
  selectionSource: SelectionSource | null;
  hoverSource: 'map' | 'graph' | null;
  focusRequest: FocusRequest | null;
  connectedPath: { nodeIds: Set<string>; lineIds: Set<string> };
  selectedFaultId: string | null;
  faultFocusNonce: number;
  eventReconstructions: EventReconstructionIncident[];
  scopedReconstructions: EventReconstructionIncident[];
  selectedReconstructionId: string;
  highlightedAssetIds: string[];
  pendingSimulationParams: {
    sourceFeeder?: string;
    targetFeeder?: string;
    tieSwitch?: string;
    loadTransferMva?: number;
  } | null;
  activeSimulationId: string | null;
  activeSimulation: SimulationScenario | null;
  activeSimulationOverlay: SimulationMapOverlay | null;
  simulationOverlayPlaying: boolean;
  pendingDecisionDraft: PendingDecisionDraft | null;
  activeRootCauseAnalysis: RootCauseAnalysis;
  activeWorkflowStage: WorkflowStageId;
  focusRcaNonce: number;
  maintenanceFocusNonce: number;
  mapCenter: [number, number];
  mapZoom: number;
  currentMapZoom: number;
  mapLayers: MapFilterLayers;
  geoFilter: GeographicFilterState;
  hasRegionSelection: boolean;
  geoScopeLabel: string;
  // Live OSM & Telemetry State
  osmLoading: boolean;
  osmError: string | null;
  osmCached: boolean;
  osmLastFetchedAt: string | null;
  telemetryByAssetId: Record<string, AssetTelemetryStatus>;
  telemetryProviderName: string;
  telemetrySourceType: AssetSource;
  // Globally Scoped Datasets (synchronized with geographic filter & 1:1 with map markers)
  scopedAssets: InfrastructureAsset[];
  scopedDisplayAssets: InfrastructureAsset[];
  scopedDisplayPowerLines: PowerLine[];
  scopedAssetCounts: ScopedAssetCounts;
  scopedFaults: ActiveFault[];
  scopedMaintenanceZones: MaintenanceZone[];
  scopedPowerLines: PowerLine[];
  scopedBoundaries: GeographicBoundary[];
  scopedIssues: DataQualityIssue[];
  scopedEvents: OperationalEvent[];
  scopedScenarios: SimulationScenario[];
  scopedDecisions: EngineeringDecision[];
  scopedAuditLogs: AuditLog[];
  scopedStats: SystemStats;
  // Phase 7: AI Intelligence Engine & Predictive Analytics
  aiSnapshot: AiIntelligenceSnapshot;
  scopedAiSnapshot: AiIntelligenceSnapshot;
  aiLastRecalculatedAt: string;
  recalculateAiIntelligence: () => void;
  getAssetHealth: (assetId: string) => AssetHealthScore | undefined;
  getAssetTimeline: (assetId: string) => AssetTimelineStage[];
  prepareDecisionFromAiRecommendation: (rec: AiRecommendation) => void;
  launchSimulationFromAiRecommendation: (rec: AiRecommendation) => void;
  // Phase 8: WebSocket, Alert Center, Toasts, Auth Session, Demo Mode, Health & Reports
  wsState: WebSocketConnectionState;
  lastWsMessageAt: string | null;
  recentAnimatedAssetIds: string[];
  alerts: GridAlert[];
  unacknowledgedAlertsCount: number;
  acknowledgeAlert: (alertId: string) => void;
  toasts: GridToast[];
  pushToast: (toast: Omit<GridToast, 'id' | 'timestamp'>) => void;
  dismissToast: (toastId: string) => void;
  systemHealth: SystemHealthSnapshot | null;
  refreshSystemHealth: () => Promise<void>;
  isDemoMode: boolean;
  toggleDemoMode: () => void;
  triggerLiveDemoIncident: (assetId?: string) => Promise<void>;
  authSession: AuthSession | null;
  loginWithCredentials: (identifier: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  registerAccount: (input: {
    username: string;
    email: string;
    fullName: string;
    password: string;
    role: UserRole;
  }) => Promise<{ ok: boolean; error?: string }>;
  logoutAuthSession: () => Promise<void>;
  exportReport: (reportType: ExportReportType, format: ExportFormat) => { filename: string; rowCount: number };
  // Phase 9: Enterprise Digital Twin, Executive Command, Lifecycle, Customization & Admin
  digitalTwinNetwork: DigitalTwinNetworkState;
  regionalKpis: RegionalPerformanceKpi[];
  aiOperationalInsights: AiOperationalInsight[];
  assetLifecycleRecords: AssetLifecycleRecord[];
  getAssetLifecycle: (assetId: string) => AssetLifecycleRecord | undefined;
  enterpriseScenarioComparison: EnterpriseScenarioComparisonRow[];
  dashboardCustomization: DashboardCustomizationPrefs;
  moveDashboardWidget: (widgetId: DashboardWidgetId, direction: 'UP' | 'DOWN') => void;
  toggleDashboardWidget: (widgetId: DashboardWidgetId) => void;
  toggleFavoriteRegion: (regionName: string) => void;
  saveMapFilterPreset: (name: string) => void;
  applyMapFilterPreset: (preset: SavedMapFilterPreset) => void;
  updateCustomKpiTargets: (targets: DashboardCustomizationPrefs['customKpiTargets']) => void;
  executiveReportsHistory: ExecutiveReportRecord[];
  adminUsers: AdminUserRecord[];
  adminAiSettings: AdminAiModelSettings;
  adminNotificationSettings: AdminNotificationSettings;
  adminBackups: AdminBackupSnapshot[];
  createAdminUser: (input: { username: string; email: string; fullName: string; role: UserRole }) => Promise<{ ok: boolean; error?: string }>;
  updateAdminUser: (userId: string, patch: { role?: UserRole; status?: 'ACTIVE' | 'SUSPENDED' }) => Promise<{ ok: boolean; error?: string }>;
  updateAdminSettings: (patch: { aiSettings?: Partial<AdminAiModelSettings>; notificationSettings?: Partial<AdminNotificationSettings> }) => Promise<{ ok: boolean; error?: string }>;
  importAdminAssets: (rawAssets: Array<Partial<InfrastructureAsset>>) => Promise<{ ok: boolean; count?: number; error?: string }>;
  createAdminBackup: () => Promise<{ ok: boolean; error?: string }>;
  restoreAdminBackup: (backupId: string) => Promise<{ ok: boolean; error?: string }>;
  // Phase 11: Live Field Operations & Real-Time Workforce Tracking
  fieldEngineers: FieldEngineer[];
  selectedEngineerId: string | null;
  setSelectedEngineerId: (engineerId: string | null) => void;
  engineerRoutes: LiveRouteInfo[];
  geoFences: GeoFenceZone[];
  geoFenceEvents: GeoFenceEvent[];
  fieldDashboardMetrics: FieldOperationsDashboardMetrics;
  getRecommendedEngineersForAsset: (assetId: string) => EngineerRecommendation[];
  getLiveIncidentTimeline: (taskId?: string | null) => LiveIncidentTimelineStep[];
  assignEngineerToTask: (input: {
    assetId: string;
    engineerId: string;
    decisionId?: string;
    incidentId?: string | null;
    title?: string;
    priority?: PriorityLevel;
    dueDate?: string;
    safetyNotes?: string;
  }) => Promise<{ success: boolean; error?: string; task?: FieldTask }>;
  acceptFieldTask: (taskId: string) => Promise<{ success: boolean; error?: string }>;
  completeFieldTask: (taskId: string, notes?: string) => Promise<{ success: boolean; error?: string }>;
  updateEngineerLocation: (input: {
    engineerId: string;
    latitude: number;
    longitude: number;
    speedKmh?: number;
    status?: FieldEngineerStatus;
  }) => Promise<{ success: boolean; error?: string }>;
  simulateEngineerStepTowardTarget: (engineerId: string) => Promise<void>;
  openKnowledgeGraphForEngineer: (engineerId: string) => void;
  // Actions
  setActiveView: (view: string) => void;
  navigateWorkflowStage: (stage: WorkflowStageId) => void;
  setCurrentRole: (role: UserRole) => void;
  toggleTheme: () => void;
  selectAsset: (
    assetId: string | null,
    source: SelectionSource,
    options?: { zoom?: number; openPopup?: boolean; preserveFault?: boolean }
  ) => void;
  selectGraphNode: (node: GraphNodeData) => void;
  setHoveredAsset: (assetId: string | null, source: 'map' | 'graph') => void;
  clearSelection: () => void;
  setSelectedAssetId: (id: string | null) => void;
  setSelectedFaultId: (id: string | null) => void;
  setSelectedReconstructionId: (id: string) => void;
  setActiveTaskId: (id: string | null) => void;
  setMapCenter: (center: [number, number]) => void;
  setMapZoom: (zoom: number) => void;
  setCurrentMapZoom: (zoom: number) => void;
  setMapLayers: React.Dispatch<React.SetStateAction<MapFilterLayers>>;
  fetchOsmAssetsForBounds: (bounds: MapBoundingBox, zoom: number) => Promise<void>;
  updateGeoFilterLevel: (level: keyof GeographicFilterState, value: string) => void;
  setGeoFilterDirect: (next: GeographicFilterState) => void;
  resetGeoFilter: () => void;
  applySearchResult: (result: GeographicSearchResult) => void;
  focusAssetOnMap: (assetId: string) => void;
  syncAssetFromGraph: (assetId: string) => void;
  focusFaultOnMap: (faultId: string) => void;
  openEventReconstructionForFault: (faultId: string) => void;
  openEventReconstructionForAsset: (assetId: string) => void;
  openRootCauseForAsset: (assetId?: string) => void;
  openKnowledgeGraphForAsset: (assetId: string) => void;
  openFieldTaskForAsset: (assetId: string) => void;
  launchSimulationForAsset: (asset: InfrastructureAsset) => void;
  launchSimulationFromRca: (rcaOverride?: RootCauseAnalysis) => void;
  clearPendingSimulationParams: () => void;
  prepareDecisionFromContext: (scenario?: SimulationScenario) => void;
  clearPendingDecisionDraft: () => void;
  inspectMaintenanceHistory: (assetId: string) => void;
  raiseMaintenanceRequest: (asset: InfrastructureAsset) => EngineeringDecision;
  resolveIssue: (issueId: string, chosenValue: string, notes: string) => void;
  submitDecision: (decision: Partial<EngineeringDecision>) => EngineeringDecision;
  reviewDecision: (
    decisionId: string,
    action: 'APPROVE' | 'REJECT',
    notes: string,
    assignmentOverride?: {
      assignedEngineer?: string;
      assignedEngineerEmail?: string;
      assignedTeam?: string;
      priority?: PriorityLevel;
      dueDate?: string;
    }
  ) => { success: boolean; error?: string; createdTask?: FieldTask };
  toggleDecisionEscalation: (decisionId: string, reason?: string) => { success: boolean; error?: string };
  createFieldTask: (input: {
    decisionId: string;
    title?: string;
    assignedEngineer: string;
    assignedEngineerEmail?: string;
    assignedTeam: string;
    priority: PriorityLevel;
    dueDate: string;
    safetyNotes?: string;
  }) => { success: boolean; error?: string; task?: FieldTask };
  assignOrReassignFieldTask: (
    taskId: string,
    updates: {
      assignedEngineer: string;
      assignedEngineerEmail?: string;
      assignedTeam: string;
      priority: PriorityLevel;
      dueDate: string;
    }
  ) => { success: boolean; error?: string };
  updateFieldTaskStatus: (
    taskId: string,
    status: FieldTaskStatus,
    notes?: string
  ) => { success: boolean; error?: string };
  submitFieldEvidence: (input: {
    taskId: string;
    fileName: string;
    mimeType: string;
    fileSizeBytes: number;
    filePreviewUrl?: string;
    gpsLat: number;
    gpsLon: number;
    notes: string;
    inspectionResult: FieldEvidence['inspectionResult'];
    equipmentCondition: FieldEvidence['equipmentCondition'];
    meterReadings: FieldEvidence['meterReadings'];
  }) => { success: boolean; error?: string; evidence?: FieldEvidence };
  verifyAndCloseDecision: (
    decisionId: string,
    checklist: VerificationChecklistState,
    resolutionSummary: string
  ) => { success: boolean; error?: string };
  markNotificationRead: (notificationId: string) => void;
  markAllNotificationsRead: () => void;
  runSimulation: (
    params:
      | SimulationInputParams
      | {
          sourceFeeder: string;
          targetFeeder: string;
          loadTransferMva: number;
          tieSwitch: string;
        }
  ) => SimulationScenario;
  selectSimulationScenario: (simulationId: string | null) => void;
  setSimulationOverlayPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  compareSimulations: (scenarioIds: string[]) => SimulationComparisonResult;
  recordReportExportAudit: (scenario: SimulationScenario) => void;
  recordResolutionReportExportAudit: (decision: EngineeringDecision) => void;
  resetToSevereWeatherCascade: () => void;
}

const DEFAULT_MAP_LAYERS: MapFilterLayers = {
  states: true,
  districtBoundaries: true,
  cityBoundaries: true,
  localityBoundaries: true,
  serviceAreas: true,
  substations: true,
  feeders: true,
  transformers: true,
  circuitBreakers: true,
  switches: true,
  towersAndPoles: true,
  powerLines: true,
  faults: true,
  maintenance: true,
  conflicts: true,
  recentIncidents: true,
  simulationOverlay: true,
  riskOverlay: true
};

function telemetryStatusToAssetStatus(
  status?: AssetTelemetryStatus['status']
): InfrastructureAsset['status'] {
  switch (status) {
    case 'NORMAL':
      return 'ACTIVE';
    case 'WARNING':
      return 'WARNING';
    case 'FAULT':
      return 'FAULTED';
    default:
      return 'UNKNOWN';
  }
}

function telemetryStatusToLineStatus(
  status?: AssetTelemetryStatus['status']
): PowerLine['status'] {
  switch (status) {
    case 'FAULT':
      return 'FAULTED';
    case 'WARNING':
      return 'WARNING';
    default:
      return 'ENERGIZED';
  }
}

const GridContext = createContext<GridContextType | undefined>(undefined);

export const GridProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [assets, setAssets] = useState<InfrastructureAsset[]>(INITIAL_ASSETS);
  const [issues, setIssues] = useState<DataQualityIssue[]>(INITIAL_DATA_QUALITY_ISSUES);
  const [events, setEvents] = useState<OperationalEvent[]>(INITIAL_OPERATIONAL_EVENTS);
  const [scenarios, setScenarios] = useState<SimulationScenario[]>(INITIAL_SIMULATION_SCENARIOS);
  const [decisions, setDecisions] = useState<EngineeringDecision[]>(INITIAL_ENGINEERING_DECISIONS);
  const [approvals, setApprovals] = useState<ApprovalRecord[]>(INITIAL_APPROVALS);
  const [fieldTasks, setFieldTasks] = useState<FieldTask[]>(INITIAL_FIELD_TASKS);
  const [fieldEvidence, setFieldEvidence] = useState<FieldEvidence[]>(INITIAL_FIELD_EVIDENCE);
  const [fieldEngineers, setFieldEngineers] = useState<FieldEngineer[]>(INITIAL_FIELD_ENGINEERS);
  const [selectedEngineerId, setSelectedEngineerId] = useState<string | null>(
    INITIAL_FIELD_ENGINEERS[3]?.engineerId ?? INITIAL_FIELD_ENGINEERS[0]?.engineerId ?? null
  );
  const [geoFenceEvents, setGeoFenceEvents] = useState<GeoFenceEvent[]>([]);
  const [mapboxRouteGeometryByKey, setMapboxRouteGeometryByKey] = useState<
    Record<string, { coordinates: [number, number][]; distanceKm: number; etaMinutes: number }>
  >({});
  const [notifications, setNotifications] = useState<GridNotification[]>(INITIAL_NOTIFICATIONS);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(
    INITIAL_FIELD_TASKS[0]?.id ?? null
  );
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(INITIAL_AUDIT_LOGS);
  const [stats, setStats] = useState<SystemStats>(INITIAL_STATS);
  const [currentRole, setCurrentRoleState] = useState<UserRole>('GRID_ENGINEER');
  const [isDark, setIsDark] = useState<boolean>(true);
  const [activeView, setActiveViewState] = useState<string>('overview');
  const [overviewMode, setOverviewMode] = useState<OverviewDashboardMode>('OPERATIONAL');
  const [simulatorTab, setSimulatorTab] = useState<SimulatorWorkspaceTab>('studio');
  const [adminTab, setAdminTab] = useState<AdminWorkspaceTab>('users');

  // Auto-activate Executive Dashboard mode on Overview for Executive/Manager roles
  useEffect(() => {
    if (currentRole === 'REVIEWER_APPROVER' || currentRole === 'ADMIN') {
      setOverviewMode('EXECUTIVE');
    } else {
      setOverviewMode('OPERATIONAL');
    }
  }, [currentRole]);

  const setActiveView = useCallback((view: string) => {
    setWorkflowOverrideStage(null);
    switch (view) {
      case 'decisions':
        setSimulatorTab('governance');
        setActiveViewState('simulator');
        break;
      case 'simulator':
        setSimulatorTab('studio');
        setActiveViewState('simulator');
        break;
      case 'audit':
        setAdminTab('logs');
        setActiveViewState('admin');
        break;
      case 'executive':
        setOverviewMode('EXECUTIVE');
        setActiveViewState('overview');
        break;
      case 'twin':
        setActiveViewState('graph');
        break;
      default:
        setActiveViewState(view);
        break;
    }
  }, []);

  const rolePermissions = useMemo(() => getRolePermissions(currentRole), [currentRole]);
  const unreadNotificationsCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  // Geographic Intelligence & Live OSM State
  const [faults, setFaults] = useState<ActiveFault[]>(INITIAL_FAULTS);
  const [maintenanceZones] = useState<MaintenanceZone[]>(INITIAL_MAINTENANCE_ZONES);
  const [powerLines, setPowerLines] = useState<PowerLine[]>(INITIAL_POWER_LINES);
  const [geoFilter, setGeoFilter] = useState<GeographicFilterState>(DEFAULT_GEO_FILTER);

  // Shared Selection State across Map, Knowledge Graph, Search
  const [selectedAssetId, setSelectedAssetIdState] = useState<string | null>('SUB-TG-06U');
  const [hoveredAssetId, setHoveredAssetIdState] = useState<string | null>(null);
  const [selectionSource, setSelectionSource] = useState<SelectionSource | null>(null);
  const [hoverSource, setHoverSource] = useState<'map' | 'graph' | null>(null);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const [selectedFaultId, setSelectedFaultId] = useState<string | null>(null);
  const [faultFocusNonce, setFaultFocusNonce] = useState<number>(0);
  const [selectedReconstructionId, setSelectedReconstructionId] = useState<string>(
    INITIAL_EVENT_RECONSTRUCTIONS[0]?.id ?? 'EVT-TG-06U-01'
  );
  const [highlightedAssetIds, setHighlightedAssetIds] = useState<string[]>([]);
  const [pendingSimulationParams, setPendingSimulationParams] = useState<{
    sourceFeeder?: string;
    targetFeeder?: string;
    tieSwitch?: string;
    loadTransferMva?: number;
  } | null>(null);
  const [pendingDecisionDraft, setPendingDecisionDraft] = useState<PendingDecisionDraft | null>(null);
  const [activeSimulationId, setActiveSimulationId] = useState<string | null>(
    INITIAL_SIMULATION_SCENARIOS[0]?.id ?? null
  );
  const [simulationOverlayPlaying, setSimulationOverlayPlaying] = useState<boolean>(true);
  const [workflowOverrideStage, setWorkflowOverrideStage] = useState<WorkflowStageId | null>(null);
  const [focusRcaNonce, setFocusRcaNonce] = useState<number>(0);
  const [maintenanceFocusNonce, setMaintenanceFocusNonce] = useState<number>(0);
  const [mapCenter, setMapCenter] = useState<[number, number]>(INITIAL_MAP_CENTER);
  const [mapZoom, setMapZoom] = useState<number>(INITIAL_MAP_ZOOM);
  const [currentMapZoom, setCurrentMapZoom] = useState<number>(INITIAL_MAP_ZOOM);
  const [mapLayers, setMapLayers] = useState<MapFilterLayers>(DEFAULT_MAP_LAYERS);

  // OSM & Telemetry Provider State
  const [osmLoading, setOsmLoading] = useState<boolean>(false);
  const [osmError, setOsmError] = useState<string | null>(null);
  const [osmCached, setOsmCached] = useState<boolean>(false);
  const [osmLastFetchedAt, setOsmLastFetchedAt] = useState<string | null>(null);
  const [telemetryByAssetId, setTelemetryByAssetId] = useState<Record<string, AssetTelemetryStatus>>({});
  const [aiLastRecalculatedAt, setAiLastRecalculatedAt] = useState<string>('2026-11-17T06:00:00Z');

  // Phase 8: Real-Time WebSockets, Alert Center, Toasts, Demo Mode, Health & In-Memory Auth Session
  const [wsState, setWsState] = useState<WebSocketConnectionState>('CONNECTING');
  const [lastWsMessageAt, setLastWsMessageAt] = useState<string | null>(null);
  const [recentAnimatedAssetIds, setRecentAnimatedAssetIds] = useState<string[]>([]);
  const [alerts, setAlerts] = useState<GridAlert[]>([]);
  const [toasts, setToasts] = useState<GridToast[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealthSnapshot | null>(null);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(true);
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);

  // Phase 9: Dashboard Customization, Executive Reports History & System Admin State
  const [dashboardCustomization, setDashboardCustomization] = useState<DashboardCustomizationPrefs>({
    widgetOrder: [
      'EXECUTIVE_KPI_STRIP',
      'REGIONAL_PERFORMANCE',
      'AI_INSIGHTS',
      'SCENARIO_COMPARISON',
      'INCIDENT_TRENDS',
      'LIFECYCLE_WATCH'
    ],
    hiddenWidgets: [],
    favoriteRegions: ['Telangana', 'Hyderabad'],
    savedFilterPresets: [
      {
        id: 'PRESET-HYD-CRITICAL',
        name: 'Hyderabad Critical Corridor',
        geoFilter: { country: 'India', state: 'Telangana', district: 'Hyderabad' }
      },
      {
        id: 'PRESET-BLR-IT',
        name: 'Bengaluru Whitefield Zone',
        geoFilter: { country: 'India', state: 'Karnataka', district: 'Bengaluru Urban' }
      }
    ],
    customKpiTargets: {
      reliabilityTargetPct: 99.0,
      mttrMaxHours: 2.0,
      complianceTargetPct: 92.0
    }
  });
  const [executiveReportsHistory, setExecutiveReportsHistory] = useState<ExecutiveReportRecord[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUserRecord[]>([]);
  const [adminAiSettings, setAdminAiSettings] = useState<AdminAiModelSettings>({
    riskThresholdHigh: 70,
    riskThresholdMedium: 45,
    predictionWindowDays: 30,
    autoRecalculateOnWsFault: true,
    maintenanceWeightLoadPct: 35
  });
  const [adminNotificationSettings, setAdminNotificationSettings] = useState<AdminNotificationSettings>({
    notifyCriticalAlerts: true,
    notifyAiRecommendations: true,
    notifyFieldUpdates: true,
    escalateUnacknowledgedMin: 20
  });
  const [adminBackups, setAdminBackups] = useState<AdminBackupSnapshot[]>([]);

  const osmAbortRef = useRef<AbortController | null>(null);
  const nonceRef = useRef<number>(1);
  const assetsRef = useRef<InfrastructureAsset[]>(assets);
  assetsRef.current = assets;
  const faultsRef = useRef<ActiveFault[]>(faults);
  faultsRef.current = faults;
  const telemetryRef = useRef<Record<string, AssetTelemetryStatus>>(telemetryByAssetId);
  telemetryRef.current = telemetryByAssetId;
  const telemetryProvider = useMemo(() => createTelemetryProvider(), []);

  // Sync dark class on html root element
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  // Register baseline DEMO assets with telemetry provider on mount so SSE starts immediately
  useEffect(() => {
    const baselineOsmCompatible: OsmAsset[] = INITIAL_ASSETS.map((a) => ({
      id: a.canonicalId,
      type: a.osmType,
      name: a.rawName ?? a.name,
      voltage: a.voltage,
      operator: a.operator,
      lat: a.latitude,
      lon: a.longitude,
      geometry: a.geometry,
      source: 'OSM',
      tags: a.tags
    }));
    telemetryProvider.registerAssets(baselineOsmCompatible);
  }, [telemetryProvider]);

  // Subscribe to TelemetryProvider adapter updates (5-second SSE stream in simulated mode)
  useEffect(() => {
    const unsubscribe = telemetryProvider.subscribe((updates) => {
      if (updates.length === 0) return;

      const prevSnapshot = telemetryRef.current;
      const nextMap: Record<string, AssetTelemetryStatus> = { ...prevSnapshot };
      const newlyFaulted: AssetTelemetryStatus[] = [];
      const newlyRestoredIds: string[] = [];

      for (const upd of updates) {
        const previous = prevSnapshot[upd.assetId];
        if (upd.status === 'FAULT' && previous?.status !== 'FAULT') {
          newlyFaulted.push(upd);
        } else if (previous?.status === 'FAULT' && upd.status !== 'FAULT') {
          newlyRestoredIds.push(upd.assetId);
        }
        nextMap[upd.assetId] = upd;
      }

      setTelemetryByAssetId(nextMap);

      setAssets((prevAssets) =>
        prevAssets.map((a) => {
          // Keep initial DEMO fault cascade stable unless telemetry explicitly overrides non-DEMO OSM assets
          if (a.source === 'DEMO') return a;
          const tel = nextMap[a.canonicalId];
          if (!tel) return a;
          return {
            ...a,
            status: telemetryStatusToAssetStatus(tel.status)
          };
        })
      );

      setPowerLines((prevLines) =>
        prevLines.map((l) => {
          if (l.source === 'DEMO') return l;
          const tel = nextMap[l.canonicalId];
          if (!tel) return l;
          return {
            ...l,
            status: telemetryStatusToLineStatus(tel.status)
          };
        })
      );

      const currentAssetsById = new Map(assetsRef.current.map((a) => [a.canonicalId, a]));

      setFaults((prevFaults) => {
        const activeFaultsMap = new Map<string, ActiveFault>();
        // Keep seeded DEMO faults unless resolved
        for (const existing of prevFaults) {
          if (existing.source === 'DEMO') {
            activeFaultsMap.set(existing.affectedAssetId, existing);
            continue;
          }
          const tel = nextMap[existing.affectedAssetId];
          if (tel && tel.status === 'FAULT') {
            activeFaultsMap.set(existing.affectedAssetId, {
              ...existing,
              lastUpdated: tel.lastUpdated
            });
          }
        }

        for (const tel of Object.values(nextMap)) {
          if (tel.status !== 'FAULT') continue;
          const asset = currentAssetsById.get(tel.assetId);
          if (!asset || asset.source === 'DEMO') continue;
          const existing = activeFaultsMap.get(tel.assetId);
          if (!existing) {
            const faultCode = tel.faultCode || `SIM-FLT-${tel.assetId.slice(-6)}`;
            activeFaultsMap.set(tel.assetId, {
              id: faultCode,
              faultCode,
              title: `${formatMissingValue(asset.rawName ?? asset.name)} Telemetry Fault`,
              latitude: asset.latitude,
              longitude: asset.longitude,
              severity: 'CRITICAL',
              status: 'ACTIVE_LOCKOUT',
              affectedAssetId: asset.canonicalId,
              affectedAssetName: formatMissingValue(asset.rawName ?? asset.name),
              affectedSubstationId: asset.substationId,
              affectedFeederId: asset.feederId,
              affectedTransformerId: asset.assetType === 'TRANSFORMER' ? asset.canonicalId : undefined,
              detectedAt: tel.lastUpdated,
              lastUpdated: tel.lastUpdated,
              source: tel.source,
              telemetrySource: tel.source,
              customersInterrupted: null,
              relatedEventId: `EVT-${faultCode}`,
              description:
                tel.faultReason ||
                `Simulated fault event triggered on ${asset.osmType} (${asset.canonicalId}).`
            });
          }
        }

        return Array.from(activeFaultsMap.values());
      });

      if (newlyFaulted.length > 0 || newlyRestoredIds.length > 0) {
        setEvents((prevEvents) => {
          const additions: OperationalEvent[] = [];

          for (const tel of newlyFaulted) {
            const asset = currentAssetsById.get(tel.assetId);
            if (!asset || asset.source === 'DEMO') continue;
            additions.push({
              id: `evt-fault-${tel.assetId}-${Date.now()}`,
              timestamp: tel.lastUpdated,
              sourceSystem: 'SCADA_OSI',
              source: tel.source,
              telemetrySource: tel.source,
              assetCanonicalId: asset.canonicalId,
              assetName: formatMissingValue(asset.rawName ?? asset.name),
              eventType: `SIMULATED_${asset.osmType.toUpperCase()}_FAULT`,
              summary: `${tel.faultReason || 'Simulated telemetry fault'} (Load: ${
                tel.loadKw !== null ? `${tel.loadKw} kW` : 'Not available'
              }, Voltage: ${formatMissingValue(tel.voltage)})`,
              isInferred: false,
              confidenceScore: 1,
              hasContradiction: false
            });
          }

          for (const restoredId of newlyRestoredIds) {
            const asset = currentAssetsById.get(restoredId);
            const tel = nextMap[restoredId];
            if (!asset || !tel || asset.source === 'DEMO') continue;
            additions.push({
              id: `evt-restore-${restoredId}-${Date.now()}`,
              timestamp: tel.lastUpdated,
              sourceSystem: 'SCADA_OSI',
              source: tel.source,
              telemetrySource: tel.source,
              assetCanonicalId: asset.canonicalId,
              assetName: formatMissingValue(asset.rawName ?? asset.name),
              eventType: 'SIMULATED_TELEMETRY_RESTORED',
              summary: `Asset telemetry returned to ${tel.status} (Load: ${
                tel.loadKw !== null ? `${tel.loadKw} kW` : 'Not available'
              }, Voltage: ${formatMissingValue(tel.voltage)}).`,
              isInferred: false,
              confidenceScore: 1,
              hasContradiction: false
            });
          }

          return [...additions, ...prevEvents].slice(0, 80);
        });
      }
    });

    return () => {
      unsubscribe();
      telemetryProvider.destroy();
    };
  }, [telemetryProvider]);

  // Fetch real power assets from backend Overpass proxy for current map bounds (only when zoom >= 11)
  const fetchOsmAssetsForBounds = useCallback(
    async (bounds: MapBoundingBox, zoom: number) => {
      setCurrentMapZoom(zoom);

      if (zoom < 11) {
        setOsmError(null);
        setOsmLoading(false);
        return;
      }

      if (osmAbortRef.current) {
        osmAbortRef.current.abort();
      }
      const controller = new AbortController();
      osmAbortRef.current = controller;

      setOsmLoading(true);
      setOsmError(null);

      try {
        const bboxParam = `${bounds.south.toFixed(5)},${bounds.west.toFixed(5)},${bounds.north.toFixed(5)},${bounds.east.toFixed(5)}`;
        const response = await fetch(`/api/assets?bbox=${encodeURIComponent(bboxParam)}`, {
          signal: controller.signal
        });

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          throw new Error(errBody.error || `HTTP ${response.status}`);
        }

        const data = (await response.json()) as {
          cached?: boolean;
          fetchedAt?: string;
          assets?: OsmAsset[];
        };

        const osmAssets = Array.isArray(data.assets) ? data.assets : [];
        const contextHint = {
          country: geoFilter.country || 'India',
          state: geoFilter.state || 'Not available',
          district: geoFilter.district || 'Not available',
          city: geoFilter.city || 'Not available',
          area: geoFilter.area || 'Not available'
        };

        const currentTelemetry = telemetryRef.current;
        const normalizedOsmAssets = osmAssets.map((item) => {
          const base = normalizeOsmToInfrastructureAsset(item, contextHint);
          const tel = currentTelemetry[base.canonicalId];
          if (!tel) return base;
          return {
            ...base,
            status: telemetryStatusToAssetStatus(tel.status)
          };
        });

        const normalizedOsmLines = osmAssets
          .map((item) => normalizeOsmToPowerLine(item))
          .filter((l): l is PowerLine => Boolean(l))
          .map((line) => {
            const tel = currentTelemetry[line.canonicalId];
            return tel ? { ...line, status: telemetryStatusToLineStatus(tel.status) } : line;
          });

        const osmTagIssues = buildOsmTagIntegrityIssues(osmAssets);

        // Preserve clearly badged DEMO seed assets merged with viewport OSM assets (deduped by canonicalId)
        setAssets(() => {
          const merged = new Map<string, InfrastructureAsset>(
            INITIAL_ASSETS.map((a) => [a.canonicalId, a])
          );
          for (const osmItem of normalizedOsmAssets) {
            merged.set(osmItem.canonicalId, osmItem);
          }
          return Array.from(merged.values());
        });

        setPowerLines(() => {
          const merged = new Map<string, PowerLine>(
            INITIAL_POWER_LINES.map((l) => [l.canonicalId, l])
          );
          for (const osmLine of normalizedOsmLines) {
            merged.set(osmLine.canonicalId, osmLine);
          }
          return Array.from(merged.values());
        });

        setIssues([...INITIAL_DATA_QUALITY_ISSUES, ...osmTagIssues]);
        setOsmCached(Boolean(data.cached));
        setOsmLastFetchedAt(data.fetchedAt || new Date().toISOString());

        if (osmAssets.length > 0) {
          telemetryProvider.registerAssets(osmAssets);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const message = err instanceof Error ? err.message : 'Unable to fetch OSM power assets';
        setOsmError(message);
      } finally {
        setOsmLoading(false);
      }
    },
    [geoFilter.area, geoFilter.city, geoFilter.country, geoFilter.district, geoFilter.state, telemetryProvider]
  );

  // Synchronize backend /api/map/assets whenever geoFilter changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (geoFilter.country) params.set('country', geoFilter.country);
    if (geoFilter.state) params.set('state', geoFilter.state);
    if (geoFilter.district) params.set('district', geoFilter.district);
    if (geoFilter.division) params.set('division', geoFilter.division);
    if (geoFilter.subdivision) params.set('subdivision', geoFilter.subdivision);
    if (geoFilter.city) params.set('city', geoFilter.city);
    if (geoFilter.area) params.set('area', geoFilter.area);
    if (geoFilter.substationId) params.set('substationId', geoFilter.substationId);
    if (geoFilter.feederId) params.set('feederId', geoFilter.feederId);
    if (geoFilter.transformerId) params.set('transformerId', geoFilter.transformerId);

    const controller = new AbortController();
    fetch(`/api/map/assets?${params.toString()}`, { signal: controller.signal }).catch(() => {
      // Non-blocking sync
    });

    return () => controller.abort();
  }, [geoFilter]);

  const hasRegionSelection = useMemo(() => hasRegionalSelection(geoFilter), [geoFilter]);
  const geoScopeLabel = useMemo(() => formatGeoBreadcrumb(geoFilter), [geoFilter]);

  // Compute globally synchronized datasets + 1:1 display assets & counts
  const scoped = useMemo(
    () =>
      scopePlatformData({
        filter: geoFilter,
        assets,
        faults,
        maintenanceZones,
        powerLines,
        boundaries: GEOGRAPHIC_BOUNDARIES,
        issues,
        events,
        scenarios,
        decisions,
        auditLogs,
        baseStats: stats
      }),
    [
      geoFilter,
      assets,
      faults,
      maintenanceZones,
      powerLines,
      issues,
      events,
      scenarios,
      decisions,
      auditLogs,
      stats
    ]
  );

  const scopedReconstructions = useMemo(() => {
    if (!hasRegionSelection) return INITIAL_EVENT_RECONSTRUCTIONS;
    const faultIds = new Set(scoped.scopedFaults.map((f) => f.id));
    const assetIds = new Set(scoped.scopedAssets.map((a) => a.canonicalId));
    const matches = INITIAL_EVENT_RECONSTRUCTIONS.filter(
      (inc) =>
        faultIds.has(inc.faultId) ||
        inc.affectedAssetIds.some((aid) => assetIds.has(aid))
    );
    return matches.length > 0 ? matches : INITIAL_EVENT_RECONSTRUCTIONS;
  }, [hasRegionSelection, scoped.scopedFaults, scoped.scopedAssets]);

  // Compute full connected path (Substation -> Feeder -> Transformer/Breakers) for active selection or hover
  const connectedPath = useMemo(() => {
    const targetId = selectedAssetId || hoveredAssetId;
    return getConnectedPathForAsset(targetId, assets, powerLines);
  }, [selectedAssetId, hoveredAssetId, assets, powerLines]);

  const selectAsset = useCallback(
    (
      assetId: string | null,
      source: SelectionSource,
      options?: { zoom?: number; openPopup?: boolean; preserveFault?: boolean }
    ) => {
      if (!assetId) {
        setSelectedAssetIdState(null);
        setSelectionSource(null);
        setFocusRequest(null);
        setHighlightedAssetIds([]);
        return;
      }

      const matched = assetsRef.current.find(
        (a) => a.canonicalId === assetId || a.id === assetId
      );
      const canonicalId = matched ? matched.canonicalId : assetId;

      setSelectedAssetIdState(canonicalId);
      setSelectionSource(source);
      setHighlightedAssetIds([canonicalId]);

      // Cross-module real-time synchronization: match fault & event reconstruction incident
      if (!options?.preserveFault) {
        const matchingFault = faultsRef.current.find(
          (f) =>
            f.affectedAssetId === canonicalId ||
            f.affectedFeederId === canonicalId ||
            (matched?.feederId && f.affectedFeederId === matched.feederId) ||
            (matched?.substationId && f.affectedSubstationId === matched.substationId)
        );
        setSelectedFaultId(matchingFault ? matchingFault.id : null);
      }

      const matchingIncident = INITIAL_EVENT_RECONSTRUCTIONS.find(
        (inc) =>
          inc.affectedAssetIds.includes(canonicalId) ||
          inc.feederId === canonicalId ||
          inc.substationId === canonicalId ||
          (matched?.feederId && inc.feederId === matched.feederId) ||
          (matched?.substationId && inc.substationId === matched.substationId)
      );
      if (matchingIncident) {
        setSelectedReconstructionId(matchingIncident.id);
      }

      const shouldFocusMap = source !== 'map';
      const targetZoom = Math.max(options?.zoom ?? 15, 15);
      const nonce = ++nonceRef.current;

      setFocusRequest({
        assetId: canonicalId,
        source,
        zoom: targetZoom,
        openPopup: options?.openPopup ?? shouldFocusMap,
        nonce
      });

      if (shouldFocusMap && matched) {
        setMapCenter([matched.latitude, matched.longitude]);
        setMapZoom(targetZoom);
        setCurrentMapZoom(targetZoom);
      }

      if (source === 'map' || source === 'graph') {
        setAuditLogs((prev) => {
          const last = prev[0];
          if (last?.actionType === 'ASSET_SELECTED' && last.entityId === canonicalId) {
            return prev;
          }
          const perms = getRolePermissions(currentRole);
          const entry: AuditLog = {
            id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            timestamp: new Date().toISOString(),
            actorEmail: perms.actorEmail,
            actorRole: currentRole,
            actionType: 'ASSET_SELECTED',
            module: source === 'map' ? 'Grid Map' : 'Knowledge Graph',
            targetEntity: 'infrastructure_assets',
            entityId: canonicalId,
            relatedAssetId: canonicalId,
            summary: `Selected canonical asset ${canonicalId} via ${source}.`,
            ipAddress: '127.0.0.1'
          };
          return [entry, ...prev].slice(0, 120);
        });
      }
    },
    [currentRole]
  );

  const setHoveredAsset = useCallback(
    (assetId: string | null, source: 'map' | 'graph') => {
      setHoveredAssetIdState(assetId);
      setHoverSource(assetId ? source : null);
    },
    []
  );

  const clearSelection = useCallback(() => {
    setSelectedAssetIdState(null);
    setSelectionSource(null);
    setFocusRequest(null);
    setSelectedFaultId(null);
    setHighlightedAssetIds([]);
  }, []);

  const syncInspectorToFilter = useCallback(
    (nextFilter: GeographicFilterState) => {
      const nextScoped = filterAssetsByHierarchy(assetsRef.current, nextFilter);
      const viewport = computeViewportForSelection(
        assetsRef.current,
        GEOGRAPHIC_BOUNDARIES,
        nextFilter
      );
      setMapCenter(viewport.center);
      setMapZoom(viewport.zoom);
      setCurrentMapZoom(viewport.zoom);

      if (nextFilter.transformerId) {
        selectAsset(nextFilter.transformerId, 'search', { zoom: 17, openPopup: true });
        return;
      }
      if (nextFilter.feederId) {
        selectAsset(nextFilter.feederId, 'search', { zoom: 15, openPopup: true });
        return;
      }
      if (nextFilter.substationId) {
        selectAsset(nextFilter.substationId, 'search', { zoom: 15, openPopup: true });
        return;
      }

      if (hasRegionalSelection(nextFilter)) {
        const preferred =
          nextScoped.find((a) => a.status === 'FAULTED') ||
          nextScoped.find((a) => a.assetType === 'SUBSTATION') ||
          nextScoped[0];
        if (preferred) {
          setSelectedAssetIdState(preferred.canonicalId);
          setSelectionSource('search');
          setHighlightedAssetIds([preferred.canonicalId]);
        } else {
          setSelectedAssetIdState(null);
          setSelectionSource(null);
        }
        setSelectedFaultId(faults[0]?.id ?? null);
      } else {
        setSelectedAssetIdState(null);
        setSelectionSource(null);
        setSelectedFaultId(null);
        setHighlightedAssetIds([]);
      }
    },
    [faults, selectAsset]
  );

  const updateGeoFilterLevel = useCallback(
    (level: keyof GeographicFilterState, value: string) => {
      if (level === 'country' || level === 'state' || level === 'district') {
        setAssets(INITIAL_ASSETS);
        setPowerLines(INITIAL_POWER_LINES);
        setIssues(INITIAL_DATA_QUALITY_ISSUES);
      }
      setGeoFilter((prev) => {
        const next: GeographicFilterState = { ...prev, [level]: value };
        const idx = HIERARCHY_ORDER.indexOf(level);
        for (let i = idx + 1; i < HIERARCHY_ORDER.length; i += 1) {
          next[HIERARCHY_ORDER[i]] = '';
        }
        syncInspectorToFilter(next);
        return next;
      });
    },
    [syncInspectorToFilter]
  );

  const setGeoFilterDirect = useCallback(
    (next: GeographicFilterState) => {
      setAssets(INITIAL_ASSETS);
      setPowerLines(INITIAL_POWER_LINES);
      setIssues(INITIAL_DATA_QUALITY_ISSUES);
      setGeoFilter(next);
      syncInspectorToFilter(next);
    },
    [syncInspectorToFilter]
  );

  const resetGeoFilter = useCallback(() => {
    setAssets(INITIAL_ASSETS);
    setPowerLines(INITIAL_POWER_LINES);
    setIssues(INITIAL_DATA_QUALITY_ISSUES);
    setGeoFilter(DEFAULT_GEO_FILTER);
    setMapCenter(INDIA_CENTER);
    setMapZoom(INDIA_ZOOM);
    setCurrentMapZoom(INDIA_ZOOM);
    clearSelection();
  }, [clearSelection]);

  const applySearchResult = useCallback(
    (result: GeographicSearchResult) => {
      if (result.kind === 'LOCATION') {
        setAssets(INITIAL_ASSETS);
        setPowerLines(INITIAL_POWER_LINES);
        setIssues(INITIAL_DATA_QUALITY_ISSUES);
      }
      const nextFilter: GeographicFilterState = {
        ...DEFAULT_GEO_FILTER,
        ...result.filterPatch
      };
      setGeoFilter(nextFilter);

      if (result.kind === 'ASSET' && result.asset) {
        selectAsset(result.asset.canonicalId, 'search', {
          zoom: Math.max(result.zoom, 15),
          openPopup: true
        });
      } else {
        const targetCenter: [number, number] = [result.latitude, result.longitude];
        setMapCenter(targetCenter);
        setMapZoom(result.zoom);
        setCurrentMapZoom(result.zoom);

        const matching = filterAssetsByHierarchy(assetsRef.current, nextFilter);
        setHighlightedAssetIds(matching.map((a) => a.canonicalId));
        const preferred =
          matching.find((a) => a.status === 'FAULTED') ||
          matching.find((a) => a.assetType === 'SUBSTATION') ||
          matching[0];
        if (preferred) {
          selectAsset(preferred.canonicalId, 'search', { zoom: result.zoom, openPopup: false });
        } else {
          setSelectedAssetIdState(null);
          setSelectionSource('search');
        }
      }
    },
    [selectAsset]
  );

  const toggleTheme = () => {
    setIsDark((prev) => !prev);
  };

  const logAudit = useCallback(
    (
      actionType: AuditLog['actionType'],
      targetEntity: string,
      entityId: string,
      summary: string,
      extra?: {
        module?: string;
        relatedAssetId?: string;
        relatedIncidentId?: string;
        metadata?: Record<string, unknown>;
        actorRoleOverride?: UserRole;
      }
    ) => {
      const effectiveRole = extra?.actorRoleOverride ?? currentRole;
      const perms = getRolePermissions(effectiveRole);
      const newLog: AuditLog = {
        id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toISOString(),
        actorEmail: perms.actorEmail,
        actorRole: effectiveRole,
        actionType,
        module: extra?.module || 'Operations',
        targetEntity,
        entityId,
        relatedAssetId: extra?.relatedAssetId,
        relatedIncidentId: extra?.relatedIncidentId,
        summary,
        metadata: extra?.metadata,
        ipAddress: '127.0.0.1'
      };
      setAuditLogs((prev) => [newLog, ...prev].slice(0, 150));
    },
    [currentRole]
  );

  const pushNotification = useCallback(
    (notif: Omit<GridNotification, 'id' | 'timestamp' | 'read'>) => {
      const created: GridNotification = {
        ...notif,
        id: `NTF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toISOString(),
        read: false
      };
      setNotifications((prev) => [created, ...prev].slice(0, 40));
    },
    []
  );

  const setCurrentRole = useCallback(
    (role: UserRole) => {
      setCurrentRoleState(role);
      const perms = getRolePermissions(role);
      logAudit(
        'USER_LOGIN',
        'users',
        perms.actorEmail,
        `Switched active RBAC operational session to ${perms.label} (${role}).`,
        {
          module: 'Identity & RBAC',
          actorRoleOverride: role,
          metadata: { role, label: perms.label }
        }
      );
    },
    [logAudit]
  );

  const resolveIssue = (issueId: string, chosenValue: string, notes: string) => {
    setIssues((prev) =>
      prev.map((issue) => {
        if (issue.id === issueId) {
          return {
            ...issue,
            status: 'RESOLVED',
            chosenCanonicalValue: chosenValue,
            resolvedBy: rolePermissions.actorName,
            resolvedAt: new Date().toISOString(),
            resolutionNotes: notes
          };
        }
        return issue;
      })
    );

    setStats((prev) => ({
      ...prev,
      activeConflictsCount: Math.max(0, prev.activeConflictsCount - 1),
      dataQualityScore: Math.min(100, Math.round((prev.dataQualityScore + 3.8) * 10) / 10)
    }));

    logAudit(
      'DATA_RECONCILED',
      'data_quality_issues',
      issueId,
      `Reconciled issue on ${issueId}. Canonical value confirmed as "${chosenValue}". Rationale: ${notes}`,
      { module: 'Data Integrity', relatedAssetId: issueId }
    );
  };

  const submitDecision = (decisionData: Partial<EngineeringDecision>): EngineeringDecision => {
    const fallbackTarget = selectedAssetId || assets[0]?.canonicalId || 'SUB-TG-06U';
    const targetAssetId = decisionData.targetAssetId || fallbackTarget;
    const matchedAsset = assets.find((a) => a.canonicalId === targetAssetId);
    const matchedFault = faults.find(
      (f) =>
        f.id === decisionData.faultId ||
        f.affectedAssetId === targetAssetId ||
        (matchedAsset?.feederId && f.affectedFeederId === matchedAsset.feederId)
    );
    const nowIso = new Date().toISOString();
    const newDecision: EngineeringDecision = {
      id: `DEC-${Date.now()}`,
      decisionCode: `DEC-2026-${String(decisions.length + 1).padStart(3, '0')}`,
      incidentId:
        decisionData.incidentId ??
        matchedFault?.relatedEventId ??
        selectedReconstructionId ??
        null,
      faultId: decisionData.faultId ?? matchedFault?.id ?? selectedFaultId ?? null,
      title: decisionData.title || 'Untitled Engineering Proposal',
      rationale: decisionData.rationale || '',
      riskAssessment: decisionData.riskAssessment || '',
      recommendationSummary:
        decisionData.recommendationSummary ||
        decisionData.title ||
        'Human-verified switching & inspection plan.',
      targetAssetId,
      priority: decisionData.priority || 'HIGH',
      riskLevel: decisionData.riskLevel || 'MEDIUM',
      escalated: Boolean(decisionData.escalated),
      assignedTaskId: null,
      state: decisionData.state || matchedAsset?.state || 'Telangana',
      district: decisionData.district || matchedAsset?.district || 'Hyderabad',
      area: decisionData.area || matchedAsset?.area || 'HITEC City',
      proposedBy: rolePermissions.actorName,
      proposedByEmail: rolePermissions.actorEmail,
      status: 'SUBMITTED',
      source: 'DEMO',
      evidenceBundle: decisionData.evidenceBundle || {
        conflictIssueIds: issues.slice(0, 1).map((i) => i.id),
        eventTimelineIds: events.slice(0, 2).map((e) => e.id),
        affectedCustomersCount: null,
        reliabilityImpact: 'Supports operational switching & canonical asset governance.'
      },
      signatureHash: Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join(''),
      createdAt: nowIso,
      updatedAt: nowIso,
      comments: [
        {
          author: rolePermissions.actorName,
          role: currentRole,
          timestamp: nowIso,
          text: 'Proposal submitted with attached canonical asset metadata and simulation metrics.'
        }
      ]
    };

    setDecisions((prev) => [newDecision, ...prev]);
    setStats((prev) => ({ ...prev, pendingApprovalsCount: prev.pendingApprovalsCount + 1 }));

    pushNotification({
      type: 'APPROVAL_REQUIRED',
      title: `Approval Required: ${newDecision.decisionCode}`,
      message: `${newDecision.title} requires Utility Manager review & sign-off.`,
      severity: newDecision.priority === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
      relatedAssetId: newDecision.targetAssetId,
      relatedIncidentId: newDecision.incidentId || undefined,
      relatedDecisionId: newDecision.id,
      targetView: 'decisions',
      source: 'DEMO'
    });

    logAudit(
      'DECISION_SUBMITTED',
      'engineering_decisions',
      newDecision.id,
      `Submitted engineering decision ${newDecision.decisionCode}: "${newDecision.title}". Evidence bundle linked.`,
      {
        module: 'Decision Governance',
        relatedAssetId: newDecision.targetAssetId,
        relatedIncidentId: newDecision.incidentId || undefined
      }
    );

    fetch('/api/decisions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newDecision)
    }).catch(() => {});

    return newDecision;
  };

  const reviewDecision = (
    decisionId: string,
    action: 'APPROVE' | 'REJECT',
    notes: string,
    assignmentOverride?: {
      assignedEngineer?: string;
      assignedEngineerEmail?: string;
      assignedTeam?: string;
      priority?: PriorityLevel;
      dueDate?: string;
    }
  ): { success: boolean; error?: string; createdTask?: FieldTask } => {
    const decision = decisions.find((d) => d.id === decisionId);
    if (!decision) return { success: false, error: 'Decision not found.' };

    if (!rolePermissions.canApproveDecision) {
      return {
        success: false,
        error:
          currentRole === 'GRID_ENGINEER'
            ? 'Separation of duties violation: Submitting Control Room Engineers cannot approve or reject operational proposals. Switch role to Utility Manager or Administrator.'
            : `Role ${rolePermissions.label} lacks authorization to approve or reject engineering decisions.`
      };
    }

    const nowIso = new Date().toISOString();
    const sigHash = Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
    let createdTask: FieldTask | undefined;

    if (action === 'APPROVE') {
      const targetAsset =
        assets.find((a) => a.canonicalId === decision.targetAssetId) ||
        assets.find((a) => a.canonicalId === 'DTR-TG-06U-104') ||
        assets[0];
      const taskCode = `TSK-${new Date().getFullYear()}-${String(fieldTasks.length + 1).padStart(3, '0')}`;
      const dueDefault = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
      createdTask = {
        id: taskCode,
        taskCode,
        decisionId: decision.id,
        decisionCode: decision.decisionCode,
        incidentId: decision.incidentId ?? null,
        faultId: decision.faultId ?? null,
        title: `Execute Approved Action (${decision.decisionCode}): ${decision.targetAssetId}`,
        assignedEngineer: assignmentOverride?.assignedEngineer || 'Rohan Kulkarni (Field Engineer)',
        assignedEngineerEmail:
          assignmentOverride?.assignedEngineerEmail || 'r.kulkarni@utilitygrid.org',
        assignedTeam:
          assignmentOverride?.assignedTeam ||
          `${decision.district || targetAsset?.district || 'Regional'} Rapid Response Crew-01`,
        assetId: decision.targetAssetId,
        assetName: targetAsset
          ? formatMissingValue(targetAsset.rawName ?? targetAsset.name)
          : decision.targetAssetId,
        faultLocation: `${decision.area || targetAsset?.area || 'Substation Zone'}, ${
          decision.district || targetAsset?.district || 'District'
        }, ${decision.state || targetAsset?.state || 'India'}`,
        state: decision.state || targetAsset?.state || 'Telangana',
        district: decision.district || targetAsset?.district || 'Hyderabad',
        area: decision.area || targetAsset?.area || 'HITEC City',
        gpsLat: targetAsset?.latitude ?? 17.4435,
        gpsLon: targetAsset?.longitude ?? 78.3772,
        navigationRoute: [
          {
            step: `Proceed from regional depot toward ${decision.area || targetAsset?.area || 'target zone'}`,
            distanceLabel: '0.8 km'
          },
          {
            step: `Verify isolation point and approach ${decision.targetAssetId}`,
            distanceLabel: '0.3 km'
          }
        ],
        safetyNotes:
          'Verify lockout/tagout zero-energy state and PPE clearance prior to touching 11 kV / 0.433 kV switchgear.',
        maintenanceHistoryNotes: targetAsset?.lastInspectionDate
          ? `Last documented inspection: ${targetAsset.lastInspectionDate}.`
          : 'No prior inspection record; perform full visual & thermography baseline.',
        previousIncidentsSummary: decision.incidentId
          ? `Linked incident ${decision.incidentId} (${decision.evidenceBundle.reliabilityImpact}).`
          : 'Linked to operational governance review.',
        scheduledTime: nowIso,
        dueDate: assignmentOverride?.dueDate || dueDefault,
        priority: assignmentOverride?.priority || decision.priority || 'HIGH',
        status: 'ASSIGNED',
        source: 'DEMO',
        createdAt: nowIso,
        updatedAt: nowIso
      };

      setFieldTasks((prev) => [createdTask!, ...prev]);
      setActiveTaskId(createdTask.id);
    }

    const newStatus: EngineeringDecision['status'] =
      action === 'APPROVE' ? 'IN_PROGRESS' : 'REJECTED';

    setDecisions((prev) =>
      prev.map((d) => {
        if (d.id === decisionId) {
          return {
            ...d,
            status: newStatus,
            assignedTaskId: createdTask ? createdTask.id : d.assignedTaskId,
            reviewedBy: rolePermissions.actorName,
            reviewedByEmail: rolePermissions.actorEmail,
            updatedAt: nowIso,
            comments: [
              ...d.comments,
              {
                author: rolePermissions.actorName,
                role: currentRole,
                timestamp: nowIso,
                text: `${action === 'APPROVE' ? 'APPROVED' : 'REJECTED'}: ${notes}${
                  createdTask ? ` · Auto-assigned Field Task ${createdTask.taskCode}.` : ''
                }`
              }
            ]
          };
        }
        return d;
      })
    );

    const approvalRecord: ApprovalRecord = {
      id: `APR-${Date.now()}`,
      decisionId: decision.id,
      decisionCode: decision.decisionCode,
      action: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
      approverName: rolePermissions.actorName,
      approverEmail: rolePermissions.actorEmail,
      approverRole: currentRole,
      comments: notes,
      timestamp: nowIso,
      signatureHash: sigHash
    };
    setApprovals((prev) => [approvalRecord, ...prev]);

    setStats((prev) => ({
      ...prev,
      pendingApprovalsCount: Math.max(0, prev.pendingApprovalsCount - 1)
    }));

    logAudit(
      action === 'APPROVE' ? 'DECISION_APPROVED' : 'DECISION_REJECTED',
      'engineering_decisions',
      decisionId,
      `${action} decision ${decision.decisionCode}. Reviewer notes: ${notes}`,
      {
        module: 'Decision Governance',
        relatedAssetId: decision.targetAssetId,
        relatedIncidentId: decision.incidentId || undefined
      }
    );

    if (createdTask) {
      logAudit(
        'FIELD_TASK_ASSIGNED',
        'field_tasks',
        createdTask.id,
        `Auto-generated Field Task ${createdTask.taskCode} assigned to ${createdTask.assignedEngineer} (${createdTask.assignedTeam}).`,
        {
          module: 'Field Operations',
          relatedAssetId: createdTask.assetId,
          relatedIncidentId: createdTask.incidentId || undefined
        }
      );

      pushNotification({
        type: 'TASK_ASSIGNED',
        title: `Field Task Assigned: ${createdTask.taskCode}`,
        message: `${createdTask.assignedTeam} dispatched to ${createdTask.assetId} for ${decision.decisionCode}.`,
        severity: createdTask.priority === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
        relatedAssetId: createdTask.assetId,
        relatedIncidentId: createdTask.incidentId || undefined,
        relatedDecisionId: decision.id,
        relatedTaskId: createdTask.id,
        targetView: 'field',
        source: 'DEMO'
      });
    }

    fetch('/api/approvals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approval: approvalRecord, createdTask })
    }).catch(() => {});

    return { success: true, createdTask };
  };

  const toggleDecisionEscalation = (
    decisionId: string,
    reason?: string
  ): { success: boolean; error?: string } => {
    if (rolePermissions.isReadOnly) {
      return { success: false, error: 'Viewer role cannot escalate governance cases.' };
    }
    const target = decisions.find((d) => d.id === decisionId);
    if (!target) return { success: false, error: 'Decision not found.' };
    const nextEsc = !target.escalated;
    setDecisions((prev) =>
      prev.map((d) =>
        d.id === decisionId
          ? {
              ...d,
              escalated: nextEsc,
              escalationReason: nextEsc
                ? reason || 'Escalated for senior utility manager intervention.'
                : undefined,
              updatedAt: new Date().toISOString()
            }
          : d
      )
    );
    logAudit(
      'EVENT_ANNOTATED',
      'engineering_decisions',
      decisionId,
      `${nextEsc ? 'Escalated' : 'De-escalated'} decision ${target.decisionCode}.`,
      { module: 'Decision Governance', relatedAssetId: target.targetAssetId }
    );
    return { success: true };
  };

  const createFieldTask = (input: {
    decisionId: string;
    title?: string;
    assignedEngineer: string;
    assignedEngineerEmail?: string;
    assignedTeam: string;
    priority: PriorityLevel;
    dueDate: string;
    safetyNotes?: string;
  }): { success: boolean; error?: string; task?: FieldTask } => {
    if (!rolePermissions.canAssignFieldTask) {
      return {
        success: false,
        error: `Only Utility Manager or Administrator roles can assign field tasks (current: ${rolePermissions.label}).`
      };
    }
    const dec = decisions.find((d) => d.id === input.decisionId);
    if (!dec) return { success: false, error: 'Linked decision not found.' };

    const targetAsset = assets.find((a) => a.canonicalId === dec.targetAssetId);
    const nowIso = new Date().toISOString();
    const taskCode = `TSK-${new Date().getFullYear()}-${String(fieldTasks.length + 1).padStart(3, '0')}`;

    const newTask: FieldTask = {
      id: taskCode,
      taskCode,
      decisionId: dec.id,
      decisionCode: dec.decisionCode,
      incidentId: dec.incidentId ?? null,
      faultId: dec.faultId ?? null,
      title: input.title || `Field Inspection & Execution: ${dec.targetAssetId}`,
      assignedEngineer: input.assignedEngineer,
      assignedEngineerEmail: input.assignedEngineerEmail || 'field.ops@utilitygrid.org',
      assignedTeam: input.assignedTeam,
      assetId: dec.targetAssetId,
      assetName: targetAsset
        ? formatMissingValue(targetAsset.rawName ?? targetAsset.name)
        : dec.targetAssetId,
      faultLocation: `${dec.area || targetAsset?.area || 'Service Area'}, ${
        dec.district || targetAsset?.district || 'District'
      }, ${dec.state || targetAsset?.state || 'India'}`,
      state: dec.state || targetAsset?.state || 'Telangana',
      district: dec.district || targetAsset?.district || 'Hyderabad',
      area: dec.area || targetAsset?.area || 'HITEC City',
      gpsLat: targetAsset?.latitude ?? 17.4435,
      gpsLon: targetAsset?.longitude ?? 78.3772,
      navigationRoute: [
        {
          step: `Dispatch from circle store to ${dec.area || targetAsset?.area || 'target feeder zone'}`,
          distanceLabel: '1.2 km'
        },
        {
          step: `Check isolation & arrive at ${dec.targetAssetId}`,
          distanceLabel: '0.4 km'
        }
      ],
      safetyNotes:
        input.safetyNotes ||
        'Confirm breaker rack-out & ground switch closure before servicing equipment.',
      maintenanceHistoryNotes: targetAsset?.lastInspectionDate
        ? `Last inspection: ${targetAsset.lastInspectionDate}.`
        : 'Baseline inspection required.',
      previousIncidentsSummary: dec.incidentId
        ? `Linked incident ${dec.incidentId}.`
        : 'Preventive dispatch.',
      scheduledTime: nowIso,
      dueDate: input.dueDate,
      priority: input.priority,
      status: 'ASSIGNED',
      source: 'DEMO',
      createdAt: nowIso,
      updatedAt: nowIso
    };

    setFieldTasks((prev) => [newTask, ...prev]);
    setDecisions((prev) =>
      prev.map((d) => (d.id === dec.id ? { ...d, assignedTaskId: newTask.id, status: 'IN_PROGRESS' } : d))
    );
    setActiveTaskId(newTask.id);

    logAudit(
      'FIELD_TASK_ASSIGNED',
      'field_tasks',
      newTask.id,
      `Assigned field task ${newTask.taskCode} to ${newTask.assignedEngineer} (${newTask.assignedTeam}).`,
      { module: 'Field Operations', relatedAssetId: newTask.assetId }
    );

    pushNotification({
      type: 'TASK_ASSIGNED',
      title: `Field Task Assigned: ${newTask.taskCode}`,
      message: `${newTask.assignedEngineer} assigned to ${newTask.assetId} (${newTask.priority} priority).`,
      severity: newTask.priority === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
      relatedAssetId: newTask.assetId,
      relatedTaskId: newTask.id,
      targetView: 'field',
      source: 'DEMO'
    });

    fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTask)
    }).catch(() => {});

    return { success: true, task: newTask };
  };

  const assignOrReassignFieldTask = (
    taskId: string,
    updates: {
      assignedEngineer: string;
      assignedEngineerEmail?: string;
      assignedTeam: string;
      priority: PriorityLevel;
      dueDate: string;
    }
  ): { success: boolean; error?: string } => {
    if (!rolePermissions.canAssignFieldTask) {
      return {
        success: false,
        error: `Only Utility Manager or Administrator roles can reassign field tasks (current: ${rolePermissions.label}).`
      };
    }
    const existing = fieldTasks.find((t) => t.id === taskId);
    if (!existing) return { success: false, error: 'Field task not found.' };

    const nowIso = new Date().toISOString();
    setFieldTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              assignedEngineer: updates.assignedEngineer,
              assignedEngineerEmail: updates.assignedEngineerEmail || t.assignedEngineerEmail,
              assignedTeam: updates.assignedTeam,
              priority: updates.priority,
              dueDate: updates.dueDate,
              updatedAt: nowIso
            }
          : t
      )
    );

    logAudit(
      'FIELD_TASK_ASSIGNED',
      'field_tasks',
      taskId,
      `Reassigned ${existing.taskCode} to ${updates.assignedEngineer} (${updates.assignedTeam}, Priority: ${updates.priority}).`,
      { module: 'Field Operations', relatedAssetId: existing.assetId }
    );

    fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    }).catch(() => {});

    return { success: true };
  };

  const updateFieldTaskStatus = (
    taskId: string,
    status: FieldTaskStatus,
    notes?: string
  ): { success: boolean; error?: string } => {
    if (!rolePermissions.canExecuteFieldTask && !rolePermissions.canVerifyAndClose) {
      return {
        success: false,
        error: `Role ${rolePermissions.label} cannot modify field task execution state.`
      };
    }
    const existing = fieldTasks.find((t) => t.id === taskId);
    if (!existing) return { success: false, error: 'Field task not found.' };

    const nowIso = new Date().toISOString();
    setFieldTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          status,
          updatedAt: nowIso,
          startedAt: status === 'IN_PROGRESS' && !t.startedAt ? nowIso : t.startedAt,
          pausedAt: status === 'PAUSED' ? nowIso : t.pausedAt,
          pauseReason: status === 'PAUSED' ? notes || 'Awaiting feeder clearance window' : t.pauseReason,
          completedAt: status === 'COMPLETED' ? nowIso : t.completedAt,
          completionNotes: status === 'COMPLETED' ? notes || 'Field inspection & repair completed.' : t.completionNotes
        };
      })
    );

    if (status === 'COMPLETED') {
      setDecisions((prev) =>
        prev.map((d) =>
          d.id === existing.decisionId && d.status !== 'CLOSED'
            ? { ...d, status: 'COMPLETED', updatedAt: nowIso }
            : d
        )
      );
      pushNotification({
        type: 'APPROVAL_REQUIRED',
        title: `Case Verification Ready: ${existing.decisionCode}`,
        message: `${existing.taskCode} completed in the field. Manager verification checklist required to close case.`,
        severity: 'INFO',
        relatedAssetId: existing.assetId,
        relatedDecisionId: existing.decisionId,
        relatedTaskId: existing.id,
        targetView: 'decisions',
        source: 'DEMO'
      });
    }

    logAudit(
      'FIELD_TASK_UPDATED',
      'field_tasks',
      taskId,
      `Field task ${existing.taskCode} updated to ${status}${notes ? ` (${notes})` : ''}.`,
      { module: 'Field Operations', relatedAssetId: existing.assetId, relatedIncidentId: existing.incidentId || undefined }
    );

    fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, notes })
    }).catch(() => {});

    return { success: true };
  };

  const submitFieldEvidence = (input: {
    taskId: string;
    fileName: string;
    mimeType: string;
    fileSizeBytes: number;
    filePreviewUrl?: string;
    gpsLat: number;
    gpsLon: number;
    notes: string;
    inspectionResult: FieldEvidence['inspectionResult'];
    equipmentCondition: FieldEvidence['equipmentCondition'];
    meterReadings: FieldEvidence['meterReadings'];
  }): { success: boolean; error?: string; evidence?: FieldEvidence } => {
    if (!rolePermissions.canUploadEvidence) {
      return {
        success: false,
        error: `Role ${rolePermissions.label} cannot upload field inspection evidence. Switch to Field Engineer or Administrator.`
      };
    }
    const validation = validateEvidenceFile({
      fileName: input.fileName,
      mimeType: input.mimeType,
      fileSizeBytes: input.fileSizeBytes
    });
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }
    const task = fieldTasks.find((t) => t.id === input.taskId);
    if (!task) return { success: false, error: 'Field task not found.' };

    const nowIso = new Date().toISOString();
    const evidenceItem: FieldEvidence = {
      id: `EVD-${Date.now()}`,
      taskId: task.id,
      taskCode: task.taskCode,
      decisionId: task.decisionId,
      fileName: input.fileName.trim(),
      mimeType: input.mimeType,
      fileSizeBytes: input.fileSizeBytes,
      filePreviewUrl: input.filePreviewUrl,
      gpsLat: Number.isFinite(input.gpsLat) ? input.gpsLat : task.gpsLat,
      gpsLon: Number.isFinite(input.gpsLon) ? input.gpsLon : task.gpsLon,
      notes: input.notes.trim() || 'Field verification uploaded.',
      inspectionResult: input.inspectionResult,
      equipmentCondition: input.equipmentCondition,
      meterReadings: input.meterReadings,
      uploadedBy: rolePermissions.actorName,
      uploadedByEmail: rolePermissions.actorEmail,
      uploadedAt: nowIso,
      source: 'DEMO'
    };

    setFieldEvidence((prev) => [evidenceItem, ...prev]);

    logAudit(
      'EVIDENCE_UPLOADED',
      'field_evidence',
      evidenceItem.id,
      `Uploaded ${evidenceItem.fileName} (${evidenceItem.inspectionResult}) for ${task.taskCode} at GPS ${evidenceItem.gpsLat.toFixed(4)}, ${evidenceItem.gpsLon.toFixed(4)}.`,
      {
        module: 'Field Operations',
        relatedAssetId: task.assetId,
        relatedIncidentId: task.incidentId || undefined
      }
    );

    fetch('/api/evidence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(evidenceItem)
    }).catch(() => {});

    return { success: true, evidence: evidenceItem };
  };

  const verifyAndCloseDecision = (
    decisionId: string,
    checklist: VerificationChecklistState,
    resolutionSummary: string
  ): { success: boolean; error?: string } => {
    if (!rolePermissions.canVerifyAndClose) {
      return {
        success: false,
        error: `Only Utility Manager or Administrator roles can verify checklists and close incidents (current: ${rolePermissions.label}).`
      };
    }
    if (!isChecklistComplete(checklist)) {
      return {
        success: false,
        error: 'All 5 verification checklist confirmations (Fault Resolved, Equipment Tested, Power Restored, Safety Checks, Documentation) must be checked before closing.'
      };
    }

    const decision = decisions.find((d) => d.id === decisionId);
    if (!decision) return { success: false, error: 'Decision not found.' };

    const nowIso = new Date().toISOString();
    const createdMs = Date.parse(decision.createdAt);
    const resolutionMinutes = Number.isFinite(createdMs)
      ? Math.max(15, Math.min(240, Math.round((Date.now() - createdMs) / 60000)))
      : 45;

    const finalChecklist: VerificationChecklistState = {
      ...checklist,
      verifiedBy: rolePermissions.actorName,
      verifiedAt: nowIso
    };

    setDecisions((prev) =>
      prev.map((d) =>
        d.id === decisionId
          ? {
              ...d,
              status: 'CLOSED',
              verificationChecklist: finalChecklist,
              resolutionSummary: resolutionSummary.trim() || 'Fault cleared and service restored after human verification.',
              resolutionTimeMinutes: resolutionMinutes,
              closedAt: nowIso,
              closedBy: rolePermissions.actorName,
              updatedAt: nowIso,
              comments: [
                ...d.comments,
                {
                  author: rolePermissions.actorName,
                  role: currentRole,
                  timestamp: nowIso,
                  text: `CASE VERIFIED & CLOSED: ${resolutionSummary.trim() || 'All 5 checklist confirmations signed.'}`
                }
              ]
            }
          : d
      )
    );

    if (decision.assignedTaskId) {
      setFieldTasks((prev) =>
        prev.map((t) =>
          t.id === decision.assignedTaskId
            ? {
                ...t,
                status: 'VERIFIED',
                verifiedAt: nowIso,
                verifiedBy: rolePermissions.actorName,
                completedAt: t.completedAt || nowIso,
                updatedAt: nowIso
              }
            : t
        )
      );
    }

    if (decision.faultId) {
      setFaults((prev) =>
        prev.map((f) =>
          f.id === decision.faultId
            ? { ...f, status: 'RESTORED', lastUpdated: nowIso }
            : f
        )
      );
    }

    logAudit(
      'CASE_VERIFIED',
      'engineering_decisions',
      decisionId,
      `Verified 5-point operational checklist for ${decision.decisionCode} (${decision.targetAssetId}).`,
      {
        module: 'Decision Governance',
        relatedAssetId: decision.targetAssetId,
        relatedIncidentId: decision.incidentId || undefined
      }
    );

    logAudit(
      'INCIDENT_CLOSED',
      'engineering_decisions',
      decisionId,
      `Closed decision & incident ${decision.decisionCode}. Summary: ${resolutionSummary || 'Verified restoration.'}`,
      {
        module: 'Decision Governance',
        relatedAssetId: decision.targetAssetId,
        relatedIncidentId: decision.incidentId || undefined
      }
    );

    pushNotification({
      type: 'INCIDENT_RESOLVED',
      title: `Incident Closed: ${decision.decisionCode}`,
      message: `${decision.targetAssetId} verified and closed by ${rolePermissions.actorName}.`,
      severity: 'INFO',
      relatedAssetId: decision.targetAssetId,
      relatedIncidentId: decision.incidentId || undefined,
      relatedDecisionId: decision.id,
      targetView: 'decisions',
      source: 'DEMO'
    });

    fetch(`/api/decisions/${encodeURIComponent(decisionId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'CLOSED',
        verificationChecklist: finalChecklist,
        resolutionSummary
      })
    }).catch(() => {});

    return { success: true };
  };

  const markNotificationRead = useCallback((notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    );
    fetch(`/api/notifications/${encodeURIComponent(notificationId)}/read`, {
      method: 'POST'
    }).catch(() => {});
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const runSimulation = (
    rawParams:
      | SimulationInputParams
      | {
          sourceFeeder: string;
          targetFeeder: string;
          loadTransferMva: number;
          tieSwitch: string;
        }
  ): SimulationScenario => {
    const normalizedParams: SimulationInputParams =
      'scenarioType' in rawParams
        ? rawParams
        : {
            scenarioType: 'FEEDER_TRANSFER',
            sourceFeeder: rawParams.sourceFeeder,
            targetFeeder: rawParams.targetFeeder,
            tieSwitch: rawParams.tieSwitch,
            loadTransferMva: rawParams.loadTransferMva
          };

    const nextIndex = scenarios.length + 1;
    const scenarioCode = `SCEN-2026-${String(nextIndex).padStart(3, '0')}`;

    const newScenario = executeWhatIfSimulation(
      normalizedParams,
      {
        assets,
        powerLines,
        faults,
        reconstructions: INITIAL_EVENT_RECONSTRUCTIONS,
        issues,
        telemetryByAssetId
      },
      {
        id: `SCEN-${Date.now()}`,
        scenarioCode,
        source: 'SIMULATED',
        status: 'COMPLETED'
      }
    );

    setScenarios((prev) => [newScenario, ...prev]);
    setActiveSimulationId(newScenario.id);
    setSimulationOverlayPlaying(true);
    setHighlightedAssetIds(newScenario.mapOverlay.participatingAssetIds);
    setStats((prev) => ({ ...prev, activeScenariosCount: prev.activeScenariosCount + 1 }));

    // Link simulation to active asset / incident in shared state
    if (normalizedParams.incidentId) {
      setSelectedReconstructionId(normalizedParams.incidentId);
    }
    if (normalizedParams.faultId) {
      setSelectedFaultId(normalizedParams.faultId);
    }

    if (newScenario.riskAssessment.level === 'HIGH') {
      pushNotification({
        type: 'HIGH_RISK_SIMULATION',
        title: `High-Risk Simulation Flagged: ${newScenario.scenarioCode}`,
        message: `${newScenario.scenarioType} (${newScenario.sourceFeederId} -> ${newScenario.targetFeederId}) triggered HIGH risk.`,
        severity: 'CRITICAL',
        relatedAssetId: newScenario.targetFeederId,
        relatedIncidentId: newScenario.incidentId || undefined,
        targetView: 'simulator',
        source: 'SIMULATED'
      });
    }

    logAudit(
      'SCENARIO_SIMULATED',
      'simulation_scenarios',
      newScenario.id,
      `Executed ${newScenario.scenarioType} simulation ${newScenario.scenarioCode}: ${newScenario.transferredLoadMva.toFixed(2)} MVA (${newScenario.sourceFeederId} -> ${newScenario.targetFeederId}). Risk: ${newScenario.riskAssessment.level}.`,
      {
        module: 'What-If Simulator',
        relatedAssetId: newScenario.targetFeederId,
        relatedIncidentId: newScenario.incidentId || undefined
      }
    );

    // Sync asynchronously with backend simulation API
    fetch('/api/simulations/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...normalizedParams,
        id: newScenario.id,
        scenarioCode: newScenario.scenarioCode
      })
    }).catch(() => {
      // Non-blocking: local deterministic simulation already applied
    });

    return newScenario;
  };

  const selectSimulationScenario = useCallback(
    (simulationId: string | null) => {
      setActiveSimulationId(simulationId);
      if (!simulationId) return;
      const found = scenarios.find((s) => s.id === simulationId);
      if (found) {
        setHighlightedAssetIds(found.mapOverlay.participatingAssetIds);
        if (found.incidentId) {
          setSelectedReconstructionId(found.incidentId);
        }
        if (found.faultId) {
          setSelectedFaultId(found.faultId);
        }
        const focusTarget = found.transformerId || found.tieSwitchId || found.sourceFeederId;
        if (focusTarget) {
          selectAsset(focusTarget, 'simulator', { zoom: 15, openPopup: false });
        }
      }
    },
    [scenarios, selectAsset]
  );

  const activeSimulation = useMemo(
    () => scenarios.find((s) => s.id === activeSimulationId) || scenarios[0] || null,
    [scenarios, activeSimulationId]
  );

  const activeSimulationOverlay = useMemo(() => {
    if (!activeSimulation) return null;
    return {
      ...activeSimulation.mapOverlay,
      isPlaying: simulationOverlayPlaying
    };
  }, [activeSimulation, simulationOverlayPlaying]);

  const compareSimulations = useCallback(
    (scenarioIds: string[]): SimulationComparisonResult => {
      const selected = scenarios.filter((s) => scenarioIds.includes(s.id));
      return compareSimulationScenarios(selected);
    },
    [scenarios]
  );

  const recordReportExportAudit = useCallback(
    (scenario: SimulationScenario) => {
      logAudit(
        'REPORT_EXPORTED',
        'simulation_scenarios',
        scenario.id,
        `Exported PDF Decision Support Report for ${scenario.scenarioCode} (${scenario.riskAssessment.level} RISK).`,
        { module: 'What-If Simulator', relatedAssetId: scenario.targetFeederId }
      );
    },
    [logAudit]
  );

  const recordResolutionReportExportAudit = useCallback(
    (decision: EngineeringDecision) => {
      logAudit(
        'REPORT_EXPORTED',
        'engineering_decisions',
        decision.id,
        `Exported Incident Resolution PDF Report for ${decision.decisionCode} (${decision.status}).`,
        {
          module: 'Decision Governance',
          relatedAssetId: decision.targetAssetId,
          relatedIncidentId: decision.incidentId || undefined
        }
      );
    },
    [logAudit]
  );

  const activeRootCauseAnalysis = useMemo(
    () =>
      buildRootCauseAnalysis({
        selectedAssetId,
        selectedFaultId,
        selectedReconstructionId,
        assets,
        powerLines,
        faults,
        reconstructions: INITIAL_EVENT_RECONSTRUCTIONS,
        events,
        issues,
        telemetryByAssetId
      }),
    [
      selectedAssetId,
      selectedFaultId,
      selectedReconstructionId,
      assets,
      powerLines,
      faults,
      events,
      issues,
      telemetryByAssetId
    ]
  );

  const activeWorkflowStage: WorkflowStageId = useMemo(() => {
    if (workflowOverrideStage) return workflowOverrideStage;
    switch (activeView) {
      case 'map':
        return 'map';
      case 'graph':
        return 'graph';
      case 'events':
        return 'events';
      case 'simulator':
        return simulatorTab === 'governance' ? 'decisions' : 'simulator';
      case 'field':
        return 'field';
      case 'admin':
        return adminTab === 'logs' ? 'audit' : 'incident';
      case 'overview':
      case 'integrity':
      default:
        return 'incident';
    }
  }, [workflowOverrideStage, activeView, simulatorTab, adminTab]);

  const navigateWorkflowStage = useCallback(
    (stage: WorkflowStageId) => {
      setWorkflowOverrideStage(stage);
      switch (stage) {
        case 'incident':
          setActiveViewState('overview');
          break;
        case 'map':
          setActiveViewState('map');
          break;
        case 'graph':
          setActiveViewState('graph');
          break;
        case 'events':
          setActiveViewState('events');
          break;
        case 'rca':
          setFocusRcaNonce((n) => n + 1);
          setActiveViewState('events');
          break;
        case 'simulator':
          if (activeRootCauseAnalysis.feederId || activeRootCauseAnalysis.recommendedTargetFeederId) {
            setPendingSimulationParams({
              sourceFeeder: activeRootCauseAnalysis.feederId || undefined,
              targetFeeder: activeRootCauseAnalysis.recommendedTargetFeederId || undefined,
              tieSwitch: activeRootCauseAnalysis.recommendedTieSwitchId || undefined,
              loadTransferMva: activeRootCauseAnalysis.recommendedTransferMva
            });
          }
          setSimulatorTab('studio');
          setActiveViewState('simulator');
          break;
        case 'decisions':
          setSimulatorTab('governance');
          setActiveViewState('simulator');
          break;
        case 'field':
          setActiveViewState('field');
          break;
        case 'audit':
          setAdminTab('logs');
          setActiveViewState('admin');
          break;
      }
    },
    [activeRootCauseAnalysis]
  );

  const selectGraphNode = useCallback(
    (node: GraphNodeData) => {
      if (node.type === 'STATE' && node.stateName) {
        const stateFilter: GeographicFilterState = {
          ...DEFAULT_GEO_FILTER,
          country: 'India',
          state: node.stateName
        };
        const viewport = computeViewportForSelection(
          assetsRef.current,
          GEOGRAPHIC_BOUNDARIES,
          stateFilter
        );
        setMapCenter(viewport.center);
        setMapZoom(viewport.zoom);
        setCurrentMapZoom(viewport.zoom);
        if (node.targetAssetId) {
          selectAsset(node.targetAssetId, 'graph', { zoom: viewport.zoom, openPopup: false });
        }
        return;
      }

      if (node.type === 'DISTRICT' && node.stateName && node.districtName) {
        const distFilter: GeographicFilterState = {
          ...DEFAULT_GEO_FILTER,
          country: 'India',
          state: node.stateName,
          district: node.districtName
        };
        const viewport = computeViewportForSelection(
          assetsRef.current,
          GEOGRAPHIC_BOUNDARIES,
          distFilter
        );
        setMapCenter(viewport.center);
        setMapZoom(viewport.zoom);
        setCurrentMapZoom(viewport.zoom);
        if (node.targetAssetId) {
          selectAsset(node.targetAssetId, 'graph', { zoom: viewport.zoom, openPopup: false });
        }
        return;
      }

      if (node.type === 'CONSUMER_CLUSTER' && node.targetAssetId) {
        selectAsset(node.targetAssetId, 'graph', { zoom: 16, openPopup: true });
        return;
      }

      selectAsset(node.canonicalId || node.id, 'graph', { zoom: 15, openPopup: true });
    },
    [selectAsset]
  );

  const syncAssetFromGraph = useCallback(
    (assetId: string) => {
      selectAsset(assetId, 'graph', { zoom: 15, openPopup: true });
    },
    [selectAsset]
  );

  const focusAssetOnMap = useCallback(
    (assetId: string) => {
      selectAsset(assetId, 'search', { zoom: 16, openPopup: true });
      setActiveView('map');
    },
    [selectAsset, setActiveView]
  );

  const focusFaultOnMap = useCallback(
    (faultId: string) => {
      const fault = faults.find((f) => f.id === faultId || f.faultCode === faultId);
      if (fault) {
        setSelectedFaultId(fault.id);
        setSelectedAssetIdState(fault.affectedAssetId);
        setSelectionSource('search');
        setHighlightedAssetIds([fault.affectedAssetId]);
        setMapCenter([fault.latitude, fault.longitude]);
        setMapZoom(16);
        setCurrentMapZoom(16);
        setFaultFocusNonce((n) => n + 1);
        const matchingIncident = INITIAL_EVENT_RECONSTRUCTIONS.find(
          (inc) => inc.faultId === fault.id || inc.id === fault.relatedEventId
        );
        if (matchingIncident) {
          setSelectedReconstructionId(matchingIncident.id);
        }
        setActiveView('map');
      }
    },
    [faults, setActiveView]
  );

  const openEventReconstructionForFault = useCallback(
    (faultId: string) => {
      const fault = faults.find((f) => f.id === faultId || f.faultCode === faultId);
      const incident = INITIAL_EVENT_RECONSTRUCTIONS.find(
        (inc) =>
          inc.faultId === faultId ||
          inc.faultCode === faultId ||
          inc.id === faultId ||
          (fault && (inc.id === fault.relatedEventId || inc.faultId === fault.id))
      );
      if (fault) {
        setSelectedFaultId(fault.id);
        setSelectedAssetIdState(fault.affectedAssetId);
        setSelectionSource('search');
      }
      if (incident) {
        setSelectedReconstructionId(incident.id);
      }
      setActiveView('events');
    },
    [faults, setActiveView]
  );

  const openEventReconstructionForAsset = useCallback(
    (assetId: string) => {
      const asset = assetsRef.current.find(
        (a) => a.canonicalId === assetId || a.id === assetId
      );
      const incident = INITIAL_EVENT_RECONSTRUCTIONS.find(
        (inc) =>
          inc.affectedAssetIds.includes(assetId) ||
          (asset?.feederId && inc.feederId === asset.feederId) ||
          (asset?.substationId && inc.substationId === asset.substationId)
      );
      selectAsset(assetId, 'events', { openPopup: false });
      if (incident) {
        setSelectedReconstructionId(incident.id);
      }
      setActiveView('events');
    },
    [selectAsset, setActiveView]
  );

  const openRootCauseForAsset = useCallback(
    (assetId?: string) => {
      if (assetId) {
        selectAsset(assetId, 'workflow', { openPopup: false });
      }
      setWorkflowOverrideStage('rca');
      setFocusRcaNonce((n) => n + 1);
      setActiveViewState('events');
    },
    [selectAsset]
  );

  const openKnowledgeGraphForAsset = useCallback(
    (assetId: string) => {
      selectAsset(assetId, 'map', { openPopup: false });
      setActiveView('graph');
    },
    [selectAsset, setActiveView]
  );

  const openFieldTaskForAsset = useCallback(
    (assetId: string) => {
      selectAsset(assetId, 'field', { openPopup: false });
      const matchingTask =
        fieldTasks.find((t) => t.assetId === assetId && t.status !== 'VERIFIED') ||
        fieldTasks.find((t) => t.assetId === assetId) ||
        fieldTasks[0];
      if (matchingTask) {
        setActiveTaskId(matchingTask.id);
        const matchingEng = fieldEngineers.find(
          (e) =>
            e.currentTaskId === matchingTask.id ||
            e.engineerId === matchingTask.engineerId ||
            e.email.toLowerCase() === matchingTask.assignedEngineerEmail.toLowerCase()
        );
        if (matchingEng) setSelectedEngineerId(matchingEng.engineerId);
      }
      setActiveView('field');
    },
    [fieldTasks, fieldEngineers, selectAsset, setActiveView]
  );

  // --------------------------------------------------------------------------
  // Phase 11: Live Field Operations Derived Models, Geo-Fences & Actions
  // --------------------------------------------------------------------------
  const geoFences = useMemo(
    () =>
      buildGeoFencesForGrid({
        assets,
        faults,
        maintenanceZones
      }),
    [assets, faults, maintenanceZones]
  );

  const engineerRoutes = useMemo<LiveRouteInfo[]>(() => {
    const routes: LiveRouteInfo[] = [];
    for (const eng of fieldEngineers) {
      if (!eng.currentTaskId) continue;
      const task = fieldTasks.find((t) => t.id === eng.currentTaskId);
      if (!task || task.status === 'VERIFIED') continue;
      const asset = assets.find((a) => a.canonicalId === task.assetId) ?? null;
      const baseRoute = computeFallbackRoute({ engineer: eng, task, destAsset: asset });
      const cached = mapboxRouteGeometryByKey[baseRoute.routeId];
      if (cached && cached.coordinates.length >= 2) {
        routes.push({
          ...baseRoute,
          coordinates: cached.coordinates,
          remainingDistanceKm:
            baseRoute.progressPct >= 98 ? 0 : Math.min(baseRoute.remainingDistanceKm, cached.distanceKm),
          etaMinutes:
            baseRoute.progressPct >= 98 ? 0 : Math.max(1, Math.round(cached.etaMinutes)),
          provider: 'MAPBOX_DIRECTIONS'
        });
      } else {
        routes.push(baseRoute);
      }
    }
    return routes;
  }, [fieldEngineers, fieldTasks, assets, mapboxRouteGeometryByKey]);

  const fieldDashboardMetrics = useMemo(
    () =>
      computeFieldDashboardMetrics({
        engineers: fieldEngineers,
        tasks: fieldTasks,
        faults,
        routes: engineerRoutes,
        geofenceEvents: geoFenceEvents
      }),
    [fieldEngineers, fieldTasks, faults, engineerRoutes, geoFenceEvents]
  );

  // Enrich active route geometries with Mapbox Directions API when token is configured
  useEffect(() => {
    const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
    if (!token || token.trim().length === 0 || token.trim() === 'YOUR_MAPBOX_PUBLIC_ACCESS_TOKEN') {
      return;
    }
    const activeTraveling = fieldEngineers.filter(
      (eng) => eng.currentTaskId && (eng.status === 'TRAVELING' || eng.status === 'AVAILABLE')
    );
    for (const eng of activeTraveling.slice(0, 3)) {
      const task = fieldTasks.find((t) => t.id === eng.currentTaskId);
      if (!task || task.status === 'COMPLETED' || task.status === 'VERIFIED') continue;
      const routeId = `RTE-${task.id}-${eng.engineerId}`;
      if (mapboxRouteGeometryByKey[routeId]) continue;

      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 5000);
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${eng.longitude},${eng.latitude};${task.gpsLon},${task.gpsLat}?geometries=geojson&overview=full&access_token=${encodeURIComponent(token)}`;
      fetch(url, { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          const route = data?.routes?.[0];
          const coords = route?.geometry?.coordinates;
          if (Array.isArray(coords) && coords.length >= 2) {
            setMapboxRouteGeometryByKey((prev) => ({
              ...prev,
              [routeId]: {
                coordinates: coords as [number, number][],
                distanceKm: Math.round(((Number(route.distance) || 1000) / 1000) * 100) / 100,
                etaMinutes: Math.max(1, Math.round((Number(route.duration) || 180) / 60))
              }
            }));
          }
        })
        .catch(() => {
          // Graceful fallback to computeFallbackRoute
        })
        .finally(() => window.clearTimeout(timer));
    }
  }, [fieldEngineers, fieldTasks, mapboxRouteGeometryByKey]);

  const getRecommendedEngineersForAsset = useCallback(
    (assetId: string): EngineerRecommendation[] => {
      const targetAsset =
        assets.find((a) => a.canonicalId === assetId || a.id === assetId) || assets[0];
      if (!targetAsset) return [];
      return recommendEngineersForAsset({
        asset: targetAsset,
        engineers: fieldEngineers,
        tasks: fieldTasks
      });
    },
    [assets, fieldEngineers, fieldTasks]
  );

  const getLiveIncidentTimeline = useCallback(
    (taskId?: string | null): LiveIncidentTimelineStep[] => {
      const targetTask =
        (taskId && fieldTasks.find((t) => t.id === taskId)) ||
        fieldTasks.find((t) => t.id === activeTaskId) ||
        fieldTasks[0] ||
        null;
      const matchingFault =
        (targetTask?.faultId && faults.find((f) => f.id === targetTask.faultId)) ||
        (targetTask && faults.find((f) => f.affectedAssetId === targetTask.assetId)) ||
        faults[0] ||
        null;
      const matchingRecon =
        INITIAL_EVENT_RECONSTRUCTIONS.find(
          (r) =>
            (matchingFault && r.faultId === matchingFault.id) ||
            (targetTask && r.affectedAssetIds.includes(targetTask.assetId))
        ) || INITIAL_EVENT_RECONSTRUCTIONS[0] || null;
      return buildLiveIncidentTimeline({
        task: targetTask,
        fault: matchingFault,
        reconstruction: matchingRecon,
        evidence: fieldEvidence,
        auditLogs
      });
    },
    [fieldTasks, activeTaskId, faults, fieldEvidence, auditLogs]
  );

  const buildFieldRequestHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-gridguard-role': currentRole
    };
    if (authSession?.accessToken) {
      headers.Authorization = `Bearer ${authSession.accessToken}`;
    }
    return headers;
  }, [currentRole, authSession]);

  const assignEngineerToTask = useCallback(
    async (input: {
      assetId: string;
      engineerId: string;
      decisionId?: string;
      incidentId?: string | null;
      title?: string;
      priority?: PriorityLevel;
      dueDate?: string;
      safetyNotes?: string;
    }): Promise<{ success: boolean; error?: string; task?: FieldTask }> => {
      if (!rolePermissions.canAssignFieldTask) {
        return {
          success: false,
          error: `Only Utility Manager or Administrator roles can dispatch field engineers (current: ${rolePermissions.label}).`
        };
      }
      const engineer = fieldEngineers.find((e) => e.engineerId === input.engineerId);
      const asset = assets.find((a) => a.canonicalId === input.assetId);
      if (!engineer || !asset) {
        return { success: false, error: 'Selected engineer or target asset not found.' };
      }

      const nowIso = new Date().toISOString();
      const distKm =
        Math.round(haversineDistanceKm(engineer.latitude, engineer.longitude, asset.latitude, asset.longitude) * 100) /
        100;
      const etaMin = Math.max(2, Math.round((distKm / 28) * 60 + 2));
      const fallbackDecision =
        decisions.find((d) => d.id === input.decisionId) ||
        decisions.find((d) => d.targetAssetId === asset.canonicalId) ||
        decisions[0];

      try {
        const res = await fetch('/api/field/tasks', {
          method: 'POST',
          headers: buildFieldRequestHeaders(),
          body: JSON.stringify({
            ...input,
            decisionId: fallbackDecision?.id || 'DEC-MANUAL'
          })
        });
        if (res.ok) {
          const data = (await res.json()) as { task?: FieldTask; engineer?: FieldEngineer };
          if (data.task) {
            setFieldTasks((prev) => [data.task!, ...prev.filter((t) => t.id !== data.task!.id)]);
            setActiveTaskId(data.task.id);
          }
          if (data.engineer) {
            setFieldEngineers((prev) =>
              prev.map((e) => (e.engineerId === data.engineer!.engineerId ? data.engineer! : e))
            );
            setSelectedEngineerId(data.engineer.engineerId);
          }
          logAudit(
            'FIELD_TASK_ASSIGNED',
            'field_tasks',
            data.task?.id || engineer.engineerId,
            `Dispatched ${engineer.name} to ${asset.canonicalId} (ETA ${data.task?.etaMinutes ?? etaMin} min).`,
            { module: 'Field Operations', relatedAssetId: asset.canonicalId }
          );
          return { success: true, task: data.task };
        }
      } catch {
        // Optimistic client fallback if backend unavailable
      }

      const taskId = `TSK-${Date.now()}`;
      const taskCode = `TSK-${new Date().getFullYear()}-${String(fieldTasks.length + 1).padStart(3, '0')}`;
      const localTask: FieldTask = {
        id: taskId,
        taskCode,
        decisionId: fallbackDecision?.id || 'DEC-MANUAL',
        decisionCode: fallbackDecision?.decisionCode || 'DEC-MANUAL',
        incidentId: input.incidentId || null,
        title: input.title?.trim() || `Field Dispatch: ${asset.canonicalId} Inspection & Restoration`,
        engineerId: engineer.engineerId,
        assignedEngineer: engineer.name,
        assignedEngineerEmail: engineer.email,
        assignedTeam: engineer.team,
        assetId: asset.canonicalId,
        assetName: asset.name,
        faultLocation: `${asset.area}, ${asset.district}`,
        state: asset.state,
        district: asset.district,
        area: asset.area,
        gpsLat: asset.latitude,
        gpsLon: asset.longitude,
        navigationRoute: [
          { step: `Dispatch from ${engineer.assignedArea}`, distanceLabel: `${(distKm * 0.6).toFixed(1)} km` },
          { step: `Proceed directly to ${asset.canonicalId}`, distanceLabel: `${(distKm * 0.4).toFixed(1)} km` }
        ],
        safetyNotes: input.safetyNotes || 'Verify LOTO isolation & zero-voltage check prior to asset entry.',
        maintenanceHistoryNotes: 'Synchronized with Digital Twin & AI Health Registry.',
        previousIncidentsSummary: 'Linked to operational incident log.',
        scheduledTime: nowIso,
        dueDate: input.dueDate || new Date(Date.now() + 3 * 3600_000).toISOString(),
        etaMinutes: etaMin,
        distanceKm: distKm,
        estimatedCompletionAt: new Date(Date.now() + (etaMin + 35) * 60_000).toISOString(),
        routeProgressPct: 5,
        priority: input.priority || 'HIGH',
        status: 'ASSIGNED',
        source: 'DEMO',
        createdAt: nowIso,
        updatedAt: nowIso
      };
      setFieldTasks((prev) => [localTask, ...prev]);
      setActiveTaskId(localTask.id);
      setFieldEngineers((prev) =>
        prev.map((e) =>
          e.engineerId === engineer.engineerId
            ? {
                ...e,
                status: 'TRAVELING',
                currentTaskId: localTask.id,
                currentTaskCode: localTask.taskCode,
                currentAssetId: localTask.assetId,
                activeWorkloadCount: e.activeWorkloadCount + 1,
                lastLocationUpdate: nowIso
              }
            : e
        )
      );
      setSelectedEngineerId(engineer.engineerId);
      return { success: true, task: localTask };
    },
    [
      rolePermissions,
      fieldEngineers,
      assets,
      decisions,
      fieldTasks.length,
      buildFieldRequestHeaders
    ]
  );

  const acceptFieldTask = useCallback(
    async (taskId: string): Promise<{ success: boolean; error?: string }> => {
      if (!rolePermissions.canExecuteFieldTask && !rolePermissions.canAssignFieldTask) {
        return { success: false, error: `Role ${rolePermissions.label} cannot accept field assignments.` };
      }
      const existing = fieldTasks.find((t) => t.id === taskId);
      if (!existing) return { success: false, error: 'Field task not found.' };

      const nowIso = new Date().toISOString();
      setFieldTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, status: 'ACCEPTED', acceptedAt: nowIso, updatedAt: nowIso } : t
        )
      );
      setFieldEngineers((prev) =>
        prev.map((e) =>
          e.currentTaskId === taskId || e.engineerId === existing.engineerId
            ? { ...e, status: 'TRAVELING', lastLocationUpdate: nowIso }
            : e
        )
      );
      try {
        await fetch(`/api/field/tasks/${encodeURIComponent(taskId)}/accept`, {
          method: 'POST',
          headers: buildFieldRequestHeaders()
        });
      } catch {
        // Already updated optimistically
      }
      return { success: true };
    },
    [rolePermissions, fieldTasks, buildFieldRequestHeaders]
  );

  const completeFieldTask = useCallback(
    async (taskId: string, notes?: string): Promise<{ success: boolean; error?: string }> => {
      if (!rolePermissions.canExecuteFieldTask && !rolePermissions.canVerifyAndClose) {
        return { success: false, error: `Role ${rolePermissions.label} cannot complete field tasks.` };
      }
      const existing = fieldTasks.find((t) => t.id === taskId);
      if (!existing) return { success: false, error: 'Field task not found.' };

      const nowIso = new Date().toISOString();
      setFieldTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: 'COMPLETED',
                completedAt: nowIso,
                routeProgressPct: 100,
                etaMinutes: 0,
                completionNotes: notes?.trim() || t.completionNotes || 'Field repair verified and completed.',
                updatedAt: nowIso
              }
            : t
        )
      );
      setFieldEngineers((prev) =>
        prev.map((e) =>
          e.currentTaskId === taskId || e.engineerId === existing.engineerId
            ? {
                ...e,
                status: 'AVAILABLE',
                speedKmh: 0,
                activeWorkloadCount: Math.max(0, e.activeWorkloadCount - 1),
                lastLocationUpdate: nowIso
              }
            : e
        )
      );
      try {
        await fetch(`/api/field/tasks/${encodeURIComponent(taskId)}/complete`, {
          method: 'POST',
          headers: buildFieldRequestHeaders(),
          body: JSON.stringify({ notes })
        });
      } catch {
        // Already updated optimistically
      }
      return { success: true };
    },
    [rolePermissions, fieldTasks, buildFieldRequestHeaders]
  );

  const updateEngineerLocation = useCallback(
    async (input: {
      engineerId: string;
      latitude: number;
      longitude: number;
      speedKmh?: number;
      status?: FieldEngineerStatus;
    }): Promise<{ success: boolean; error?: string }> => {
      const existing = fieldEngineers.find((e) => e.engineerId === input.engineerId);
      if (!existing) return { success: false, error: 'Engineer not found.' };

      const prevLat = existing.latitude;
      const prevLon = existing.longitude;
      const nowIso = new Date().toISOString();
      const updatedEng: FieldEngineer = {
        ...existing,
        latitude: Number(input.latitude.toFixed(6)),
        longitude: Number(input.longitude.toFixed(6)),
        speedKmh: input.speedKmh ?? existing.speedKmh,
        status: input.status ?? existing.status,
        lastLocationUpdate: nowIso
      };

      setFieldEngineers((prev) =>
        prev.map((e) => (e.engineerId === input.engineerId ? updatedEng : e))
      );

      const gfEvents = evaluateGeoFenceTransitions({
        engineer: updatedEng,
        prevLat,
        prevLon,
        newLat: updatedEng.latitude,
        newLon: updatedEng.longitude,
        fences: geoFences
      });
      if (gfEvents.length > 0) {
        setGeoFenceEvents((prev) => [...gfEvents, ...prev].slice(0, 80));
      }

      try {
        await fetch('/api/field/location/update', {
          method: 'POST',
          headers: buildFieldRequestHeaders(),
          body: JSON.stringify(input)
        });
      } catch {
        // Graceful offline handling
      }
      return { success: true };
    },
    [fieldEngineers, geoFences, buildFieldRequestHeaders]
  );

  const simulateEngineerStepTowardTarget = useCallback(
    async (engineerId: string) => {
      const eng = fieldEngineers.find((e) => e.engineerId === engineerId);
      if (!eng) return;
      const task = eng.currentTaskId
        ? fieldTasks.find((t) => t.id === eng.currentTaskId)
        : fieldTasks.find((t) => t.assetId === eng.currentAssetId) || fieldTasks[0];
      const destAsset = task
        ? assets.find((a) => a.canonicalId === task.assetId)
        : assets.find((a) => a.status === 'FAULTED') || assets[0];
      const destLat = destAsset?.latitude ?? task?.gpsLat ?? eng.latitude;
      const destLon = destAsset?.longitude ?? task?.gpsLon ?? eng.longitude;

      const distKm = haversineDistanceKm(eng.latitude, eng.longitude, destLat, destLon);
      const stepFactor = distKm > 0.25 ? 0.35 : 0.85;
      const nextLat = eng.latitude + (destLat - eng.latitude) * stepFactor;
      const nextLon = eng.longitude + (destLon - eng.longitude) * stepFactor;
      const newDist = haversineDistanceKm(nextLat, nextLon, destLat, destLon);
      const arrived = newDist <= 0.06;

      await updateEngineerLocation({
        engineerId: eng.engineerId,
        latitude: nextLat,
        longitude: nextLon,
        speedKmh: arrived ? 0 : 32,
        status: arrived ? 'WORKING' : 'TRAVELING'
      });

      if (arrived && task && task.status !== 'ON_SITE' && task.status !== 'COMPLETED' && task.status !== 'VERIFIED') {
        updateFieldTaskStatus(task.id, 'ON_SITE', `${eng.name} arrived within asset geo-fence.`);
      }
    },
    [fieldEngineers, fieldTasks, assets, updateEngineerLocation, updateFieldTaskStatus]
  );

  const openKnowledgeGraphForEngineer = useCallback(
    (engineerId: string) => {
      setSelectedEngineerId(engineerId);
      const eng = fieldEngineers.find((e) => e.engineerId === engineerId);
      if (eng?.currentAssetId) {
        selectAsset(eng.currentAssetId, 'field', { openPopup: false });
      }
      setActiveView('graph');
    },
    [fieldEngineers, selectAsset, setActiveView]
  );

  const launchSimulationForAsset = useCallback(
    (asset: InfrastructureAsset) => {
      const all = assetsRef.current;
      const feeders = all.filter((a) => a.assetType === 'FEEDER');
      const resolvedSource =
        asset.assetType === 'FEEDER'
          ? asset.canonicalId
          : asset.feederId ||
            feeders.find((f) => f.substationId === asset.substationId)?.canonicalId ||
            feeders[0]?.canonicalId ||
            '';
      const siblingHealthy =
        feeders.find(
          (f) =>
            f.canonicalId !== resolvedSource &&
            f.substationId === (asset.substationId || '') &&
            f.status !== 'FAULTED'
        ) || feeders.find((f) => f.canonicalId !== resolvedSource);
      const resolvedTieSwitch =
        asset.assetType === 'SECTIONALIZER' ||
        asset.assetType === 'CIRCUIT_BREAKER' ||
        asset.assetType === 'RECLOSER'
          ? asset.canonicalId
          : all.find(
              (a) =>
                (a.assetType === 'SECTIONALIZER' || a.assetType === 'CIRCUIT_BREAKER') &&
                (a.feederId === resolvedSource || a.substationId === asset.substationId)
            )?.canonicalId;

      setPendingSimulationParams({
        sourceFeeder: resolvedSource || undefined,
        targetFeeder: siblingHealthy?.canonicalId || undefined,
        tieSwitch: resolvedTieSwitch || undefined
      });
      selectAsset(asset.canonicalId, 'simulator', { openPopup: false });
      setActiveView('simulator');
    },
    [selectAsset, setActiveView]
  );

  const launchSimulationFromRca = useCallback(
    (rcaOverride?: RootCauseAnalysis) => {
      const rca = rcaOverride ?? activeRootCauseAnalysis;
      setPendingSimulationParams({
        sourceFeeder: rca.feederId || undefined,
        targetFeeder: rca.recommendedTargetFeederId || undefined,
        tieSwitch: rca.recommendedTieSwitchId || undefined,
        loadTransferMva: rca.recommendedTransferMva
      });
      selectAsset(rca.canonicalAssetId, 'workflow', { openPopup: false });
      setActiveView('simulator');
    },
    [activeRootCauseAnalysis, selectAsset, setActiveView]
  );

  const clearPendingSimulationParams = useCallback(() => {
    setPendingSimulationParams(null);
  }, []);

  const aiSnapshot = useMemo(
    () =>
      computeAiIntelligenceSnapshot({
        assets,
        faults,
        events,
        maintenanceZones,
        fieldTasks,
        issues,
        reconstructions: INITIAL_EVENT_RECONSTRUCTIONS,
        telemetryByAssetId,
        recalculatedAt: aiLastRecalculatedAt
      }),
    [assets, faults, events, maintenanceZones, fieldTasks, issues, telemetryByAssetId, aiLastRecalculatedAt]
  );

  const scopedAiSnapshot = useMemo<AiIntelligenceSnapshot>(() => {
    if (!hasRegionSelection) return aiSnapshot;
    const scopedIds = new Set(scoped.scopedAssets.map((a) => a.canonicalId));
    const scopedHealthScores = aiSnapshot.healthScores.filter((h) => scopedIds.has(h.assetId));
    const scopedPredictions = aiSnapshot.predictions.filter((p) => scopedIds.has(p.assetId));
    const scopedRecommendations = aiSnapshot.recommendations.filter((r) => scopedIds.has(r.assetId));
    const scopedQueue = aiSnapshot.maintenanceQueue.filter((q) => scopedIds.has(q.assetId));

    const scopedRiskIndices = aiSnapshot.riskIndices.filter((entry) => {
      if (geoFilter.feederId && entry.scopeLevel === 'FEEDER') {
        return entry.name === geoFilter.feederId;
      }
      if (geoFilter.substationId && entry.scopeLevel === 'SUBSTATION') {
        return entry.name === geoFilter.substationId;
      }
      if (geoFilter.area && entry.scopeLevel === 'AREA') {
        return entry.name.toLowerCase().includes(geoFilter.area.toLowerCase());
      }
      if (geoFilter.district && entry.scopeLevel === 'DISTRICT') {
        return entry.name.toLowerCase() === geoFilter.district.toLowerCase();
      }
      if (geoFilter.state && entry.scopeLevel === 'STATE') {
        return entry.name.toLowerCase() === geoFilter.state.toLowerCase();
      }
      return scopedIds.has(entry.name) || entry.parentLabel.includes(geoFilter.district || geoFilter.state || '');
    });

    return {
      ...aiSnapshot,
      healthScores: scopedHealthScores.length > 0 ? scopedHealthScores : aiSnapshot.healthScores,
      predictions: scopedPredictions,
      recommendations: scopedRecommendations,
      maintenanceQueue: scopedQueue,
      riskIndices: scopedRiskIndices.length > 0 ? scopedRiskIndices : aiSnapshot.riskIndices
    };
  }, [aiSnapshot, hasRegionSelection, scoped.scopedAssets, geoFilter]);

  const getAssetHealth = useCallback(
    (assetId: string) => aiSnapshot.healthScores.find((h) => h.assetId === assetId),
    [aiSnapshot.healthScores]
  );

  const getAssetTimeline = useCallback(
    (assetId: string): AssetTimelineStage[] => {
      const target = assets.find((a) => a.canonicalId === assetId || a.id === assetId);
      if (!target) return [];
      const health = aiSnapshot.healthScores.find((h) => h.assetId === target.canonicalId);
      const prediction = aiSnapshot.predictions.find((p) => p.assetId === target.canonicalId);
      return buildAssetAiTimeline({
        asset: target,
        health,
        prediction,
        events,
        faults
      });
    },
    [assets, aiSnapshot.healthScores, aiSnapshot.predictions, events, faults]
  );

  const recalculateAiIntelligence = useCallback(() => {
    const nowIso = new Date().toISOString();
    setAiLastRecalculatedAt(nowIso);
    logAudit(
      'AI_RECALCULATED',
      'ai_intelligence',
      'AI-ENGINE-V2',
      `Recalculated Asset Health Scores, Failure Predictions, and Grid Risk Indices across ${assetsRef.current.length} canonical assets.`,
      {
        module: 'AI Predictive Intelligence',
        metadata: {
          assetCount: assetsRef.current.length,
          criticalCount: aiSnapshot.healthScores.filter((h) => h.category === 'CRITICAL').length,
          predictionsCount: aiSnapshot.predictions.length
        }
      }
    );
    fetch('/api/ai/recalculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestedBy: rolePermissions.actorEmail })
    }).catch(() => {});
  }, [logAudit, aiSnapshot.healthScores, aiSnapshot.predictions.length, rolePermissions.actorEmail]);

  const prepareDecisionFromAiRecommendation = useCallback(
    (rec: AiRecommendation) => {
      selectAsset(rec.assetId, 'overview', { openPopup: false });
      const matchingPred = aiSnapshot.predictions.find((p) => p.id === rec.linkedPredictionId);
      const impactText = `-${rec.expectedRiskReductionPct}% outage & equipment failure risk`;
      logAudit(
        'AI_RECOMMENDATION_GENERATED',
        'ai_recommendations',
        rec.id,
        `Transferred AI recommendation ${rec.id} (${rec.confidenceScore}% conf.) for ${rec.assetId} into Decision Governance draft.`,
        {
          module: 'AI Predictive Intelligence',
          relatedAssetId: rec.assetId,
          metadata: { confidenceScore: rec.confidenceScore, priority: rec.priority }
        }
      );
      setPendingDecisionDraft({
        title: `AI Preventive Action: ${rec.assetName} (${rec.assetId})`,
        rationale: `${rec.recommendation} ${rec.reasons.join(' ')} Expected risk reduction: ${impactText}.`,
        riskAssessment: `${rec.priority} PRIORITY (${rec.confidenceScore}% AI confidence). ${
          matchingPred?.historicalComparison || 'Historical urban telemetry correlation indicates elevated failure probability.'
        } Requires engineering review & manager approval prior to crew execution.`,
        targetAssetId: rec.assetId,
        conflictIssueIds: issues
          .filter((i) => i.canonicalAssetId === rec.assetId && i.status !== 'RESOLVED')
          .map((i) => i.id),
        eventTimelineIds: events
          .filter((e) => e.assetCanonicalId === rec.assetId)
          .slice(0, 3)
          .map((e) => e.id),
        affectedCustomersCount: null,
        reliabilityImpact: impactText,
        aiRecommendationSummary: rec.recommendation,
        aiConfidenceScore: rec.confidenceScore,
        aiReasons: rec.reasons
      });
      setActiveView('decisions');
    },
    [selectAsset, logAudit, issues, events, setActiveView, aiSnapshot.predictions]
  );

  const launchSimulationFromAiRecommendation = useCallback(
    (rec: AiRecommendation) => {
      logAudit(
        'AI_RECOMMENDATION_GENERATED',
        'ai_recommendations',
        rec.id,
        `Launched What-If Simulation preloaded from AI recommendation ${rec.id} for ${rec.assetId}.`,
        { module: 'AI Predictive Intelligence', relatedAssetId: rec.assetId }
      );
      if (rec.linkedScenarioParams?.sourceFeeder && rec.linkedScenarioParams?.targetFeeder) {
        setPendingSimulationParams({
          sourceFeeder: rec.linkedScenarioParams.sourceFeeder,
          targetFeeder: rec.linkedScenarioParams.targetFeeder,
          tieSwitch: rec.linkedScenarioParams.tieSwitch || 'SW-TG-06U-14',
          loadTransferMva: rec.linkedScenarioParams.loadTransferMva ?? 3.4
        });
        selectAsset(rec.assetId, 'simulator', { openPopup: false });
        setActiveView('simulator');
        return;
      }
      const matched = assetsRef.current.find((a) => a.canonicalId === rec.assetId);
      if (matched) {
        launchSimulationForAsset(matched);
      } else {
        setActiveView('simulator');
      }
    },
    [logAudit, selectAsset, setActiveView, launchSimulationForAsset]
  );

  const prepareDecisionFromContext = useCallback(
    (scenario?: SimulationScenario) => {
      const rca = activeRootCauseAnalysis;
      const targetId =
        scenario?.tieSwitchId ||
        scenario?.transformerId ||
        rca.recommendedTieSwitchId ||
        rca.canonicalAssetId ||
        selectedAssetId ||
        'SW-TG-06U-14';

      const matchingRec = aiSnapshot.recommendations.find(
        (r) =>
          r.assetId === targetId ||
          r.assetId === rca.canonicalAssetId ||
          r.assetId === rca.feederId
      );

      const title = scenario
        ? `Authorize ${scenario.scenarioCode}: ${scenario.recommendation.title}`
        : `Operational Switching & Recovery Proposal for ${targetId}`;

      const rationale = [
        `Root Cause (${rca.id}): ${rca.rootCauseSummary}`,
        scenario
          ? `What-If Simulation (${scenario.scenarioCode} · ${scenario.scenarioType}): ${scenario.recommendation.reasons.join('; ')}. Post-operation loading ${scenario.targetFeederPostLoadMva.toFixed(2)} / ${scenario.targetFeederCapacityMva} MVA, min bus voltage ${scenario.minBusVoltagePu} p.u.`
          : `Recommended Action: ${rca.recommendedActionTitle}.`
      ].join(' ');

      const riskAssessment = scenario
        ? `${scenario.riskAssessment.level} RISK: ${scenario.riskAssessment.reasons.join(' ')}`
        : rca.dataIntegrityCaveats.length > 0
          ? `Verify integrity caveat(s) prior to execution: ${rca.dataIntegrityCaveats[0]}`
          : 'Requires field crew isolation confirmation and Reviewer/Approver sign-off.';

      const affectedCustomers =
        scenario?.impactAnalysis.consumersAffectedAfter ?? rca.affectedConsumersCount;

      setPendingDecisionDraft({
        title,
        rationale,
        riskAssessment,
        targetAssetId: targetId,
        conflictIssueIds: rca.evidenceIssueIds,
        eventTimelineIds: rca.evidenceEventIds,
        simulationScenarioId: scenario?.scenarioCode,
        affectedCustomersCount: affectedCustomers,
        reliabilityImpact: scenario
          ? `${scenario.scenarioCode} · Restores ${scenario.impactAnalysis.consumersRestored ?? 'N/A'} consumers · Est. window ${scenario.expectedDurationMin} min`
          : `Linked to ${rca.id} · Impact: ${rca.consumerClusterLabel}`,
        aiRecommendationSummary: matchingRec?.recommendation,
        aiConfidenceScore: matchingRec?.confidenceScore,
        aiReasons: matchingRec?.reasons
      });
      setActiveView('decisions');
    },
    [activeRootCauseAnalysis, selectedAssetId, setActiveView, aiSnapshot.recommendations]
  );

  const clearPendingDecisionDraft = useCallback(() => {
    setPendingDecisionDraft(null);
  }, []);

  const inspectMaintenanceHistory = useCallback(
    (assetId: string) => {
      selectAsset(assetId, 'map', { openPopup: false });
      setMaintenanceFocusNonce((n) => n + 1);
    },
    [selectAsset]
  );

  const raiseMaintenanceRequest = (asset: InfrastructureAsset): EngineeringDecision => {
    const label = formatMissingValue(asset.rawName ?? asset.name);
    return submitDecision({
      title: `Preventive Maintenance Inspection: ${label} (${asset.canonicalId})`,
      rationale: `Field inspection and infrared thermography requested via Grid Map operational workspace for ${asset.assetType} ${asset.canonicalId} (${formatMissingValue(asset.area)}, ${formatMissingValue(asset.district)}).`,
      riskAssessment:
        asset.status === 'FAULTED' || asset.status === 'WARNING'
          ? `Elevated priority: Asset currently reports ${asset.status} status. Crew isolation verification required before work.`
          : 'Routine preventive maintenance window; verify feeder sectionalizing isolation prior to crew dispatch.',
      targetAssetId: asset.canonicalId,
      evidenceBundle: {
        conflictIssueIds: issues
          .filter((i) => i.canonicalAssetId === asset.canonicalId)
          .map((i) => i.id),
        eventTimelineIds: events
          .filter((e) => e.assetCanonicalId === asset.canonicalId)
          .slice(0, 3)
          .map((e) => e.id),
        affectedCustomersCount: null,
        reliabilityImpact: `Field maintenance request raised for ${asset.canonicalId} [${asset.source}].`
      }
    });
  };

  // Phase 8 Actions: Toasts, Alerts, Health, Demo Triggers, Auth & Multi-Format Export
  const dismissToast = useCallback((toastId: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== toastId));
  }, []);

  const pushToast = useCallback(
    (toast: Omit<GridToast, 'id' | 'timestamp'>) => {
      const id = `tst-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const entry: GridToast = {
        ...toast,
        id,
        timestamp: new Date().toISOString()
      };
      setToasts((prev) => [entry, ...prev].slice(0, 4));
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 6500);
    },
    []
  );

  const markAssetAnimated = useCallback((assetId: string) => {
    if (!assetId) return;
    setRecentAnimatedAssetIds((prev) => Array.from(new Set([assetId, ...prev])).slice(0, 12));
    window.setTimeout(() => {
      setRecentAnimatedAssetIds((prev) => prev.filter((id) => id !== assetId));
    }, 10000);
  }, []);

  const refreshSystemHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health');
      if (!res.ok) return;
      const data = (await res.json()) as SystemHealthSnapshot;
      setSystemHealth(data);
    } catch {
      // Ignore transient offline errors
    }
  }, []);

  const acknowledgeAlert = useCallback(
    (alertId: string) => {
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === alertId
            ? { ...a, acknowledged: true, acknowledgedBy: rolePermissions.actorName }
            : a
        )
      );
      fetch(`/api/alerts/${encodeURIComponent(alertId)}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acknowledgedBy: rolePermissions.actorName })
      }).catch(() => {});
    },
    [rolePermissions.actorName]
  );

  const toggleDemoMode = useCallback(() => {
    setIsDemoMode((prev) => {
      const next = !prev;
      pushToast({
        title: next ? 'Demo Mode Activated' : 'Standard Operations Mode',
        message: next
          ? 'Realistic Indian grid telemetry & live scenario triggers are active.'
          : 'Live demo scenario injector hidden from quick controls.',
        severity: 'INFO'
      });
      return next;
    });
  }, [pushToast]);

  const triggerLiveDemoIncident = useCallback(
    async (assetId?: string) => {
      try {
        const res = await fetch('/api/demo/simulate-incident', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assetId })
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json()) as {
          fault?: ActiveFault;
          alert?: GridAlert;
          notification?: GridNotification;
        };
        if (data.fault) {
          const fault = data.fault;
          setFaults((prev) =>
            prev.some((f) => f.id === fault.id) ? prev : [fault, ...prev]
          );
          setAssets((prev) =>
            prev.map((a) =>
              a.canonicalId === fault.affectedAssetId ? { ...a, status: 'FAULTED' } : a
            )
          );
          markAssetAnimated(fault.affectedAssetId);
        }
        if (data.alert) {
          const alert = data.alert;
          setAlerts((prev) => (prev.some((a) => a.id === alert.id) ? prev : [alert, ...prev]));
        }
        if (data.notification) {
          const notif = data.notification;
          setNotifications((prev) =>
            prev.some((n) => n.id === notif.id) ? prev : [notif, ...prev].slice(0, 40)
          );
        }
      } catch (err) {
        pushToast({
          title: 'Demo Trigger Failed',
          message: err instanceof Error ? err.message : 'Unable to trigger simulated incident.',
          severity: 'HIGH'
        });
      }
    },
    [markAssetAnimated, pushToast]
  );

  const syncDemoRoleJwt = useCallback(async (role: UserRole) => {
    try {
      const res = await fetch('/api/auth/demo-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role })
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        accessToken: string;
        refreshToken: string;
        expiresAtMs: number;
        user: { username: string; email: string; fullName: string; role: UserRole };
      };
      setAuthSession({
        authenticated: true,
        mode: 'DEMO',
        username: data.user.username,
        email: data.user.email,
        fullName: data.user.fullName,
        role: data.user.role,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAtMs: data.expiresAtMs
      });
    } catch {
      // Non-blocking fallback
    }
  }, []);

  const loginWithCredentials = useCallback(
    async (identifier: string, password: string): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier, password })
        });
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          accessToken?: string;
          refreshToken?: string;
          expiresAtMs?: number;
          user?: { username: string; email: string; fullName: string; role: UserRole };
        };
        if (!res.ok || !body.accessToken || !body.user) {
          return { ok: false, error: body.error || `Login failed (${res.status})` };
        }
        setAuthSession({
          authenticated: true,
          mode: 'CREDENTIALS',
          username: body.user.username,
          email: body.user.email,
          fullName: body.user.fullName,
          role: body.user.role,
          accessToken: body.accessToken,
          refreshToken: body.refreshToken || '',
          expiresAtMs: body.expiresAtMs || Date.now() + 7200_000
        });
        setCurrentRoleState(body.user.role);
        pushToast({
          title: 'Authenticated Session Active',
          message: `Signed in as ${body.user.fullName} (${body.user.role}).`,
          severity: 'INFO'
        });
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
      }
    },
    [pushToast]
  );

  const registerAccount = useCallback(
    async (input: {
      username: string;
      email: string;
      fullName: string;
      password: string;
      role: UserRole;
    }): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input)
        });
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          accessToken?: string;
          refreshToken?: string;
          expiresAtMs?: number;
          user?: { username: string; email: string; fullName: string; role: UserRole };
        };
        if (!res.ok || !body.accessToken || !body.user) {
          return { ok: false, error: body.error || `Registration failed (${res.status})` };
        }
        setAuthSession({
          authenticated: true,
          mode: 'CREDENTIALS',
          username: body.user.username,
          email: body.user.email,
          fullName: body.user.fullName,
          role: body.user.role,
          accessToken: body.accessToken,
          refreshToken: body.refreshToken || '',
          expiresAtMs: body.expiresAtMs || Date.now() + 7200_000
        });
        setCurrentRoleState(body.user.role);
        pushToast({
          title: 'Account Registered',
          message: `JWT session issued for ${body.user.email}.`,
          severity: 'INFO'
        });
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
      }
    },
    [pushToast]
  );

  const logoutAuthSession = useCallback(async () => {
    const refreshToken = authSession?.refreshToken;
    if (refreshToken) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      }).catch(() => {});
    }
    setAuthSession(null);
    setCurrentRoleState('VIEWER');
    pushToast({
      title: 'Session Signed Out',
      message: 'Refresh token revoked; switched to read-only Viewer context.',
      severity: 'INFO'
    });
  }, [authSession?.refreshToken, pushToast]);

  const exportReport = useCallback(
    (reportType: ExportReportType, format: ExportFormat) => {
      const kpis = computeRegionalPerformanceKpis({
        assets,
        faults,
        maintenanceZones,
        fieldTasks,
        aiSnapshot
      });
      const result = exportOperationalReport(
        {
          reportType,
          scopeLabel: geoScopeLabel,
          actorName: rolePermissions.actorName,
          actorEmail: rolePermissions.actorEmail,
          faults: scoped.scopedFaults,
          assets: scoped.scopedAssets,
          maintenanceZones: scoped.scopedMaintenanceZones,
          scenarios: scoped.scopedScenarios,
          auditLogs: scoped.scopedAuditLogs,
          aiSnapshot: scopedAiSnapshot,
          decisions: scoped.scopedDecisions,
          regionalKpis: kpis
        },
        format
      );
      const record: ExecutiveReportRecord = {
        reportId: `RPT-${Date.now()}`,
        reportType,
        format,
        generatedBy: rolePermissions.actorName,
        scopeLabel: geoScopeLabel,
        rowCount: result.rowCount,
        filename: result.filename,
        generatedAt: new Date().toISOString()
      };
      setExecutiveReportsHistory((prev) => [record, ...prev].slice(0, 50));
      fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      }).catch(() => {});

      logAudit(
        'REPORT_EXPORTED',
        'reports',
        result.filename,
        `Exported ${reportType} report (${result.rowCount} records) as ${format} within ${geoScopeLabel}.`,
        {
          module: 'Reports & Export Center',
          metadata: { reportType, format, rowCount: result.rowCount, filename: result.filename }
        }
      );
      pushToast({
        title: `${format} Report Exported`,
        message: `Downloaded ${result.filename} (${result.rowCount} rows).`,
        severity: 'INFO',
        targetView: 'reports'
      });
      return result;
    },
    [
      assets,
      faults,
      maintenanceZones,
      fieldTasks,
      aiSnapshot,
      geoScopeLabel,
      rolePermissions.actorName,
      rolePermissions.actorEmail,
      scoped.scopedFaults,
      scoped.scopedAssets,
      scoped.scopedMaintenanceZones,
      scoped.scopedScenarios,
      scoped.scopedAuditLogs,
      scoped.scopedDecisions,
      scopedAiSnapshot,
      logAudit,
      pushToast
    ]
  );

  // Phase 9 Derived Enterprise Models (Digital Twin, Regional KPIs, Insights, Lifecycle, Scenarios)
  const digitalTwinNetwork = useMemo(
    () =>
      buildDigitalTwinNetwork({
        assets: scoped.scopedAssets.length > 0 ? scoped.scopedAssets : assets,
        faults: scoped.scopedFaults,
        powerLines: scoped.scopedPowerLines,
        maintenanceZones: scoped.scopedMaintenanceZones,
        aiSnapshot: scopedAiSnapshot,
        telemetryByAssetId
      }),
    [
      scoped.scopedAssets,
      assets,
      scoped.scopedFaults,
      scoped.scopedPowerLines,
      scoped.scopedMaintenanceZones,
      scopedAiSnapshot,
      telemetryByAssetId
    ]
  );

  const regionalKpis = useMemo(
    () =>
      computeRegionalPerformanceKpis({
        assets,
        faults,
        maintenanceZones,
        fieldTasks,
        aiSnapshot
      }),
    [assets, faults, maintenanceZones, fieldTasks, aiSnapshot]
  );

  const aiOperationalInsights = useMemo(
    () =>
      generateAiOperationalInsights({
        regionalKpis,
        aiSnapshot: scopedAiSnapshot,
        faults: scoped.scopedFaults,
        maintenanceZones: scoped.scopedMaintenanceZones
      }),
    [regionalKpis, scopedAiSnapshot, scoped.scopedFaults, scoped.scopedMaintenanceZones]
  );

  const assetLifecycleRecords = useMemo(
    () =>
      buildAssetLifecycleRegistry({
        assets,
        faults,
        maintenanceZones,
        fieldTasks
      }),
    [assets, faults, maintenanceZones, fieldTasks]
  );

  const getAssetLifecycle = useCallback(
    (assetId: string) => assetLifecycleRecords.find((r) => r.assetId === assetId),
    [assetLifecycleRecords]
  );

  const enterpriseScenarioComparison = useMemo(
    () => compareEnterpriseScenarios(scoped.scopedScenarios, scoped.scopedFaults),
    [scoped.scopedScenarios, scoped.scopedFaults]
  );

  // Dashboard Customization Handlers
  const moveDashboardWidget = useCallback((widgetId: DashboardWidgetId, direction: 'UP' | 'DOWN') => {
    setDashboardCustomization((prev) => {
      const idx = prev.widgetOrder.indexOf(widgetId);
      if (idx === -1) return prev;
      const targetIdx = direction === 'UP' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.widgetOrder.length) return prev;
      const nextOrder = [...prev.widgetOrder];
      const [item] = nextOrder.splice(idx, 1);
      nextOrder.splice(targetIdx, 0, item);
      return { ...prev, widgetOrder: nextOrder };
    });
  }, []);

  const toggleDashboardWidget = useCallback((widgetId: DashboardWidgetId) => {
    setDashboardCustomization((prev) => {
      const hidden = prev.hiddenWidgets.includes(widgetId)
        ? prev.hiddenWidgets.filter((id) => id !== widgetId)
        : [...prev.hiddenWidgets, widgetId];
      return { ...prev, hiddenWidgets: hidden };
    });
  }, []);

  const toggleFavoriteRegion = useCallback((regionName: string) => {
    setDashboardCustomization((prev) => {
      const exists = prev.favoriteRegions.includes(regionName);
      return {
        ...prev,
        favoriteRegions: exists
          ? prev.favoriteRegions.filter((r) => r !== regionName)
          : [...prev.favoriteRegions, regionName]
      };
    });
  }, []);

  const saveMapFilterPreset = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const preset: SavedMapFilterPreset = {
        id: `PRESET-${Date.now()}`,
        name: trimmed,
        geoFilter: { ...geoFilter }
      };
      setDashboardCustomization((prev) => ({
        ...prev,
        savedFilterPresets: [preset, ...prev.savedFilterPresets].slice(0, 12)
      }));
      pushToast({
        title: 'Filter Preset Saved',
        message: `Saved geographic preset "${trimmed}".`,
        severity: 'INFO'
      });
    },
    [geoFilter, pushToast]
  );

  const applyMapFilterPreset = useCallback(
    (preset: SavedMapFilterPreset) => {
      const next: GeographicFilterState = {
        ...DEFAULT_GEO_FILTER,
        ...preset.geoFilter
      };
      setGeoFilterDirect(next);
      pushToast({
        title: 'Filter Preset Applied',
        message: `Scoped workspace to "${preset.name}".`,
        severity: 'INFO'
      });
    },
    [setGeoFilterDirect, pushToast]
  );

  const updateCustomKpiTargets = useCallback(
    (targets: DashboardCustomizationPrefs['customKpiTargets']) => {
      setDashboardCustomization((prev) => ({
        ...prev,
        customKpiTargets: targets
      }));
    },
    []
  );

  // Admin API Helpers (RBAC enforced server-side)
  const buildAdminHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-gridguard-role': currentRole
    };
    if (authSession?.accessToken) {
      headers.Authorization = `Bearer ${authSession.accessToken}`;
    }
    return headers;
  }, [authSession?.accessToken, currentRole]);

  const createAdminUser = useCallback(
    async (input: { username: string; email: string; fullName: string; role: UserRole }) => {
      try {
        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: buildAdminHeaders(),
          body: JSON.stringify(input)
        });
        const body = (await res.json().catch(() => ({}))) as { user?: AdminUserRecord; error?: string };
        if (!res.ok || !body.user) return { ok: false, error: body.error || `HTTP ${res.status}` };
        setAdminUsers((prev) => [body.user!, ...prev]);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Request failed' };
      }
    },
    [buildAdminHeaders]
  );

  const updateAdminUser = useCallback(
    async (userId: string, patch: { role?: UserRole; status?: 'ACTIVE' | 'SUSPENDED' }) => {
      try {
        const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
          method: 'PUT',
          headers: buildAdminHeaders(),
          body: JSON.stringify(patch)
        });
        const body = (await res.json().catch(() => ({}))) as { user?: AdminUserRecord; error?: string };
        if (!res.ok || !body.user) return { ok: false, error: body.error || `HTTP ${res.status}` };
        setAdminUsers((prev) => prev.map((u) => (u.id === userId ? body.user! : u)));
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Request failed' };
      }
    },
    [buildAdminHeaders]
  );

  const updateAdminSettings = useCallback(
    async (patch: {
      aiSettings?: Partial<AdminAiModelSettings>;
      notificationSettings?: Partial<AdminNotificationSettings>;
    }) => {
      try {
        const res = await fetch('/api/admin/settings', {
          method: 'PUT',
          headers: buildAdminHeaders(),
          body: JSON.stringify(patch)
        });
        const body = (await res.json().catch(() => ({}))) as {
          aiSettings?: AdminAiModelSettings;
          notificationSettings?: AdminNotificationSettings;
          error?: string;
        };
        if (!res.ok) return { ok: false, error: body.error || `HTTP ${res.status}` };
        if (body.aiSettings) setAdminAiSettings(body.aiSettings);
        if (body.notificationSettings) setAdminNotificationSettings(body.notificationSettings);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Request failed' };
      }
    },
    [buildAdminHeaders]
  );

  const importAdminAssets = useCallback(
    async (rawAssets: Array<Partial<InfrastructureAsset>>) => {
      try {
        const res = await fetch('/api/admin/assets/import', {
          method: 'POST',
          headers: buildAdminHeaders(),
          body: JSON.stringify({ assets: rawAssets })
        });
        const body = (await res.json().catch(() => ({}))) as {
          importedCount?: number;
          assets?: InfrastructureAsset[];
          error?: string;
        };
        if (!res.ok || !Array.isArray(body.assets)) {
          return { ok: false, error: body.error || `HTTP ${res.status}` };
        }
        setAssets((prev) => {
          const existing = new Set(prev.map((a) => a.canonicalId));
          const merged = [...prev];
          for (const a of body.assets!) {
            if (!existing.has(a.canonicalId)) merged.push(a);
          }
          return merged;
        });
        return { ok: true, count: body.importedCount };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Request failed' };
      }
    },
    [buildAdminHeaders]
  );

  const createAdminBackup = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/backup', {
        method: 'POST',
        headers: buildAdminHeaders(),
        body: JSON.stringify({ actorEmail: rolePermissions.actorEmail })
      });
      const body = (await res.json().catch(() => ({}))) as { backup?: AdminBackupSnapshot; error?: string };
      if (!res.ok || !body.backup) return { ok: false, error: body.error || `HTTP ${res.status}` };
      setAdminBackups((prev) => [body.backup!, ...prev]);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Request failed' };
    }
  }, [buildAdminHeaders, rolePermissions.actorEmail]);

  const restoreAdminBackup = useCallback(
    async (backupId: string) => {
      try {
        const res = await fetch('/api/admin/restore', {
          method: 'POST',
          headers: buildAdminHeaders(),
          body: JSON.stringify({ backupId })
        });
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) return { ok: false, error: body.error || `HTTP ${res.status}` };
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Request failed' };
      }
    },
    [buildAdminHeaders]
  );

  // Sync demo role JWT whenever role switches in Demo Mode + initial /api/health & /api/alerts fetch
  useEffect(() => {
    if (isDemoMode) {
      syncDemoRoleJwt(currentRole);
    }
  }, [currentRole, isDemoMode, syncDemoRoleJwt]);

  // Automatic silent refresh-token rotation 5 minutes before JWT access token expiry
  useEffect(() => {
    if (!authSession?.refreshToken || !authSession.expiresAtMs) return;
    const msUntilRefresh = Math.max(15_000, authSession.expiresAtMs - Date.now() - 300_000);
    const timer = window.setTimeout(() => {
      fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: authSession.refreshToken })
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((body) => {
          if (body?.accessToken) {
            setAuthSession((prev) =>
              prev
                ? {
                    ...prev,
                    accessToken: body.accessToken,
                    refreshToken: body.refreshToken || prev.refreshToken,
                    expiresAtMs: body.expiresAtMs || prev.expiresAtMs
                  }
                : prev
            );
          }
        })
        .catch(() => {});
    }, msUntilRefresh);
    return () => window.clearTimeout(timer);
  }, [authSession?.refreshToken, authSession?.expiresAtMs]);

  // Initial fetch of Alert Center, Executive Reports History, Admin State & System Health
  useEffect(() => {
    refreshSystemHealth();
    fetch('/api/alerts')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (Array.isArray(data?.alerts)) {
          setAlerts(data.alerts);
        }
      })
      .catch(() => {});
    fetch('/api/reports')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (Array.isArray(data?.reports)) setExecutiveReportsHistory(data.reports);
      })
      .catch(() => {});
    fetch('/api/admin/users')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (Array.isArray(data?.users)) setAdminUsers(data.users);
      })
      .catch(() => {});
    fetch('/api/admin/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.aiSettings) setAdminAiSettings(data.aiSettings);
        if (data?.notificationSettings) setAdminNotificationSettings(data.notificationSettings);
      })
      .catch(() => {});
    fetch('/api/admin/backups')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (Array.isArray(data?.backups)) setAdminBackups(data.backups);
      })
      .catch(() => {});
    const healthTimer = window.setInterval(refreshSystemHealth, 25_000);
    return () => window.clearInterval(healthTimer);
  }, [refreshSystemHealth]);

  // Real-Time WebSocket Client (/ws/grid) with automatic exponential-backoff reconnect & ping
  useEffect(() => {
    if (typeof window === 'undefined' || typeof WebSocket === 'undefined') return;
    let disposed = false;
    let activeSocket: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let pingTimer: number | null = null;
    let attempt = 0;

    const connect = () => {
      if (disposed) return;
      setWsState(attempt === 0 ? 'CONNECTING' : 'RECONNECTING');
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(`${proto}//${window.location.host}/ws/grid`);
      activeSocket = socket;

      socket.onopen = () => {
        if (disposed) return;
        attempt = 0;
        setWsState('CONNECTED');
        setLastWsMessageAt(new Date().toISOString());
        if (pingTimer) window.clearInterval(pingTimer);
        pingTimer = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'PING' }));
          }
        }, 20_000);
      };

      socket.onmessage = (evt) => {
        if (disposed) return;
        setLastWsMessageAt(new Date().toISOString());
        try {
          const msg = JSON.parse(String(evt.data)) as {
            type: string;
            payload?: Record<string, unknown>;
          };
          const p = msg.payload || {};

          if (msg.type === 'WELCOME') {
            if (Array.isArray(p.alerts)) {
              setAlerts(p.alerts as GridAlert[]);
            }
            if (p.health) {
              setSystemHealth(p.health as SystemHealthSnapshot);
            }
            if (Array.isArray(p.faults)) {
              setFaults(p.faults as ActiveFault[]);
            }
            if (Array.isArray(p.engineers)) {
              setFieldEngineers(p.engineers as FieldEngineer[]);
            }
            if (Array.isArray(p.geofenceEvents)) {
              setGeoFenceEvents(p.geofenceEvents as GeoFenceEvent[]);
            }
          } else if (msg.type === 'TELEMETRY_BATCH') {
            if (p.health) {
              setSystemHealth(p.health as SystemHealthSnapshot);
            }
          } else if (msg.type === 'ENGINEER_LOCATION_UPDATED') {
            const incomingEng = p.engineer as FieldEngineer | undefined;
            const incomingTask = p.task as FieldTask | undefined;
            if (incomingEng) {
              setFieldEngineers((prev) =>
                prev.some((e) => e.engineerId === incomingEng.engineerId)
                  ? prev.map((e) =>
                      e.engineerId === incomingEng.engineerId ? incomingEng : e
                    )
                  : [incomingEng, ...prev]
              );
            }
            if (incomingTask) {
              setFieldTasks((prev) =>
                prev.map((t) => (t.id === incomingTask.id ? incomingTask : t))
              );
            }
          } else if (msg.type === 'GEOFENCE_EVENT' && p.event) {
            const gfe = p.event as GeoFenceEvent;
            setGeoFenceEvents((prev) =>
              prev.some((e) => e.id === gfe.id) ? prev : [gfe, ...prev].slice(0, 80)
            );
            pushToast({
              title: `Geo-Fence · ${gfe.eventType.replace(/_/g, ' ')}`,
              message: gfe.summary,
              severity: gfe.eventType === 'REACHED_ASSET' ? 'INFO' : 'MEDIUM',
              relatedAssetId: gfe.assetId,
              targetView: 'field'
            });
          } else if (msg.type === 'FIELD_UPDATE') {
            const incomingTask = p.task as FieldTask | undefined;
            const incomingEng = p.engineer as FieldEngineer | undefined;
            const incomingEv = p.evidence as FieldEvidence | undefined;
            if (incomingTask) {
              setFieldTasks((prev) =>
                prev.some((t) => t.id === incomingTask.id)
                  ? prev.map((t) => (t.id === incomingTask.id ? incomingTask : t))
                  : [incomingTask, ...prev]
              );
            }
            if (incomingEng) {
              setFieldEngineers((prev) =>
                prev.map((e) =>
                  e.engineerId === incomingEng.engineerId ? incomingEng : e
                )
              );
            }
            if (incomingEv) {
              setFieldEvidence((prev) =>
                prev.some((ev) => ev.id === incomingEv.id) ? prev : [incomingEv, ...prev]
              );
            }
          } else if (msg.type === 'ALERT_CREATED' && p.alert) {
            const incoming = p.alert as GridAlert;
            setAlerts((prev) => (prev.some((a) => a.id === incoming.id) ? prev : [incoming, ...prev]));
            markAssetAnimated(incoming.assetId);
            pushToast({
              title: `${incoming.severity} Alert · ${incoming.assetId}`,
              message: incoming.title,
              severity: incoming.severity,
              relatedAssetId: incoming.assetId,
              targetView: incoming.targetView
            });
          } else if (msg.type === 'INCIDENT_TRIGGERED') {
            const fault = p.fault as ActiveFault | undefined;
            const alert = p.alert as GridAlert | undefined;
            const notification = p.notification as GridNotification | undefined;
            if (fault) {
              setFaults((prev) => (prev.some((f) => f.id === fault.id) ? prev : [fault, ...prev]));
              setAssets((prev) =>
                prev.map((a) =>
                  a.canonicalId === fault.affectedAssetId ? { ...a, status: 'FAULTED' } : a
                )
              );
              markAssetAnimated(fault.affectedAssetId);
            }
            if (alert) {
              setAlerts((prev) => (prev.some((a) => a.id === alert.id) ? prev : [alert, ...prev]));
              pushToast({
                title: `Live Fault Stream · ${alert.assetId}`,
                message: alert.title,
                severity: alert.severity,
                relatedAssetId: alert.assetId,
                targetView: 'map'
              });
            }
            if (notification) {
              setNotifications((prev) =>
                prev.some((n) => n.id === notification.id) ? prev : [notification, ...prev].slice(0, 40)
              );
            }
          } else if (msg.type === 'ALERT_ACKNOWLEDGED' && p.alert) {
            const updated = p.alert as GridAlert;
            setAlerts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
          } else if (msg.type === 'DEMO_RESET') {
            setAssets(INITIAL_ASSETS);
            setFaults((p.faults as ActiveFault[]) || INITIAL_FAULTS);
            if (Array.isArray(p.alerts)) setAlerts(p.alerts as GridAlert[]);
            if (Array.isArray(p.notifications)) {
              setNotifications(p.notifications as GridNotification[]);
            }
            pushToast({
              title: 'Demo Scenario Reset',
              message: 'Network topology & alerts restored to baseline Severe Weather Cascade.',
              severity: 'INFO'
            });
          } else if (msg.type === 'DIGITAL_TWIN_UPDATE') {
            pushToast({
              title: 'Digital Twin Synchronized',
              message: `Imported ${String(p.importedCount ?? 1)} asset(s) into live network topology.`,
              severity: 'INFO',
              targetView: 'graph'
            });
          }
        } catch {
          // Ignore malformed WS payloads
        }
      };

      socket.onclose = () => {
        if (pingTimer) window.clearInterval(pingTimer);
        if (disposed) return;
        setWsState('RECONNECTING');
        attempt += 1;
        const delayMs = Math.min(15_000, 1200 * Math.pow(1.6, Math.min(attempt, 6)));
        reconnectTimer = window.setTimeout(connect, delayMs);
      };

      socket.onerror = () => {
        socket.close();
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (pingTimer) window.clearInterval(pingTimer);
      if (activeSocket) {
        activeSocket.close();
      }
    };
  }, [markAssetAnimated, pushToast]);

  const unacknowledgedAlertsCount = useMemo(
    () => alerts.filter((a) => !a.acknowledged).length,
    [alerts]
  );

  const resetToSevereWeatherCascade = () => {
    setGeoFilter(DEFAULT_GEO_FILTER);
    clearSelection();
    setMapCenter(INITIAL_MAP_CENTER);
    setMapZoom(INITIAL_MAP_ZOOM);
    setCurrentMapZoom(INITIAL_MAP_ZOOM);
    setMapLayers(DEFAULT_MAP_LAYERS);
    fetch('/api/demo/reset', { method: 'POST' }).catch(() => {});
  };

  return (
    <GridContext.Provider
      value={{
        assets,
        issues,
        events,
        scenarios,
        decisions,
        approvals,
        fieldTasks,
        fieldEvidence,
        notifications,
        unreadNotificationsCount,
        activeTaskId,
        rolePermissions,
        auditLogs,
        stats,
        boundaries: GEOGRAPHIC_BOUNDARIES,
        currentRole,
        isDark,
        activeView,
        overviewMode,
        setOverviewMode,
        simulatorTab,
        setSimulatorTab,
        adminTab,
        setAdminTab,
        faults,
        maintenanceZones,
        powerLines,
        selectedAssetId,
        hoveredAssetId,
        selectionSource,
        hoverSource,
        focusRequest,
        connectedPath,
        selectedFaultId,
        faultFocusNonce,
        eventReconstructions: INITIAL_EVENT_RECONSTRUCTIONS,
        scopedReconstructions,
        selectedReconstructionId,
        highlightedAssetIds,
        pendingSimulationParams,
        activeSimulationId,
        activeSimulation,
        activeSimulationOverlay,
        simulationOverlayPlaying,
        pendingDecisionDraft,
        activeRootCauseAnalysis,
        activeWorkflowStage,
        focusRcaNonce,
        maintenanceFocusNonce,
        mapCenter,
        mapZoom,
        currentMapZoom,
        mapLayers,
        geoFilter,
        hasRegionSelection,
        geoScopeLabel,
        osmLoading,
        osmError,
        osmCached,
        osmLastFetchedAt,
        telemetryByAssetId,
        telemetryProviderName: telemetryProvider.name,
        telemetrySourceType: telemetryProvider.sourceType,
        scopedAssets: scoped.scopedAssets,
        scopedDisplayAssets: scoped.scopedDisplay.displayAssets,
        scopedDisplayPowerLines: scoped.scopedDisplay.displayPowerLines,
        scopedAssetCounts: scoped.scopedDisplay.counts,
        scopedFaults: scoped.scopedFaults,
        scopedMaintenanceZones: scoped.scopedMaintenanceZones,
        scopedPowerLines: scoped.scopedPowerLines,
        scopedBoundaries: scoped.scopedBoundaries,
        scopedIssues: scoped.scopedIssues,
        scopedEvents: scoped.scopedEvents,
        scopedScenarios: scoped.scopedScenarios,
        scopedDecisions: scoped.scopedDecisions,
        scopedAuditLogs: scoped.scopedAuditLogs,
        scopedStats: scoped.scopedStats,
        aiSnapshot,
        scopedAiSnapshot,
        aiLastRecalculatedAt,
        recalculateAiIntelligence,
        getAssetHealth,
        getAssetTimeline,
        prepareDecisionFromAiRecommendation,
        launchSimulationFromAiRecommendation,
        wsState,
        lastWsMessageAt,
        recentAnimatedAssetIds,
        alerts,
        unacknowledgedAlertsCount,
        acknowledgeAlert,
        toasts,
        pushToast,
        dismissToast,
        systemHealth,
        refreshSystemHealth,
        isDemoMode,
        toggleDemoMode,
        triggerLiveDemoIncident,
        authSession,
        loginWithCredentials,
        registerAccount,
        logoutAuthSession,
        exportReport,
        digitalTwinNetwork,
        regionalKpis,
        aiOperationalInsights,
        assetLifecycleRecords,
        getAssetLifecycle,
        enterpriseScenarioComparison,
        dashboardCustomization,
        moveDashboardWidget,
        toggleDashboardWidget,
        toggleFavoriteRegion,
        saveMapFilterPreset,
        applyMapFilterPreset,
        updateCustomKpiTargets,
        executiveReportsHistory,
        adminUsers,
        adminAiSettings,
        adminNotificationSettings,
        adminBackups,
        createAdminUser,
        updateAdminUser,
        updateAdminSettings,
        importAdminAssets,
        createAdminBackup,
        restoreAdminBackup,
        fieldEngineers,
        selectedEngineerId,
        setSelectedEngineerId,
        engineerRoutes,
        geoFences,
        geoFenceEvents,
        fieldDashboardMetrics,
        getRecommendedEngineersForAsset,
        getLiveIncidentTimeline,
        assignEngineerToTask,
        acceptFieldTask,
        completeFieldTask,
        updateEngineerLocation,
        simulateEngineerStepTowardTarget,
        openKnowledgeGraphForEngineer,
        setActiveView,
        navigateWorkflowStage,
        setCurrentRole,
        toggleTheme,
        selectAsset,
        selectGraphNode,
        setHoveredAsset,
        clearSelection,
        setSelectedAssetId: (id) => selectAsset(id, 'map', { openPopup: false }),
        setSelectedFaultId,
        setSelectedReconstructionId,
        setActiveTaskId,
        setMapCenter,
        setMapZoom,
        setCurrentMapZoom,
        setMapLayers,
        fetchOsmAssetsForBounds,
        updateGeoFilterLevel,
        setGeoFilterDirect,
        resetGeoFilter,
        applySearchResult,
        focusAssetOnMap,
        syncAssetFromGraph,
        focusFaultOnMap,
        openEventReconstructionForFault,
        openEventReconstructionForAsset,
        openRootCauseForAsset,
        openKnowledgeGraphForAsset,
        openFieldTaskForAsset,
        launchSimulationForAsset,
        launchSimulationFromRca,
        clearPendingSimulationParams,
        prepareDecisionFromContext,
        clearPendingDecisionDraft,
        inspectMaintenanceHistory,
        raiseMaintenanceRequest,
        resolveIssue,
        submitDecision,
        reviewDecision,
        toggleDecisionEscalation,
        createFieldTask,
        assignOrReassignFieldTask,
        updateFieldTaskStatus,
        submitFieldEvidence,
        verifyAndCloseDecision,
        markNotificationRead,
        markAllNotificationsRead,
        runSimulation,
        selectSimulationScenario,
        setSimulationOverlayPlaying,
        compareSimulations,
        recordReportExportAudit,
        recordResolutionReportExportAudit,
        resetToSevereWeatherCascade
      }}
    >
      {children}
    </GridContext.Provider>
  );
};

export const useGrid = () => {
  const context = useContext(GridContext);
  if (!context) {
    throw new Error('useGrid must be used within a GridProvider');
  }
  return context;
};
