import type {
  ActiveFault,
  AssetTelemetryStatus,
  DataQualityIssue,
  EventReconstructionIncident,
  FieldEngineer,
  FieldTask,
  GraphEdgeData,
  GraphNodeData,
  InfrastructureAsset,
  OperationalEvent,
  PowerLine,
  RootCauseAnalysis
} from '../types/grid.ts';
import { formatMissingValue, getConnectedPathForAsset } from './syntheticData.ts';

function isKnownLabel(val?: string | null): val is string {
  if (!val) return false;
  const trimmed = val.trim();
  return (
    trimmed.length > 0 &&
    trimmed !== 'Not available' &&
    trimmed !== 'Not mapped' &&
    trimmed !== 'Unknown' &&
    trimmed !== 'N/A'
  );
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getAssetPriority(asset: InfrastructureAsset): number {
  switch (asset.assetType) {
    case 'SUBSTATION':
    case 'PLANT':
      return 0;
    case 'FEEDER':
      return 1;
    case 'TRANSFORMER':
      return 2;
    case 'CIRCUIT_BREAKER':
    case 'SECTIONALIZER':
    case 'RECLOSER':
      return 3;
    default:
      return 4;
  }
}

export function formatAssetGeographicLocation(asset: InfrastructureAsset): string {
  const parts = [asset.area, asset.city, asset.district, asset.state].filter(isKnownLabel);
  const deduped = Array.from(new Set(parts));
  return deduped.length > 0 ? deduped.join(', ') : 'Not available';
}

function worstStatus(
  statuses: Array<GraphNodeData['status']>
): GraphNodeData['status'] {
  if (statuses.includes('FAULTED')) return 'FAULTED';
  if (statuses.includes('WARNING')) return 'WARNING';
  if (statuses.includes('DE_ENERGIZED')) return 'DE_ENERGIZED';
  if (statuses.includes('MAINTENANCE')) return 'MAINTENANCE';
  if (statuses.includes('ACTIVE')) return 'ACTIVE';
  return 'UNKNOWN';
}

export function makeStateNodeId(state: string): string {
  return `GEO-STATE-${state.replace(/[^a-zA-Z0-9]+/g, '-').toUpperCase()}`;
}

export function makeDistrictNodeId(state: string, district: string): string {
  return `GEO-DIST-${state.replace(/[^a-zA-Z0-9]+/g, '-').toUpperCase()}-${district
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .toUpperCase()}`;
}

export function makeClusterNodeId(transformerId: string): string {
  return `CLU-${transformerId}`;
}

export interface HierarchicalGraphResult {
  nodes: Array<{ data: GraphNodeData }>;
  edges: Array<{ data: GraphEdgeData }>;
}

/**
 * Builds the 7-tier hierarchical Knowledge Graph:
 * State -> District -> Substation -> Feeder -> Transformer -> Switch -> Consumer Cluster
 * Preserves 1:1 canonical IDs for every electrical asset and derives geographic/consumer nodes cleanly.
 */
export function buildHierarchicalKnowledgeGraph(params: {
  assets: InfrastructureAsset[];
  allAssets: InfrastructureAsset[];
  telemetryByAssetId: Record<string, AssetTelemetryStatus>;
  faults: ActiveFault[];
  reconstructions: EventReconstructionIncident[];
  selectedAssetId?: string | null;
  includeGeoAndConsumerTiers?: boolean;
  fieldEngineers?: FieldEngineer[];
  fieldTasks?: FieldTask[];
  selectedEngineerId?: string | null;
}): HierarchicalGraphResult {
  const {
    assets,
    allAssets,
    telemetryByAssetId,
    faults,
    reconstructions,
    selectedAssetId,
    includeGeoAndConsumerTiers = true,
    fieldEngineers = [],
    fieldTasks = [],
    selectedEngineerId = null
  } = params;

  const sourcePool = assets.length > 0 ? assets : allAssets;
  const sortedPool = [...sourcePool].sort((a, b) => {
    const pDiff = getAssetPriority(a) - getAssetPriority(b);
    if (pDiff !== 0) return pDiff;
    return a.canonicalId.localeCompare(b.canonicalId);
  });

  const chosen: InfrastructureAsset[] = sortedPool.slice(0, 64);
  if (selectedAssetId) {
    const selectedMatch =
      sourcePool.find((a) => a.canonicalId === selectedAssetId || a.id === selectedAssetId) ||
      allAssets.find((a) => a.canonicalId === selectedAssetId || a.id === selectedAssetId);
    if (selectedMatch && !chosen.some((a) => a.canonicalId === selectedMatch.canonicalId)) {
      chosen.unshift(selectedMatch);
    }
  }

  const chosenById = new Map<string, InfrastructureAsset>(
    chosen.map((a) => [a.canonicalId, a])
  );

  const resolvedStatusMap = new Map<string, GraphNodeData['status']>();
  for (const asset of chosen) {
    const tel = telemetryByAssetId[asset.canonicalId];
    const derivedStatus: GraphNodeData['status'] = tel
      ? tel.status === 'FAULT'
        ? 'FAULTED'
        : tel.status === 'WARNING'
          ? 'WARNING'
          : 'ACTIVE'
      : asset.status;
    resolvedStatusMap.set(asset.canonicalId, derivedStatus);
  }

  const nodesMap = new Map<string, GraphNodeData>();
  const edges: Array<{ data: GraphEdgeData }> = [];
  const seenEdges = new Set<string>();

  const addNode = (data: GraphNodeData) => {
    if (!nodesMap.has(data.id)) {
      nodesMap.set(data.id, data);
    }
  };

  const addEdge = (
    srcId: string,
    tgtId: string,
    label: string,
    edgeStatus: GraphEdgeData['status'] = 'NORMAL'
  ) => {
    if (srcId === tgtId) return;
    if (!nodesMap.has(srcId) || !nodesMap.has(tgtId)) return;
    const key = `${srcId}__${tgtId}`;
    if (seenEdges.has(key)) return;
    seenEdges.add(key);
    const srcNode = nodesMap.get(srcId)!;
    const tgtNode = nodesMap.get(tgtId)!;
    const isFaulted =
      edgeStatus === 'ISOLATED' ||
      srcNode.status === 'FAULTED' ||
      tgtNode.status === 'FAULTED';
    edges.push({
      data: {
        id: `edge-${key}`,
        source: srcId,
        target: tgtId,
        label,
        status: isFaulted ? 'ISOLATED' : edgeStatus
      }
    });
  };

  // 1. Add electrical asset nodes
  for (const asset of chosen) {
    const tel = telemetryByAssetId[asset.canonicalId];
    const status = resolvedStatusMap.get(asset.canonicalId) ?? asset.status;
    const displayName =
      asset.rawName && asset.rawName !== 'Not available'
        ? asset.rawName
        : formatMissingValue(asset.name) !== 'Not available'
          ? asset.name
          : asset.osmType;

    addNode({
      id: asset.canonicalId,
      canonicalId: asset.canonicalId,
      label: `${asset.canonicalId}\n${displayName.slice(0, 26)}`,
      assetName: displayName,
      type: asset.assetType,
      osmType: asset.osmType,
      feederId: asset.feederId,
      substationId: asset.substationId,
      status,
      voltage: asset.voltage,
      operator: asset.operator,
      voltageKv: asset.nominalVoltageKv,
      loadPct: asset.peakLoadPct,
      hasConflict: asset.hasConflict,
      source: tel ? tel.source : asset.source,
      geographicLocation: formatAssetGeographicLocation(asset),
      stateName: isKnownLabel(asset.state) ? asset.state : undefined,
      districtName: isKnownLabel(asset.district) ? asset.district : undefined
    });
  }

  // 2. Add State -> District hierarchy nodes when enabled
  if (includeGeoAndConsumerTiers) {
    const assetsByState = new Map<string, InfrastructureAsset[]>();
    const assetsByDistrict = new Map<string, InfrastructureAsset[]>();

    for (const asset of chosen) {
      if (!isKnownLabel(asset.state)) continue;
      const sArr = assetsByState.get(asset.state) ?? [];
      sArr.push(asset);
      assetsByState.set(asset.state, sArr);

      if (isKnownLabel(asset.district)) {
        const dKey = `${asset.state}::${asset.district}`;
        const dArr = assetsByDistrict.get(dKey) ?? [];
        dArr.push(asset);
        assetsByDistrict.set(dKey, dArr);
      }
    }

    for (const [stateName, stateAssets] of assetsByState.entries()) {
      const stateId = makeStateNodeId(stateName);
      const stateStatus = worstStatus(
        stateAssets.map((a) => resolvedStatusMap.get(a.canonicalId) ?? a.status)
      );
      const repSub =
        stateAssets.find((a) => a.assetType === 'SUBSTATION') || stateAssets[0];

      addNode({
        id: stateId,
        canonicalId: stateId,
        label: `${stateName}\nState Grid`,
        assetName: `${stateName} State Grid`,
        type: 'STATE',
        feederId: null,
        substationId: null,
        status: stateStatus,
        voltage: '132/33/11 kV',
        operator: repSub?.operator ?? null,
        voltageKv: 132,
        source: stateAssets.every((a) => a.source === 'DEMO') ? 'DEMO' : repSub?.source ?? 'DEMO',
        geographicLocation: `${stateName}, India`,
        stateName,
        targetAssetId: repSub?.canonicalId
      });
    }

    for (const [dKey, distAssets] of assetsByDistrict.entries()) {
      const [stateName, districtName] = dKey.split('::');
      const stateId = makeStateNodeId(stateName);
      const distId = makeDistrictNodeId(stateName, districtName);
      const distStatus = worstStatus(
        distAssets.map((a) => resolvedStatusMap.get(a.canonicalId) ?? a.status)
      );
      const repSub =
        distAssets.find((a) => a.assetType === 'SUBSTATION') || distAssets[0];

      addNode({
        id: distId,
        canonicalId: distId,
        label: `${districtName}\nDistrict Circle`,
        assetName: `${districtName} Distribution Circle`,
        type: 'DISTRICT',
        feederId: null,
        substationId: null,
        status: distStatus,
        voltage: '33/11 kV',
        operator: repSub?.operator ?? null,
        voltageKv: 33,
        source: distAssets.every((a) => a.source === 'DEMO') ? 'DEMO' : repSub?.source ?? 'DEMO',
        geographicLocation: `${districtName}, ${stateName}`,
        stateName,
        districtName,
        targetAssetId: repSub?.canonicalId
      });

      addEdge(stateId, distId, 'CONTAINS_DISTRICT');
    }

    // Link District (or State) -> Substations/Plants
    for (const asset of chosen) {
      if (asset.assetType !== 'SUBSTATION' && asset.assetType !== 'PLANT') continue;
      if (isKnownLabel(asset.state) && isKnownLabel(asset.district)) {
        addEdge(
          makeDistrictNodeId(asset.state, asset.district),
          asset.canonicalId,
          'SERVES_SUBSTATION'
        );
      } else if (isKnownLabel(asset.state)) {
        addEdge(makeStateNodeId(asset.state), asset.canonicalId, 'SERVES_SUBSTATION');
      }
    }
  }

  // 3. Electrical Hierarchy: Substation -> Feeder -> Transformer -> Switch -> Consumer Cluster
  const switchesByFeeder = new Map<string, InfrastructureAsset[]>();
  for (const asset of chosen) {
    if (
      (asset.assetType === 'SECTIONALIZER' ||
        asset.assetType === 'RECLOSER' ||
        asset.assetType === 'CIRCUIT_BREAKER') &&
      asset.feederId
    ) {
      const list = switchesByFeeder.get(asset.feederId) ?? [];
      list.push(asset);
      switchesByFeeder.set(asset.feederId, list);
    }
  }

  for (const asset of chosen) {
    if (asset.assetType === 'FEEDER' && asset.substationId) {
      addEdge(asset.substationId, asset.canonicalId, 'FEEDS');
    } else if (asset.assetType === 'TRANSFORMER') {
      if (asset.feederId && nodesMap.has(asset.feederId)) {
        addEdge(asset.feederId, asset.canonicalId, 'FEEDS_DTR');
      } else if (asset.substationId && nodesMap.has(asset.substationId)) {
        addEdge(asset.substationId, asset.canonicalId, 'FEEDS_DTR');
      }

      // Connect Transformer -> Sectionalizer/Switch on the same feeder when present
      const feederSwitches = asset.feederId ? switchesByFeeder.get(asset.feederId) ?? [] : [];
      const sectionalizer =
        feederSwitches.find(
          (sw) => sw.assetType === 'SECTIONALIZER' || sw.assetType === 'RECLOSER'
        ) || feederSwitches[0];

      if (sectionalizer && sectionalizer.canonicalId !== asset.canonicalId) {
        addEdge(
          asset.canonicalId,
          sectionalizer.canonicalId,
          sectionalizer.assetType === 'SECTIONALIZER' ? 'SECTIONALIZED_BY' : 'PROTECTED_BY'
        );
      }
    } else if (
      (asset.assetType === 'CIRCUIT_BREAKER' ||
        asset.assetType === 'SECTIONALIZER' ||
        asset.assetType === 'RECLOSER') &&
      asset.feederId
    ) {
      addEdge(asset.feederId, asset.canonicalId, 'SWITCH_BAY');
      if (asset.canonicalId === 'SW-TG-06U-14' && chosenById.has('FDR-TG-06U-02')) {
        addEdge('SW-TG-06U-14', 'FDR-TG-06U-02', 'TIE_OPEN', 'TIE_OPEN');
      }
    }
  }

  // 4. Add Consumer Cluster downstream nodes linked from Switch (or Transformer)
  if (includeGeoAndConsumerTiers) {
    for (const asset of chosen) {
      if (asset.assetType !== 'TRANSFORMER') continue;
      const dtrStatus = resolvedStatusMap.get(asset.canonicalId) ?? asset.status;
      const matchingIncident = reconstructions.find(
        (inc) =>
          inc.affectedTransformerIds.includes(asset.canonicalId) ||
          inc.affectedAssetIds.includes(asset.canonicalId)
      );
      const matchingFault = faults.find(
        (f) =>
          f.affectedAssetId === asset.canonicalId ||
          f.affectedTransformerIds?.includes(asset.canonicalId)
      );
      const consumersCount =
        matchingIncident?.affectedConsumersCount ??
        matchingFault?.customersInterrupted ??
        (asset.source === 'DEMO' ? (asset.status === 'ACTIVE' ? 320 : null) : null);

      const clusterId = makeClusterNodeId(asset.canonicalId);
      const areaLabel = isKnownLabel(asset.area)
        ? asset.area
        : isKnownLabel(asset.city)
          ? asset.city
          : asset.canonicalId;

      addNode({
        id: clusterId,
        canonicalId: clusterId,
        label: `${areaLabel}\nConsumer Cluster`,
        assetName: `${areaLabel} Consumer Cluster`,
        type: 'CONSUMER_CLUSTER',
        feederId: asset.feederId,
        substationId: asset.substationId,
        status: dtrStatus,
        voltage: '0.433 kV LT',
        operator: asset.operator,
        voltageKv: 0.433,
        source: asset.source,
        geographicLocation: formatAssetGeographicLocation(asset),
        stateName: isKnownLabel(asset.state) ? asset.state : undefined,
        districtName: isKnownLabel(asset.district) ? asset.district : undefined,
        consumersCount,
        targetAssetId: asset.canonicalId
      });

      const feederSwitches = asset.feederId ? switchesByFeeder.get(asset.feederId) ?? [] : [];
      const downstreamSwitch =
        feederSwitches.find(
          (sw) => sw.assetType === 'SECTIONALIZER' || sw.assetType === 'RECLOSER'
        ) || feederSwitches[0];

      if (downstreamSwitch && nodesMap.has(downstreamSwitch.canonicalId)) {
        addEdge(downstreamSwitch.canonicalId, clusterId, 'SUPPLIES_CLUSTER');
      } else {
        addEdge(asset.canonicalId, clusterId, 'SUPPLIES_CLUSTER');
      }
    }
  }

  // 5. Spatial fallback links for OSM elements lacking explicit parent tags
  const hubs = chosen.filter(
    (a) =>
      a.assetType === 'SUBSTATION' ||
      a.assetType === 'PLANT' ||
      a.assetType === 'FEEDER'
  );

  for (const asset of chosen) {
    if (asset.source !== 'OSM') continue;
    if (asset.assetType === 'SUBSTATION' || asset.assetType === 'PLANT') continue;

    let bestHub: InfrastructureAsset | null = null;
    let bestDist = Infinity;
    for (const hub of hubs) {
      if (hub.canonicalId === asset.canonicalId) continue;
      const d = haversineMeters(asset.latitude, asset.longitude, hub.latitude, hub.longitude);
      if (d < 5000 && d < bestDist) {
        bestDist = d;
        bestHub = hub;
      }
    }
    if (bestHub) {
      addEdge(
        bestHub.canonicalId,
        asset.canonicalId,
        bestHub.assetType === 'FEEDER' ? 'ALONG_LINE' : 'NEAR_HUB'
      );
    }
  }

  // 6. Phase 11 Field Operations Layer:
  // Engineer -> Assigned Incident -> Affected Transformer -> Affected Feeder -> Substation -> Related Historical Incidents
  if (fieldEngineers.length > 0) {
    const activeEngineers = selectedEngineerId
      ? fieldEngineers.filter(
          (eng) =>
            eng.engineerId === selectedEngineerId ||
            eng.currentTaskId !== null ||
            eng.status !== 'OFFLINE'
        )
      : fieldEngineers.filter((eng) => eng.currentTaskId !== null || eng.status === 'TRAVELING' || eng.status === 'WORKING');

    for (const eng of activeEngineers.slice(0, 6)) {
      const assignedTask =
        fieldTasks.find(
          (t) =>
            t.id === eng.currentTaskId ||
            t.engineerId === eng.engineerId ||
            t.assignedEngineerEmail.toLowerCase() === eng.email.toLowerCase()
        ) || null;
      const targetAssetId = eng.currentAssetId || assignedTask?.assetId || null;
      const targetAsset = targetAssetId
        ? allAssets.find((a) => a.canonicalId === targetAssetId) ||
          chosenById.get(targetAssetId) ||
          null
        : null;

      // Ensure target asset + its feeder & substation exist in nodesMap when selectedEngineerId is active
      if (targetAsset) {
        if (!nodesMap.has(targetAsset.canonicalId)) {
          addNode({
            id: targetAsset.canonicalId,
            canonicalId: targetAsset.canonicalId,
            label: `${targetAsset.canonicalId}\n${targetAsset.name.slice(0, 26)}`,
            assetName: targetAsset.name,
            type: targetAsset.assetType,
            osmType: targetAsset.osmType,
            feederId: targetAsset.feederId,
            substationId: targetAsset.substationId,
            status: resolvedStatusMap.get(targetAsset.canonicalId) ?? targetAsset.status,
            voltage: targetAsset.voltage,
            operator: targetAsset.operator,
            voltageKv: targetAsset.nominalVoltageKv,
            loadPct: targetAsset.peakLoadPct,
            hasConflict: targetAsset.hasConflict,
            source: targetAsset.source,
            geographicLocation: formatAssetGeographicLocation(targetAsset),
            stateName: isKnownLabel(targetAsset.state) ? targetAsset.state : undefined,
            districtName: isKnownLabel(targetAsset.district) ? targetAsset.district : undefined
          });
        }
        if (targetAsset.feederId && !nodesMap.has(targetAsset.feederId)) {
          const feederAsset = allAssets.find((a) => a.canonicalId === targetAsset.feederId);
          if (feederAsset) {
            addNode({
              id: feederAsset.canonicalId,
              canonicalId: feederAsset.canonicalId,
              label: `${feederAsset.canonicalId}\n${feederAsset.name.slice(0, 26)}`,
              assetName: feederAsset.name,
              type: feederAsset.assetType,
              osmType: feederAsset.osmType,
              feederId: feederAsset.feederId,
              substationId: feederAsset.substationId,
              status: feederAsset.status,
              voltage: feederAsset.voltage,
              operator: feederAsset.operator,
              voltageKv: feederAsset.nominalVoltageKv,
              source: feederAsset.source,
              geographicLocation: formatAssetGeographicLocation(feederAsset)
            });
            addEdge(feederAsset.canonicalId, targetAsset.canonicalId, 'FEEDS_DTR');
          }
        }
        if (targetAsset.substationId && !nodesMap.has(targetAsset.substationId)) {
          const subAsset = allAssets.find((a) => a.canonicalId === targetAsset.substationId);
          if (subAsset) {
            addNode({
              id: subAsset.canonicalId,
              canonicalId: subAsset.canonicalId,
              label: `${subAsset.canonicalId}\n${subAsset.name.slice(0, 26)}`,
              assetName: subAsset.name,
              type: subAsset.assetType,
              osmType: subAsset.osmType,
              feederId: subAsset.feederId,
              substationId: subAsset.substationId,
              status: subAsset.status,
              voltage: subAsset.voltage,
              operator: subAsset.operator,
              voltageKv: subAsset.nominalVoltageKv,
              source: subAsset.source,
              geographicLocation: formatAssetGeographicLocation(subAsset)
            });
            if (targetAsset.feederId) {
              addEdge(subAsset.canonicalId, targetAsset.feederId, 'FEEDS');
            }
          }
        }
      }

      const engNodeId = eng.engineerId;
      const engNodeStatus: GraphNodeData['status'] =
        eng.status === 'OFFLINE'
          ? 'DE_ENERGIZED'
          : eng.status === 'WORKING'
            ? 'WARNING'
            : 'ACTIVE';

      addNode({
        id: engNodeId,
        canonicalId: engNodeId,
        label: `${eng.name.split(' (')[0]}\n[${eng.status}]`,
        assetName: eng.name,
        type: 'FIELD_ENGINEER',
        feederId: targetAsset?.feederId ?? null,
        substationId: targetAsset?.substationId ?? null,
        status: engNodeStatus,
        voltage: `${eng.batteryPct}% Bat · ${eng.networkStatus}`,
        operator: eng.team,
        voltageKv: null,
        source: eng.source,
        geographicLocation: `${eng.assignedArea}, ${eng.district}`,
        targetAssetId: targetAssetId ?? undefined,
        engineerStatus: eng.status,
        engineerId: eng.engineerId
      });

      const matchingFault =
        (assignedTask?.faultId && faults.find((f) => f.id === assignedTask.faultId)) ||
        (targetAssetId && faults.find((f) => f.affectedAssetId === targetAssetId)) ||
        faults.find((f) => f.status !== 'RESTORED') ||
        null;

      if (matchingFault) {
        const incNodeId = `INC-${matchingFault.id}`;
        addNode({
          id: incNodeId,
          canonicalId: matchingFault.faultCode,
          label: `${matchingFault.faultCode}\nIncident`,
          assetName: matchingFault.title,
          type: 'INCIDENT',
          feederId: matchingFault.affectedFeederId,
          substationId: matchingFault.affectedSubstationId,
          status: matchingFault.status === 'RESTORED' ? 'ACTIVE' : 'FAULTED',
          voltage: matchingFault.severity,
          operator: matchingFault.description,
          voltageKv: null,
          source: matchingFault.source,
          geographicLocation: `${matchingFault.affectedAssetName}`,
          targetAssetId: matchingFault.affectedAssetId
        });

        addEdge(engNodeId, incNodeId, 'DISPATCHED_TO');
        if (targetAssetId && nodesMap.has(targetAssetId)) {
          addEdge(incNodeId, targetAssetId, 'AFFECTS_ASSET');
        } else if (nodesMap.has(matchingFault.affectedAssetId)) {
          addEdge(incNodeId, matchingFault.affectedAssetId, 'AFFECTS_ASSET');
        }

        // Link related historical incidents on same substation/feeder
        const histNodeId = `HIST-${matchingFault.affectedSubstationId || matchingFault.affectedAssetId}`;
        if (!nodesMap.has(histNodeId)) {
          const pastCount = reconstructions.filter(
            (r) =>
              r.substationId === matchingFault.affectedSubstationId ||
              r.affectedAssetIds.includes(matchingFault.affectedAssetId)
          ).length;
          addNode({
            id: histNodeId,
            canonicalId: histNodeId,
            label: `Historical Log\n(${Math.max(pastCount, 1)} prior)`,
            assetName: `Related Historical Incidents (${matchingFault.affectedSubstationId || matchingFault.affectedAssetId})`,
            type: 'HISTORICAL_INCIDENT',
            feederId: matchingFault.affectedFeederId,
            substationId: matchingFault.affectedSubstationId,
            status: 'WARNING',
            voltage: '24M History',
            operator: 'SCADA Incident Archive',
            voltageKv: null,
            source: matchingFault.source,
            geographicLocation: targetAsset ? formatAssetGeographicLocation(targetAsset) : 'Network Scope',
            targetAssetId: matchingFault.affectedSubstationId || matchingFault.affectedAssetId
          });
        }
        const hubSubId = matchingFault.affectedSubstationId || targetAsset?.substationId;
        if (hubSubId && nodesMap.has(hubSubId)) {
          addEdge(hubSubId, histNodeId, 'RELATED_HISTORY');
        } else if (targetAssetId && nodesMap.has(targetAssetId)) {
          addEdge(targetAssetId, histNodeId, 'RELATED_HISTORY');
        }
      } else if (targetAssetId && nodesMap.has(targetAssetId)) {
        addEdge(engNodeId, targetAssetId, 'ASSIGNED_ASSET');
      }
    }
  }

  return {
    nodes: Array.from(nodesMap.values()).map((data) => ({ data })),
    edges
  };
}

/**
 * Resolves connected node IDs across all 7 hierarchical Knowledge Graph tiers
 * (State -> District -> Substation -> Feeder -> Transformer -> Switch -> Consumer Cluster).
 */
export function getHierarchicalConnectedNodeIds(
  selectedNodeId: string | null,
  nodes: Array<{ data: GraphNodeData }>,
  edges: Array<{ data: GraphEdgeData }>,
  assets: InfrastructureAsset[],
  powerLines: PowerLine[]
): Set<string> {
  const result = new Set<string>();
  if (!selectedNodeId) return result;

  const nodeMap = new Map(nodes.map((n) => [n.data.id, n.data]));
  const selectedNode = nodeMap.get(selectedNodeId);

  // Seed with canonical electrical path if this corresponds to an electrical asset or cluster
  const baseAssetId =
    selectedNode?.type === 'CONSUMER_CLUSTER' && selectedNode.targetAssetId
      ? selectedNode.targetAssetId
      : selectedNodeId;
  const electricalPath = getConnectedPathForAsset(baseAssetId, assets, powerLines);
  for (const id of electricalPath.nodeIds) {
    result.add(id);
  }
  result.add(selectedNodeId);

  // Build adjacency maps for upstream/downstream traversal
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const e of edges) {
    const out = outgoing.get(e.data.source) ?? [];
    out.push(e.data.target);
    outgoing.set(e.data.source, out);

    const inc = incoming.get(e.data.target) ?? [];
    inc.push(e.data.source);
    incoming.set(e.data.target, inc);
  }

  // Traverse downstream from selectedNodeId (e.g. Engineer -> Incident -> Asset or State -> District -> Substation -> Feeder -> DTR -> Switch -> Cluster)
  if (
    selectedNode?.type === 'STATE' ||
    selectedNode?.type === 'DISTRICT' ||
    selectedNode?.type === 'SUBSTATION' ||
    selectedNode?.type === 'FEEDER' ||
    selectedNode?.type === 'FIELD_ENGINEER' ||
    selectedNode?.type === 'INCIDENT'
  ) {
    const queue = [selectedNodeId];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      for (const nxt of outgoing.get(curr) ?? []) {
        if (!result.has(nxt)) {
          result.add(nxt);
          queue.push(nxt);
        }
      }
    }
  } else {
    // Also attach downstream switches and consumer clusters reachable from electricalPath nodes
    const visitedDown = new Set<string>(result);
    const downQueue = Array.from(result);
    while (downQueue.length > 0) {
      const curr = downQueue.shift()!;
      for (const nxt of outgoing.get(curr) ?? []) {
        const nxtType = nodeMap.get(nxt)?.type;
        if (
          !visitedDown.has(nxt) &&
          (nxtType === 'CONSUMER_CLUSTER' ||
            nxtType === 'SECTIONALIZER' ||
            nxtType === 'RECLOSER' ||
            nxtType === 'CIRCUIT_BREAKER')
        ) {
          visitedDown.add(nxt);
          result.add(nxt);
          downQueue.push(nxt);
        }
      }
    }
  }

  // Traverse upstream to District and State from all seeded connected nodes
  const visitedUp = new Set<string>(result);
  const upQueue = Array.from(result);
  while (upQueue.length > 0) {
    const curr = upQueue.shift()!;
    for (const prev of incoming.get(curr) ?? []) {
      if (!visitedUp.has(prev)) {
        visitedUp.add(prev);
        result.add(prev);
        upQueue.push(prev);
      }
    }
  }

  return result;
}

/**
 * Deterministic Root Cause Analysis synthesis across Grid Map, Knowledge Graph,
 * Event Reconstruction, Live Telemetry, and Data Integrity conflicts.
 */
export function buildRootCauseAnalysis(params: {
  selectedAssetId: string | null;
  selectedFaultId: string | null;
  selectedReconstructionId: string;
  assets: InfrastructureAsset[];
  powerLines: PowerLine[];
  faults: ActiveFault[];
  reconstructions: EventReconstructionIncident[];
  events: OperationalEvent[];
  issues: DataQualityIssue[];
  telemetryByAssetId: Record<string, AssetTelemetryStatus>;
}): RootCauseAnalysis {
  const {
    selectedAssetId,
    selectedFaultId,
    selectedReconstructionId,
    assets,
    powerLines,
    faults,
    reconstructions,
    events,
    issues,
    telemetryByAssetId
  } = params;

  const targetAsset =
    (selectedAssetId &&
      assets.find((a) => a.canonicalId === selectedAssetId || a.id === selectedAssetId)) ||
    assets.find((a) => a.status === 'FAULTED') ||
    assets[0];

  const matchingFault =
    (selectedFaultId &&
      faults.find((f) => f.id === selectedFaultId || f.faultCode === selectedFaultId)) ||
    (targetAsset &&
      faults.find(
        (f) =>
          f.affectedAssetId === targetAsset.canonicalId ||
          f.affectedFeederId === targetAsset.canonicalId ||
          (targetAsset.feederId && f.affectedFeederId === targetAsset.feederId) ||
          (targetAsset.substationId && f.affectedSubstationId === targetAsset.substationId)
      )) ||
    faults[0] ||
    null;

  const matchingIncident =
    (matchingFault &&
      reconstructions.find(
        (inc) => inc.faultId === matchingFault.id || inc.id === matchingFault.relatedEventId
      )) ||
    (targetAsset &&
      reconstructions.find(
        (inc) =>
          inc.affectedAssetIds.includes(targetAsset.canonicalId) ||
          (targetAsset.feederId && inc.feederId === targetAsset.feederId) ||
          (targetAsset.substationId && inc.substationId === targetAsset.substationId)
      )) ||
    reconstructions.find((inc) => inc.id === selectedReconstructionId) ||
    reconstructions[0] ||
    null;

  const canonicalAssetId =
    targetAsset?.canonicalId ||
    matchingFault?.affectedAssetId ||
    matchingIncident?.affectedAssetIds[0] ||
    'SUB-TG-06U';

  const substationId =
    targetAsset?.substationId ||
    (targetAsset?.assetType === 'SUBSTATION' ? targetAsset.canonicalId : null) ||
    matchingIncident?.substationId ||
    matchingFault?.affectedSubstationId ||
    null;

  const feederId =
    targetAsset?.feederId ||
    (targetAsset?.assetType === 'FEEDER' ? targetAsset.canonicalId : null) ||
    matchingIncident?.feederId ||
    matchingFault?.affectedFeederId ||
    null;

  const path = getConnectedPathForAsset(canonicalAssetId, assets, powerLines);
  const relatedEvents = events.filter(
    (e) =>
      path.nodeIds.has(e.assetCanonicalId) ||
      e.assetCanonicalId === canonicalAssetId ||
      (feederId && e.assetCanonicalId === feederId)
  );
  const relatedIssues = issues.filter(
    (i) =>
      path.nodeIds.has(i.canonicalAssetId) ||
      i.canonicalAssetId === canonicalAssetId ||
      (substationId && i.canonicalAssetId === substationId)
  );

  // Pick candidate healthy sibling feeder & tie switch for What-If Simulator recovery
  const allFeeders = assets.filter((a) => a.assetType === 'FEEDER');
  const candidateTargetFeeder =
    allFeeders.find(
      (f) =>
        f.canonicalId !== feederId &&
        (!substationId || f.substationId === substationId) &&
        f.status !== 'FAULTED'
    ) ||
    allFeeders.find((f) => f.canonicalId !== feederId) ||
    null;

  const feederOrSubSwitches = assets.filter(
    (a) =>
      (a.assetType === 'SECTIONALIZER' ||
        a.assetType === 'RECLOSER' ||
        a.assetType === 'CIRCUIT_BREAKER') &&
      ((feederId && a.feederId === feederId) || (substationId && a.substationId === substationId))
  );

  const candidateSwitch =
    feederOrSubSwitches.find((a) => a.assetType === 'SECTIONALIZER') ||
    feederOrSubSwitches.find((a) => a.assetType === 'RECLOSER') ||
    feederOrSubSwitches[0] ||
    null;

  const tel = telemetryByAssetId[canonicalAssetId];
  const hasActiveIncident = Boolean(matchingFault || matchingIncident);

  const protectionSequence = matchingIncident
    ? matchingIncident.steps.map(
        (s) =>
          `Step ${s.stepNumber} (${s.timestamp.slice(11, 19)} UTC · ${s.assetId}): ${s.title}`
      )
    : relatedEvents.slice(0, 4).map((e) => `${e.timestamp.slice(11, 19)} UTC · ${e.assetCanonicalId}: ${e.eventType}`);

  const dataIntegrityCaveats: string[] = [];
  for (const issue of relatedIssues.filter((i) => i.status !== 'RESOLVED')) {
    dataIntegrityCaveats.push(`${issue.canonicalAssetId} (${issue.issueType}): ${issue.explanation}`);
  }
  for (const step of matchingIncident?.steps ?? []) {
    if (step.hasContradiction && step.contradictionDetail) {
      dataIntegrityCaveats.push(`${step.assetId}: ${step.contradictionDetail}`);
    }
  }
  for (const ev of relatedEvents) {
    if (ev.hasContradiction && ev.contradictionDetail) {
      dataIntegrityCaveats.push(`${ev.assetCanonicalId}: ${ev.contradictionDetail}`);
    }
  }

  const initiatingTrigger =
    matchingIncident?.steps[0]?.summary ||
    matchingFault?.description ||
    `Telemetry status ${tel?.status ?? targetAsset?.status ?? 'UNKNOWN'} on ${canonicalAssetId}`;

  const rootCauseSummary = matchingIncident
    ? `${matchingIncident.title} — Initiated at ${matchingIncident.steps[0]?.assetId ?? canonicalAssetId} and propagated along ${formatMissingValue(feederId)} to ${
        matchingIncident.affectedTransformerIds.length > 0
          ? matchingIncident.affectedTransformerIds.join(', ')
          : canonicalAssetId
      }.`
    : targetAsset
      ? `Asset ${canonicalAssetId} (${targetAsset.assetType}) operating in ${formatMissingValue(targetAsset.district)} under ${formatMissingValue(targetAsset.operator)}.${
          tel ? ` Live telemetry reports ${tel.status} (${tel.loadKw !== null ? `${tel.loadKw} kW` : 'Load: Not available'}).` : ''
        }`
      : 'No fault escalation detected in active geographic scope.';

  const affectedConsumersCount =
    matchingIncident?.affectedConsumersCount ?? matchingFault?.customersInterrupted ?? null;

  const areaLabel = targetAsset ? formatAssetGeographicLocation(targetAsset) : 'Not available';
  const consumerClusterLabel =
    affectedConsumersCount !== null
      ? `${affectedConsumersCount.toLocaleString()} Consumers · ${areaLabel}`
      : `Not available · ${areaLabel}`;

  const recommendedTransferMva =
    feederId === 'FDR-TG-06U-01' ? 3.4 : feederId === 'FDR-KA-01U-01' ? 2.8 : 2.5;

  const recommendedActionTitle = candidateTargetFeeder
    ? `Evaluate load transfer (${recommendedTransferMva.toFixed(1)} MVA) from ${formatMissingValue(
        feederId
      )} to ${candidateTargetFeeder.canonicalId}${
        candidateSwitch ? ` via ${candidateSwitch.canonicalId}` : ''
      }`
    : `Verify protection isolation and inspect ${canonicalAssetId}`;

  return {
    id: `RCA-${matchingIncident?.id ?? canonicalAssetId}`,
    canonicalAssetId,
    faultId: matchingFault?.id ?? null,
    incidentId: matchingIncident?.id ?? null,
    substationId,
    feederId,
    title: hasActiveIncident
      ? matchingFault?.title || matchingIncident?.title || `Root Cause: ${canonicalAssetId}`
      : `Operational Diagnostic: ${canonicalAssetId}`,
    severity: matchingFault?.severity ?? matchingIncident?.severity ?? (targetAsset?.status === 'FAULTED' ? 'CRITICAL' : 'INFO'),
    source: matchingIncident?.source ?? matchingFault?.source ?? targetAsset?.source ?? 'DEMO',
    confidencePct: dataIntegrityCaveats.length > 0 ? 86 : 94,
    initiatingTrigger,
    rootCauseSummary,
    protectionSequence,
    affectedPathIds: Array.from(path.nodeIds),
    affectedConsumersCount,
    consumerClusterLabel,
    dataIntegrityCaveats,
    recommendedActionTitle,
    recommendedTransferMva,
    recommendedTargetFeederId: candidateTargetFeeder?.canonicalId ?? null,
    recommendedTieSwitchId: candidateSwitch?.canonicalId ?? null,
    evidenceEventIds: relatedEvents.map((e) => e.id),
    evidenceIssueIds: relatedIssues.map((i) => i.id)
  };
}
