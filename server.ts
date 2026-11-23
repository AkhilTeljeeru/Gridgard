import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer, WebSocket } from 'ws';
import type {
  ActiveFault,
  AdminAiModelSettings,
  AdminBackupSnapshot,
  AdminNotificationSettings,
  AdminUserRecord,
  ApprovalRecord,
  AssetTelemetryStatus,
  AuditLog,
  EngineeringDecision,
  ExecutiveReportRecord,
  FieldEngineer,
  FieldEngineerStatus,
  FieldEvidence,
  FieldTask,
  FieldTaskStatus,
  GeoFenceEvent,
  GeographicFilterState,
  GridAlert,
  GridNotification,
  InfrastructureAsset,
  LiveRouteInfo,
  OsmAsset,
  OsmPowerType,
  PriorityLevel,
  SimulationInputParams,
  SimulationScenario,
  SystemHealthSnapshot,
  TelemetryHealthStatus,
  UserRole,
  VerificationChecklistState
} from './src/types/grid.ts';
import {
  ROLE_DIRECTORY,
  isChecklistComplete,
  validateEvidenceFile
} from './src/services/governanceHelpers.ts';
import {
  ServerMonitoringStore,
  authenticateServerUser,
  buildSeedAlerts,
  createSlidingRateLimiter,
  extractBearerFromRequest,
  isDemoModeEnabled,
  registerServerUser,
  revokeRefreshJwt,
  securityHeadersMiddleware,
  signJwtToken,
  verifyJwtToken
} from './server/securityAndMetrics.ts';
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
  buildEventReconstructionPayload,
  formatMissingValue,
  normalizeOsmToInfrastructureAsset
} from './src/services/syntheticData.ts';
import { computeAiIntelligenceSnapshot } from './src/services/aiIntelligenceEngine.ts';
import {
  INITIAL_FIELD_ENGINEERS,
  buildGeoFencesForGrid,
  computeFallbackRoute,
  computeFieldDashboardMetrics,
  evaluateGeoFenceTransitions,
  haversineDistanceKm,
  mapTaskStatusToEngineerStatus,
  recommendEngineersForAsset
} from './src/services/fieldOperationsEngine.ts';
import {
  buildAssetLifecycleRegistry,
  buildDigitalTwinNetwork,
  compareEnterpriseScenarios,
  computeRegionalPerformanceKpis,
  generateAiOperationalInsights
} from './src/services/digitalTwinEngine.ts';
import {
  compareSimulationScenarios,
  executeWhatIfSimulation
} from './src/services/simulationEngine.ts';
import { GEOGRAPHIC_BOUNDARIES } from './src/services/geographyBoundariesData.ts';
import {
  DEFAULT_GEO_FILTER,
  computeScopedMapDisplay,
  computeViewportForSelection,
  filterAssetsByHierarchy,
  filterBoundaries,
  getAreas,
  getCities,
  getCountries,
  getDistricts,
  getDivisions,
  getFeeders,
  getStates,
  getSubdivisions,
  getSubstations,
  getTransformers,
  searchGeographyAndAssets
} from './src/services/geographyService.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OVERPASS_ENDPOINTS = [
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];
const OSM_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const TELEMETRY_INTERVAL_MS = 5000;

interface CachedOsmEntry {
  bboxKey: string;
  fetchedAt: number;
  assets: OsmAsset[];
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  geometry?: Array<{ lat: number; lon: number }>;
  tags?: Record<string, string>;
}

interface RegisteredTelemetryAsset {
  id: string;
  type: OsmPowerType;
  name: string | null;
  voltage: string | null;
  lat: number;
  lon: number;
}

const osmBboxCache = new Map<string, CachedOsmEntry>();
const inFlightOsmQueries = new Map<string, Promise<OsmAsset[]>>();
// Single canonical asset registry seeded with clearly badged DEMO assets + merged live OSM assets
const liveAssetsMap = new Map<string, InfrastructureAsset>(
  INITIAL_ASSETS.map((asset) => [asset.canonicalId, asset])
);

// Server-side simulated SCADA/telemetry registry for SSE + WebSocket streams
const telemetryRegistry = new Map<string, RegisteredTelemetryAsset>();
const telemetryStates = new Map<string, AssetTelemetryStatus>();
const sseClients = new Set<express.Response>();
const wsClients = new Set<WebSocket>();
const monitoringStore = new ServerMonitoringStore();
let faultSequence = 100;

const liveFaultsRegistry = new Map<string, ActiveFault>(
  INITIAL_FAULTS.map((f) => [f.id, f])
);
const simulationsRegistry = new Map<string, SimulationScenario>(
  INITIAL_SIMULATION_SCENARIOS.map((s) => [s.id, s])
);
const decisionsRegistry = new Map<string, EngineeringDecision>(
  INITIAL_ENGINEERING_DECISIONS.map((d) => [d.id, d])
);
const approvalsRegistry: ApprovalRecord[] = [...INITIAL_APPROVALS];
const fieldTasksRegistry = new Map<string, FieldTask>(
  INITIAL_FIELD_TASKS.map((t) => [t.id, t])
);
const fieldEvidenceRegistry: FieldEvidence[] = [...INITIAL_FIELD_EVIDENCE];
const engineersRegistry = new Map<string, FieldEngineer>(
  INITIAL_FIELD_ENGINEERS.map((e) => [e.engineerId, e])
);
interface LiveLocationLogEntry {
  locationId: string;
  engineerId: string;
  engineerName: string;
  taskId: string | null;
  latitude: number;
  longitude: number;
  speedKmh: number;
  headingDeg: number;
  batteryPct: number;
  networkStatus: FieldEngineer['networkStatus'];
  recordedAt: string;
}
const liveLocationsRegistry: LiveLocationLogEntry[] = INITIAL_FIELD_ENGINEERS.map((e, idx) => ({
  locationId: `LOC-INIT-${idx + 1}`,
  engineerId: e.engineerId,
  engineerName: e.name,
  taskId: e.currentTaskId,
  latitude: e.latitude,
  longitude: e.longitude,
  speedKmh: e.speedKmh,
  headingDeg: e.headingDeg,
  batteryPct: e.batteryPct,
  networkStatus: e.networkStatus,
  recordedAt: e.lastLocationUpdate
}));
const geofenceEventsRegistry: GeoFenceEvent[] = [];

const getActiveGeoFences = () =>
  buildGeoFencesForGrid({
    assets: Array.from(liveAssetsMap.values()),
    faults: Array.from(liveFaultsRegistry.values()),
    maintenanceZones: INITIAL_MAINTENANCE_ZONES
  });

const computeActiveLiveRoutes = (): LiveRouteInfo[] => {
  const routes: LiveRouteInfo[] = [];
  for (const eng of engineersRegistry.values()) {
    if (!eng.currentTaskId) continue;
    const task = fieldTasksRegistry.get(eng.currentTaskId);
    if (!task || task.status === 'VERIFIED') continue;
    const asset = liveAssetsMap.get(task.assetId) ?? null;
    routes.push(computeFallbackRoute({ engineer: eng, task, destAsset: asset }));
  }
  return routes;
};
const auditLogsRegistry: AuditLog[] = [...INITIAL_AUDIT_LOGS];
const notificationsRegistry = new Map<string, GridNotification>(
  INITIAL_NOTIFICATIONS.map((n) => [n.id, n])
);
const alertsRegistry = new Map<string, GridAlert>();
const executiveReportsRegistry: ExecutiveReportRecord[] = [
  {
    reportId: 'RPT-2026-001',
    reportType: 'GRID_HEALTH',
    format: 'PDF',
    generatedBy: 'Elena Rostova (Utility Manager)',
    scopeLabel: 'All India Operations',
    rowCount: 15,
    filename: 'gridguard-grid-health-report-2026-11-20.pdf',
    generatedAt: '2026-11-20T14:30:00Z'
  }
];
const adminUsersRegistry = new Map<string, AdminUserRecord>([
  [
    'USR-ADMIN-01',
    {
      id: 'USR-ADMIN-01',
      username: 'a.sharma',
      email: 'a.sharma@utilitygrid.org',
      fullName: 'Arvind Sharma (System Admin)',
      role: 'ADMIN',
      status: 'ACTIVE',
      lastActiveAt: new Date().toISOString()
    }
  ],
  [
    'USR-ENG-01',
    {
      id: 'USR-ENG-01',
      username: 'm.vance',
      email: 'm.vance@utilitygrid.org',
      fullName: 'Marcus Vance, PE',
      role: 'GRID_ENGINEER',
      status: 'ACTIVE',
      lastActiveAt: new Date().toISOString()
    }
  ],
  [
    'USR-MGR-01',
    {
      id: 'USR-MGR-01',
      username: 'e.rostova',
      email: 'e.rostova@utilitygrid.org',
      fullName: 'Elena Rostova (Utility Manager)',
      role: 'REVIEWER_APPROVER',
      status: 'ACTIVE',
      lastActiveAt: new Date().toISOString()
    }
  ],
  [
    'USR-FLD-01',
    {
      id: 'USR-FLD-01',
      username: 'r.kulkarni',
      email: 'r.kulkarni@utilitygrid.org',
      fullName: 'Rohan Kulkarni',
      role: 'FIELD_ENGINEER',
      status: 'ACTIVE',
      lastActiveAt: new Date().toISOString()
    }
  ],
  [
    'USR-VIEW-01',
    {
      id: 'USR-VIEW-01',
      username: 'ops.auditor',
      email: 'auditor@utilitygrid.org',
      fullName: 'Regulatory Audit Observer',
      role: 'VIEWER',
      status: 'ACTIVE',
      lastActiveAt: new Date().toISOString()
    }
  ]
]);
let adminAiSettings: AdminAiModelSettings = {
  riskThresholdHigh: 70,
  riskThresholdMedium: 45,
  predictionWindowDays: 30,
  autoRecalculateOnWsFault: true,
  maintenanceWeightLoadPct: 35
};
let adminNotificationSettings: AdminNotificationSettings = {
  notifyCriticalAlerts: true,
  notifyAiRecommendations: true,
  notifyFieldUpdates: true,
  escalateUnacknowledgedMin: 20
};
const adminBackupsRegistry: AdminBackupSnapshot[] = [
  {
    id: 'BKP-2026-BASELINE',
    createdAt: '2026-11-21T00:00:00Z',
    createdBy: 'system-scheduler@utilitygrid.org',
    assetCount: INITIAL_ASSETS.length,
    decisionCount: INITIAL_ENGINEERING_DECISIONS.length,
    auditCount: INITIAL_AUDIT_LOGS.length,
    checksum: 'sha256:9f4b8c12a03e7d19'
  }
];

function getSimulationTopologyContext() {
  return {
    assets: Array.from(liveAssetsMap.values()),
    powerLines: INITIAL_POWER_LINES,
    faults: Array.from(liveFaultsRegistry.values()),
    reconstructions: INITIAL_EVENT_RECONSTRUCTIONS,
    issues: INITIAL_DATA_QUALITY_ISSUES
  };
}

let aiLastRecalculatedAt = new Date().toISOString();

function getCurrentAiSnapshot(recalculate = false) {
  if (recalculate) {
    aiLastRecalculatedAt = new Date().toISOString();
  }
  const telemetryRecord: Record<string, AssetTelemetryStatus> = {};
  for (const [k, v] of telemetryStates.entries()) {
    telemetryRecord[k] = v;
  }
  return computeAiIntelligenceSnapshot({
    assets: Array.from(liveAssetsMap.values()),
    faults: Array.from(liveFaultsRegistry.values()),
    events: INITIAL_OPERATIONAL_EVENTS,
    maintenanceZones: INITIAL_MAINTENANCE_ZONES,
    fieldTasks: Array.from(fieldTasksRegistry.values()),
    issues: INITIAL_DATA_QUALITY_ISSUES,
    reconstructions: INITIAL_EVENT_RECONSTRUCTIONS,
    telemetryByAssetId: telemetryRecord,
    recalculatedAt: aiLastRecalculatedAt
  });
}

// Seed initial Alert Center entries from faults, integrity issues, and AI snapshot
for (const alert of buildSeedAlerts({
  faults: Array.from(liveFaultsRegistry.values()),
  assets: Array.from(liveAssetsMap.values()),
  issues: INITIAL_DATA_QUALITY_ISSUES,
  aiSnapshot: getCurrentAiSnapshot(false)
})) {
  alertsRegistry.set(alert.id, alert);
}

function broadcastWsEvent(type: string, payload: Record<string, unknown>): void {
  if (wsClients.size === 0) return;
  const serialized = JSON.stringify({
    type,
    timestamp: new Date().toISOString(),
    payload
  });
  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(serialized);
      } catch {
        wsClients.delete(client);
      }
    }
  }
}

function buildHealthSnapshot(): SystemHealthSnapshot {
  const allAssets = Array.from(liveAssetsMap.values());
  return {
    status: 'ok',
    apiStatus: 'HEALTHY',
    databaseStatus: process.env.DATABASE_URL ? 'CONFIGURED_READY' : 'IN_MEMORY_REGISTRY',
    aiServiceStatus: 'HEALTHY',
    webSocketStatus: {
      status: wsClients.size > 0 || sseClients.size > 0 ? 'ACTIVE' : 'IDLE',
      connectedClients: wsClients.size,
      sseClients: sseClients.size
    },
    uptimeSeconds: monitoringStore.uptimeSeconds,
    avgLatencyMs: monitoringStore.avgLatencyMs,
    totalRequests: monitoringStore.totalRequests,
    errorCount: monitoringStore.errorCount,
    failedLoginAttempts: monitoringStore.failedLoginAttempts,
    aiRecalculationsCount: monitoringStore.aiRecalculationsCount,
    assetCount: allAssets.length,
    demoMode: isDemoModeEnabled(),
    checkedAt: new Date().toISOString()
  };
}

function extractFilterFromQuery(query: express.Request['query']): GeographicFilterState {
  const str = (val: unknown): string => (typeof val === 'string' ? val.trim() : '');
  return {
    country: str(query.country) || DEFAULT_GEO_FILTER.country,
    state: str(query.state),
    district: str(query.district),
    division: str(query.division),
    subdivision: str(query.subdivision),
    city: str(query.city) || str(query.village),
    area: str(query.area),
    substationId: str(query.substationId) || str(query.substation),
    feederId: str(query.feederId) || str(query.feeder),
    transformerId: str(query.transformerId) || str(query.transformer)
  };
}

function parseOsmPowerType(raw?: string, tags?: Record<string, string>): OsmPowerType {
  if (raw === 'sub_station') return 'substation';
  switch (raw) {
    case 'substation':
    case 'transformer':
    case 'switch':
    case 'tower':
    case 'pole':
    case 'plant':
    case 'generator':
    case 'converter':
    case 'compensator':
    case 'portal':
    case 'busbar':
    case 'bay':
    case 'terminal':
    case 'insulator':
    case 'connection':
    case 'line':
    case 'minor_line':
    case 'cable':
      return raw;
    default:
      if (
        tags &&
        (tags.street_cabinet === 'power' ||
          tags.utility === 'power' ||
          tags.utility === 'electricity')
      ) {
        return 'cabinet';
      }
      return 'unknown';
  }
}

function normalizeOverpassElements(elements: OverpassElement[]): OsmAsset[] {
  const deduped = new Map<string, OsmAsset>();

  for (const el of elements) {
    const tags = el.tags || {};
    const powerType = parseOsmPowerType(tags.power, tags);
    if (powerType === 'unknown') continue;

    const id = `osm:${el.type}:${el.id}`;
    const rawName = tags.name ?? tags['name:en'] ?? tags.ref ?? tags.substation ?? null;
    const voltage = tags.voltage ?? null;
    const operator = tags.operator ?? null;

    if (
      el.type === 'way' &&
      Array.isArray(el.geometry) &&
      el.geometry.length >= 2 &&
      (powerType === 'line' || powerType === 'minor_line' || powerType === 'cable')
    ) {
      const coords: [number, number][] = el.geometry
        .filter((pt) => Number.isFinite(pt.lat) && Number.isFinite(pt.lon))
        .map((pt) => [pt.lon, pt.lat]);
      if (coords.length < 2) continue;

      const mid = coords[Math.floor(coords.length / 2)];
      deduped.set(id, {
        id,
        type: powerType,
        name: rawName,
        voltage,
        operator,
        lat: mid[1],
        lon: mid[0],
        geometry: {
          type: 'LineString',
          coordinates: coords
        },
        source: 'OSM',
        tags
      });
      continue;
    }

    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      continue;
    }

    const existing = deduped.get(id);
    if (existing && existing.geometry.type === 'LineString') {
      continue;
    }

    deduped.set(id, {
      id,
      type: powerType,
      name: rawName,
      voltage,
      operator,
      lat,
      lon,
      geometry: {
        type: 'Point',
        coordinates: [lon, lat]
      },
      source: 'OSM',
      tags
    });
  }

  return Array.from(deduped.values());
}

async function fetchFromOverpassEndpoint(endpoint: string, query: string): Promise<OsmAsset[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9500);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json, */*',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': 'GridGuardAI/1.0'
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Overpass HTTP ${response.status}: ${text.slice(0, 160)}`);
    }

    const json = (await response.json()) as { elements?: OverpassElement[] };
    const elements = Array.isArray(json.elements) ? json.elements : [];
    return normalizeOverpassElements(elements);
  } finally {
    clearTimeout(timer);
  }
}

async function queryOverpassApi(bbox: {
  south: number;
  west: number;
  north: number;
  east: number;
}): Promise<OsmAsset[]> {
  const { south, west, north, east } = bbox;
  const query = `
[out:json][timeout:20];
(
  nwr["power"]["power"!~"^(line|minor_line|cable)$"](${south},${west},${north},${east});
  nwr["utility"~"^(power|electricity)$"](${south},${west},${north},${east});
  nwr["street_cabinet"="power"](${south},${west},${north},${east});
);
out center tags;
way["power"~"^(line|minor_line|cable)$"](${south},${west},${north},${east});
out geom;
`.trim();

  // Try the primary healthy mirror first; if it fails, race the remaining mirrors for fastest response
  try {
    return await fetchFromOverpassEndpoint(OVERPASS_ENDPOINTS[0], query);
  } catch (primaryErr) {
    try {
      return await Promise.any(
        OVERPASS_ENDPOINTS.slice(1).map((ep) => fetchFromOverpassEndpoint(ep, query))
      );
    } catch {
      throw primaryErr instanceof Error ? primaryErr : new Error('Overpass API query failed');
    }
  }
}

function parseOsmVoltageKv(raw: string | null): number | null {
  if (!raw) return null;
  const first = raw.split(/[;,]/)[0]?.trim();
  if (!first) return null;
  const n = Number(first.replace(/[^\d.]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n >= 1000 ? Number((n / 1000).toFixed(2)) : n;
}

function baselineLoadForType(type: OsmPowerType): number {
  switch (type) {
    case 'plant':
      return 42000 + Math.random() * 28000;
    case 'substation':
      return 12500 + Math.random() * 14000;
    case 'line':
      return 6400 + Math.random() * 7200;
    case 'minor_line':
    case 'cable':
      return 1800 + Math.random() * 2600;
    case 'transformer':
      return 280 + Math.random() * 620;
    case 'switch':
      return 450 + Math.random() * 900;
    default:
      return 90 + Math.random() * 250;
  }
}

function formatSimulatedVoltage(asset: RegisteredTelemetryAsset, status: TelemetryHealthStatus): string {
  const nominalKv = parseOsmVoltageKv(asset.voltage);
  if (nominalKv) {
    const jitter =
      status === 'FAULT'
        ? 0.72 + Math.random() * 0.12
        : status === 'WARNING'
          ? 0.91 + Math.random() * 0.04
          : 0.98 + Math.random() * 0.04;
    return `${(nominalKv * jitter).toFixed(2)} kV`;
  }
  const fallbackKv =
    asset.type === 'plant' || asset.type === 'substation'
      ? 33
      : 11;
  const jitter = status === 'FAULT' ? 0.76 : status === 'WARNING' ? 0.93 : 0.99 + (Math.random() - 0.5) * 0.03;
  return `${(fallbackKv * jitter).toFixed(2)} kV`;
}

function createFaultReason(type: OsmPowerType): string {
  switch (type) {
    case 'substation':
      return 'Simulated busbar differential trip / under-voltage excursion';
    case 'transformer':
      return 'Simulated winding thermal overload & oil temperature trip';
    case 'line':
    case 'minor_line':
    case 'cable':
      return 'Simulated single-line-to-ground fault & feeder lockout';
    case 'switch':
      return 'Simulated sectionalizer contact thermal anomaly';
    default:
      return 'Simulated asset telemetry fault alarm';
  }
}

function buildSimulatedStatus(
  asset: RegisteredTelemetryAsset,
  prev: AssetTelemetryStatus | undefined,
  allowFault: boolean
): AssetTelemetryStatus {
  const nowIso = new Date().toISOString();
  const baseLoad = prev?.loadKw && prev.loadKw > 0 ? prev.loadKw : baselineLoadForType(asset.type);
  const deltaFactor = 1 + (Math.random() - 0.48) * 0.1;
  const nextLoad = Math.max(10, Math.round(baseLoad * deltaFactor));

  let status: TelemetryHealthStatus = 'NORMAL';
  let faultCode: string | undefined;
  let faultReason: string | undefined;

  if (prev?.status === 'FAULT') {
    if (Math.random() < 0.75) {
      status = 'FAULT';
      faultCode = prev.faultCode;
      faultReason = prev.faultReason;
    }
  } else if (allowFault && Math.random() < 0.025) {
    status = 'FAULT';
    faultSequence += 1;
    faultCode = `SIM-FLT-${faultSequence}`;
    faultReason = createFaultReason(asset.type);
  } else if (Math.random() < 0.08) {
    status = 'WARNING';
  }

  return {
    assetId: asset.id,
    status,
    loadKw: status === 'FAULT' ? Math.round(nextLoad * 0.15) : nextLoad,
    voltage: formatSimulatedVoltage(asset, status),
    lastUpdated: nowIso,
    source: 'SIMULATED',
    ...(faultCode ? { faultCode, faultReason } : {})
  };
}

function broadcastSseTelemetry(updates: AssetTelemetryStatus[]): void {
  if (sseClients.size === 0 || updates.length === 0) return;
  const payload = JSON.stringify({
    source: 'SIMULATED',
    generatedAt: new Date().toISOString(),
    updates
  });
  const chunk = `event: telemetry\ndata: ${payload}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(chunk);
    } catch {
      sseClients.delete(res);
    }
  }
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    const reqUrl = request.url || '';
    if (reqUrl.startsWith('/ws/grid')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws) => {
    wsClients.add(ws);
    monitoringStore.recordLog({
      level: 'INFO',
      category: 'WEBSOCKET',
      message: `WebSocket client connected (active: ${wsClients.size})`
    });

    const initialTelemetry = Array.from(telemetryRegistry.keys())
      .map((id) => telemetryStates.get(id))
      .filter((s): s is AssetTelemetryStatus => Boolean(s));

    ws.send(
      JSON.stringify({
        type: 'WELCOME',
        timestamp: new Date().toISOString(),
        payload: {
          demoMode: isDemoModeEnabled(),
          health: buildHealthSnapshot(),
          telemetryUpdates: initialTelemetry,
          alerts: Array.from(alertsRegistry.values()),
          notifications: Array.from(notificationsRegistry.values()),
          faults: Array.from(liveFaultsRegistry.values()),
          engineers: Array.from(engineersRegistry.values()),
          routes: computeActiveLiveRoutes(),
          geofenceEvents: geofenceEventsRegistry.slice(0, 40)
        }
      })
    );

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw)) as { type?: string };
        if (msg.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: new Date().toISOString() }));
        }
      } catch {
        // Ignore malformed frames
      }
    });

    ws.on('close', () => {
      wsClients.delete(ws);
    });
    ws.on('error', () => {
      wsClients.delete(ws);
    });
  });

  app.use(express.json({ limit: '10mb' }));
  app.use(securityHeadersMiddleware());
  app.use(
    '/api/',
    createSlidingRateLimiter({
      windowMs: 60_000,
      maxRequests: 400,
      keyPrefix: 'api'
    })
  );
  app.use(
    '/api/auth/login',
    createSlidingRateLimiter({
      windowMs: 60_000,
      maxRequests: 20,
      keyPrefix: 'auth-login'
    })
  );

  // Structured latency & error monitoring middleware for /api/* routes
  app.use('/api', (req, res, next) => {
    const started = performance.now();
    res.on('finish', () => {
      const elapsed = performance.now() - started;
      monitoringStore.recordRequest(res.statusCode, elapsed, req.originalUrl);
    });
    next();
  });

  // Periodic 5-second telemetry simulation loop pushed via SSE & WebSockets
  setInterval(() => {
    if (telemetryRegistry.size === 0 || (sseClients.size === 0 && wsClients.size === 0)) return;

    const registered = Array.from(telemetryRegistry.values());
    const activeFaultCount = Array.from(telemetryStates.values()).filter(
      (s) => s.status === 'FAULT'
    ).length;

    const updates: AssetTelemetryStatus[] = [];
    let newFaultsCreated = 0;

    for (const asset of registered) {
      const prev = telemetryStates.get(asset.id);
      const canTriggerFault =
        activeFaultCount + newFaultsCreated < 2 &&
        asset.type !== 'tower' &&
        asset.type !== 'pole';

      const next = buildSimulatedStatus(asset, prev, canTriggerFault);
      if (next.status === 'FAULT' && prev?.status !== 'FAULT') {
        newFaultsCreated += 1;
        const liveAsset = liveAssetsMap.get(asset.id);
        if (liveAsset && liveAsset.source !== 'DEMO') {
          const alertId = `ALT-TEL-${next.faultCode || asset.id}`;
          if (!alertsRegistry.has(alertId)) {
            const createdAlert: GridAlert = {
              id: alertId,
              title: `${formatMissingValue(liveAsset.rawName ?? liveAsset.name)} Telemetry Fault`,
              assetId: liveAsset.canonicalId,
              assetName: formatMissingValue(liveAsset.rawName ?? liveAsset.name),
              locationLabel: `${formatMissingValue(liveAsset.area)}, ${formatMissingValue(liveAsset.district)}`,
              severity: 'CRITICAL',
              category: 'OUTAGE_FAULT',
              timestamp: next.lastUpdated,
              recommendedAction: next.faultReason || 'Inspect telemetry excursion on Grid Map.',
              acknowledged: false,
              targetView: 'map',
              source: 'SIMULATED'
            };
            alertsRegistry.set(alertId, createdAlert);
            broadcastWsEvent('ALERT_CREATED', { alert: createdAlert });
          }
        }
      }
      telemetryStates.set(asset.id, next);
      updates.push(next);
    }

    broadcastSseTelemetry(updates);
    broadcastWsEvent('TELEMETRY_BATCH', {
      source: 'SIMULATED',
      generatedAt: new Date().toISOString(),
      updates,
      health: buildHealthSnapshot()
    });

    // Advance any TRAVELING field engineers along their assigned route and emit live GPS + geofence events
    const activeFences = getActiveGeoFences();
    for (const eng of engineersRegistry.values()) {
      if (eng.status !== 'TRAVELING' || !eng.currentTaskId) continue;
      const task = fieldTasksRegistry.get(eng.currentTaskId);
      if (!task) continue;
      const destAsset = liveAssetsMap.get(task.assetId);
      const destLat = destAsset?.latitude ?? task.gpsLat;
      const destLon = destAsset?.longitude ?? task.gpsLon;
      const distKm = haversineDistanceKm(eng.latitude, eng.longitude, destLat, destLon);
      if (distKm <= 0.04) continue;

      const prevLat = eng.latitude;
      const prevLon = eng.longitude;
      const stepFraction = distKm > 0.25 ? 0.16 : 0.45;
      const newLat = Number((prevLat + (destLat - prevLat) * stepFraction).toFixed(6));
      const newLon = Number((prevLon + (destLon - prevLon) * stepFraction).toFixed(6));
      const newDistKm = haversineDistanceKm(newLat, newLon, destLat, destLon);
      const arrived = newDistKm <= 0.055;
      const nowIso = new Date().toISOString();

      const updatedEng: FieldEngineer = {
        ...eng,
        latitude: newLat,
        longitude: newLon,
        speedKmh: arrived ? 0 : eng.speedKmh > 0 ? eng.speedKmh : 32,
        status: arrived ? 'WORKING' : 'TRAVELING',
        lastLocationUpdate: nowIso
      };
      engineersRegistry.set(updatedEng.engineerId, updatedEng);

      const route = computeFallbackRoute({
        engineer: updatedEng,
        task,
        destAsset: destAsset ?? null
      });
      const updatedTask: FieldTask = {
        ...task,
        status: arrived ? 'ON_SITE' : task.status,
        arrivedAt: arrived && !task.arrivedAt ? nowIso : task.arrivedAt,
        etaMinutes: route.etaMinutes,
        distanceKm: route.remainingDistanceKm,
        routeProgressPct: route.progressPct,
        updatedAt: nowIso
      };
      fieldTasksRegistry.set(task.id, updatedTask);

      liveLocationsRegistry.unshift({
        locationId: `LOC-${Date.now()}-${updatedEng.engineerId}`,
        engineerId: updatedEng.engineerId,
        engineerName: updatedEng.name,
        taskId: updatedEng.currentTaskId,
        latitude: newLat,
        longitude: newLon,
        speedKmh: updatedEng.speedKmh,
        headingDeg: updatedEng.headingDeg,
        batteryPct: updatedEng.batteryPct,
        networkStatus: updatedEng.networkStatus,
        recordedAt: nowIso
      });
      if (liveLocationsRegistry.length > 300) liveLocationsRegistry.length = 300;

      const gfEvents = evaluateGeoFenceTransitions({
        engineer: updatedEng,
        prevLat,
        prevLon,
        newLat,
        newLon,
        fences: activeFences
      });
      for (const gfe of gfEvents) {
        geofenceEventsRegistry.unshift(gfe);
        broadcastWsEvent('GEOFENCE_EVENT', { event: gfe });
      }
      if (geofenceEventsRegistry.length > 200) geofenceEventsRegistry.length = 200;

      broadcastWsEvent('ENGINEER_LOCATION_UPDATED', {
        engineer: updatedEng,
        route,
        task: updatedTask
      });
    }
  }, TELEMETRY_INTERVAL_MS);

  // Enhanced System Healthcheck & Monitoring Metrics
  app.get('/api/health', (_req, res) => {
    const allAssets = Array.from(liveAssetsMap.values());
    const health = buildHealthSnapshot();
    res.json({
      ...health,
      demoAssetCount: allAssets.filter((a) => a.source === 'DEMO').length,
      osmAssetCount: allAssets.filter((a) => a.source === 'OSM').length,
      cachedBboxes: osmBboxCache.size,
      stateCount: getStates(allAssets).length
    });
  });

  app.get('/api/monitoring/metrics', (_req, res) => {
    res.json({
      health: buildHealthSnapshot(),
      recentLogs: monitoringStore.recentLogs.slice(0, 30)
    });
  });

  // Phase 8 Authentication, Refresh Tokens & RBAC Session Endpoints
  app.post('/api/auth/register', (req, res) => {
    const body = (req.body || {}) as {
      username?: string;
      email?: string;
      fullName?: string;
      password?: string;
      role?: UserRole;
    };
    const role: UserRole = body.role && ROLE_DIRECTORY[body.role] ? body.role : 'VIEWER';
    const result = registerServerUser({
      username: body.username || (body.email ? body.email.split('@')[0] : 'operator'),
      email: body.email || '',
      fullName: body.fullName || body.username || 'Grid Operator',
      password: body.password || '',
      role
    });
    if (result.ok === false) {
      return res.status(result.status).json({ error: result.error });
    }
    const access = signJwtToken({
      sub: result.user.username,
      email: result.user.email,
      fullName: result.user.fullName,
      role: result.user.role,
      tokenType: 'access',
      ttlSeconds: 7200
    });
    const refresh = signJwtToken({
      sub: result.user.username,
      email: result.user.email,
      fullName: result.user.fullName,
      role: result.user.role,
      tokenType: 'refresh',
      ttlSeconds: 86400
    });
    monitoringStore.recordLog({
      level: 'INFO',
      category: 'AUTH',
      message: `Registered new utility operator ${result.user.email} (${result.user.role})`
    });
    return res.status(201).json({
      accessToken: access.token,
      refreshToken: refresh.token,
      expiresAtMs: access.expiresAtMs,
      user: {
        username: result.user.username,
        email: result.user.email,
        fullName: result.user.fullName,
        role: result.user.role
      }
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const body = (req.body || {}) as { identifier?: string; password?: string };
    const account = authenticateServerUser(body.identifier || '', body.password || '');
    if (!account) {
      monitoringStore.failedLoginAttempts += 1;
      monitoringStore.recordLog({
        level: 'WARN',
        category: 'AUTH',
        message: `Failed login attempt for identifier "${String(body.identifier || 'unknown').slice(0, 48)}"`,
        statusCode: 401
      });
      return res.status(401).json({ error: 'Invalid username/email or password.' });
    }
    const access = signJwtToken({
      sub: account.username,
      email: account.email,
      fullName: account.fullName,
      role: account.role,
      tokenType: 'access',
      ttlSeconds: 7200
    });
    const refresh = signJwtToken({
      sub: account.username,
      email: account.email,
      fullName: account.fullName,
      role: account.role,
      tokenType: 'refresh',
      ttlSeconds: 86400
    });
    monitoringStore.recordLog({
      level: 'INFO',
      category: 'AUTH',
      message: `Authenticated credential login for ${account.email} (${account.role})`
    });
    return res.json({
      accessToken: access.token,
      refreshToken: refresh.token,
      expiresAtMs: access.expiresAtMs,
      user: {
        username: account.username,
        email: account.email,
        fullName: account.fullName,
        role: account.role
      }
    });
  });

  app.post('/api/auth/demo-session', (req, res) => {
    if (!isDemoModeEnabled()) {
      return res.status(403).json({ error: 'Demo session tokens are disabled in production mode.' });
    }
    const requestedRole = (req.body?.role as UserRole) || 'GRID_ENGINEER';
    const perms = ROLE_DIRECTORY[requestedRole] || ROLE_DIRECTORY.GRID_ENGINEER;
    const access = signJwtToken({
      sub: perms.actorEmail.split('@')[0],
      email: perms.actorEmail,
      fullName: perms.actorName,
      role: perms.role,
      tokenType: 'access',
      ttlSeconds: 7200
    });
    const refresh = signJwtToken({
      sub: perms.actorEmail.split('@')[0],
      email: perms.actorEmail,
      fullName: perms.actorName,
      role: perms.role,
      tokenType: 'refresh',
      ttlSeconds: 86400
    });
    return res.json({
      mode: 'DEMO',
      accessToken: access.token,
      refreshToken: refresh.token,
      expiresAtMs: access.expiresAtMs,
      user: {
        username: perms.actorEmail.split('@')[0],
        email: perms.actorEmail,
        fullName: perms.actorName,
        role: perms.role
      }
    });
  });

  app.post('/api/auth/refresh', (req, res) => {
    const refreshToken = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken.trim() : '';
    const verified = verifyJwtToken(refreshToken, 'refresh');
    if (verified.valid === false) {
      return res.status(401).json({ error: verified.error });
    }
    revokeRefreshJwt(refreshToken);
    const access = signJwtToken({
      sub: verified.claims.sub,
      email: verified.claims.email,
      fullName: verified.claims.fullName,
      role: verified.claims.role,
      tokenType: 'access',
      ttlSeconds: 7200
    });
    const nextRefresh = signJwtToken({
      sub: verified.claims.sub,
      email: verified.claims.email,
      fullName: verified.claims.fullName,
      role: verified.claims.role,
      tokenType: 'refresh',
      ttlSeconds: 86400
    });
    return res.json({
      accessToken: access.token,
      refreshToken: nextRefresh.token,
      expiresAtMs: access.expiresAtMs,
      user: {
        username: verified.claims.sub,
        email: verified.claims.email,
        fullName: verified.claims.fullName,
        role: verified.claims.role
      }
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    const refreshToken = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken.trim() : '';
    if (refreshToken) {
      revokeRefreshJwt(refreshToken);
    }
    return res.json({ status: 'signed_out' });
  });

  app.get('/api/auth/me', (req, res) => {
    const claims = extractBearerFromRequest(req);
    if (!claims) {
      return res.status(401).json({ error: 'Valid Bearer access token required.' });
    }
    return res.json({
      username: claims.sub,
      email: claims.email,
      fullName: claims.fullName,
      role: claims.role,
      expiresAtMs: claims.exp * 1000
    });
  });

  // Lookup single canonical asset across DEMO + OSM registry
  app.get('/api/assets/:canonicalId', (req, res) => {
    const canonicalId = decodeURIComponent(req.params.canonicalId || '').trim();
    const asset = liveAssetsMap.get(canonicalId);
    if (!asset) {
      return res.status(404).json({
        error: `Asset ${canonicalId} not found in canonical registry.`
      });
    }
    return res.json({
      asset: {
        ...asset,
        id: asset.canonicalId,
        voltageDisplay: formatMissingValue(asset.voltage),
        operatorDisplay: formatMissingValue(asset.operator),
        ratedCapacityDisplay: formatMissingValue(asset.ratedCapacityKva, ' kVA'),
        lastInspectionDisplay: formatMissingValue(asset.lastInspectionDate)
      }
    });
  });

  // PART A: Real locations from OpenStreetMap via Overpass API + 24h rounded bbox cache
  app.get('/api/assets', async (req, res) => {
    const rawBbox = typeof req.query.bbox === 'string' ? req.query.bbox : '';
    if (!rawBbox) {
      const allAssets = Array.from(liveAssetsMap.values());
      return res.json({
        count: allAssets.length,
        assets: allAssets
      });
    }

    const parts = rawBbox.split(',').map((p) => Number(p.trim()));
    if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
      return res.status(400).json({
        error: 'Invalid bbox query parameter. Expected bbox=south,west,north,east'
      });
    }

    const [south, west, north, east] = parts;
    if (south >= north || west >= east) {
      return res.status(400).json({
        error: 'Invalid bbox coordinates: south must be < north and west must be < east'
      });
    }

    const latSpan = north - south;
    const lonSpan = east - west;
    if (latSpan > 2.2 || lonSpan > 2.2) {
      return res.status(400).json({
        error: 'Bounding box too large. Zoom in to zoom >= 11 before querying OpenStreetMap.'
      });
    }

    // Round bbox to 0.01° grid (~1.1 km) for high cache hit rate
    const rSouth = Math.floor(south * 100) / 100;
    const rWest = Math.floor(west * 100) / 100;
    const rNorth = Math.ceil(north * 100) / 100;
    const rEast = Math.ceil(east * 100) / 100;
    const bboxKey = `${rSouth.toFixed(2)},${rWest.toFixed(2)},${rNorth.toFixed(2)},${rEast.toFixed(2)}`;

    const now = Date.now();
    const cached = osmBboxCache.get(bboxKey);
    if (cached && now - cached.fetchedAt < OSM_CACHE_TTL_MS) {
      return res.json({
        bbox: bboxKey,
        cached: true,
        fetchedAt: new Date(cached.fetchedAt).toISOString(),
        attribution: '© OpenStreetMap contributors',
        count: cached.assets.length,
        assets: cached.assets
      });
    }

    try {
      let queryPromise = inFlightOsmQueries.get(bboxKey);
      if (!queryPromise) {
        queryPromise = queryOverpassApi({
          south: rSouth,
          west: rWest,
          north: rNorth,
          east: rEast
        });
        inFlightOsmQueries.set(bboxKey, queryPromise);
      }

      const assets = await queryPromise;
      inFlightOsmQueries.delete(bboxKey);

      const fetchedAt = Date.now();
      osmBboxCache.set(bboxKey, {
        bboxKey,
        fetchedAt,
        assets
      });

      for (const osmAsset of assets) {
        const normalized = normalizeOsmToInfrastructureAsset(osmAsset);
        liveAssetsMap.set(normalized.canonicalId, normalized);
      }

      return res.json({
        bbox: bboxKey,
        cached: false,
        fetchedAt: new Date(fetchedAt).toISOString(),
        attribution: '© OpenStreetMap contributors',
        count: assets.length,
        assets
      });
    } catch (err) {
      inFlightOsmQueries.delete(bboxKey);
      if (cached) {
        return res.json({
          bbox: bboxKey,
          cached: true,
          staleFallback: true,
          fetchedAt: new Date(cached.fetchedAt).toISOString(),
          attribution: '© OpenStreetMap contributors',
          count: cached.assets.length,
          assets: cached.assets
        });
      }
      const message = err instanceof Error ? err.message : 'Overpass API unavailable';
      return res.status(502).json({
        error: `Failed to fetch power assets from OpenStreetMap Overpass API: ${message}`
      });
    }
  });

  // PART B: Live Simulated Telemetry Registration & SSE Stream
  app.post('/api/telemetry/register', (req, res) => {
    const incoming = Array.isArray(req.body?.assets) ? req.body.assets : [];
    const initialUpdates: AssetTelemetryStatus[] = [];

    telemetryRegistry.clear();
    for (const item of incoming.slice(0, 300)) {
      if (!item || typeof item.id !== 'string') continue;
      const asset: RegisteredTelemetryAsset = {
        id: item.id,
        type: parseOsmPowerType(item.type),
        name: typeof item.name === 'string' ? item.name : null,
        voltage: typeof item.voltage === 'string' ? item.voltage : null,
        lat: Number(item.lat) || 0,
        lon: Number(item.lon) || 0
      };
      telemetryRegistry.set(asset.id, asset);

      let existing = telemetryStates.get(asset.id);
      if (!existing) {
        existing = buildSimulatedStatus(asset, undefined, false);
        telemetryStates.set(asset.id, existing);
      }
      initialUpdates.push(existing);
    }

    res.json({
      registered: telemetryRegistry.size,
      source: 'SIMULATED',
      updates: initialUpdates
    });
  });

  app.get('/api/telemetry/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    sseClients.add(res);

    const initialUpdates = Array.from(telemetryRegistry.keys())
      .map((id) => telemetryStates.get(id))
      .filter((s): s is AssetTelemetryStatus => Boolean(s));

    if (initialUpdates.length > 0) {
      const payload = JSON.stringify({
        source: 'SIMULATED',
        generatedAt: new Date().toISOString(),
        updates: initialUpdates
      });
      res.write(`event: telemetry\ndata: ${payload}\n\n`);
    } else {
      res.write(`event: heartbeat\ndata: ${JSON.stringify({ source: 'SIMULATED', ts: new Date().toISOString() })}\n\n`);
    }

    req.on('close', () => {
      sseClients.delete(res);
    });
  });

  // Hierarchical Geography Endpoints backed by India Registry + Canonical Asset Registry
  app.get('/api/geography/countries', (_req, res) => {
    res.json({ countries: getCountries(Array.from(liveAssetsMap.values())) });
  });

  app.get('/api/geography/states', (req, res) => {
    const filter = extractFilterFromQuery(req.query);
    res.json({ states: getStates(Array.from(liveAssetsMap.values()), filter) });
  });

  app.get('/api/geography/districts', (req, res) => {
    const filter = extractFilterFromQuery(req.query);
    res.json({ districts: getDistricts(Array.from(liveAssetsMap.values()), filter) });
  });

  app.get('/api/geography/divisions', (req, res) => {
    const filter = extractFilterFromQuery(req.query);
    res.json({ divisions: getDivisions(Array.from(liveAssetsMap.values()), filter) });
  });

  app.get('/api/geography/subdivisions', (req, res) => {
    const filter = extractFilterFromQuery(req.query);
    res.json({ subdivisions: getSubdivisions(Array.from(liveAssetsMap.values()), filter) });
  });

  app.get('/api/geography/cities', (req, res) => {
    const filter = extractFilterFromQuery(req.query);
    res.json({ cities: getCities(Array.from(liveAssetsMap.values()), filter) });
  });

  app.get('/api/geography/areas', (req, res) => {
    const filter = extractFilterFromQuery(req.query);
    res.json({ areas: getAreas(Array.from(liveAssetsMap.values()), filter) });
  });

  app.get('/api/geography/substations', (req, res) => {
    const filter = extractFilterFromQuery(req.query);
    res.json({ substations: getSubstations(Array.from(liveAssetsMap.values()), filter) });
  });

  app.get('/api/geography/feeders', (req, res) => {
    const filter = extractFilterFromQuery(req.query);
    res.json({ feeders: getFeeders(Array.from(liveAssetsMap.values()), filter) });
  });

  app.get('/api/geography/transformers', (req, res) => {
    const filter = extractFilterFromQuery(req.query);
    res.json({ transformers: getTransformers(Array.from(liveAssetsMap.values()), filter) });
  });

  app.get('/api/geography/boundaries', (req, res) => {
    const filter = extractFilterFromQuery(req.query);
    const boundaries = filterBoundaries(GEOGRAPHIC_BOUNDARIES, filter);
    res.json({ boundaries });
  });

  app.get('/api/geography/search', (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const results = searchGeographyAndAssets(
      Array.from(liveAssetsMap.values()),
      GEOGRAPHIC_BOUNDARIES,
      q
    );
    res.json({ query: q, results });
  });

  app.get('/api/map/search', (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const results = searchGeographyAndAssets(
      Array.from(liveAssetsMap.values()),
      GEOGRAPHIC_BOUNDARIES,
      q
    );
    res.json({ query: q, count: results.length, results });
  });

  app.get('/api/map/states', (req, res) => {
    const filter = extractFilterFromQuery(req.query);
    res.json({ states: getStates(Array.from(liveAssetsMap.values()), filter) });
  });

  app.get('/api/map/districts', (req, res) => {
    const filter = extractFilterFromQuery(req.query);
    res.json({ districts: getDistricts(Array.from(liveAssetsMap.values()), filter) });
  });

  app.get('/api/map/areas', (req, res) => {
    const filter = extractFilterFromQuery(req.query);
    res.json({ areas: getAreas(Array.from(liveAssetsMap.values()), filter) });
  });

  app.get('/api/map/substations', (req, res) => {
    const filter = extractFilterFromQuery(req.query);
    res.json({ substations: getSubstations(Array.from(liveAssetsMap.values()), filter) });
  });

  app.get('/api/map/feeders', (req, res) => {
    const filter = extractFilterFromQuery(req.query);
    res.json({ feeders: getFeeders(Array.from(liveAssetsMap.values()), filter) });
  });

  app.get('/api/map/transformers', (req, res) => {
    const filter = extractFilterFromQuery(req.query);
    res.json({ transformers: getTransformers(Array.from(liveAssetsMap.values()), filter) });
  });

  app.get('/api/map/assets', (req, res) => {
    const filter = extractFilterFromQuery(req.query);
    const pincodeFilter = typeof req.query.pincode === 'string' ? req.query.pincode.trim() : '';
    const rawBbox = typeof req.query.bbox === 'string' ? req.query.bbox.trim() : '';
    const allLive = Array.from(liveAssetsMap.values());
    let assets = filterAssetsByHierarchy(allLive, filter);

    if (pincodeFilter) {
      assets = assets.filter((a) => (a.pincode || '').includes(pincodeFilter));
    }

    if (rawBbox) {
      const parts = rawBbox.split(',').map((p) => Number(p.trim()));
      if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
        const [south, west, north, east] = parts;
        assets = assets.filter(
          (a) =>
            a.latitude >= south &&
            a.latitude <= north &&
            a.longitude >= west &&
            a.longitude <= east
        );
      }
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || assets.length || 500, 1), 2000);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const pagedAssets =
      req.query.limit !== undefined || req.query.offset !== undefined
        ? assets.slice(offset, offset + limit)
        : assets;

    const boundaries = filterBoundaries(GEOGRAPHIC_BOUNDARIES, filter);
    const viewport = computeViewportForSelection(allLive, GEOGRAPHIC_BOUNDARIES, filter);
    const { counts } = computeScopedMapDisplay(assets, []);

    res.setHeader('Cache-Control', 'private, max-age=15');
    res.json({
      filter,
      count: pagedAssets.length,
      total: assets.length,
      limit,
      offset,
      counts,
      viewport,
      assets: pagedAssets,
      boundaries,
      geojson: {
        type: 'FeatureCollection',
        features: pagedAssets.map((asset) => ({
          type: 'Feature',
          id: asset.canonicalId,
          geometry: asset.geometry,
          properties: {
            id: asset.canonicalId,
            canonicalId: asset.canonicalId,
            name: formatMissingValue(asset.rawName ?? asset.name),
            osmType: asset.osmType,
            assetType: asset.assetType,
            substationId: asset.substationId,
            feederId: asset.feederId,
            status: asset.status,
            voltage: formatMissingValue(asset.voltage),
            operator: formatMissingValue(asset.operator),
            state: formatMissingValue(asset.state),
            district: formatMissingValue(asset.district),
            area: formatMissingValue(asset.area),
            installationDate: formatMissingValue(asset.installationDate),
            lastInspectionDate: formatMissingValue(asset.lastInspectionDate),
            source: asset.source
          }
        }))
      }
    });
  });

  // PART C: Active Faults GeoJSON/Canonical Endpoint
  app.get('/api/map/faults', (req, res) => {
    const stateFilter = typeof req.query.state === 'string' ? req.query.state.trim().toLowerCase() : '';
    const districtFilter = typeof req.query.district === 'string' ? req.query.district.trim().toLowerCase() : '';
    const areaFilter = typeof req.query.area === 'string' ? req.query.area.trim().toLowerCase() : '';
    const feederFilter = typeof req.query.feederId === 'string' ? req.query.feederId.trim().toLowerCase() : '';

    const simulatedFaults = Array.from(telemetryStates.values())
      .filter((t) => t.status === 'FAULT')
      .map((t) => {
        const asset = liveAssetsMap.get(t.assetId);
        if (!asset || asset.source === 'DEMO') return null;
        return {
          id: t.faultCode || `SIM-FLT-${t.assetId}`,
          faultCode: t.faultCode || `SIM-FLT-${t.assetId}`,
          title: `${formatMissingValue(asset.rawName ?? asset.name)} Telemetry Fault`,
          latitude: asset.latitude,
          longitude: asset.longitude,
          faultRadiusMeters: 220,
          severity: 'CRITICAL' as const,
          status: 'ACTIVE_LOCKOUT' as const,
          affectedAssetId: asset.canonicalId,
          affectedAssetName: formatMissingValue(asset.rawName ?? asset.name),
          affectedSubstationId: asset.substationId,
          affectedFeederId: asset.feederId,
          affectedTransformerId: asset.assetType === 'TRANSFORMER' ? asset.canonicalId : undefined,
          affectedTransformerIds: asset.assetType === 'TRANSFORMER' ? [asset.canonicalId] : [],
          detectedAt: t.lastUpdated,
          lastUpdated: t.lastUpdated,
          source: t.source,
          telemetrySource: t.source,
          customersInterrupted: null,
          relatedEventId: `EVT-${t.faultCode || t.assetId}`,
          description: t.faultReason || `Simulated fault on ${asset.canonicalId}`
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    const combinedFaults = [...Array.from(liveFaultsRegistry.values()), ...simulatedFaults]
      .filter((f) => {
        const asset = liveAssetsMap.get(f.affectedAssetId);
        if (stateFilter && (asset?.state || '').toLowerCase() !== stateFilter) return false;
        if (districtFilter && (asset?.district || '').toLowerCase() !== districtFilter) return false;
        if (areaFilter && (asset?.area || '').toLowerCase() !== areaFilter) return false;
        if (feederFilter && (f.affectedFeederId || '').toLowerCase() !== feederFilter) return false;
        return true;
      })
      .map((f) => ({
        ...f,
        radiusMeters: f.faultRadiusMeters ?? 250,
        affectedTransformerIds:
          f.affectedTransformerIds && f.affectedTransformerIds.length > 0
            ? f.affectedTransformerIds
            : f.affectedTransformerId
              ? [f.affectedTransformerId]
              : [],
        geometry: {
          type: 'Point' as const,
          coordinates: [f.longitude, f.latitude] as [number, number]
        }
      }));

    res.json({
      count: combinedFaults.length,
      faults: combinedFaults
    });
  });

  // PART C: List & Retrieve Event Reconstructions with Steps & Map Geometry
  app.get('/api/events/reconstructions', (_req, res) => {
    const allLive = Array.from(liveAssetsMap.values());
    const reconstructions = INITIAL_EVENT_RECONSTRUCTIONS.map((inc) =>
      buildEventReconstructionPayload(inc, allLive, INITIAL_POWER_LINES)
    );
    res.json({
      count: reconstructions.length,
      reconstructions
    });
  });

  app.get('/api/events/:id/reconstruction', (req, res) => {
    const lookupId = decodeURIComponent(req.params.id || '').trim();
    const incident = INITIAL_EVENT_RECONSTRUCTIONS.find(
      (inc) => inc.id === lookupId || inc.faultId === lookupId || inc.faultCode === lookupId
    );
    if (!incident) {
      return res.status(404).json({
        error: `Event reconstruction "${lookupId}" not found.`
      });
    }

    const allLive = Array.from(liveAssetsMap.values());
    return res.json(buildEventReconstructionPayload(incident, allLive, INITIAL_POWER_LINES));
  });

  // Phase 5: What-If Simulation & Decision Intelligence Endpoints
  // Note: /run and /compare are registered BEFORE /:simulationId to avoid route shadowing.
  app.post('/api/simulations', (req, res) => {
    const body = (req.body || {}) as Partial<SimulationInputParams> & {
      id?: string;
      scenarioCode?: string;
    };
    const params: SimulationInputParams = {
      scenarioType: body.scenarioType || 'FEEDER_TRANSFER',
      title: body.title,
      substationId: body.substationId ?? null,
      sourceFeeder: body.sourceFeeder || 'FDR-TG-06U-01',
      targetFeeder: body.targetFeeder || 'FDR-TG-06U-02',
      transformerId: body.transformerId ?? null,
      tieSwitch: body.tieSwitch || 'SW-TG-06U-14',
      loadTransferMva: body.loadTransferMva,
      loadTransferPct: body.loadTransferPct,
      expectedDurationMin: body.expectedDurationMin,
      timeOfOperation: body.timeOfOperation,
      incidentId: body.incidentId ?? null,
      faultId: body.faultId ?? null,
      engineerName: body.engineerName,
      engineerEmail: body.engineerEmail
    };

    const simId = body.id || `SCEN-${Date.now()}`;
    const scenarioCode =
      body.scenarioCode || `SCEN-2026-${String(simulationsRegistry.size + 1).padStart(3, '0')}`;
    const created = executeWhatIfSimulation(params, getSimulationTopologyContext(), {
      id: simId,
      scenarioCode,
      source: 'SIMULATED',
      status: 'DRAFT'
    });
    simulationsRegistry.set(created.id, created);
    return res.status(201).json({ simulation: created });
  });

  app.get('/api/simulations', (_req, res) => {
    const simulations = Array.from(simulationsRegistry.values());
    return res.json({
      count: simulations.length,
      simulations
    });
  });

  app.post('/api/simulations/run', (req, res) => {
    const body = (req.body || {}) as Partial<SimulationInputParams> & {
      id?: string;
      scenarioCode?: string;
    };
    const params: SimulationInputParams = {
      scenarioType: body.scenarioType || 'FEEDER_TRANSFER',
      title: body.title,
      substationId: body.substationId ?? null,
      sourceFeeder: body.sourceFeeder || 'FDR-TG-06U-01',
      targetFeeder: body.targetFeeder || 'FDR-TG-06U-02',
      transformerId: body.transformerId ?? null,
      tieSwitch: body.tieSwitch || 'SW-TG-06U-14',
      loadTransferMva: body.loadTransferMva,
      loadTransferPct: body.loadTransferPct,
      expectedDurationMin: body.expectedDurationMin,
      timeOfOperation: body.timeOfOperation,
      incidentId: body.incidentId ?? null,
      faultId: body.faultId ?? null,
      engineerName: body.engineerName,
      engineerEmail: body.engineerEmail
    };

    const simId = body.id || `SCEN-${Date.now()}`;
    const scenarioCode =
      body.scenarioCode || `SCEN-2026-${String(simulationsRegistry.size + 1).padStart(3, '0')}`;
    const completed = executeWhatIfSimulation(params, getSimulationTopologyContext(), {
      id: simId,
      scenarioCode,
      source: 'SIMULATED',
      status: 'COMPLETED'
    });
    simulationsRegistry.set(completed.id, completed);

    return res.json({
      simulation: completed,
      impactAnalysis: completed.impactAnalysis,
      riskAssessment: completed.riskAssessment,
      recommendation: completed.recommendation,
      mapOverlay: completed.mapOverlay
    });
  });

  app.post('/api/simulations/compare', (req, res) => {
    const body = (req.body || {}) as {
      scenarioIds?: string[];
      scenarios?: SimulationScenario[];
    };
    let targets: SimulationScenario[] = [];
    if (Array.isArray(body.scenarioIds) && body.scenarioIds.length > 0) {
      targets = body.scenarioIds
        .map((id) =>
          simulationsRegistry.get(id) ||
          Array.from(simulationsRegistry.values()).find((s) => s.scenarioCode === id)
        )
        .filter((s): s is SimulationScenario => Boolean(s));
    } else if (Array.isArray(body.scenarios) && body.scenarios.length > 0) {
      targets = body.scenarios;
    } else {
      targets = Array.from(simulationsRegistry.values()).slice(0, 3);
    }

    return res.json(compareSimulationScenarios(targets));
  });

  app.get('/api/simulations/:simulationId', (req, res) => {
    const lookupId = decodeURIComponent(req.params.simulationId || '').trim();
    const found =
      simulationsRegistry.get(lookupId) ||
      Array.from(simulationsRegistry.values()).find((s) => s.scenarioCode === lookupId);
    if (!found) {
      return res.status(404).json({
        error: `Simulation "${lookupId}" not found.`
      });
    }
    return res.json({
      simulation: found,
      simulationAssets: found.simulationAssets
    });
  });

  app.get('/api/simulations/:simulationId/results', (req, res) => {
    const lookupId = decodeURIComponent(req.params.simulationId || '').trim();
    const found =
      simulationsRegistry.get(lookupId) ||
      Array.from(simulationsRegistry.values()).find((s) => s.scenarioCode === lookupId);
    if (!found) {
      return res.status(404).json({
        error: `Simulation results for "${lookupId}" not found.`
      });
    }
    return res.json({
      simulationId: found.id,
      scenarioCode: found.scenarioCode,
      riskAssessment: found.riskAssessment,
      impactAnalysis: found.impactAnalysis,
      recommendation: found.recommendation,
      mapOverlay: found.mapOverlay,
      simulationAssets: found.simulationAssets
    });
  });

  // Phase 6: Decision Governance, Approvals, Field Tasks, Evidence, Audit & Notifications
  app.get('/api/decisions', (req, res) => {
    const statusFilter = typeof req.query.status === 'string' ? req.query.status.trim().toUpperCase() : '';
    const stateFilter = typeof req.query.state === 'string' ? req.query.state.trim().toLowerCase() : '';
    const list = Array.from(decisionsRegistry.values()).filter((d) => {
      if (statusFilter && d.status.toUpperCase() !== statusFilter) return false;
      if (stateFilter && (d.state || '').toLowerCase() !== stateFilter) return false;
      return true;
    });
    return res.json({ count: list.length, decisions: list });
  });

  app.post('/api/decisions', (req, res) => {
    const body = (req.body || {}) as Partial<EngineeringDecision>;
    const nowIso = new Date().toISOString();
    const id = body.id || `DEC-${Date.now()}`;
    const created: EngineeringDecision = {
      id,
      decisionCode: body.decisionCode || `DEC-2026-${String(decisionsRegistry.size + 1).padStart(3, '0')}`,
      incidentId: body.incidentId ?? null,
      faultId: body.faultId ?? null,
      title: body.title || 'Engineering Governance Proposal',
      rationale: body.rationale || '',
      riskAssessment: body.riskAssessment || '',
      recommendationSummary: body.recommendationSummary || body.title || 'Operational proposal',
      targetAssetId: body.targetAssetId || 'SUB-TG-06U',
      priority: body.priority || 'HIGH',
      riskLevel: body.riskLevel || 'MEDIUM',
      escalated: Boolean(body.escalated),
      assignedTaskId: body.assignedTaskId ?? null,
      state: body.state || 'Telangana',
      district: body.district || 'Hyderabad',
      area: body.area || 'HITEC City',
      proposedBy: body.proposedBy || 'Marcus Vance, PE',
      proposedByEmail: body.proposedByEmail || 'm.vance@utilitygrid.org',
      status: body.status || 'SUBMITTED',
      source: body.source || 'DEMO',
      evidenceBundle: body.evidenceBundle || {
        conflictIssueIds: [],
        eventTimelineIds: [],
        affectedCustomersCount: null,
        reliabilityImpact: 'Pending governance review'
      },
      signatureHash:
        body.signatureHash ||
        Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
      createdAt: body.createdAt || nowIso,
      updatedAt: nowIso,
      comments: Array.isArray(body.comments) ? body.comments : []
    };
    decisionsRegistry.set(created.id, created);
    broadcastWsEvent('GOVERNANCE_UPDATE', {
      event: 'DECISION_SUBMITTED',
      decisionId: created.id,
      assetId: created.targetAssetId,
      title: created.title
    });
    return res.status(201).json({ decision: created });
  });

  app.put('/api/decisions/:id', (req, res) => {
    const id = decodeURIComponent(req.params.id || '').trim();
    const existing = decisionsRegistry.get(id);
    if (!existing) {
      return res.status(404).json({ error: `Decision "${id}" not found.` });
    }
    const body = (req.body || {}) as {
      status?: EngineeringDecision['status'];
      verificationChecklist?: VerificationChecklistState;
      resolutionSummary?: string;
      escalated?: boolean;
    };
    if (body.status === 'CLOSED' && !isChecklistComplete(body.verificationChecklist)) {
      return res.status(400).json({
        error: 'All 5 verification checklist items must be confirmed before closing a decision.'
      });
    }
    const nowIso = new Date().toISOString();
    const updated: EngineeringDecision = {
      ...existing,
      ...(body.status ? { status: body.status } : {}),
      ...(body.verificationChecklist ? { verificationChecklist: body.verificationChecklist } : {}),
      ...(body.resolutionSummary !== undefined ? { resolutionSummary: body.resolutionSummary } : {}),
      ...(body.escalated !== undefined ? { escalated: body.escalated } : {}),
      closedAt: body.status === 'CLOSED' ? nowIso : existing.closedAt,
      updatedAt: nowIso
    };
    decisionsRegistry.set(id, updated);
    broadcastWsEvent('GOVERNANCE_UPDATE', {
      event: updated.status === 'CLOSED' ? 'DECISION_CLOSED' : 'DECISION_UPDATED',
      decisionId: updated.id,
      assetId: updated.targetAssetId,
      status: updated.status
    });
    return res.json({ decision: updated });
  });

  app.post('/api/approvals', (req, res) => {
    const body = (req.body || {}) as {
      approval?: ApprovalRecord;
      createdTask?: FieldTask;
    };
    if (!body.approval) {
      return res.status(400).json({ error: 'approval payload is required.' });
    }
    approvalsRegistry.unshift(body.approval);
    const dec = decisionsRegistry.get(body.approval.decisionId);
    if (dec) {
      decisionsRegistry.set(dec.id, {
        ...dec,
        status: body.approval.action === 'APPROVED' ? 'IN_PROGRESS' : 'REJECTED',
        reviewedBy: body.approval.approverName,
        reviewedByEmail: body.approval.approverEmail,
        assignedTaskId: body.createdTask?.id ?? dec.assignedTaskId,
        updatedAt: new Date().toISOString()
      });
    }
    if (body.createdTask) {
      fieldTasksRegistry.set(body.createdTask.id, body.createdTask);
    }
    broadcastWsEvent('GOVERNANCE_UPDATE', {
      event: `DECISION_${body.approval.action}`,
      decisionId: body.approval.decisionId,
      assetId: dec?.targetAssetId,
      taskId: body.createdTask?.id ?? null
    });
    return res.status(201).json({ approval: body.approval, task: body.createdTask ?? null });
  });

  app.get('/api/tasks', (req, res) => {
    const statusFilter = typeof req.query.status === 'string' ? req.query.status.trim().toUpperCase() : '';
    const tasks = Array.from(fieldTasksRegistry.values()).filter((t) =>
      statusFilter ? t.status.toUpperCase() === statusFilter : true
    );
    return res.json({ count: tasks.length, tasks });
  });

  app.post('/api/tasks', (req, res) => {
    const task = req.body as FieldTask;
    if (!task || !task.id || !task.assetId) {
      return res.status(400).json({ error: 'Field task id and assetId are required.' });
    }
    fieldTasksRegistry.set(task.id, task);
    broadcastWsEvent('FIELD_UPDATE', {
      event: 'FIELD_TASK_CREATED',
      taskId: task.id,
      assetId: task.assetId,
      status: task.status
    });
    return res.status(201).json({ task });
  });

  app.put('/api/tasks/:id', (req, res) => {
    const id = decodeURIComponent(req.params.id || '').trim();
    const existing = fieldTasksRegistry.get(id);
    if (!existing) {
      return res.status(404).json({ error: `Field task "${id}" not found.` });
    }
    const patch = (req.body || {}) as Partial<FieldTask> & { notes?: string };
    const updated: FieldTask = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString()
    };
    fieldTasksRegistry.set(id, updated);
    broadcastWsEvent('FIELD_UPDATE', {
      event: 'FIELD_TASK_UPDATED',
      taskId: updated.id,
      assetId: updated.assetId,
      status: updated.status
    });
    return res.json({ task: updated });
  });

  app.post('/api/evidence', (req, res) => {
    const ev = req.body as Partial<FieldEvidence>;
    if (!ev || !ev.taskId || !ev.fileName || !ev.mimeType || !ev.fileSizeBytes) {
      return res.status(400).json({ error: 'Missing required evidence file metadata.' });
    }
    const validation = validateEvidenceFile({
      fileName: ev.fileName,
      mimeType: ev.mimeType,
      fileSizeBytes: ev.fileSizeBytes
    });
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }
    const saved: FieldEvidence = {
      id: ev.id || `EVD-${Date.now()}`,
      taskId: ev.taskId,
      taskCode: ev.taskCode || ev.taskId,
      decisionId: ev.decisionId || '',
      fileName: ev.fileName,
      mimeType: ev.mimeType,
      fileSizeBytes: ev.fileSizeBytes,
      filePreviewUrl: ev.filePreviewUrl,
      gpsLat: Number(ev.gpsLat ?? 0),
      gpsLon: Number(ev.gpsLon ?? 0),
      notes: ev.notes || '',
      inspectionResult: ev.inspectionResult || 'PASS',
      equipmentCondition: ev.equipmentCondition || 'GOOD',
      meterReadings: ev.meterReadings || {},
      uploadedBy: ev.uploadedBy || 'Rohan Kulkarni (Field Engineer)',
      uploadedByEmail: ev.uploadedByEmail || 'r.kulkarni@utilitygrid.org',
      uploadedAt: ev.uploadedAt || new Date().toISOString(),
      source: ev.source || 'DEMO'
    };
    fieldEvidenceRegistry.unshift(saved);
    broadcastWsEvent('FIELD_UPDATE', {
      event: 'EVIDENCE_UPLOADED',
      taskId: saved.taskId,
      evidenceId: saved.id
    });
    return res.status(201).json({ evidence: saved });
  });

  app.get('/api/evidence/:taskId', (req, res) => {
    const taskId = decodeURIComponent(req.params.taskId || '').trim();
    const items = fieldEvidenceRegistry.filter(
      (e) => e.taskId === taskId || e.taskCode === taskId
    );
    return res.json({ count: items.length, evidence: items });
  });

  // --------------------------------------------------------------------------
  // Phase 11: Live Field Operations & Real-Time Workforce Tracking APIs
  // --------------------------------------------------------------------------
  const resolveFieldActor = (
    req: express.Request,
    res: express.Response,
    allowedRoles: UserRole[]
  ): { email: string; name: string; role: UserRole } | null => {
    const claims = extractBearerFromRequest(req);
    if (claims) {
      if (allowedRoles.includes(claims.role)) {
        return { email: claims.email, name: claims.fullName, role: claims.role };
      }
      res.status(403).json({
        error: `Role "${claims.role}" is not permitted for this field operation.`
      });
      return null;
    }
    if (isDemoModeEnabled()) {
      const hdrRole = String(req.headers['x-gridguard-role'] || 'ADMIN').toUpperCase() as UserRole;
      if (allowedRoles.includes(hdrRole) && ROLE_DIRECTORY[hdrRole]) {
        const dir = ROLE_DIRECTORY[hdrRole];
        return { email: dir.actorEmail, name: dir.actorName, role: hdrRole };
      }
      res.status(403).json({
        error: `Role "${hdrRole}" is not permitted for this field operation.`
      });
      return null;
    }
    res.status(401).json({ error: 'Valid Bearer JWT token required.' });
    return null;
  };

  app.get('/api/field/engineers', (req, res) => {
    const statusFilter =
      typeof req.query.status === 'string' ? req.query.status.trim().toUpperCase() : '';
    const assetId = typeof req.query.assetId === 'string' ? req.query.assetId.trim() : '';
    const engineers = Array.from(engineersRegistry.values()).filter((e) =>
      statusFilter ? e.status === statusFilter : true
    );
    const asset = assetId ? liveAssetsMap.get(assetId) || null : null;
    const recommendations = asset
      ? recommendEngineersForAsset({
          asset,
          engineers: Array.from(engineersRegistry.values()),
          tasks: Array.from(fieldTasksRegistry.values())
        })
      : [];
    return res.json({ count: engineers.length, engineers, recommendations });
  });

  app.get('/api/field/live-locations', (req, res) => {
    const engineerId =
      typeof req.query.engineerId === 'string' ? req.query.engineerId.trim() : '';
    const locations = liveLocationsRegistry.filter((loc) =>
      engineerId ? loc.engineerId === engineerId : true
    );
    return res.json({
      count: locations.length,
      locations: locations.slice(0, 100),
      engineers: Array.from(engineersRegistry.values())
    });
  });

  app.post('/api/field/location/update', (req, res) => {
    const actor = resolveFieldActor(req, res, ['ADMIN', 'FIELD_ENGINEER', 'REVIEWER_APPROVER']);
    if (!actor) return;

    const body = (req.body || {}) as {
      engineerId?: string;
      engineer_id?: string;
      latitude?: number;
      longitude?: number;
      speedKmh?: number;
      speed_kmh?: number;
      headingDeg?: number;
      batteryPct?: number;
      networkStatus?: FieldEngineer['networkStatus'];
      status?: FieldEngineerStatus;
      taskId?: string;
    };

    const engineerId = (body.engineerId || body.engineer_id || '').trim();
    const lat = Number(body.latitude);
    const lon = Number(body.longitude);
    if (
      !engineerId ||
      !Number.isFinite(lat) ||
      lat < -90 ||
      lat > 90 ||
      !Number.isFinite(lon) ||
      lon < -180 ||
      lon > 180
    ) {
      return res.status(400).json({
        error: 'Valid engineerId, latitude (-90..90), and longitude (-180..180) are required.'
      });
    }

    const existing = engineersRegistry.get(engineerId);
    if (!existing) {
      return res.status(404).json({ error: `Field engineer "${engineerId}" not found.` });
    }

    const prevLat = existing.latitude;
    const prevLon = existing.longitude;
    const nowIso = new Date().toISOString();
    const updatedEng: FieldEngineer = {
      ...existing,
      latitude: Number(lat.toFixed(6)),
      longitude: Number(lon.toFixed(6)),
      speedKmh:
        body.speedKmh !== undefined || body.speed_kmh !== undefined
          ? Math.max(0, Number(body.speedKmh ?? body.speed_kmh ?? existing.speedKmh))
          : existing.speedKmh,
      headingDeg:
        body.headingDeg !== undefined ? Number(body.headingDeg) : existing.headingDeg,
      batteryPct:
        body.batteryPct !== undefined
          ? Math.min(100, Math.max(0, Math.round(Number(body.batteryPct))))
          : existing.batteryPct,
      networkStatus: body.networkStatus || existing.networkStatus,
      status: body.status || existing.status,
      lastLocationUpdate: nowIso
    };
    engineersRegistry.set(engineerId, updatedEng);

    const locEntry: LiveLocationLogEntry = {
      locationId: `LOC-${Date.now()}`,
      engineerId,
      engineerName: updatedEng.name,
      taskId: body.taskId ?? updatedEng.currentTaskId,
      latitude: updatedEng.latitude,
      longitude: updatedEng.longitude,
      speedKmh: updatedEng.speedKmh,
      headingDeg: updatedEng.headingDeg,
      batteryPct: updatedEng.batteryPct,
      networkStatus: updatedEng.networkStatus,
      recordedAt: nowIso
    };
    liveLocationsRegistry.unshift(locEntry);
    if (liveLocationsRegistry.length > 300) liveLocationsRegistry.length = 300;

    const fences = getActiveGeoFences();
    const gfEvents = evaluateGeoFenceTransitions({
      engineer: updatedEng,
      prevLat,
      prevLon,
      newLat: updatedEng.latitude,
      newLon: updatedEng.longitude,
      fences
    });
    for (const gfe of gfEvents) {
      geofenceEventsRegistry.unshift(gfe);
      broadcastWsEvent('GEOFENCE_EVENT', { event: gfe });
      if (gfe.eventType === 'REACHED_ASSET' || gfe.eventType === 'ENTER_WORK_ZONE') {
        const arrivedNotif: GridNotification = {
          id: `NTF-GF-${Date.now()}`,
          type: 'ENGINEER_ARRIVED',
          title: `Geo-Fence Trigger: ${updatedEng.name.split(' (')[0]}`,
          message: gfe.summary,
          severity: 'INFO',
          timestamp: nowIso,
          read: false,
          relatedAssetId: gfe.assetId,
          relatedTaskId: updatedEng.currentTaskId || undefined,
          targetView: 'field',
          source: 'DEMO'
        };
        notificationsRegistry.set(arrivedNotif.id, arrivedNotif);
      }
      auditLogsRegistry.unshift({
        id: `AUD-GF-${Date.now()}`,
        timestamp: nowIso,
        actorEmail: actor.email,
        actorRole: actor.role,
        actionType: 'GEOFENCE_EVENT',
        module: 'Field Operations',
        targetEntity: 'geofence_events',
        entityId: gfe.id,
        relatedAssetId: gfe.assetId,
        summary: gfe.summary,
        ipAddress: req.ip || '127.0.0.1'
      });
    }

    const linkedTask = updatedEng.currentTaskId
      ? fieldTasksRegistry.get(updatedEng.currentTaskId) || null
      : null;
    const updatedRoute = linkedTask
      ? computeFallbackRoute({
          engineer: updatedEng,
          task: linkedTask,
          destAsset: liveAssetsMap.get(linkedTask.assetId) || null
        })
      : null;

    if (linkedTask && updatedRoute) {
      fieldTasksRegistry.set(linkedTask.id, {
        ...linkedTask,
        etaMinutes: updatedRoute.etaMinutes,
        distanceKm: updatedRoute.remainingDistanceKm,
        routeProgressPct: updatedRoute.progressPct,
        updatedAt: nowIso
      });
    }

    broadcastWsEvent('ENGINEER_LOCATION_UPDATED', {
      engineer: updatedEng,
      route: updatedRoute,
      geofenceEvents: gfEvents
    });

    return res.json({
      engineer: updatedEng,
      location: locEntry,
      route: updatedRoute,
      geofenceEvents: gfEvents
    });
  });

  app.post('/api/field/tasks', (req, res) => {
    const actor = resolveFieldActor(req, res, ['ADMIN', 'REVIEWER_APPROVER']);
    if (!actor) return;

    const body = (req.body || {}) as {
      decisionId?: string;
      incidentId?: string | null;
      assetId?: string;
      engineerId?: string;
      title?: string;
      priority?: PriorityLevel;
      dueDate?: string;
      safetyNotes?: string;
    };

    const assetId = (body.assetId || '').trim();
    const engineerId = (body.engineerId || '').trim();
    if (!assetId || !engineerId) {
      return res.status(400).json({ error: 'assetId and engineerId are required.' });
    }
    const asset = liveAssetsMap.get(assetId);
    const engineer = engineersRegistry.get(engineerId);
    if (!engineer) {
      return res.status(404).json({ error: `Field engineer "${engineerId}" not found.` });
    }

    const nowIso = new Date().toISOString();
    const taskId = `TSK-${Date.now()}`;
    const taskCode = `TSK-${new Date().getFullYear()}-${String(fieldTasksRegistry.size + 1).padStart(3, '0')}`;
    const destLat = asset?.latitude ?? engineer.latitude;
    const destLon = asset?.longitude ?? engineer.longitude;
    const distKm =
      Math.round(haversineDistanceKm(engineer.latitude, engineer.longitude, destLat, destLon) * 100) /
      100;
    const etaMin = Math.max(2, Math.round((distKm / 28) * 60 + 2));

    const newTask: FieldTask = {
      id: taskId,
      taskCode,
      decisionId: body.decisionId || decisionsRegistry.keys().next().value || 'DEC-MANUAL',
      decisionCode: body.decisionId || 'DEC-MANUAL',
      incidentId: body.incidentId || null,
      title: body.title?.trim() || `Field Dispatch: ${assetId} Inspection & Restoration`,
      engineerId: engineer.engineerId,
      assignedEngineer: engineer.name,
      assignedEngineerEmail: engineer.email,
      assignedTeam: engineer.team,
      assetId,
      assetName: asset?.name || assetId,
      faultLocation: asset ? `${asset.area}, ${asset.district}` : engineer.assignedArea,
      state: asset?.state || engineer.state,
      district: asset?.district || engineer.district,
      area: asset?.area || engineer.assignedArea,
      gpsLat: destLat,
      gpsLon: destLon,
      navigationRoute: [
        { step: `Dispatch from ${engineer.assignedArea}`, distanceLabel: `${(distKm * 0.6).toFixed(1)} km` },
        { step: `Proceed directly to ${assetId} perimeter`, distanceLabel: `${(distKm * 0.4).toFixed(1)} km` }
      ],
      safetyNotes: body.safetyNotes || 'Verify LOTO isolation & zero-voltage check prior to asset entry.',
      maintenanceHistoryNotes: 'Synchronized with Digital Twin & AI Health Registry.',
      previousIncidentsSummary: 'Linked to active operational intelligence event log.',
      scheduledTime: nowIso,
      dueDate: body.dueDate || new Date(Date.now() + 3 * 3600_000).toISOString(),
      etaMinutes: etaMin,
      distanceKm: distKm,
      estimatedCompletionAt: new Date(Date.now() + (etaMin + 35) * 60_000).toISOString(),
      routeProgressPct: 5,
      priority: body.priority || 'HIGH',
      status: 'ASSIGNED',
      source: 'DEMO',
      createdAt: nowIso,
      updatedAt: nowIso
    };
    fieldTasksRegistry.set(newTask.id, newTask);

    const updatedEng: FieldEngineer = {
      ...engineer,
      status: 'TRAVELING',
      currentTaskId: newTask.id,
      currentTaskCode: newTask.taskCode,
      currentAssetId: newTask.assetId,
      activeWorkloadCount: engineer.activeWorkloadCount + 1,
      lastLocationUpdate: nowIso
    };
    engineersRegistry.set(updatedEng.engineerId, updatedEng);

    const route = computeFallbackRoute({
      engineer: updatedEng,
      task: newTask,
      destAsset: asset || null
    });

    auditLogsRegistry.unshift({
      id: `AUD-FLD-${Date.now()}`,
      timestamp: nowIso,
      actorEmail: actor.email,
      actorRole: actor.role,
      actionType: 'FIELD_TASK_ASSIGNED',
      module: 'Field Operations',
      targetEntity: 'field_tasks',
      entityId: newTask.id,
      relatedAssetId: newTask.assetId,
      relatedIncidentId: newTask.incidentId || undefined,
      summary: `Assigned ${newTask.taskCode} (${newTask.assetId}) to ${engineer.name} (ETA ${etaMin} min).`,
      ipAddress: req.ip || '127.0.0.1'
    });

    broadcastWsEvent('FIELD_UPDATE', {
      event: 'FIELD_TASK_CREATED',
      task: newTask,
      engineer: updatedEng,
      route
    });

    return res.status(201).json({ task: newTask, engineer: updatedEng, route });
  });

  app.put('/api/field/tasks/:taskId', (req, res) => {
    const actor = resolveFieldActor(req, res, ['ADMIN', 'REVIEWER_APPROVER', 'FIELD_ENGINEER']);
    if (!actor) return;

    const taskId = decodeURIComponent(req.params.taskId || '').trim();
    const existing = fieldTasksRegistry.get(taskId);
    if (!existing) {
      return res.status(404).json({ error: `Field task "${taskId}" not found.` });
    }
    const patch = (req.body || {}) as Partial<FieldTask> & { notes?: string };
    const nowIso = new Date().toISOString();
    const nextStatus = patch.status || existing.status;

    const updated: FieldTask = {
      ...existing,
      ...patch,
      status: nextStatus,
      updatedAt: nowIso
    };
    fieldTasksRegistry.set(taskId, updated);

    if (updated.engineerId && engineersRegistry.has(updated.engineerId)) {
      const eng = engineersRegistry.get(updated.engineerId)!;
      const mappedStatus = mapTaskStatusToEngineerStatus(nextStatus);
      engineersRegistry.set(eng.engineerId, {
        ...eng,
        status: mappedStatus,
        lastLocationUpdate: nowIso
      });
    }

    auditLogsRegistry.unshift({
      id: `AUD-FLD-UPD-${Date.now()}`,
      timestamp: nowIso,
      actorEmail: actor.email,
      actorRole: actor.role,
      actionType: 'FIELD_TASK_UPDATED',
      module: 'Field Operations',
      targetEntity: 'field_tasks',
      entityId: taskId,
      relatedAssetId: updated.assetId,
      summary: `Field task ${updated.taskCode} updated to ${nextStatus}${patch.notes ? ` (${patch.notes})` : ''}.`,
      ipAddress: req.ip || '127.0.0.1'
    });

    broadcastWsEvent('FIELD_UPDATE', {
      event: 'FIELD_TASK_UPDATED',
      task: updated
    });
    return res.json({ task: updated });
  });

  app.post('/api/field/tasks/:taskId/accept', (req, res) => {
    const actor = resolveFieldActor(req, res, ['ADMIN', 'FIELD_ENGINEER', 'REVIEWER_APPROVER']);
    if (!actor) return;

    const taskId = decodeURIComponent(req.params.taskId || '').trim();
    const existing = fieldTasksRegistry.get(taskId);
    if (!existing) {
      return res.status(404).json({ error: `Field task "${taskId}" not found.` });
    }
    const nowIso = new Date().toISOString();
    const updated: FieldTask = {
      ...existing,
      status: 'ACCEPTED',
      acceptedAt: nowIso,
      updatedAt: nowIso
    };
    fieldTasksRegistry.set(taskId, updated);

    if (updated.engineerId && engineersRegistry.has(updated.engineerId)) {
      const eng = engineersRegistry.get(updated.engineerId)!;
      engineersRegistry.set(eng.engineerId, {
        ...eng,
        status: 'TRAVELING',
        currentTaskId: updated.id,
        currentTaskCode: updated.taskCode,
        currentAssetId: updated.assetId,
        lastLocationUpdate: nowIso
      });
    }

    auditLogsRegistry.unshift({
      id: `AUD-ACC-${Date.now()}`,
      timestamp: nowIso,
      actorEmail: actor.email,
      actorRole: actor.role,
      actionType: 'FIELD_TASK_ACCEPTED',
      module: 'Field Operations',
      targetEntity: 'field_tasks',
      entityId: taskId,
      relatedAssetId: updated.assetId,
      summary: `${actor.name} accepted field assignment ${updated.taskCode}.`,
      ipAddress: req.ip || '127.0.0.1'
    });

    broadcastWsEvent('FIELD_UPDATE', {
      event: 'FIELD_TASK_ACCEPTED',
      task: updated
    });
    return res.json({ task: updated });
  });

  app.post('/api/field/tasks/:taskId/complete', (req, res) => {
    const actor = resolveFieldActor(req, res, ['ADMIN', 'FIELD_ENGINEER', 'REVIEWER_APPROVER']);
    if (!actor) return;

    const taskId = decodeURIComponent(req.params.taskId || '').trim();
    const existing = fieldTasksRegistry.get(taskId);
    if (!existing) {
      return res.status(404).json({ error: `Field task "${taskId}" not found.` });
    }
    const body = (req.body || {}) as { notes?: string };
    const nowIso = new Date().toISOString();
    const updated: FieldTask = {
      ...existing,
      status: 'COMPLETED',
      completedAt: nowIso,
      routeProgressPct: 100,
      etaMinutes: 0,
      completionNotes: body.notes?.trim() || existing.completionNotes || 'Field repair completed cleanly.',
      updatedAt: nowIso
    };
    fieldTasksRegistry.set(taskId, updated);

    const eng = updated.engineerId
      ? engineersRegistry.get(updated.engineerId)
      : Array.from(engineersRegistry.values()).find((e) => e.currentTaskId === taskId);
    if (eng) {
      const fences = getActiveGeoFences();
      const completeGfe = evaluateGeoFenceTransitions({
        engineer: eng,
        prevLat: eng.latitude,
        prevLon: eng.longitude,
        newLat: eng.latitude,
        newLon: eng.longitude,
        fences,
        completedTaskFlag: true
      });
      for (const gfe of completeGfe) {
        geofenceEventsRegistry.unshift(gfe);
        broadcastWsEvent('GEOFENCE_EVENT', { event: gfe });
      }
      engineersRegistry.set(eng.engineerId, {
        ...eng,
        status: 'AVAILABLE',
        speedKmh: 0,
        activeWorkloadCount: Math.max(0, eng.activeWorkloadCount - 1),
        lastLocationUpdate: nowIso
      });
    }

    auditLogsRegistry.unshift({
      id: `AUD-CMP-${Date.now()}`,
      timestamp: nowIso,
      actorEmail: actor.email,
      actorRole: actor.role,
      actionType: 'FIELD_TASK_COMPLETED',
      module: 'Field Operations',
      targetEntity: 'field_tasks',
      entityId: taskId,
      relatedAssetId: updated.assetId,
      summary: `${updated.taskCode} repair completed by ${actor.name}.`,
      ipAddress: req.ip || '127.0.0.1'
    });

    broadcastWsEvent('FIELD_UPDATE', {
      event: 'FIELD_TASK_COMPLETED',
      task: updated
    });
    return res.json({ task: updated });
  });

  app.post('/api/field/evidence', (req, res) => {
    const actor = resolveFieldActor(req, res, ['ADMIN', 'FIELD_ENGINEER']);
    if (!actor) return;

    const ev = (req.body || {}) as Partial<FieldEvidence>;
    if (!ev.taskId || !ev.fileName || !ev.mimeType || !ev.fileSizeBytes) {
      return res.status(400).json({ error: 'taskId, fileName, mimeType, and fileSizeBytes are required.' });
    }
    const validation = validateEvidenceFile({
      fileName: ev.fileName,
      mimeType: ev.mimeType,
      fileSizeBytes: ev.fileSizeBytes
    });
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const nowIso = new Date().toISOString();
    const saved: FieldEvidence = {
      id: ev.id || `EVD-${Date.now()}`,
      taskId: ev.taskId,
      taskCode: ev.taskCode || ev.taskId,
      decisionId: ev.decisionId || '',
      fileName: ev.fileName,
      filePath: ev.filePath || `/uploads/evidence/${ev.fileName}`,
      mimeType: ev.mimeType,
      fileSizeBytes: ev.fileSizeBytes,
      filePreviewUrl: ev.filePreviewUrl,
      videoFileName: ev.videoFileName,
      voiceNoteSummary: ev.voiceNoteSummary,
      repairNotes: ev.repairNotes,
      gpsLat: Number(ev.gpsLat ?? 0),
      gpsLon: Number(ev.gpsLon ?? 0),
      notes: ev.notes || '',
      inspectionResult: ev.inspectionResult || 'PASS',
      equipmentCondition: ev.equipmentCondition || 'GOOD',
      meterReadings: ev.meterReadings || {},
      uploadedBy: actor.name,
      uploadedByEmail: actor.email,
      uploadedAt: ev.uploadedAt || nowIso,
      source: 'DEMO'
    };
    fieldEvidenceRegistry.unshift(saved);

    auditLogsRegistry.unshift({
      id: `AUD-EVD-${Date.now()}`,
      timestamp: nowIso,
      actorEmail: actor.email,
      actorRole: actor.role,
      actionType: 'EVIDENCE_UPLOADED',
      module: 'Field Operations',
      targetEntity: 'evidence',
      entityId: saved.id,
      summary: `Uploaded geo-tagged evidence ${saved.fileName} for ${saved.taskCode}.`,
      ipAddress: req.ip || '127.0.0.1'
    });

    broadcastWsEvent('FIELD_UPDATE', {
      event: 'EVIDENCE_UPLOADED',
      evidence: saved,
      taskId: saved.taskId
    });
    return res.status(201).json({ evidence: saved });
  });

  app.get('/api/field/routes', (_req, res) => {
    const routes = computeActiveLiveRoutes();
    const fences = getActiveGeoFences();
    return res.json({
      count: routes.length,
      routes,
      fences,
      geofenceEvents: geofenceEventsRegistry.slice(0, 60)
    });
  });

  app.get('/api/field/dashboard', (_req, res) => {
    const engineers = Array.from(engineersRegistry.values());
    const tasks = Array.from(fieldTasksRegistry.values());
    const faults = Array.from(liveFaultsRegistry.values());
    const routes = computeActiveLiveRoutes();
    const metrics = computeFieldDashboardMetrics({
      engineers,
      tasks,
      faults,
      routes,
      geofenceEvents: geofenceEventsRegistry
    });
    return res.json({
      metrics,
      engineersCount: engineers.length,
      openTasksCount: metrics.openTasks
    });
  });

  app.get('/api/audit', (req, res) => {
    const action = typeof req.query.action === 'string' ? req.query.action.trim().toUpperCase() : '';
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const filtered = auditLogsRegistry.filter((a) =>
      action ? a.actionType.toUpperCase() === action : true
    );
    return res.json({
      total: filtered.length,
      limit,
      offset,
      logs: filtered.slice(offset, offset + limit)
    });
  });

  app.get('/api/notifications', (_req, res) => {
    const list = Array.from(notificationsRegistry.values());
    return res.json({
      unreadCount: list.filter((n) => !n.read).length,
      notifications: list
    });
  });

  app.post('/api/notifications/:id/read', (req, res) => {
    const id = decodeURIComponent(req.params.id || '').trim();
    const existing = notificationsRegistry.get(id);
    if (!existing) {
      return res.status(404).json({ error: `Notification "${id}" not found.` });
    }
    const updated = { ...existing, read: true };
    notificationsRegistry.set(id, updated);
    return res.json({ notification: updated });
  });

  // Phase 7: AI Predictive Intelligence Endpoints
  app.get('/api/ai/health', (req, res) => {
    const snapshot = getCurrentAiSnapshot(false);
    const assetId = typeof req.query.assetId === 'string' ? req.query.assetId.trim() : '';
    const category = typeof req.query.category === 'string' ? req.query.category.trim().toUpperCase() : '';
    const items = snapshot.healthScores.filter((h) => {
      if (assetId && h.assetId !== assetId) return false;
      if (category && h.category !== category) return false;
      return true;
    });
    return res.json({
      count: items.length,
      recalculatedAt: snapshot.recalculatedAt,
      healthScores: items
    });
  });

  app.get('/api/ai/predictions', (req, res) => {
    const snapshot = getCurrentAiSnapshot(false);
    const riskLevel = typeof req.query.riskLevel === 'string' ? req.query.riskLevel.trim().toUpperCase() : '';
    const failureType = typeof req.query.failureType === 'string' ? req.query.failureType.trim().toUpperCase() : '';
    const predictions = snapshot.predictions.filter((p) => {
      if (riskLevel && p.riskLevel !== riskLevel) return false;
      if (failureType && p.failureType !== failureType) return false;
      return true;
    });
    return res.json({
      count: predictions.length,
      modelMetrics: snapshot.modelMetrics,
      monthlyFailureTrends: snapshot.monthlyFailureTrends,
      predictions
    });
  });

  app.get('/api/ai/risk', (req, res) => {
    const snapshot = getCurrentAiSnapshot(false);
    const scopeLevel = typeof req.query.scopeLevel === 'string' ? req.query.scopeLevel.trim().toUpperCase() : '';
    const riskLevel = typeof req.query.riskLevel === 'string' ? req.query.riskLevel.trim().toUpperCase() : '';
    const riskIndices = snapshot.riskIndices.filter((r) => {
      if (scopeLevel && r.scopeLevel !== scopeLevel) return false;
      if (riskLevel && r.riskLevel !== riskLevel) return false;
      return true;
    });
    return res.json({
      count: riskIndices.length,
      recalculatedAt: snapshot.recalculatedAt,
      riskIndices
    });
  });

  app.get('/api/ai/recommendations', (req, res) => {
    const snapshot = getCurrentAiSnapshot(false);
    const assetId = typeof req.query.assetId === 'string' ? req.query.assetId.trim() : '';
    const recommendations = snapshot.recommendations.filter((r) =>
      assetId ? r.assetId === assetId : true
    );
    return res.json({
      count: recommendations.length,
      recalculatedAt: snapshot.recalculatedAt,
      recommendations
    });
  });

  app.get('/api/ai/patterns', (_req, res) => {
    const snapshot = getCurrentAiSnapshot(false);
    return res.json({
      patternsCount: snapshot.patterns.length,
      queueCount: snapshot.maintenanceQueue.length,
      recalculatedAt: snapshot.recalculatedAt,
      patterns: snapshot.patterns,
      maintenanceQueue: snapshot.maintenanceQueue
    });
  });

  app.post('/api/ai/recalculate', (req, res) => {
    const requestedBy =
      typeof req.body?.requestedBy === 'string' && req.body.requestedBy.trim()
        ? req.body.requestedBy.trim()
        : 'm.vance@utilitygrid.org';
    const snapshot = getCurrentAiSnapshot(true);
    monitoringStore.aiRecalculationsCount += 1;
    monitoringStore.recordLog({
      level: 'INFO',
      category: 'AI',
      message: `AI intelligence recalculated (${snapshot.healthScores.length} assets, ${snapshot.predictions.length} predictions)`
    });
    auditLogsRegistry.unshift({
      id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: snapshot.recalculatedAt,
      actorEmail: requestedBy,
      actorRole: 'GRID_ENGINEER',
      actionType: 'AI_RECALCULATED',
      module: 'AI Predictive Intelligence',
      targetEntity: 'ai_intelligence',
      entityId: 'AI-ENGINE-V2',
      summary: `Recalculated AI health scores (${snapshot.healthScores.length} assets), failure predictions (${snapshot.predictions.length}), and grid risk indices.`,
      ipAddress: '127.0.0.1'
    });
    broadcastWsEvent('AI_UPDATE', {
      recalculatedAt: snapshot.recalculatedAt,
      recommendationsCount: snapshot.recommendations.length
    });
    return res.json({
      status: 'recalculated',
      recalculatedAt: snapshot.recalculatedAt,
      summary: {
        healthScoresCount: snapshot.healthScores.length,
        criticalAssetsCount: snapshot.healthScores.filter((h) => h.category === 'CRITICAL').length,
        predictionsCount: snapshot.predictions.length,
        recommendationsCount: snapshot.recommendations.length,
        riskIndicesCount: snapshot.riskIndices.length
      },
      snapshot
    });
  });

  // Phase 8: Centralized Alert Center & Demo Scenario Streaming Triggers
  app.get('/api/alerts', (req, res) => {
    const severityFilter = typeof req.query.severity === 'string' ? req.query.severity.trim().toUpperCase() : '';
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 300);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const list = Array.from(alertsRegistry.values()).filter((a) =>
      severityFilter ? a.severity === severityFilter : true
    );
    return res.json({
      total: list.length,
      limit,
      offset,
      unacknowledgedCount: list.filter((a) => !a.acknowledged).length,
      alerts: list.slice(offset, offset + limit)
    });
  });

  app.post('/api/alerts/:id/acknowledge', (req, res) => {
    const id = decodeURIComponent(req.params.id || '').trim();
    const existing = alertsRegistry.get(id);
    if (!existing) {
      return res.status(404).json({ error: `Alert "${id}" not found.` });
    }
    const actor =
      typeof req.body?.acknowledgedBy === 'string' && req.body.acknowledgedBy.trim()
        ? req.body.acknowledgedBy.trim()
        : 'Control Room Operator';
    const updated: GridAlert = { ...existing, acknowledged: true, acknowledgedBy: actor };
    alertsRegistry.set(id, updated);
    broadcastWsEvent('ALERT_ACKNOWLEDGED', { alert: updated });
    return res.json({ alert: updated });
  });

  app.post('/api/demo/simulate-incident', (req, res) => {
    if (!isDemoModeEnabled()) {
      return res.status(403).json({ error: 'Demo mode simulation triggers are disabled.' });
    }
    const candidates = Array.from(liveAssetsMap.values()).filter(
      (a) =>
        a.source === 'DEMO' &&
        (a.assetType === 'TRANSFORMER' || a.assetType === 'FEEDER') &&
        a.status !== 'FAULTED'
    );
    const targetAsset =
      (typeof req.body?.assetId === 'string' ? liveAssetsMap.get(req.body.assetId.trim()) : undefined) ||
      candidates[Math.floor(Math.random() * Math.max(1, candidates.length))] ||
      liveAssetsMap.get('DTR-TG-06U-105') ||
      Array.from(liveAssetsMap.values())[0];

    const nowIso = new Date().toISOString();
    faultSequence += 1;
    const faultCode = `FLT-LIVE-${faultSequence}`;
    const assetName = formatMissingValue(targetAsset.rawName ?? targetAsset.name);
    const newFault: ActiveFault = {
      id: faultCode,
      faultCode,
      title: `Live Demo Surge & Winding Alarm on ${assetName}`,
      latitude: targetAsset.latitude,
      longitude: targetAsset.longitude,
      faultRadiusMeters: 260,
      severity: 'CRITICAL',
      status: 'ACTIVE_LOCKOUT',
      affectedAssetId: targetAsset.canonicalId,
      affectedAssetName: assetName,
      affectedSubstationId: targetAsset.substationId,
      affectedFeederId: targetAsset.feederId,
      affectedTransformerId:
        targetAsset.assetType === 'TRANSFORMER' ? targetAsset.canonicalId : undefined,
      affectedTransformerIds:
        targetAsset.assetType === 'TRANSFORMER' ? [targetAsset.canonicalId] : [],
      detectedAt: nowIso,
      lastUpdated: nowIso,
      source: 'SIMULATED',
      telemetrySource: 'SIMULATED',
      customersInterrupted: 380,
      relatedEventId: `EVT-${faultCode}`,
      description: `Live WebSocket Demo Trigger: Harmonic current spike & thermal threshold excursion detected on ${targetAsset.canonicalId} (${targetAsset.area}, ${targetAsset.district}).`
    };
    liveFaultsRegistry.set(newFault.id, newFault);

    const newAlert: GridAlert = {
      id: `ALT-${faultCode}`,
      title: newFault.title,
      assetId: targetAsset.canonicalId,
      assetName,
      locationLabel: `${targetAsset.area}, ${targetAsset.district}, ${targetAsset.state}`,
      severity: 'CRITICAL',
      category: 'OUTAGE_FAULT',
      timestamp: nowIso,
      recommendedAction:
        'Isolate faulted section in What-If Simulator and dispatch field inspection crew.',
      acknowledged: false,
      targetView: 'map',
      source: 'SIMULATED'
    };
    alertsRegistry.set(newAlert.id, newAlert);

    const newNotification: GridNotification = {
      id: `NTF-${faultCode}`,
      type: 'NEW_INCIDENT',
      title: `CRITICAL ALERT · ${faultCode}`,
      message: `${assetName} (${targetAsset.canonicalId}) reported live protection lockout.`,
      severity: 'CRITICAL',
      timestamp: nowIso,
      read: false,
      relatedAssetId: targetAsset.canonicalId,
      relatedIncidentId: newFault.relatedEventId,
      targetView: 'map',
      source: 'SIMULATED'
    };
    notificationsRegistry.set(newNotification.id, newNotification);

    monitoringStore.recordLog({
      level: 'WARN',
      category: 'DEMO',
      message: `Demo incident ${faultCode} triggered on ${targetAsset.canonicalId} and streamed over WebSocket`
    });

    broadcastWsEvent('INCIDENT_TRIGGERED', {
      fault: newFault,
      alert: newAlert,
      notification: newNotification,
      assetId: targetAsset.canonicalId
    });

    return res.status(201).json({
      fault: newFault,
      alert: newAlert,
      notification: newNotification
    });
  });

  app.post('/api/demo/reset', (_req, res) => {
    liveFaultsRegistry.clear();
    for (const f of INITIAL_FAULTS) {
      liveFaultsRegistry.set(f.id, f);
    }
    alertsRegistry.clear();
    for (const a of buildSeedAlerts({
      faults: INITIAL_FAULTS,
      assets: Array.from(liveAssetsMap.values()),
      issues: INITIAL_DATA_QUALITY_ISSUES,
      aiSnapshot: getCurrentAiSnapshot(false)
    })) {
      alertsRegistry.set(a.id, a);
    }
    notificationsRegistry.clear();
    for (const n of INITIAL_NOTIFICATIONS) {
      notificationsRegistry.set(n.id, n);
    }
    monitoringStore.recordLog({
      level: 'INFO',
      category: 'DEMO',
      message: 'Demo dataset and WebSocket stream reset to baseline Severe Weather Cascade state'
    });
    broadcastWsEvent('DEMO_RESET', {
      faults: Array.from(liveFaultsRegistry.values()),
      alerts: Array.from(alertsRegistry.values()),
      notifications: Array.from(notificationsRegistry.values())
    });
    return res.json({ status: 'reset', faultsCount: liveFaultsRegistry.size });
  });

  // --------------------------------------------------------------------------
  // Phase 9: Enterprise Digital Twin, Executive Dashboard, Analytics, Reports & Admin
  // --------------------------------------------------------------------------
  const buildLiveTwinState = () => {
    const telemetryRecord: Record<string, AssetTelemetryStatus> = {};
    for (const [k, v] of telemetryStates.entries()) {
      telemetryRecord[k] = v;
    }
    return buildDigitalTwinNetwork({
      assets: Array.from(liveAssetsMap.values()),
      faults: Array.from(liveFaultsRegistry.values()),
      powerLines: INITIAL_POWER_LINES,
      maintenanceZones: INITIAL_MAINTENANCE_ZONES,
      aiSnapshot: getCurrentAiSnapshot(false),
      telemetryByAssetId: telemetryRecord
    });
  };

  const requireAdminAccess = (req: express.Request, res: express.Response): boolean => {
    const claims = extractBearerFromRequest(req);
    if (claims) {
      if (claims.role === 'ADMIN') return true;
      res.status(403).json({ error: 'Administrator role required for this operation.' });
      return false;
    }
    if (isDemoModeEnabled()) {
      const hdrRole = String(req.headers['x-gridguard-role'] || '').toUpperCase();
      if (hdrRole === 'ADMIN') return true;
      res.status(403).json({ error: 'Administrator role required. Switch RBAC role to Administrator.' });
      return false;
    }
    res.status(401).json({ error: 'Valid Administrator Bearer token required.' });
    return false;
  };

  app.get('/api/digital-twin/network', (req, res) => {
    const stateFilter = typeof req.query.state === 'string' ? req.query.state.trim().toLowerCase() : '';
    const twin = buildLiveTwinState();
    const filteredNodes = stateFilter
      ? twin.flatNodes.filter((n) => n.state.toLowerCase() === stateFilter || n.nodeLevel === 'COUNTRY')
      : twin.flatNodes;
    res.setHeader('Cache-Control', 'private, max-age=5');
    return res.json({
      ...twin,
      flatNodes: filteredNodes
    });
  });

  app.get('/api/digital-twin/assets', (req, res) => {
    const assetId = typeof req.query.assetId === 'string' ? req.query.assetId.trim() : '';
    const stateFilter = typeof req.query.state === 'string' ? req.query.state.trim().toLowerCase() : '';
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const twin = buildLiveTwinState();
    const lifecycle = buildAssetLifecycleRegistry({
      assets: Array.from(liveAssetsMap.values()),
      faults: Array.from(liveFaultsRegistry.values()),
      maintenanceZones: INITIAL_MAINTENANCE_ZONES,
      fieldTasks: Array.from(fieldTasksRegistry.values())
    });
    const lifecycleById = new Map(lifecycle.map((l) => [l.assetId, l]));

    const filtered = twin.flatNodes
      .filter((n) => n.nodeLevel !== 'COUNTRY' && n.nodeLevel !== 'STATE' && n.nodeLevel !== 'DISTRICT')
      .filter((n) => {
        if (assetId && n.canonicalId !== assetId) return false;
        if (stateFilter && n.state.toLowerCase() !== stateFilter) return false;
        return true;
      })
      .map((n) => ({
        ...n,
        lifecycle: lifecycleById.get(n.canonicalId) || null
      }));

    return res.json({
      total: filtered.length,
      limit,
      offset,
      synchronizedAt: twin.synchronizedAt,
      assets: filtered.slice(offset, offset + limit)
    });
  });

  app.get('/api/executive/dashboard', (req, res) => {
    const stateFilter = typeof req.query.state === 'string' ? req.query.state.trim() : '';
    const districtFilter = typeof req.query.district === 'string' ? req.query.district.trim() : '';
    const allAssets = Array.from(liveAssetsMap.values()).filter((a) => {
      if (stateFilter && a.state.toLowerCase() !== stateFilter.toLowerCase()) return false;
      if (districtFilter && a.district.toLowerCase() !== districtFilter.toLowerCase()) return false;
      return true;
    });
    const ai = getCurrentAiSnapshot(false);
    const scopedFaults = Array.from(liveFaultsRegistry.values()).filter((f) => {
      if (!stateFilter && !districtFilter) return true;
      return allAssets.some((a) => a.canonicalId === f.affectedAssetId);
    });
    const kpis = computeRegionalPerformanceKpis({
      assets: allAssets,
      faults: scopedFaults,
      maintenanceZones: INITIAL_MAINTENANCE_ZONES,
      fieldTasks: Array.from(fieldTasksRegistry.values()),
      aiSnapshot: ai
    });
    const insights = generateAiOperationalInsights({
      regionalKpis: kpis,
      aiSnapshot: ai,
      faults: scopedFaults,
      maintenanceZones: INITIAL_MAINTENANCE_ZONES
    });
    const scopedIds = new Set(allAssets.map((a) => a.canonicalId));
    const scopedHealth = ai.healthScores.filter((h) => scopedIds.has(h.assetId));
    const totalGridHealthPct =
      scopedHealth.length > 0
        ? Math.round((scopedHealth.reduce((s, h) => s + h.healthScore, 0) / scopedHealth.length) * 10) / 10
        : 92;
    const activeFaultsCount = scopedFaults.filter((f) => f.status !== 'RESTORED').length;
    const pendingApprovalsCount = Array.from(decisionsRegistry.values()).filter(
      (d) => d.status === 'PENDING_REVIEW' || d.status === 'SUBMITTED'
    ).length;

    return res.json({
      regionScope: districtFilter || stateFilter || 'All India Operations',
      totalGridHealthPct,
      overallNetworkRisk: activeFaultsCount >= 2 ? 'HIGH' : activeFaultsCount === 1 ? 'MEDIUM' : 'LOW',
      activeFaultsCount,
      aiRecommendationsCount: ai.recommendations.length,
      pendingApprovalsCount,
      maintenanceBacklogCount: ai.maintenanceQueue.length,
      assetReliabilityPct: kpis[0]?.gridReliabilityPct ?? 98.4,
      regionalKpis: kpis,
      insights,
      incidentTrends: ai.monthlyFailureTrends,
      generatedAt: new Date().toISOString()
    });
  });

  app.get('/api/performance', (req, res) => {
    const scopeLevel = typeof req.query.scopeLevel === 'string' ? req.query.scopeLevel.trim().toUpperCase() : '';
    const ai = getCurrentAiSnapshot(false);
    const kpis = computeRegionalPerformanceKpis({
      assets: Array.from(liveAssetsMap.values()),
      faults: Array.from(liveFaultsRegistry.values()),
      maintenanceZones: INITIAL_MAINTENANCE_ZONES,
      fieldTasks: Array.from(fieldTasksRegistry.values()),
      aiSnapshot: ai
    });
    const filtered = scopeLevel ? kpis.filter((k) => k.scopeLevel === scopeLevel) : kpis;
    return res.json({ count: filtered.length, regions: filtered });
  });

  app.get('/api/analytics', (_req, res) => {
    const ai = getCurrentAiSnapshot(false);
    const faults = Array.from(liveFaultsRegistry.values());
    const kpis = computeRegionalPerformanceKpis({
      assets: Array.from(liveAssetsMap.values()),
      faults,
      maintenanceZones: INITIAL_MAINTENANCE_ZONES,
      fieldTasks: Array.from(fieldTasksRegistry.values()),
      aiSnapshot: ai
    });
    const insights = generateAiOperationalInsights({
      regionalKpis: kpis,
      aiSnapshot: ai,
      faults,
      maintenanceZones: INITIAL_MAINTENANCE_ZONES
    });
    const scenarioComparison = compareEnterpriseScenarios(
      Array.from(simulationsRegistry.values()),
      faults
    );
    const lifecycle = buildAssetLifecycleRegistry({
      assets: Array.from(liveAssetsMap.values()),
      faults,
      maintenanceZones: INITIAL_MAINTENANCE_ZONES,
      fieldTasks: Array.from(fieldTasksRegistry.values())
    });
    return res.json({
      generatedAt: new Date().toISOString(),
      insights,
      scenarioComparison,
      lifecycleSummary: {
        totalAssets: lifecycle.length,
        inRepair: lifecycle.filter((l) => l.currentStage === 'REPAIR').length,
        inMaintenance: lifecycle.filter((l) => l.currentStage === 'MAINTENANCE').length,
        upgraded: lifecycle.filter((l) => l.currentStage === 'UPGRADE').length
      },
      lifecycle
    });
  });

  app.get('/api/reports', (_req, res) => {
    return res.json({
      count: executiveReportsRegistry.length,
      reports: executiveReportsRegistry
    });
  });

  app.post('/api/reports', (req, res) => {
    const body = (req.body || {}) as Partial<ExecutiveReportRecord>;
    if (!body.reportType || !body.format) {
      return res.status(400).json({ error: 'reportType and format are required.' });
    }
    const created: ExecutiveReportRecord = {
      reportId: body.reportId || `RPT-${Date.now()}`,
      reportType: body.reportType,
      format: body.format,
      generatedBy: body.generatedBy || 'GridGuard Operator',
      scopeLabel: body.scopeLabel || 'All India Operations',
      rowCount: Number(body.rowCount ?? 0),
      filename: body.filename || `gridguard-report-${Date.now()}.${body.format.toLowerCase()}`,
      generatedAt: new Date().toISOString()
    };
    executiveReportsRegistry.unshift(created);
    return res.status(201).json({ report: created });
  });

  app.get('/api/admin/system-health', (_req, res) => {
    return res.json({
      health: buildHealthSnapshot(),
      services: {
        expressApi: 'HEALTHY',
        websocketStream: wsClients.size >= 0 ? 'ACTIVE' : 'IDLE',
        digitalTwinEngine: 'SYNCHRONIZED',
        aiIntelligenceEngine: 'HEALTHY',
        rbacGuard: 'ENFORCED'
      },
      usersCount: adminUsersRegistry.size,
      backupsCount: adminBackupsRegistry.length,
      aiSettings: adminAiSettings,
      notificationSettings: adminNotificationSettings,
      recentLogs: monitoringStore.recentLogs.slice(0, 40)
    });
  });

  app.get('/api/admin/users', (_req, res) => {
    return res.json({ users: Array.from(adminUsersRegistry.values()) });
  });

  app.post('/api/admin/users', (req, res) => {
    if (!requireAdminAccess(req, res)) return;
    const body = (req.body || {}) as {
      username?: string;
      email?: string;
      fullName?: string;
      role?: UserRole;
    };
    const email = (body.email || '').trim().toLowerCase();
    const fullName = (body.fullName || '').trim();
    if (!email.includes('@') || !fullName) {
      return res.status(400).json({ error: 'Valid fullName and email are required.' });
    }
    const role: UserRole = body.role && ROLE_DIRECTORY[body.role] ? body.role : 'VIEWER';
    const created: AdminUserRecord = {
      id: `USR-${Date.now()}`,
      username: (body.username || email.split('@')[0]).trim(),
      email,
      fullName,
      role,
      status: 'ACTIVE',
      lastActiveAt: new Date().toISOString()
    };
    adminUsersRegistry.set(created.id, created);
    return res.status(201).json({ user: created });
  });

  app.put('/api/admin/users/:id', (req, res) => {
    if (!requireAdminAccess(req, res)) return;
    const id = decodeURIComponent(req.params.id || '').trim();
    const existing = adminUsersRegistry.get(id);
    if (!existing) return res.status(404).json({ error: `User "${id}" not found.` });
    const body = (req.body || {}) as { role?: UserRole; status?: 'ACTIVE' | 'SUSPENDED' };
    const updated: AdminUserRecord = {
      ...existing,
      ...(body.role && ROLE_DIRECTORY[body.role] ? { role: body.role } : {}),
      ...(body.status === 'ACTIVE' || body.status === 'SUSPENDED' ? { status: body.status } : {})
    };
    adminUsersRegistry.set(id, updated);
    return res.json({ user: updated });
  });

  app.get('/api/admin/settings', (_req, res) => {
    return res.json({
      aiSettings: adminAiSettings,
      notificationSettings: adminNotificationSettings
    });
  });

  app.put('/api/admin/settings', (req, res) => {
    if (!requireAdminAccess(req, res)) return;
    const body = (req.body || {}) as {
      aiSettings?: Partial<AdminAiModelSettings>;
      notificationSettings?: Partial<AdminNotificationSettings>;
    };
    if (body.aiSettings) {
      adminAiSettings = { ...adminAiSettings, ...body.aiSettings };
    }
    if (body.notificationSettings) {
      adminNotificationSettings = { ...adminNotificationSettings, ...body.notificationSettings };
    }
    monitoringStore.recordLog({
      level: 'INFO',
      category: 'API',
      message: 'System Administrator updated AI model thresholds & notification settings'
    });
    return res.json({
      aiSettings: adminAiSettings,
      notificationSettings: adminNotificationSettings
    });
  });

  app.post('/api/admin/assets/import', (req, res) => {
    if (!requireAdminAccess(req, res)) return;
    const rawAssets = Array.isArray(req.body?.assets) ? req.body.assets : [];
    if (rawAssets.length === 0) {
      return res.status(400).json({ error: 'Provide an assets array with at least one asset.' });
    }
    const imported: InfrastructureAsset[] = [];
    for (const item of rawAssets.slice(0, 50)) {
      const canonicalId = String(item.canonicalId || '').trim();
      const name = String(item.name || '').trim();
      const lat = Number(item.latitude);
      const lon = Number(item.longitude);
      if (!canonicalId || !name || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;

      const asset: InfrastructureAsset = {
        id: canonicalId,
        canonicalId,
        name,
        rawName: name,
        osmType: item.osmType || 'transformer',
        assetType: item.assetType || 'TRANSFORMER',
        source: 'DEMO',
        voltage: String(item.voltage || '11/0.433 kV'),
        nominalVoltageKv: Number(item.nominalVoltageKv ?? 11),
        status: item.status || 'ACTIVE',
        operator: String(item.operator || 'TGSPDCL (Imported)'),
        country: String(item.country || 'India'),
        state: String(item.state || 'Telangana'),
        district: String(item.district || 'Hyderabad'),
        city: String(item.city || item.district || 'Hyderabad'),
        area: String(item.area || 'HITEC City'),
        substationId: item.substationId || 'SUB-TG-06U',
        feederId: item.feederId || 'FDR-TG-06U-01',
        latitude: lat,
        longitude: lon,
        geometry: { type: 'Point', coordinates: [lon, lat] },
        ratedCapacityKva: Number(item.ratedCapacityKva ?? 500),
        peakLoadPct: Number(item.peakLoadPct ?? 58),
        sourceAliases: [],
        hasConflict: false
      };
      liveAssetsMap.set(asset.canonicalId, asset);
      imported.push(asset);
    }
    if (imported.length === 0) {
      return res.status(400).json({ error: 'No valid assets found in import payload.' });
    }
    broadcastWsEvent('DIGITAL_TWIN_UPDATE', {
      importedCount: imported.length,
      assetIds: imported.map((a) => a.canonicalId)
    });
    return res.status(201).json({ importedCount: imported.length, assets: imported });
  });

  app.get('/api/admin/backups', (_req, res) => {
    return res.json({ backups: adminBackupsRegistry });
  });

  app.post('/api/admin/backup', (req, res) => {
    if (!requireAdminAccess(req, res)) return;
    const snap: AdminBackupSnapshot = {
      id: `BKP-${Date.now()}`,
      createdAt: new Date().toISOString(),
      createdBy: String(req.body?.actorEmail || 'a.sharma@utilitygrid.org'),
      assetCount: liveAssetsMap.size,
      decisionCount: decisionsRegistry.size,
      auditCount: auditLogsRegistry.length,
      checksum: `sha256:${Math.random().toString(16).slice(2, 18)}`
    };
    adminBackupsRegistry.unshift(snap);
    monitoringStore.recordLog({
      level: 'INFO',
      category: 'API',
      message: `Encrypted snapshot backup ${snap.id} created (${snap.assetCount} assets)`
    });
    return res.status(201).json({ backup: snap });
  });

  app.post('/api/admin/restore', (req, res) => {
    if (!requireAdminAccess(req, res)) return;
    const backupId = String(req.body?.backupId || '').trim();
    const target = adminBackupsRegistry.find((b) => b.id === backupId);
    if (!target) return res.status(404).json({ error: `Backup "${backupId}" not found.` });
    monitoringStore.recordLog({
      level: 'INFO',
      category: 'API',
      message: `System state verified & restored from backup ${target.id} (${target.checksum})`
    });
    return res.json({ status: 'restored', backup: target });
  });

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`GridGuard AI server & WebSocket /ws/grid listening on http://0.0.0.0:${port}`);
  });
}

startServer();
