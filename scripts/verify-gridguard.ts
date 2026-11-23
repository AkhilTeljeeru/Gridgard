import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
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
  getConnectedPathForAsset
} from '../src/services/syntheticData.ts';
import {
  DEFAULT_GEO_FILTER,
  INDIA_CENTER,
  INDIA_ZOOM,
  INITIAL_MAP_CENTER,
  INITIAL_MAP_ZOOM,
  computeScopedMapDisplay,
  filterAssetsByHierarchy,
  scopePlatformData
} from '../src/services/geographyService.ts';
import { GEOGRAPHIC_BOUNDARIES } from '../src/services/geographyBoundariesData.ts';
import {
  buildHierarchicalKnowledgeGraph,
  getHierarchicalConnectedNodeIds,
  buildRootCauseAnalysis
} from '../src/services/intelligenceService.ts';
import {
  compareSimulationScenarios,
  executeWhatIfSimulation
} from '../src/services/simulationEngine.ts';
import {
  computeGovernanceAnalytics,
  getRolePermissions,
  isChecklistComplete,
  validateEvidenceFile
} from '../src/services/governanceHelpers.ts';
import {
  buildAssetAiTimeline,
  computeAiIntelligenceSnapshot
} from '../src/services/aiIntelligenceEngine.ts';
import {
  buildCsvContent,
  buildReportTable,
  sanitizeSpreadsheetCell
} from '../src/services/exportReportsService.ts';
import {
  buildAssetLifecycleRegistry,
  buildDigitalTwinNetwork,
  compareEnterpriseScenarios,
  computeRegionalPerformanceKpis,
  generateAiOperationalInsights,
  traceDigitalTwinDependencies
} from '../src/services/digitalTwinEngine.ts';
import {
  buildSeedAlerts,
  hashUserPassword,
  registerServerUser,
  authenticateServerUser,
  revokeRefreshJwt,
  signJwtToken,
  verifyJwtToken,
  verifyUserPassword
} from '../server/securityAndMetrics.ts';
import {
  INITIAL_FIELD_ENGINEERS,
  buildGeoFencesForGrid,
  buildLiveIncidentTimeline,
  computeFallbackRoute,
  computeFieldDashboardMetrics,
  evaluateGeoFenceTransitions,
  mapTaskStatusToEngineerStatus,
  recommendEngineersForAsset
} from '../src/services/fieldOperationsEngine.ts';
import type { ExportReportType, SimulationType } from '../src/types/grid.ts';

function runTests() {
  console.log('Running GridGuard AI Canonical Data, Parity & Sync Verification...');

  // 1. Canonical ID & DEMO Source Verification across all seed datasets
  assert.ok(INITIAL_ASSETS.length >= 15, 'Expected realistic Indian DEMO asset catalog');
  for (const asset of INITIAL_ASSETS) {
    assert.equal(asset.id, asset.canonicalId, `Asset ${asset.id} must use id === canonicalId`);
    assert.equal(asset.source, 'DEMO', `Seed asset ${asset.canonicalId} must have source === "DEMO"`);

    if (asset.assetType === 'SUBSTATION') {
      assert.ok(
        asset.voltage === '132/33 kV' || asset.voltage === '33/11 kV',
        `Substation ${asset.canonicalId} must have realistic Indian voltage rating (got "${asset.voltage}")`
      );
    }
    if (asset.assetType === 'FEEDER') {
      assert.equal(asset.voltage, '11 kV', `Feeder ${asset.canonicalId} should be 11 kV`);
    }
    if (asset.assetType === 'TRANSFORMER') {
      assert.equal(asset.voltage, '11/0.433 kV', `Transformer ${asset.canonicalId} should be 11/0.433 kV`);
    }
  }

  for (const line of INITIAL_POWER_LINES) {
    assert.equal(line.id, line.canonicalId, `PowerLine ${line.id} must use id === canonicalId`);
    assert.equal(line.source, 'DEMO', `Seed PowerLine ${line.canonicalId} must be DEMO`);
  }

  for (const fault of INITIAL_FAULTS) {
    assert.equal(fault.source, 'DEMO', `Seed fault ${fault.id} must have source === "DEMO"`);
    assert.ok(
      INITIAL_ASSETS.some((a) => a.canonicalId === fault.affectedAssetId),
      `Fault ${fault.id} affectedAssetId (${fault.affectedAssetId}) must exist in INITIAL_ASSETS`
    );
  }

  for (const dqi of INITIAL_DATA_QUALITY_ISSUES) {
    assert.equal(dqi.source, 'DEMO', `Seed DataQualityIssue ${dqi.id} must have source === "DEMO"`);
    assert.ok(
      INITIAL_ASSETS.some((a) => a.canonicalId === dqi.canonicalAssetId),
      `DataQualityIssue ${dqi.id} canonicalAssetId must exist in INITIAL_ASSETS`
    );
  }

  for (const evt of INITIAL_OPERATIONAL_EVENTS) {
    assert.equal(evt.source, 'DEMO', `Seed OperationalEvent ${evt.id} must have source === "DEMO"`);
    assert.ok(
      INITIAL_ASSETS.some((a) => a.canonicalId === evt.assetCanonicalId),
      `OperationalEvent ${evt.id} assetCanonicalId must exist in INITIAL_ASSETS`
    );
  }

  for (const zone of INITIAL_MAINTENANCE_ZONES) {
    assert.equal(zone.source, 'DEMO', `Seed MaintenanceZone ${zone.id} must have source === "DEMO"`);
  }
  for (const scen of INITIAL_SIMULATION_SCENARIOS) {
    assert.equal(scen.source, 'DEMO', `Seed SimulationScenario ${scen.id} must have source === "DEMO"`);
  }
  for (const dec of INITIAL_ENGINEERING_DECISIONS) {
    assert.equal(dec.source, 'DEMO', `Seed EngineeringDecision ${dec.id} must have source === "DEMO"`);
  }

  // 2. PostgreSQL Schema & Neo4j Cypher Canonical ID Alignment
  const canonicalIdsToCheck = [
    'SUB-TG-06U',
    'SUB-TG-07D',
    'FDR-TG-06U-01',
    'FDR-TG-06U-02',
    'FDR-TG-07D-01',
    'CB-TG-06U-01',
    'SW-TG-06U-14',
    'DTR-TG-06U-104',
    'DTR-TG-06U-108',
    'DTR-TG-07D-201'
  ];

  const pgSchema = fs.readFileSync(path.resolve('docs/POSTGRES_SCHEMA.sql'), 'utf8');
  const neo4jCypher = fs.readFileSync(path.resolve('docs/NEO4J_GRAPH_MODEL.cypher'), 'utf8');

  assert.ok(pgSchema.includes('asset_source_enum'), 'POSTGRES_SCHEMA.sql must define asset_source_enum');
  assert.ok(pgSchema.includes("'DEMO'"), 'POSTGRES_SCHEMA.sql must seed DEMO source');

  for (const cid of canonicalIdsToCheck) {
    assert.ok(
      pgSchema.includes(cid),
      `docs/POSTGRES_SCHEMA.sql must include canonical ID ${cid}`
    );
    assert.ok(
      neo4jCypher.includes(cid),
      `docs/NEO4J_GRAPH_MODEL.cypher must include canonical ID ${cid}`
    );
  }

  // 3. 1:1 Count Parity between Map Markers and Details Panel Counts across Scopes
  const scopes = [
    { label: 'All India', filter: DEFAULT_GEO_FILTER },
    { label: 'Telangana / Hyderabad', filter: { ...DEFAULT_GEO_FILTER, state: 'Telangana', district: 'Hyderabad' } },
    { label: 'Karnataka / Bengaluru', filter: { ...DEFAULT_GEO_FILTER, state: 'Karnataka', district: 'Bengaluru Urban' } },
    { label: 'Substation SUB-TG-06U', filter: { ...DEFAULT_GEO_FILTER, state: 'Telangana', district: 'Hyderabad', substationId: 'SUB-TG-06U' } }
  ];

  for (const scope of scopes) {
    const scoped = scopePlatformData({
      filter: scope.filter,
      assets: INITIAL_ASSETS,
      faults: INITIAL_FAULTS,
      maintenanceZones: INITIAL_MAINTENANCE_ZONES,
      powerLines: INITIAL_POWER_LINES,
      boundaries: GEOGRAPHIC_BOUNDARIES,
      issues: INITIAL_DATA_QUALITY_ISSUES,
      events: INITIAL_OPERATIONAL_EVENTS,
      scenarios: INITIAL_SIMULATION_SCENARIOS,
      decisions: INITIAL_ENGINEERING_DECISIONS,
      auditLogs: [],
      baseStats: {
        totalAssets: INITIAL_ASSETS.length,
        dataQualityScore: 95.8,
        activeConflictsCount: 2,
        reconstructedEventsCount: 2,
        activeScenariosCount: 1,
        pendingApprovalsCount: 1,
        orphanedAssetsCount: 0
      }
    });

    const directDisplay = computeScopedMapDisplay(scoped.scopedAssets, scoped.scopedPowerLines);
    assert.deepEqual(scoped.scopedDisplay.counts, directDisplay.counts);

    const renderedSubstations = directDisplay.displayAssets.filter(
      (a) => a.assetType === 'SUBSTATION' || a.assetType === 'PLANT'
    ).length;
    const renderedTransformers = directDisplay.displayAssets.filter(
      (a) => a.assetType === 'TRANSFORMER'
    ).length;
    const renderedSwitches = directDisplay.displayAssets.filter(
      (a) =>
        a.assetType === 'CIRCUIT_BREAKER' ||
        a.assetType === 'SECTIONALIZER' ||
        a.assetType === 'RECLOSER' ||
        a.osmType === 'switch'
    ).length;

    assert.equal(
      directDisplay.counts.substations,
      renderedSubstations,
      `${scope.label}: substations count must match rendered substation markers`
    );
    assert.equal(
      directDisplay.counts.transformers,
      renderedTransformers,
      `${scope.label}: transformers count must match rendered transformer markers`
    );
    assert.equal(
      directDisplay.counts.breakersAndSwitches,
      renderedSwitches,
      `${scope.label}: breakersAndSwitches count must match rendered switch/breaker markers`
    );
    assert.ok(
      directDisplay.counts.feeders >= directDisplay.displayPowerLines.length,
      `${scope.label}: feeders count must match feeder assets/lines`
    );
  }

  // Verify SUB-TG-06U exact hierarchy counts
  const sub06Scoped = filterAssetsByHierarchy(INITIAL_ASSETS, {
    state: 'Telangana',
    district: 'Hyderabad',
    substationId: 'SUB-TG-06U'
  });
  const sub06Display = computeScopedMapDisplay(
    sub06Scoped,
    INITIAL_POWER_LINES.filter((l) => l.substationId === 'SUB-TG-06U')
  );
  assert.equal(sub06Display.counts.substations, 1);
  assert.equal(sub06Display.counts.feeders, 2);
  assert.equal(sub06Display.counts.transformers, 2);
  assert.equal(sub06Display.counts.breakersAndSwitches, 2);

  // 4. Connected Path Resolution (Substation -> Feeder -> Transformer)
  const pathFromDtr = getConnectedPathForAsset('DTR-TG-06U-104', INITIAL_ASSETS, INITIAL_POWER_LINES);
  assert.ok(pathFromDtr.nodeIds.has('SUB-TG-06U'), 'Connected path must include upstream Substation SUB-TG-06U');
  assert.ok(pathFromDtr.nodeIds.has('FDR-TG-06U-01'), 'Connected path must include Feeder FDR-TG-06U-01');
  assert.ok(pathFromDtr.nodeIds.has('DTR-TG-06U-104'), 'Connected path must include selected DTR-TG-06U-104');
  assert.ok(pathFromDtr.nodeIds.has('CB-TG-06U-01'), 'Connected path must include feeder breaker CB-TG-06U-01');
  assert.ok(pathFromDtr.lineIds.has('FDR-TG-06U-01'), 'Connected lineIds must include FDR-TG-06U-01');

  // 5. "Not available" Missing Value Formatting
  assert.equal(formatMissingValue(null), 'Not available');
  assert.equal(formatMissingValue(undefined), 'Not available');
  assert.equal(formatMissingValue(''), 'Not available');
  assert.equal(formatMissingValue('N/A'), 'Not available');
  assert.equal(formatMissingValue('Unknown'), 'Not available');
  assert.equal(formatMissingValue('Not mapped'), 'Not available');
  assert.equal(formatMissingValue(0, ' kW'), '0 kW');
  assert.equal(formatMissingValue('132/33 kV'), '132/33 kV');

  const dtr201 = INITIAL_ASSETS.find((a) => a.canonicalId === 'DTR-TG-07D-201');
  assert.ok(dtr201, 'DTR-TG-07D-201 must exist');
  assert.equal(formatMissingValue(dtr201.lastInspectionDate), 'Not available');

  // 6. Fault Markers & Event Reconstruction Timelines (Part A/B/C)
  assert.equal(INITIAL_FAULTS.length, 3, 'Expected 3 seeded DEMO faults');
  assert.equal(
    INITIAL_EVENT_RECONSTRUCTIONS.length,
    3,
    'Expected 3 event reconstruction cascades corresponding to the 3 demo faults'
  );

  for (const fault of INITIAL_FAULTS) {
    assert.equal(fault.source, 'DEMO');
    assert.ok((fault.faultRadiusMeters ?? 0) > 0, `Fault ${fault.id} must define faultRadiusMeters`);
    assert.ok(
      (fault.affectedTransformerIds?.length ?? 0) > 0,
      `Fault ${fault.id} must define affectedTransformerIds`
    );
    const matchingRecon = INITIAL_EVENT_RECONSTRUCTIONS.find((r) => r.faultId === fault.id);
    assert.ok(matchingRecon, `Fault ${fault.id} must link to an EventReconstructionIncident`);
  }

  for (const recon of INITIAL_EVENT_RECONSTRUCTIONS) {
    assert.equal(recon.source, 'DEMO');
    assert.ok(recon.steps.length >= 4, `Reconstruction ${recon.id} must contain ordered steps`);
    assert.ok(
      recon.affectedAreaPolygon.length >= 4,
      `Reconstruction ${recon.id} must define an affectedAreaPolygon`
    );

    let prevTime = 0;
    for (const step of recon.steps) {
      assert.ok(
        INITIAL_ASSETS.some((a) => a.canonicalId === step.assetId),
        `Step ${step.stepId} assetId (${step.assetId}) must exist in INITIAL_ASSETS`
      );
      const t = Date.parse(step.timestamp);
      assert.ok(Number.isFinite(t) && t >= prevTime, `Steps in ${recon.id} must be chronological`);
      prevTime = t;
    }

    const payload = buildEventReconstructionPayload(recon, INITIAL_ASSETS, INITIAL_POWER_LINES);
    assert.equal(payload.mapGeometry.type, 'FeatureCollection');
    assert.ok(
      payload.mapGeometry.features.some((f) => f.geometry.type === 'Polygon'),
      `Payload for ${recon.id} must include GeoJSON Polygon affected area`
    );
  }

  const mumbaiRecon = INITIAL_EVENT_RECONSTRUCTIONS.find((r) => r.id === 'EVT-MH-01U-01');
  assert.ok(mumbaiRecon, 'EVT-MH-01U-01 must exist');
  const mumbaiPayload = buildEventReconstructionPayload(
    mumbaiRecon,
    INITIAL_ASSETS,
    INITIAL_POWER_LINES
  );
  assert.equal(
    mumbaiPayload.affectedConsumersDisplay,
    'Not available',
    'Null affectedConsumersCount must format to "Not available"'
  );

  const dtr104 = INITIAL_ASSETS.find((a) => a.canonicalId === 'DTR-TG-06U-104');
  assert.ok(dtr104, 'DTR-TG-06U-104 must exist');
  assert.equal(formatMissingValue(dtr104.installationDate), '2021-04-12');
  assert.equal(formatMissingValue(dtr201.installationDate), 'Not available');

  // 7. Phase 2 Mapbox Defaults (India center [22.9734, 78.6569], zoom 5)
  assert.deepEqual(INITIAL_MAP_CENTER, INDIA_CENTER, 'Initial map center must match INDIA_CENTER');
  assert.equal(INITIAL_MAP_CENTER[0], 22.9734);
  assert.equal(INITIAL_MAP_CENTER[1], 78.6569);
  assert.equal(INITIAL_MAP_ZOOM, INDIA_ZOOM);
  assert.equal(INITIAL_MAP_ZOOM, 5);

  // 8. Phase 4 Intelligence Layer: 7-Tier Knowledge Graph & Root Cause Analysis Synchronization
  const graph7Tier = buildHierarchicalKnowledgeGraph({
    assets: INITIAL_ASSETS,
    allAssets: INITIAL_ASSETS,
    telemetryByAssetId: {},
    faults: INITIAL_FAULTS,
    reconstructions: INITIAL_EVENT_RECONSTRUCTIONS,
    includeGeoAndConsumerTiers: true
  });

  const expectedNodeTypes = [
    'STATE',
    'DISTRICT',
    'SUBSTATION',
    'FEEDER',
    'TRANSFORMER',
    'SECTIONALIZER',
    'CONSUMER_CLUSTER'
  ];
  for (const nodeType of expectedNodeTypes) {
    assert.ok(
      graph7Tier.nodes.some((n) => n.data.type === nodeType),
      `7-Tier Knowledge Graph must contain nodes of type ${nodeType}`
    );
  }

  for (const { data: node } of graph7Tier.nodes) {
    assert.ok(node.canonicalId.length > 0, 'Graph node must carry canonicalId');
    assert.ok(node.assetName.length > 0, 'Graph node must carry assetName');
    assert.ok(node.type.length > 0, 'Graph node must carry type');
    assert.ok(node.status.length > 0, 'Graph node must carry status');
    assert.ok(node.geographicLocation.length > 0, 'Graph node must carry geographicLocation');
    assert.ok(node.source.length > 0, 'Graph node must carry source badge');
  }

  const edgeLabels = new Set(graph7Tier.edges.map((e) => e.data.label));
  for (const expectedEdge of [
    'CONTAINS_DISTRICT',
    'SERVES_SUBSTATION',
    'FEEDS',
    'FEEDS_DTR',
    'SUPPLIES_CLUSTER'
  ]) {
    assert.ok(
      edgeLabels.has(expectedEdge),
      `7-Tier Knowledge Graph must include ${expectedEdge} connectivity edges`
    );
  }

  const connectedFromDtr104 = getHierarchicalConnectedNodeIds(
    'DTR-TG-06U-104',
    graph7Tier.nodes,
    graph7Tier.edges,
    INITIAL_ASSETS,
    INITIAL_POWER_LINES
  );
  for (const expectedConnectedId of [
    'GEO-STATE-TELANGANA',
    'GEO-DIST-TELANGANA-HYDERABAD',
    'SUB-TG-06U',
    'FDR-TG-06U-01',
    'DTR-TG-06U-104',
    'SW-TG-06U-14',
    'CLU-DTR-TG-06U-104'
  ]) {
    assert.ok(
      connectedFromDtr104.has(expectedConnectedId),
      `Connected chain for DTR-TG-06U-104 must include ${expectedConnectedId}`
    );
  }

  const rcaHyd = buildRootCauseAnalysis({
    selectedAssetId: 'DTR-TG-06U-104',
    selectedFaultId: 'FLT-TG-06U-01',
    selectedReconstructionId: 'EVT-TG-06U-01',
    assets: INITIAL_ASSETS,
    powerLines: INITIAL_POWER_LINES,
    faults: INITIAL_FAULTS,
    reconstructions: INITIAL_EVENT_RECONSTRUCTIONS,
    events: INITIAL_OPERATIONAL_EVENTS,
    issues: INITIAL_DATA_QUALITY_ISSUES,
    telemetryByAssetId: {}
  });
  assert.equal(rcaHyd.canonicalAssetId, 'DTR-TG-06U-104');
  assert.equal(rcaHyd.faultId, 'FLT-TG-06U-01');
  assert.equal(rcaHyd.incidentId, 'EVT-TG-06U-01');
  assert.equal(rcaHyd.feederId, 'FDR-TG-06U-01');
  assert.equal(rcaHyd.recommendedTargetFeederId, 'FDR-TG-06U-02');
  assert.equal(rcaHyd.recommendedTieSwitchId, 'SW-TG-06U-14');
  assert.ok(rcaHyd.protectionSequence.length >= 4, 'RCA must include chronological protection steps');

  const rcaMumbai = buildRootCauseAnalysis({
    selectedAssetId: 'DTR-MH-01U-401',
    selectedFaultId: null,
    selectedReconstructionId: 'EVT-MH-01U-01',
    assets: INITIAL_ASSETS,
    powerLines: INITIAL_POWER_LINES,
    faults: INITIAL_FAULTS,
    reconstructions: INITIAL_EVENT_RECONSTRUCTIONS,
    events: INITIAL_OPERATIONAL_EVENTS,
    issues: INITIAL_DATA_QUALITY_ISSUES,
    telemetryByAssetId: {}
  });
  assert.equal(rcaMumbai.affectedConsumersCount, null);
  assert.ok(
    rcaMumbai.consumerClusterLabel.includes('Not available'),
    'Null affectedConsumersCount must format cleanly as Not available in RCA consumerClusterLabel'
  );

  // 9. Phase 5: What-If Simulation & Decision Intelligence Engine
  const simContext = {
    assets: INITIAL_ASSETS,
    powerLines: INITIAL_POWER_LINES,
    faults: INITIAL_FAULTS,
    reconstructions: INITIAL_EVENT_RECONSTRUCTIONS,
    issues: INITIAL_DATA_QUALITY_ISSUES
  };

  const simTypes: SimulationType[] = [
    'FEEDER_TRANSFER',
    'TRANSFORMER_ISOLATION',
    'PLANNED_MAINTENANCE',
    'ALTERNATIVE_SUPPLY',
    'LOAD_REDISTRIBUTION'
  ];

  const executedScenarios = simTypes.map((scenarioType, idx) => {
    const scenario = executeWhatIfSimulation(
      {
        scenarioType,
        substationId: 'SUB-TG-06U',
        sourceFeeder: 'FDR-TG-06U-01',
        targetFeeder: 'FDR-TG-06U-02',
        transformerId: 'DTR-TG-06U-104',
        tieSwitch: 'SW-TG-06U-14',
        loadTransferPct: 60,
        loadTransferMva: 3.4,
        expectedDurationMin: 15 + idx * 5
      },
      simContext,
      {
        id: `TEST-SIM-${idx + 1}`,
        scenarioCode: `TEST-SIM-00${idx + 1}`,
        source: 'SIMULATED'
      }
    );
    assert.equal(scenario.scenarioType, scenarioType);
    assert.equal(scenario.recommendation.advisoryOnly, true, 'Simulations must be strictly advisoryOnly');
    assert.ok(scenario.riskAssessment.reasons.length > 0, 'Risk assessment must include explainable reasons');
    assert.ok(scenario.recommendation.reasons.length > 0, 'Recommendation must include explainable reasons');
    assert.ok(scenario.impactAnalysis.equipmentUtilization.length >= 2, 'Before/After equipment table must be populated');
    assert.ok(scenario.mapOverlay.proposedFeederPath.length >= 2, 'Map overlay must include proposedFeederPath');
    assert.ok(scenario.mapOverlay.affectedAreaPolygon.length >= 3, 'Map overlay must include affectedAreaPolygon');
    return scenario;
  });

  // Verify isolation scenario marks DTR-TG-06U-104 as isolated
  const isolationScenario = executedScenarios.find(
    (s) => s.scenarioType === 'TRANSFORMER_ISOLATION'
  );
  assert.ok(isolationScenario, 'TRANSFORMER_ISOLATION scenario must execute');
  assert.ok(
    isolationScenario.mapOverlay.isolatedAssetIds.includes('DTR-TG-06U-104'),
    'TRANSFORMER_ISOLATION must flag DTR-TG-06U-104 in isolatedAssetIds'
  );

  // Verify thermal overload triggers HIGH risk
  const overloadScenario = executeWhatIfSimulation(
    {
      scenarioType: 'FEEDER_TRANSFER',
      sourceFeeder: 'FDR-TG-06U-01',
      targetFeeder: 'FDR-TG-06U-02',
      tieSwitch: 'SW-TG-06U-14',
      loadTransferMva: 9.8
    },
    simContext,
    { id: 'TEST-SIM-OVERLOAD', scenarioCode: 'TEST-SIM-OVERLOAD', source: 'SIMULATED' }
  );
  assert.equal(overloadScenario.thermalViolation, true, '9.8 MVA transfer onto 6.2/14.0 MVA feeder must cause thermalViolation');
  assert.equal(overloadScenario.riskAssessment.level, 'HIGH', 'Thermal violation must trigger HIGH risk');

  // Verify multi-scenario comparison ranks lowest risk / lowest outage first
  const comparison = compareSimulationScenarios([overloadScenario, executedScenarios[0]]);
  assert.equal(
    comparison.recommendedScenarioId,
    executedScenarios[0].id,
    'Comparison engine must recommend non-overloaded lower-risk scenario over overloaded scenario'
  );

  // 10. Phase 6: Decision Governance, Field Tasks, Evidence Validation, 5-Role RBAC & Analytics
  for (const dec of INITIAL_ENGINEERING_DECISIONS) {
    assert.equal(dec.source, 'DEMO', `Seed decision ${dec.id} must have source === "DEMO"`);
    assert.ok(
      INITIAL_ASSETS.some((a) => a.canonicalId === dec.targetAssetId),
      `Decision ${dec.id} targetAssetId (${dec.targetAssetId}) must exist in INITIAL_ASSETS`
    );
  }
  for (const apr of INITIAL_APPROVALS) {
    assert.ok(
      INITIAL_ENGINEERING_DECISIONS.some((d) => d.id === apr.decisionId),
      `Approval ${apr.id} must reference an existing decision`
    );
  }
  for (const task of INITIAL_FIELD_TASKS) {
    assert.equal(task.source, 'DEMO', `Seed FieldTask ${task.id} must have source === "DEMO"`);
    assert.ok(
      INITIAL_ASSETS.some((a) => a.canonicalId === task.assetId),
      `FieldTask ${task.id} assetId (${task.assetId}) must exist in INITIAL_ASSETS`
    );
  }
  for (const ev of INITIAL_FIELD_EVIDENCE) {
    assert.equal(ev.source, 'DEMO', `Seed FieldEvidence ${ev.id} must have source === "DEMO"`);
    assert.ok(
      INITIAL_FIELD_TASKS.some((t) => t.id === ev.taskId),
      `FieldEvidence ${ev.id} must link to an existing task`
    );
  }
  for (const notif of INITIAL_NOTIFICATIONS) {
    assert.equal(notif.source, 'DEMO', `Seed Notification ${notif.id} must have source === "DEMO"`);
  }
  assert.ok(INITIAL_AUDIT_LOGS.length >= 4, 'Expected seeded Phase 6 audit log entries');

  // 5-Role RBAC & separation of duties checks
  const engineerPerms = getRolePermissions('GRID_ENGINEER');
  assert.equal(engineerPerms.canSubmitDecision, true);
  assert.equal(engineerPerms.canApproveDecision, false, 'Control Room Engineer must NOT self-approve decisions');
  assert.equal(engineerPerms.canAssignFieldTask, false);

  const managerPerms = getRolePermissions('REVIEWER_APPROVER');
  assert.equal(managerPerms.canApproveDecision, true);
  assert.equal(managerPerms.canAssignFieldTask, true);
  assert.equal(managerPerms.canVerifyAndClose, true);
  assert.equal(managerPerms.canSubmitDecision, false, 'Utility Manager does not submit proposals');

  const fieldPerms = getRolePermissions('FIELD_ENGINEER');
  assert.equal(fieldPerms.canExecuteFieldTask, true);
  assert.equal(fieldPerms.canUploadEvidence, true);
  assert.equal(fieldPerms.canApproveDecision, false);

  const adminPerms = getRolePermissions('ADMIN');
  assert.equal(adminPerms.canApproveDecision, true);
  assert.equal(adminPerms.canUploadEvidence, true);
  assert.equal(adminPerms.canVerifyAndClose, true);

  const viewerPerms = getRolePermissions('VIEWER');
  assert.equal(viewerPerms.isReadOnly, true);
  assert.equal(viewerPerms.canSubmitDecision, false);
  assert.equal(viewerPerms.canApproveDecision, false);
  assert.equal(viewerPerms.canUploadEvidence, false);

  // Evidence upload validation (allowed MIME & <= 8 MB)
  assert.equal(
    validateEvidenceFile({ fileName: 'dtr-104.jpg', mimeType: 'image/jpeg', fileSizeBytes: 1024 * 512 }).valid,
    true
  );
  assert.equal(
    validateEvidenceFile({ fileName: 'report.pdf', mimeType: 'application/pdf', fileSizeBytes: 2 * 1024 * 1024 }).valid,
    true
  );
  assert.equal(
    validateEvidenceFile({ fileName: 'malware.exe', mimeType: 'application/x-msdownload', fileSizeBytes: 1024 }).valid,
    false
  );
  assert.equal(
    validateEvidenceFile({ fileName: 'oversize.png', mimeType: 'image/png', fileSizeBytes: 9 * 1024 * 1024 }).valid,
    false
  );

  // 5-Point verification checklist completeness guard
  assert.equal(
    isChecklistComplete({
      faultResolved: true,
      equipmentTested: true,
      powerRestored: true,
      safetyChecksCompleted: true,
      documentationCompleted: false
    }),
    false
  );
  assert.equal(
    isChecklistComplete({
      faultResolved: true,
      equipmentTested: true,
      powerRestored: true,
      safetyChecksCompleted: true,
      documentationCompleted: true
    }),
    true
  );

  // Governance analytics scoping by State / Priority
  const telanganaAnalytics = computeGovernanceAnalytics({
    decisions: INITIAL_ENGINEERING_DECISIONS,
    tasks: INITIAL_FIELD_TASKS,
    faults: INITIAL_FAULTS,
    assets: INITIAL_ASSETS,
    filters: { state: 'Telangana', priority: 'CRITICAL' }
  });
  assert.ok(telanganaAnalytics.pendingApprovalsCount >= 1, 'Expected pending CRITICAL approval in Telangana');
  assert.ok(telanganaAnalytics.assetReliabilityPct > 0 && telanganaAnalytics.assetReliabilityPct <= 100);

  const karnatakaAnalytics = computeGovernanceAnalytics({
    decisions: INITIAL_ENGINEERING_DECISIONS,
    tasks: INITIAL_FIELD_TASKS,
    faults: INITIAL_FAULTS,
    assets: INITIAL_ASSETS,
    filters: { state: 'Karnataka', priority: 'HIGH' }
  });
  assert.ok(karnatakaAnalytics.teamPerformance.length >= 1, 'Expected scoped team performance metrics in Karnataka');

  // 11. Phase 7: AI Intelligence Engine, Health Scoring, Risk Index, Patterns & 7-Stage AI Timeline
  const aiSnapshot = computeAiIntelligenceSnapshot({
    assets: INITIAL_ASSETS,
    faults: INITIAL_FAULTS,
    events: INITIAL_OPERATIONAL_EVENTS,
    maintenanceZones: INITIAL_MAINTENANCE_ZONES,
    fieldTasks: INITIAL_FIELD_TASKS,
    issues: INITIAL_DATA_QUALITY_ISSUES,
    reconstructions: INITIAL_EVENT_RECONSTRUCTIONS
  });
  assert.equal(aiSnapshot.healthScores.length, INITIAL_ASSETS.length, 'Every asset must receive an AI Health Score');

  const dtr104Health = aiSnapshot.healthScores.find((h) => h.assetId === 'DTR-TG-06U-104');
  assert.ok(dtr104Health, 'DTR-TG-06U-104 must have an AI Health Score');
  assert.equal(dtr104Health.healthScore, 42, 'Faulted DTR-TG-06U-104 must calibrate to healthScore 42');
  assert.equal(dtr104Health.category, 'CRITICAL', 'Health Score 42 must categorize as CRITICAL');

  const dtr104Rec = aiSnapshot.recommendations.find((r) => r.assetId === 'DTR-TG-06U-104');
  assert.ok(dtr104Rec, 'DTR-TG-06U-104 must have an Explainable AI recommendation');
  assert.ok(dtr104Rec.reasons.length >= 3, 'AI recommendation must provide bulletized explainable reasons');
  assert.ok(dtr104Rec.confidenceScore >= 70 && dtr104Rec.confidenceScore <= 99);

  for (const scope of ['STATE', 'DISTRICT', 'AREA', 'SUBSTATION', 'FEEDER'] as const) {
    assert.ok(
      aiSnapshot.riskIndices.some((r) => r.scopeLevel === scope),
      `GridRiskIndex must cover scope ${scope}`
    );
  }
  assert.ok(aiSnapshot.patterns.length >= 3, 'Expected AI-detected historical incident patterns');
  assert.ok(aiSnapshot.maintenanceQueue.length >= 5, 'Expected prioritized AI maintenance queue');
  for (let i = 1; i < aiSnapshot.maintenanceQueue.length; i++) {
    assert.ok(
      aiSnapshot.maintenanceQueue[i - 1].priorityRankScore >= aiSnapshot.maintenanceQueue[i].priorityRankScore,
      'Maintenance queue must be sorted descending by priorityRankScore'
    );
  }

  const dtr104Pred = aiSnapshot.predictions.find((p) => p.assetId === 'DTR-TG-06U-104');
  const dtr104Timeline = buildAssetAiTimeline({
    asset: dtr104,
    health: dtr104Health,
    prediction: dtr104Pred,
    events: INITIAL_OPERATIONAL_EVENTS,
    faults: INITIAL_FAULTS
  });
  assert.equal(dtr104Timeline.length, 7, 'Asset AI Lifecycle Timeline must contain all 7 stages');
  assert.equal(dtr104Timeline[0].stage, 'INSTALLATION');
  assert.equal(dtr104Timeline[6].stage, 'PREDICTED_RISK');

  // 12. Phase 8: Auth Security, Refresh Token Rotation/Revocation, Alerts & Export Sanitization
  const hashedPw = hashUserPassword('GridGuard#2026!');
  assert.ok(hashedPw.startsWith('scrypt$'), 'Password hash must use salted scrypt format');
  assert.equal(verifyUserPassword('GridGuard#2026!', hashedPw), true);
  assert.equal(verifyUserPassword('WrongPassword!', hashedPw), false);

  const regRes = registerServerUser({
    username: 'p.nair',
    email: 'p.nair@utilitygrid.org',
    fullName: 'Priya Nair',
    password: 'GridGuard#2026!',
    role: 'GRID_ENGINEER'
  });
  assert.equal(regRes.ok, true);
  assert.ok(authenticateServerUser('p.nair@utilitygrid.org', 'GridGuard#2026!'));
  assert.equal(authenticateServerUser('p.nair@utilitygrid.org', 'BadPassword'), null);

  const accessTok = signJwtToken({
    sub: 'p.nair',
    email: 'p.nair@utilitygrid.org',
    fullName: 'Priya Nair',
    role: 'GRID_ENGINEER',
    tokenType: 'access',
    ttlSeconds: 300
  });
  const refreshTok = signJwtToken({
    sub: 'p.nair',
    email: 'p.nair@utilitygrid.org',
    fullName: 'Priya Nair',
    role: 'GRID_ENGINEER',
    tokenType: 'refresh',
    ttlSeconds: 3600
  });
  assert.equal(verifyJwtToken(accessTok.token, 'access').valid, true);
  assert.equal(verifyJwtToken(accessTok.token, 'refresh').valid, false, 'Access token must not validate as refresh');
  assert.equal(verifyJwtToken(refreshTok.token, 'refresh').valid, true);
  revokeRefreshJwt(refreshTok.token);
  assert.equal(verifyJwtToken(refreshTok.token, 'refresh').valid, false, 'Revoked refresh token must fail validation');

  const seedAlerts = buildSeedAlerts({
    faults: INITIAL_FAULTS,
    assets: INITIAL_ASSETS,
    issues: INITIAL_DATA_QUALITY_ISSUES,
    aiSnapshot
  });
  assert.ok(seedAlerts.length >= 4, 'Expected seeded Alert Center items across severities');
  assert.ok(seedAlerts.some((a) => a.severity === 'CRITICAL'), 'Expected CRITICAL alert in seed alerts');

  // Formula-injection sanitization & 6-report build coverage
  assert.equal(sanitizeSpreadsheetCell('=CMD("calc")'), "'=CMD(\"calc\")");
  assert.equal(sanitizeSpreadsheetCell('+1234'), "'+1234");
  assert.equal(sanitizeSpreadsheetCell('@SUM(A1:A2)'), "'@SUM(A1:A2)");
  assert.equal(sanitizeSpreadsheetCell('Safe Feeder 01'), 'Safe Feeder 01');

  const reportTypes: ExportReportType[] = [
    'INCIDENTS',
    'ASSETS',
    'MAINTENANCE',
    'SIMULATIONS',
    'AUDIT_LOGS',
    'AI_RECOMMENDATIONS'
  ];
  for (const reportType of reportTypes) {
    const built = buildReportTable({
      reportType,
      scopeLabel: 'Telangana',
      actorName: 'Marcus Vance, PE',
      actorEmail: 'm.vance@utilitygrid.org',
      faults: INITIAL_FAULTS,
      assets: INITIAL_ASSETS,
      maintenanceZones: INITIAL_MAINTENANCE_ZONES,
      scenarios: INITIAL_SIMULATION_SCENARIOS,
      auditLogs: INITIAL_AUDIT_LOGS,
      aiSnapshot
    });
    assert.ok(built.headers.length >= 4, `Report ${reportType} must expose structured columns`);
    assert.ok(built.rows.length >= 1, `Report ${reportType} must contain rows`);
    const csv = buildCsvContent(built);
    assert.ok(csv.includes(built.headers[0]), `CSV for ${reportType} must include header`);
  }

  // 13. Phase 9: Enterprise Digital Twin, Regional KPIs, AI Operational Insights, Lifecycle & Enterprise Reports
  const twinNetwork = buildDigitalTwinNetwork({
    assets: INITIAL_ASSETS,
    faults: INITIAL_FAULTS,
    powerLines: INITIAL_POWER_LINES,
    maintenanceZones: INITIAL_MAINTENANCE_ZONES,
    aiSnapshot
  });
  assert.ok(twinNetwork.roots.length === 1 && twinNetwork.roots[0].canonicalId === 'IN-NATIONAL-GRID');
  assert.ok(twinNetwork.totalNodes > INITIAL_ASSETS.length, 'Digital twin must synthesize Country/State/District/Cluster levels');
  assert.ok(twinNetwork.totalEdges >= twinNetwork.totalNodes - 1);
  assert.ok(twinNetwork.faultedNodesCount >= 1);

  const trace = traceDigitalTwinDependencies(twinNetwork.flatNodes, 'DTR-TG-06U-104');
  assert.ok(trace.upstreamIds.includes('IN-NATIONAL-GRID'), 'Upstream trace must reach National Grid root');
  assert.ok(trace.downstreamIds.includes('CLS-DTR-TG-06U-104'), 'Downstream trace must reach LT Consumer Cluster leaf');
  assert.ok(trace.highlightedIds.has('DTR-TG-06U-104'));

  const regionalKpis = computeRegionalPerformanceKpis({
    assets: INITIAL_ASSETS,
    faults: INITIAL_FAULTS,
    maintenanceZones: INITIAL_MAINTENANCE_ZONES,
    fieldTasks: INITIAL_FIELD_TASKS,
    aiSnapshot
  });
  for (const scope of ['NATIONAL', 'STATE', 'DISTRICT', 'AREA', 'SUBSTATION'] as const) {
    assert.ok(
      regionalKpis.some((k) => k.scopeLevel === scope),
      `Regional performance KPIs must cover ${scope}`
    );
  }
  const nationalKpi = regionalKpis.find((k) => k.scopeLevel === 'NATIONAL')!;
  assert.ok(nationalKpi.mttrHours > 0 && nationalKpi.mtbfHours > 0);
  assert.ok(nationalKpi.gridReliabilityPct > 0 && nationalKpi.gridReliabilityPct <= 100);

  const insights = generateAiOperationalInsights({
    regionalKpis,
    aiSnapshot,
    faults: INITIAL_FAULTS,
    maintenanceZones: INITIAL_MAINTENANCE_ZONES
  });
  assert.equal(insights.length, 5, 'Expected 5 executive AI operational insight categories');
  for (const ins of insights) {
    assert.ok(ins.supportingMetrics.length >= 2, `Insight ${ins.id} must expose supporting metrics`);
  }

  const lifecycleRegistry = buildAssetLifecycleRegistry({
    assets: INITIAL_ASSETS,
    faults: INITIAL_FAULTS,
    maintenanceZones: INITIAL_MAINTENANCE_ZONES,
    fieldTasks: INITIAL_FIELD_TASKS
  });
  assert.equal(lifecycleRegistry.length, INITIAL_ASSETS.length);
  const dtrLifecycle = lifecycleRegistry.find((r) => r.assetId === 'DTR-TG-06U-104')!;
  assert.equal(dtrLifecycle.currentStage, 'REPAIR');
  assert.ok(dtrLifecycle.events.some((e) => e.stage === 'INSTALLATION'));
  assert.ok(dtrLifecycle.events.some((e) => e.stage === 'COMMISSIONING'));

  const scenarioMatrix = compareEnterpriseScenarios(INITIAL_SIMULATION_SCENARIOS, INITIAL_FAULTS);
  assert.ok(scenarioMatrix.length >= 2);
  assert.equal(scenarioMatrix[0].isBaseline, true);

  const enterpriseReportTypes: ExportReportType[] = [
    'GRID_HEALTH',
    'REGIONAL_PERFORMANCE',
    'ASSET_RELIABILITY',
    'DECISION_GOVERNANCE'
  ];
  for (const reportType of enterpriseReportTypes) {
    const built = buildReportTable({
      reportType,
      scopeLabel: 'All India Operations',
      actorName: 'Marcus Vance, PE',
      actorEmail: 'm.vance@utilitygrid.org',
      faults: INITIAL_FAULTS,
      assets: INITIAL_ASSETS,
      maintenanceZones: INITIAL_MAINTENANCE_ZONES,
      scenarios: INITIAL_SIMULATION_SCENARIOS,
      auditLogs: INITIAL_AUDIT_LOGS,
      aiSnapshot,
      decisions: INITIAL_ENGINEERING_DECISIONS,
      regionalKpis
    });
    assert.ok(built.headers.length >= 5, `Enterprise report ${reportType} must expose structured columns`);
    assert.ok(built.rows.length >= 1, `Enterprise report ${reportType} must contain rows`);
    const csv = buildCsvContent(built);
    assert.ok(csv.includes(built.headers[0]), `CSV for ${reportType} must include header`);
  }

  // 14. Phase 11: Live Field Operations, Intelligent Dispatch, Routes, Geo-Fencing & Timeline
  assert.ok(INITIAL_FIELD_ENGINEERS.length >= 6, 'Expected seeded Phase 11 field engineers');
  const recs = recommendEngineersForAsset({
    asset: dtr104,
    engineers: INITIAL_FIELD_ENGINEERS,
    tasks: INITIAL_FIELD_TASKS
  });
  assert.equal(recs.length, INITIAL_FIELD_ENGINEERS.length);
  assert.equal(recs[0].recommended, true, 'Top available proximate engineer must be flagged recommended');
  assert.ok(recs[0].distanceKm <= recs[recs.length - 1].distanceKm || recs[0].compositeScore >= recs[1].compositeScore);

  const rohan = INITIAL_FIELD_ENGINEERS.find((e) => e.engineerId === 'ENG-BLR-01')!;
  const blrTask = INITIAL_FIELD_TASKS.find((t) => t.id === 'TSK-KA-01U-01')!;
  const dtrBlr = INITIAL_ASSETS.find((a) => a.canonicalId === 'DTR-KA-01U-301')!;
  const fallbackRoute = computeFallbackRoute({
    engineer: rohan,
    task: blrTask,
    destAsset: dtrBlr
  });
  assert.ok(fallbackRoute.coordinates.length >= 5, 'Fallback route must generate arterial corridor polyline');
  assert.ok(fallbackRoute.remainingDistanceKm > 0);
  assert.ok(fallbackRoute.etaMinutes >= 1);

  const fences = buildGeoFencesForGrid({
    assets: INITIAL_ASSETS,
    faults: INITIAL_FAULTS,
    maintenanceZones: INITIAL_MAINTENANCE_ZONES
  });
  assert.ok(fences.some((f) => f.fenceType === 'FAULT_LOCATION'));
  assert.ok(fences.some((f) => f.fenceType === 'SUBSTATION'));
  assert.ok(fences.some((f) => f.fenceType === 'TRANSFORMER'));

  const targetFence = fences.find((f) => f.assetId === 'DTR-KA-01U-301')!;
  assert.ok(targetFence, 'Expected geofence around DTR-KA-01U-301');
  const gfEvents = evaluateGeoFenceTransitions({
    engineer: rohan,
    prevLat: targetFence.centerLat + 0.01,
    prevLon: targetFence.centerLon + 0.01,
    newLat: targetFence.centerLat + 0.0001,
    newLon: targetFence.centerLon + 0.0001,
    fences: [targetFence],
    completedTaskFlag: true
  });
  assert.ok(gfEvents.some((ev) => ev.eventType === 'ENTER_WORK_ZONE'));
  assert.ok(gfEvents.some((ev) => ev.eventType === 'REACHED_ASSET'));
  assert.ok(gfEvents.some((ev) => ev.eventType === 'COMPLETED_WORK'));

  const timeline = buildLiveIncidentTimeline({
    task: blrTask,
    fault: INITIAL_FAULTS[0],
    evidence: INITIAL_FIELD_EVIDENCE,
    auditLogs: INITIAL_AUDIT_LOGS
  });
  assert.equal(timeline.length, 10, 'Live Incident Timeline must contain all 10 lifecycle stages');
  assert.equal(timeline[0].stage, 'FAULT_DETECTED');
  assert.equal(timeline[9].stage, 'INCIDENT_CLOSED');

  const dashMetrics = computeFieldDashboardMetrics({
    engineers: INITIAL_FIELD_ENGINEERS,
    tasks: INITIAL_FIELD_TASKS,
    faults: INITIAL_FAULTS,
    routes: [fallbackRoute],
    geofenceEvents: gfEvents
  });
  assert.equal(dashMetrics.engineersOnline, 5);
  assert.equal(mapTaskStatusToEngineerStatus('TRAVELING'), 'TRAVELING');
  assert.equal(mapTaskStatusToEngineerStatus('REPAIR'), 'WORKING');
  assert.equal(mapTaskStatusToEngineerStatus('COMPLETED'), 'AVAILABLE');

  const workforceGraph = buildHierarchicalKnowledgeGraph({
    assets: INITIAL_ASSETS,
    allAssets: INITIAL_ASSETS,
    telemetryByAssetId: {},
    faults: INITIAL_FAULTS,
    reconstructions: INITIAL_EVENT_RECONSTRUCTIONS,
    includeGeoAndConsumerTiers: true,
    fieldEngineers: INITIAL_FIELD_ENGINEERS,
    fieldTasks: INITIAL_FIELD_TASKS,
    selectedEngineerId: 'ENG-BLR-01'
  });
  assert.ok(
    workforceGraph.nodes.some((n) => n.data.id === 'ENG-BLR-01' && n.data.type === 'FIELD_ENGINEER'),
    'Knowledge graph must include FIELD_ENGINEER node'
  );
  const engChain = getHierarchicalConnectedNodeIds(
    'ENG-BLR-01',
    workforceGraph.nodes,
    workforceGraph.edges,
    INITIAL_ASSETS,
    INITIAL_POWER_LINES
  );
  assert.ok(engChain.has('DTR-KA-01U-301'), 'Engineer workforce chain must reach assigned transformer');

  console.log('ALL GRIDGUARD AI VERIFICATION CHECKS PASSED');
}

runTests();
