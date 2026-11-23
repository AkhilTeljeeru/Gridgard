import type {
  ActiveFault,
  AiIntelligenceSnapshot,
  AiOperationalInsight,
  AssetLifecycleEvent,
  AssetLifecycleRecord,
  AssetLifecycleStage,
  AssetStatus,
  AssetTelemetryStatus,
  DigitalTwinNetworkState,
  DigitalTwinNode,
  DigitalTwinNodeLevel,
  EnterpriseScenarioComparisonRow,
  FieldTask,
  GridRiskLevel,
  InfrastructureAsset,
  MaintenanceZone,
  PowerLine,
  RegionalPerformanceKpi,
  SimulationScenario
} from '../types/grid.ts';
import { formatMissingValue } from './syntheticData.ts';

function mapAssetTypeToTwinLevel(asset: InfrastructureAsset): DigitalTwinNodeLevel {
  switch (asset.assetType) {
    case 'SUBSTATION':
    case 'PLANT':
      return 'SUBSTATION';
    case 'FEEDER':
      return 'FEEDER';
    case 'TRANSFORMER':
    case 'GENERATOR':
      return 'TRANSFORMER';
    case 'CIRCUIT_BREAKER':
    case 'SECTIONALIZER':
    case 'RECLOSER':
      return 'SWITCH';
    case 'LOAD_POINT':
      return 'CONSUMER_CLUSTER';
    default:
      return 'POWER_LINE';
  }
}

function resolveLiveAssetStatus(
  asset: InfrastructureAsset,
  telemetry: AssetTelemetryStatus | undefined,
  activeFaults: ActiveFault[]
): AssetStatus {
  if (activeFaults.some((f) => f.affectedAssetId === asset.canonicalId && f.status !== 'RESTORED')) {
    return 'FAULTED';
  }
  if (telemetry?.status === 'FAULT') return 'FAULTED';
  if (telemetry?.status === 'WARNING') return 'WARNING';
  return asset.status;
}

function deriveRiskLevel(healthScore: number, status: AssetStatus): GridRiskLevel {
  if (status === 'FAULTED' || healthScore < 55) return 'HIGH';
  if (status === 'WARNING' || status === 'MAINTENANCE' || healthScore < 80) return 'MEDIUM';
  return 'LOW';
}

export function buildDigitalTwinNetwork(params: {
  assets: InfrastructureAsset[];
  faults: ActiveFault[];
  powerLines: PowerLine[];
  maintenanceZones: MaintenanceZone[];
  aiSnapshot: AiIntelligenceSnapshot;
  telemetryByAssetId?: Record<string, AssetTelemetryStatus>;
}): DigitalTwinNetworkState {
  const {
    assets,
    faults,
    powerLines,
    maintenanceZones,
    aiSnapshot,
    telemetryByAssetId = {}
  } = params;

  const healthById = new Map(aiSnapshot.healthScores.map((h) => [h.assetId, h]));
  const activeFaults = faults.filter((f) => f.status !== 'RESTORED');

  // Build adjacency map from parent references + powerLines
  const adjacency = new Map<string, Set<string>>();
  const ensureAdj = (id: string) => {
    if (!adjacency.has(id)) adjacency.set(id, new Set());
    return adjacency.get(id)!;
  };

  for (const asset of assets) {
    const s = ensureAdj(asset.canonicalId);
    if (asset.parentAssetId && asset.parentAssetId !== asset.canonicalId) {
      s.add(asset.parentAssetId);
      ensureAdj(asset.parentAssetId).add(asset.canonicalId);
    }
    if (asset.substationId && asset.substationId !== asset.canonicalId) {
      s.add(asset.substationId);
      ensureAdj(asset.substationId).add(asset.canonicalId);
    }
    if (asset.feederId && asset.feederId !== asset.canonicalId) {
      s.add(asset.feederId);
      ensureAdj(asset.feederId).add(asset.canonicalId);
    }
  }
  for (const line of powerLines) {
    if (line.substationId && line.feederId) {
      ensureAdj(line.substationId).add(line.feederId);
      ensureAdj(line.feederId).add(line.substationId);
    }
  }

  const maintenanceByAsset = new Map<string, MaintenanceZone['status']>();
  for (const mz of maintenanceZones) {
    if (mz.feederId) {
      maintenanceByAsset.set(mz.feederId, mz.status);
      for (const a of assets) {
        if (a.feederId === mz.feederId) {
          maintenanceByAsset.set(a.canonicalId, mz.status);
        }
      }
    }
  }

  // Country root
  const countryRoot: DigitalTwinNode = {
    id: 'TWIN-COUNTRY-IN',
    canonicalId: 'IN-NATIONAL-GRID',
    name: 'India Distribution Digital Twin',
    nodeLevel: 'COUNTRY',
    parentId: null,
    status: 'ACTIVE',
    healthScore: 84,
    riskLevel: 'LOW',
    activeIncidentsCount: activeFaults.length,
    connectedAssetIds: [],
    maintenanceStatus: 'NOMINAL',
    loadPct: 68,
    voltage: '132/33/11/0.433 kV',
    state: 'All States',
    district: 'All Districts',
    area: 'National Grid',
    source: 'DEMO',
    children: []
  };

  const stateNodes = new Map<string, DigitalTwinNode>();
  const districtNodes = new Map<string, DigitalTwinNode>();
  const assetNodes = new Map<string, DigitalTwinNode>();

  // Create asset Digital Twin nodes first
  for (const asset of assets) {
    const h = healthById.get(asset.canonicalId);
    const telemetry = telemetryByAssetId[asset.canonicalId];
    const status = resolveLiveAssetStatus(asset, telemetry, activeFaults);
    const healthScore = h ? h.healthScore : status === 'FAULTED' ? 44 : status === 'WARNING' ? 68 : 88;
    const riskLevel = deriveRiskLevel(healthScore, status);
    const incidentCount = activeFaults.filter(
      (f) =>
        f.affectedAssetId === asset.canonicalId ||
        f.affectedSubstationId === asset.canonicalId ||
        f.affectedFeederId === asset.canonicalId
    ).length;

    const mzStatus = maintenanceByAsset.get(asset.canonicalId);
    const maintenanceStatus: DigitalTwinNode['maintenanceStatus'] =
      status === 'FAULTED'
        ? 'IN_REPAIR'
        : mzStatus === 'IN_PROGRESS' || mzStatus === 'SCHEDULED'
          ? 'SCHEDULED'
          : (h?.maintenanceOverdueDays ?? 0) > 60
            ? 'OVERDUE'
            : 'NOMINAL';

    const stateName = formatMissingValue(asset.state, 'Telangana');
    const districtName = formatMissingValue(asset.district, 'Hyderabad');

    const node: DigitalTwinNode = {
      id: `TWIN-${asset.canonicalId}`,
      canonicalId: asset.canonicalId,
      name: formatMissingValue(asset.rawName ?? asset.name),
      nodeLevel: mapAssetTypeToTwinLevel(asset),
      parentId: null,
      status,
      healthScore,
      riskLevel,
      activeIncidentsCount: incidentCount,
      connectedAssetIds: Array.from(adjacency.get(asset.canonicalId) || []),
      maintenanceStatus,
      loadPct: asset.peakLoadPct ?? h?.peakLoadPct ?? null,
      voltage: asset.voltage ?? null,
      state: stateName,
      district: districtName,
      area: formatMissingValue(asset.area),
      source: asset.source,
      children: []
    };
    assetNodes.set(asset.canonicalId, node);

    // Ensure State & District nodes exist
    if (!stateNodes.has(stateName)) {
      const sNode: DigitalTwinNode = {
        id: `TWIN-STATE-${stateName.toUpperCase().replace(/\s+/g, '-')}`,
        canonicalId: `STATE-${stateName.toUpperCase().replace(/\s+/g, '-')}`,
        name: stateName,
        nodeLevel: 'STATE',
        parentId: countryRoot.canonicalId,
        status: 'ACTIVE',
        healthScore: 86,
        riskLevel: 'LOW',
        activeIncidentsCount: 0,
        connectedAssetIds: [],
        maintenanceStatus: 'NOMINAL',
        loadPct: null,
        voltage: '132/33 kV',
        state: stateName,
        district: 'Statewide',
        area: stateName,
        source: 'DEMO',
        children: []
      };
      stateNodes.set(stateName, sNode);
      countryRoot.children.push(sNode);
    }

    const districtKey = `${stateName}::${districtName}`;
    if (!districtNodes.has(districtKey)) {
      const parentState = stateNodes.get(stateName)!;
      const dNode: DigitalTwinNode = {
        id: `TWIN-DIST-${districtKey.toUpperCase().replace(/[^A-Z0-9]+/g, '-')}`,
        canonicalId: `DIST-${districtName.toUpperCase().replace(/[^A-Z0-9]+/g, '-')}`,
        name: `${districtName} Circle`,
        nodeLevel: 'DISTRICT',
        parentId: parentState.canonicalId,
        status: 'ACTIVE',
        healthScore: 84,
        riskLevel: 'LOW',
        activeIncidentsCount: 0,
        connectedAssetIds: [],
        maintenanceStatus: 'NOMINAL',
        loadPct: null,
        voltage: '33/11 kV',
        state: stateName,
        district: districtName,
        area: districtName,
        source: 'DEMO',
        children: []
      };
      districtNodes.set(districtKey, dNode);
      parentState.children.push(dNode);
    }
  }

  // Wire Substation -> Feeder -> Transformer/Switch -> Consumer Cluster hierarchy
  const attached = new Set<string>();
  const clusterCountForFeeder = new Map<string, number>();

  for (const asset of assets) {
    const node = assetNodes.get(asset.canonicalId)!;
    const districtKey = `${node.state}::${node.district}`;
    const districtNode = districtNodes.get(districtKey)!;

    if (node.nodeLevel === 'SUBSTATION') {
      node.parentId = districtNode.canonicalId;
      districtNode.children.push(node);
      attached.add(node.canonicalId);
    }
  }

  for (const asset of assets) {
    const node = assetNodes.get(asset.canonicalId)!;
    if (attached.has(node.canonicalId)) continue;

    if (node.nodeLevel === 'FEEDER' && asset.substationId && assetNodes.has(asset.substationId)) {
      const subNode = assetNodes.get(asset.substationId)!;
      node.parentId = subNode.canonicalId;
      subNode.children.push(node);
      attached.add(node.canonicalId);
    }
  }

  for (const asset of assets) {
    const node = assetNodes.get(asset.canonicalId)!;
    if (attached.has(node.canonicalId)) continue;

    if (asset.feederId && assetNodes.has(asset.feederId)) {
      const fdrNode = assetNodes.get(asset.feederId)!;
      node.parentId = fdrNode.canonicalId;
      fdrNode.children.push(node);
      attached.add(node.canonicalId);

      // Attach synthesized Consumer Cluster leaf beneath Transformers
      if (node.nodeLevel === 'TRANSFORMER') {
        const count = (clusterCountForFeeder.get(asset.canonicalId) || 0) + 1;
        clusterCountForFeeder.set(asset.canonicalId, count);
        const clusterId = `CLS-${asset.canonicalId}`;
        const clusterNode: DigitalTwinNode = {
          id: `TWIN-${clusterId}`,
          canonicalId: clusterId,
          name: `${node.area} LT Consumer Cluster`,
          nodeLevel: 'CONSUMER_CLUSTER',
          parentId: node.canonicalId,
          status: node.status === 'FAULTED' ? 'FAULTED' : 'ACTIVE',
          healthScore: node.status === 'FAULTED' ? Math.max(35, node.healthScore - 4) : node.healthScore,
          riskLevel: node.riskLevel,
          activeIncidentsCount: node.activeIncidentsCount,
          connectedAssetIds: [node.canonicalId],
          maintenanceStatus: node.maintenanceStatus,
          loadPct: node.loadPct,
          voltage: '0.433 kV (LT)',
          state: node.state,
          district: node.district,
          area: node.area,
          source: node.source,
          children: []
        };
        node.children.push(clusterNode);
      }
    } else if (asset.substationId && assetNodes.has(asset.substationId)) {
      const subNode = assetNodes.get(asset.substationId)!;
      node.parentId = subNode.canonicalId;
      subNode.children.push(node);
      attached.add(node.canonicalId);
    } else {
      const districtKey = `${node.state}::${node.district}`;
      const districtNode = districtNodes.get(districtKey)!;
      node.parentId = districtNode.canonicalId;
      districtNode.children.push(node);
      attached.add(node.canonicalId);
    }
  }

  // Add Power Line corridor twins under their Feeder or Substation
  for (const line of powerLines) {
    const parentId =
      (line.feederId && assetNodes.has(line.feederId) ? line.feederId : null) ||
      (line.substationId && assetNodes.has(line.substationId) ? line.substationId : null);
    if (!parentId) continue;
    const parentNode = assetNodes.get(parentId)!;
    if (assetNodes.has(line.canonicalId)) continue;
    const mappedLineStatus: AssetStatus =
      line.status === 'FAULTED'
        ? 'FAULTED'
        : line.status === 'WARNING'
          ? 'WARNING'
          : line.status === 'ISOLATED' || line.status === 'TIE_OPEN'
            ? 'DE_ENERGIZED'
            : 'ACTIVE';
    const lineNode: DigitalTwinNode = {
      id: `TWIN-${line.canonicalId}`,
      canonicalId: line.canonicalId,
      name: formatMissingValue(line.rawName ?? line.name),
      nodeLevel: 'POWER_LINE',
      parentId: parentNode.canonicalId,
      status: mappedLineStatus,
      healthScore: mappedLineStatus === 'FAULTED' ? 45 : mappedLineStatus === 'WARNING' ? 68 : 89,
      riskLevel: deriveRiskLevel(mappedLineStatus === 'FAULTED' ? 45 : 89, mappedLineStatus),
      activeIncidentsCount: mappedLineStatus === 'FAULTED' ? 1 : 0,
      connectedAssetIds: [parentId],
      maintenanceStatus: mappedLineStatus === 'FAULTED' ? 'IN_REPAIR' : 'NOMINAL',
      loadPct: null,
      voltage: line.voltage,
      state: parentNode.state,
      district: parentNode.district,
      area: parentNode.area,
      source: line.source,
      children: []
    };
    parentNode.children.push(lineNode);
  }

  // Roll up health, status & active incidents to District, State, and Country nodes
  const flatten = (root: DigitalTwinNode, out: DigitalTwinNode[] = []): DigitalTwinNode[] => {
    out.push(root);
    for (const c of root.children) flatten(c, out);
    return out;
  };

  for (const dNode of districtNodes.values()) {
    const desc = flatten(dNode).filter((n) => n.canonicalId !== dNode.canonicalId);
    if (desc.length > 0) {
      dNode.healthScore = Math.round(desc.reduce((acc, n) => acc + n.healthScore, 0) / desc.length);
      dNode.activeIncidentsCount = desc.reduce((acc, n) => acc + n.activeIncidentsCount, 0);
      dNode.status = desc.some((n) => n.status === 'FAULTED')
        ? 'WARNING'
        : 'ACTIVE';
      dNode.riskLevel = deriveRiskLevel(dNode.healthScore, dNode.status);
    }
  }

  for (const sNode of stateNodes.values()) {
    const children = sNode.children;
    if (children.length > 0) {
      sNode.healthScore = Math.round(children.reduce((acc, n) => acc + n.healthScore, 0) / children.length);
      sNode.activeIncidentsCount = children.reduce((acc, n) => acc + n.activeIncidentsCount, 0);
      sNode.status = children.some((n) => n.status === 'WARNING' || n.status === 'FAULTED')
        ? 'WARNING'
        : 'ACTIVE';
      sNode.riskLevel = deriveRiskLevel(sNode.healthScore, sNode.status);
    }
  }

  const allFlat = flatten(countryRoot);
  if (stateNodes.size > 0) {
    const statesArr = Array.from(stateNodes.values());
    countryRoot.healthScore = Math.round(
      statesArr.reduce((acc, s) => acc + s.healthScore, 0) / statesArr.length
    );
    countryRoot.riskLevel = deriveRiskLevel(countryRoot.healthScore, countryRoot.status);
  }

  const assetOnlyNodes = allFlat.filter(
    (n) => n.nodeLevel !== 'COUNTRY' && n.nodeLevel !== 'STATE' && n.nodeLevel !== 'DISTRICT'
  );
  const faultedNodesCount = assetOnlyNodes.filter((n) => n.status === 'FAULTED').length;
  const avgHealthScore =
    assetOnlyNodes.length > 0
      ? Math.round(assetOnlyNodes.reduce((acc, n) => acc + n.healthScore, 0) / assetOnlyNodes.length)
      : 100;

  let edgeCount = 0;
  for (const n of allFlat) {
    edgeCount += n.children.length;
  }

  return {
    roots: [countryRoot],
    flatNodes: allFlat,
    totalNodes: allFlat.length,
    totalEdges: edgeCount,
    faultedNodesCount,
    avgHealthScore,
    synchronizedAt: new Date().toISOString()
  };
}

export function traceDigitalTwinDependencies(
  flatNodes: DigitalTwinNode[],
  targetCanonicalId: string | null
): {
  upstreamIds: string[];
  downstreamIds: string[];
  lateralIds: string[];
  highlightedIds: Set<string>;
} {
  if (!targetCanonicalId) {
    return { upstreamIds: [], downstreamIds: [], lateralIds: [], highlightedIds: new Set() };
  }
  const byCanonical = new Map(flatNodes.map((n) => [n.canonicalId, n]));
  const target = byCanonical.get(targetCanonicalId);
  if (!target) {
    return { upstreamIds: [], downstreamIds: [], lateralIds: [], highlightedIds: new Set() };
  }

  const upstreamIds: string[] = [];
  let cursor = target.parentId ? byCanonical.get(target.parentId) : undefined;
  while (cursor) {
    upstreamIds.push(cursor.canonicalId);
    cursor = cursor.parentId ? byCanonical.get(cursor.parentId) : undefined;
  }

  const downstreamIds: string[] = [];
  const walkDown = (node: DigitalTwinNode) => {
    for (const child of node.children) {
      downstreamIds.push(child.canonicalId);
      walkDown(child);
    }
  };
  walkDown(target);

  const lateralIds = target.connectedAssetIds.filter(
    (id) => id !== targetCanonicalId && !upstreamIds.includes(id) && !downstreamIds.includes(id)
  );

  const highlightedIds = new Set<string>([
    targetCanonicalId,
    ...upstreamIds,
    ...downstreamIds,
    ...lateralIds
  ]);

  return { upstreamIds, downstreamIds, lateralIds, highlightedIds };
}

export function computeRegionalPerformanceKpis(params: {
  assets: InfrastructureAsset[];
  faults: ActiveFault[];
  maintenanceZones: MaintenanceZone[];
  fieldTasks: FieldTask[];
  aiSnapshot: AiIntelligenceSnapshot;
}): RegionalPerformanceKpi[] {
  const { assets, faults, maintenanceZones, fieldTasks, aiSnapshot } = params;
  const healthMap = new Map(aiSnapshot.healthScores.map((h) => [h.assetId, h]));

  const computeGroupKpi = (
    regionId: string,
    regionName: string,
    scopeLevel: RegionalPerformanceKpi['scopeLevel'],
    parentRegion: string,
    groupAssets: InfrastructureAsset[]
  ): RegionalPerformanceKpi => {
    const assetIds = new Set(groupAssets.map((a) => a.canonicalId));
    const groupFaults = faults.filter(
      (f) =>
        assetIds.has(f.affectedAssetId) ||
        (f.affectedSubstationId && assetIds.has(f.affectedSubstationId)) ||
        (f.affectedFeederId && assetIds.has(f.affectedFeederId))
    );
    const activeFaultsCount = groupFaults.filter((f) => f.status !== 'RESTORED').length;
    const faultedAssetCount = groupAssets.filter((a) => a.status === 'FAULTED').length;

    const avgHealth =
      groupAssets.length > 0
        ? groupAssets.reduce((sum, a) => sum + (healthMap.get(a.canonicalId)?.healthScore ?? 85), 0) /
          groupAssets.length
        : 92;

    const availability =
      groupAssets.length > 0
        ? Math.max(
            75,
            Math.round(((groupAssets.length - faultedAssetCount * 0.75) / groupAssets.length) * 1000) / 10
          )
        : 99.4;

    const reliability = Math.max(
      82,
      Math.min(99.95, Math.round((99.6 - activeFaultsCount * 0.45 - (100 - avgHealth) * 0.08) * 100) / 100)
    );

    const groupTasks = fieldTasks.filter((t) => assetIds.has(t.assetId));
    const completedTasks = groupTasks.filter((t) => t.status === 'COMPLETED' || t.status === 'VERIFIED').length;
    const overdueCount = groupAssets.filter(
      (a) => (healthMap.get(a.canonicalId)?.maintenanceOverdueDays ?? 0) > 60
    ).length;

    const compliance =
      groupAssets.length > 0
        ? Math.max(
            62,
            Math.min(
              100,
              Math.round(
                ((groupAssets.length - overdueCount * 0.8 + completedTasks * 0.4) /
                  Math.max(1, groupAssets.length)) *
                  1000
              ) / 10
            )
          )
        : 94.0;

    const mttrHours = Math.round((1.6 + activeFaultsCount * 0.45 + (100 - avgHealth) * 0.03) * 10) / 10;
    const mtbfHours = Math.round(Math.max(140, 920 - groupFaults.length * 95 - (100 - avgHealth) * 6));
    const faultFrequencyPer100Km =
      Math.round((0.8 + groupFaults.length * 0.65 + overdueCount * 0.25) * 100) / 100;
    const avgResponseTimeMin = Math.round(14 + activeFaultsCount * 3.5 + (maintenanceZones.length > 0 ? 2 : 0));

    return {
      regionId,
      regionName,
      scopeLevel,
      parentRegion,
      gridReliabilityPct: reliability,
      assetAvailabilityPct: availability,
      faultFrequencyPer100Km,
      mttrHours,
      mtbfHours,
      maintenanceCompliancePct: compliance,
      avgResponseTimeMin,
      activeIncidents: activeFaultsCount,
      assetCount: groupAssets.length
    };
  };

  const results: RegionalPerformanceKpi[] = [];
  results.push(computeGroupKpi('NAT-IN', 'All India Operations', 'NATIONAL', 'National', assets));

  const byState = new Map<string, InfrastructureAsset[]>();
  const byDistrict = new Map<string, InfrastructureAsset[]>();
  const byArea = new Map<string, InfrastructureAsset[]>();
  const bySubstation = new Map<string, InfrastructureAsset[]>();

  for (const asset of assets) {
    const st = formatMissingValue(asset.state, 'Telangana');
    const dist = formatMissingValue(asset.district, 'Hyderabad');
    const area = formatMissingValue(asset.area, 'HITEC City');
    byState.set(st, [...(byState.get(st) || []), asset]);
    byDistrict.set(`${st}::${dist}`, [...(byDistrict.get(`${st}::${dist}`) || []), asset]);
    byArea.set(`${dist}::${area}`, [...(byArea.get(`${dist}::${area}`) || []), asset]);
    if (asset.substationId) {
      bySubstation.set(asset.substationId, [...(bySubstation.get(asset.substationId) || []), asset]);
    }
  }

  for (const [state, list] of byState.entries()) {
    results.push(computeGroupKpi(`STATE-${state}`, state, 'STATE', 'India', list));
  }
  for (const [key, list] of byDistrict.entries()) {
    const [state, district] = key.split('::');
    results.push(computeGroupKpi(`DIST-${district}`, district, 'DISTRICT', state, list));
  }
  for (const [key, list] of byArea.entries()) {
    const [district, area] = key.split('::');
    results.push(computeGroupKpi(`AREA-${area}`, area, 'AREA', district, list));
  }
  for (const [subId, list] of bySubstation.entries()) {
    const subAsset = assets.find((a) => a.canonicalId === subId);
    const label = subAsset ? formatMissingValue(subAsset.rawName ?? subAsset.name) : subId;
    const parent = subAsset ? formatMissingValue(subAsset.district, 'Hyderabad') : 'Regional';
    results.push(computeGroupKpi(`SUB-${subId}`, label, 'SUBSTATION', parent, list));
  }

  return results;
}

export function generateAiOperationalInsights(params: {
  regionalKpis: RegionalPerformanceKpi[];
  aiSnapshot: AiIntelligenceSnapshot;
  faults: ActiveFault[];
  maintenanceZones: MaintenanceZone[];
}): AiOperationalInsight[] {
  const { regionalKpis, aiSnapshot, faults, maintenanceZones } = params;
  const criticalHealth = [...aiSnapshot.healthScores]
    .sort((a, b) => a.healthScore - b.healthScore)
    .slice(0, 3);
  const topHighRiskDistrict = regionalKpis
    .filter((k) => k.scopeLevel === 'DISTRICT' || k.scopeLevel === 'STATE')
    .sort((a, b) => a.gridReliabilityPct - b.gridReliabilityPct)[0];

  const insights: AiOperationalInsight[] = [
    {
      id: 'INS-FREQ-FAIL',
      category: 'FREQUENT_FAILURE',
      title: 'Repeated Thermal & Protection Trips on Aging Urban DTRs',
      summary:
        `${criticalHealth[0]?.assetName || 'DTR-TG-06U-104'} leads chronic fault recurrence due to peak load surges exceeding 90% capacity and overdue oil/winding maintenance.`,
      supportingMetrics: [
        `Lowest Asset Health Score: ${criticalHealth[0]?.healthScore ?? 42}/100`,
        `Peak Utilization: ${criticalHealth[0]?.peakLoadPct ?? 94}%`,
        `Active Distribution Faults: ${faults.filter((f) => f.status !== 'RESTORED').length}`
      ],
      impactedRegion: `${criticalHealth[0]?.district || 'Hyderabad'}, ${criticalHealth[0]?.state || 'Telangana'}`,
      relatedAssetIds: criticalHealth.map((h) => h.assetId),
      priority: 'CRITICAL'
    },
    {
      id: 'INS-INVEST-NEEDED',
      category: 'INVESTMENT_NEEDED',
      title: 'Feeder Capacity Augmentation Recommended for IT Corridor',
      summary:
        'High-density commercial feeders in HITEC City and Whitefield show sustained seasonal thermal stress requiring tie-switch automation and 11 kV parallel relief.',
      supportingMetrics: [
        `High-Risk Feeders Identified: ${aiSnapshot.riskIndices.filter((r) => r.scopeLevel === 'FEEDER' && r.riskLevel !== 'LOW').length}`,
        `Predicted 30d Failures: ${aiSnapshot.predictions.filter((p) => p.riskLevel === 'HIGH').length}`,
        `Est. Customer Exposure: ${faults.reduce((acc, f) => acc + (f.customersInterrupted ?? 0), 0)} customers`
      ],
      impactedRegion: 'Telangana & Karnataka Metro Circles',
      relatedAssetIds: aiSnapshot.predictions.slice(0, 3).map((p) => p.assetId),
      priority: 'HIGH'
    },
    {
      id: 'INS-REC-PATTERN',
      category: 'RECURRING_PATTERN',
      title: aiSnapshot.patterns[0]?.title || 'Monsoon Moisture & Surge Fault Clustering',
      summary:
        aiSnapshot.patterns[0]?.summary ||
        'Correlated telemetry indicates moisture ingress and harmonic trips spike 2.4x around evening peak load windows.',
      supportingMetrics: [
        `Cluster Occurrences: ${aiSnapshot.patterns[0]?.occurrencesCount ?? 4}`,
        `Pattern Scope: ${aiSnapshot.patterns[0]?.geographicScope || 'Hyderabad / Bengaluru'}`,
        `Model ROC-AUC: ${aiSnapshot.modelMetrics.rocAuc}`
      ],
      impactedRegion: aiSnapshot.patterns[0]?.geographicScope || 'Hyderabad Metro',
      relatedAssetIds: aiSnapshot.patterns[0]?.affectedAssetIds || ['DTR-TG-06U-104'],
      priority: 'HIGH'
    },
    {
      id: 'INS-MAINT-BOTTLENECK',
      category: 'MAINTENANCE_BOTTLENECK',
      title: 'Preventive Inspection Backlog in Multi-Feeder Substations',
      summary:
        `${aiSnapshot.healthScores.filter((h) => h.maintenanceOverdueDays > 60).length} utility assets exceed 60-day preventive maintenance intervals, elevating unplanned outage MTTR.`,
      supportingMetrics: [
        `Scheduled Maintenance Zones: ${maintenanceZones.length}`,
        `Avg National Maintenance Compliance: ${regionalKpis[0]?.maintenanceCompliancePct ?? 88}%`,
        `Mean Time to Repair (MTTR): ${regionalKpis[0]?.mttrHours ?? 2.3} hrs`
      ],
      impactedRegion: topHighRiskDistrict?.regionName || 'Hyderabad',
      relatedAssetIds: aiSnapshot.maintenanceQueue.slice(0, 3).map((m) => m.assetId),
      priority: 'MEDIUM'
    },
    {
      id: 'INS-HIGH-RISK-REG',
      category: 'HIGH_RISK_REGION',
      title: `Priority Reliability Watch: ${topHighRiskDistrict?.regionName || 'Hyderabad'} Circle`,
      summary:
        `${topHighRiskDistrict?.regionName || 'Hyderabad'} currently posts the lowest regional reliability (${topHighRiskDistrict?.gridReliabilityPct ?? 97.4}%) and highest fault density per 100 circuit-km.`,
      supportingMetrics: [
        `Reliability: ${topHighRiskDistrict?.gridReliabilityPct ?? 97.4}%`,
        `MTBF: ${topHighRiskDistrict?.mtbfHours ?? 540} hrs`,
        `Avg Dispatch Response: ${topHighRiskDistrict?.avgResponseTimeMin ?? 19} min`
      ],
      impactedRegion: topHighRiskDistrict?.regionName || 'Hyderabad',
      relatedAssetIds: criticalHealth.slice(0, 2).map((h) => h.assetId),
      priority: 'HIGH'
    }
  ];

  return insights;
}

export function buildAssetLifecycleRegistry(params: {
  assets: InfrastructureAsset[];
  faults: ActiveFault[];
  maintenanceZones: MaintenanceZone[];
  fieldTasks: FieldTask[];
}): AssetLifecycleRecord[] {
  const { assets, faults, maintenanceZones, fieldTasks } = params;

  return assets.map((asset) => {
    const installDate = asset.installationDate || '2019-06-15';
    const installYear = Number(installDate.slice(0, 4)) || 2019;
    const commissioningDate = `${installYear}-08-01`;
    const replacementYear = installYear + (asset.assetType === 'SUBSTATION' ? 30 : 20);
    const expectedReplacementDate = `${replacementYear}-06-30`;

    const hasFault =
      asset.status === 'FAULTED' ||
      faults.some((f) => f.affectedAssetId === asset.canonicalId && f.status !== 'RESTORED');
    const hasTask = fieldTasks.some((t) => t.assetId === asset.canonicalId);
    const hasMaintenance = maintenanceZones.some(
      (m) => m.feederId === asset.canonicalId || m.feederId === asset.feederId
    );

    const currentStage: AssetLifecycleStage = hasFault
      ? 'REPAIR'
      : hasMaintenance
        ? 'MAINTENANCE'
        : installYear <= 2017
          ? 'UPGRADE'
          : 'ROUTINE_INSPECTION';

    const events: AssetLifecycleEvent[] = [
      {
        id: `LC-${asset.canonicalId}-INST`,
        stage: 'INSTALLATION',
        date: installDate,
        performedBy: asset.operator || 'Utility Capital Projects',
        summary: `Physical erection, civil foundation, and primary busbar termination for ${asset.canonicalId}.`,
        costInrLakhs: asset.assetType === 'SUBSTATION' ? 185 : asset.assetType === 'FEEDER' ? 34 : 11
      },
      {
        id: `LC-${asset.canonicalId}-COMM`,
        stage: 'COMMISSIONING',
        date: commissioningDate,
        performedBy: 'Protection & Testing Wing',
        summary: `Megger insulation check, SCADA RTU point verification, and energized load soaking.`,
        costInrLakhs: 2.4
      },
      {
        id: `LC-${asset.canonicalId}-INSP`,
        stage: 'ROUTINE_INSPECTION',
        date: asset.lastInspectionDate || '2026-09-20',
        performedBy: 'Circle Inspection Crew',
        summary: `Thermography scan, bushing visual inspection, and protective relay trip audit.`
      }
    ];

    if (hasMaintenance || hasTask) {
      events.push({
        id: `LC-${asset.canonicalId}-MAINT`,
        stage: 'MAINTENANCE',
        date: '2026-10-28',
        performedBy: 'Field Operations Team',
        summary: 'Scheduled preventive oil filtration, tap-changer servicing, and torque tightening.',
        costInrLakhs: 1.8
      });
    }

    if (hasFault) {
      events.push({
        id: `LC-${asset.canonicalId}-REP`,
        stage: 'REPAIR',
        date: '2026-11-17',
        performedBy: 'Emergency Restoration Crew',
        summary: 'Active fault isolation, winding resistance diagnostic, and restoration work order execution.',
        costInrLakhs: 4.6
      });
    } else if (installYear <= 2017) {
      events.push({
        id: `LC-${asset.canonicalId}-UPG`,
        stage: 'UPGRADE',
        date: '2025-12-10',
        performedBy: 'Grid Modernization Unit',
        summary: 'Smart RTU telemetry retrofit and automated fault-passage indicator upgrade.',
        costInrLakhs: 6.5
      });
    }

    return {
      assetId: asset.canonicalId,
      assetName: formatMissingValue(asset.rawName ?? asset.name),
      assetType: asset.assetType,
      currentStage,
      installationDate: installDate,
      commissioningDate,
      expectedReplacementDate,
      totalInspections: 3 + (hasMaintenance ? 2 : 0) + (hasFault ? 1 : 0),
      events
    };
  });
}

export function compareEnterpriseScenarios(
  scenarios: SimulationScenario[],
  faults: ActiveFault[]
): EnterpriseScenarioComparisonRow[] {
  const activeInterrupted = faults
    .filter((f) => f.status !== 'RESTORED')
    .reduce((sum, f) => sum + (f.customersInterrupted ?? 420), 0);

  const baselineRow: EnterpriseScenarioComparisonRow = {
    scenarioId: 'BASELINE-CURRENT-NETWORK',
    label: 'Current Network (Unmitigated)',
    scenarioType: 'LIVE_BASELINE',
    customerImpactCount: activeInterrupted || 1240,
    riskLevel: faults.some((f) => f.severity === 'CRITICAL') ? 'HIGH' : 'MEDIUM',
    estimatedRestorationMin: 185,
    resourceUtilizationPct: 94,
    estimatedCostInrLakhs: 14.5,
    minVoltagePu: 0.918,
    isBaseline: true
  };

  const scenarioRows: EnterpriseScenarioComparisonRow[] = scenarios.slice(0, 4).map((sc) => {
    const afterCustomers =
      sc.impactAnalysis.consumersAffectedAfter ??
      Math.max(0, (sc.impactAnalysis.consumersAffectedBefore ?? activeInterrupted) - (sc.impactAnalysis.consumersRestored ?? 350));
    const costLakhs =
      Math.round(
        (2.2 +
          sc.transferredLoadMva * 0.45 +
          (sc.riskAssessment.level === 'HIGH' ? 5.8 : sc.riskAssessment.level === 'MEDIUM' ? 2.4 : 0.9)) *
          10
      ) / 10;

    return {
      scenarioId: sc.id,
      label: `${sc.scenarioCode}: ${sc.title.slice(0, 38)}`,
      scenarioType: sc.scenarioType,
      customerImpactCount: afterCustomers,
      riskLevel: sc.riskAssessment.level,
      estimatedRestorationMin:
        sc.recommendation.estimatedRestorationMinutes ??
        sc.impactAnalysis.expectedOutageDurationMin ??
        sc.expectedDurationMin,
      resourceUtilizationPct: sc.impactAnalysis.networkUtilizationAfterPct,
      estimatedCostInrLakhs: costLakhs,
      minVoltagePu: sc.minBusVoltagePu,
      isBaseline: false
    };
  });

  return [baselineRow, ...scenarioRows];
}
