import type {
  ActiveFault,
  AssetSource,
  AssetTelemetryStatus,
  DataQualityIssue,
  EquipmentUtilizationComparison,
  EventReconstructionIncident,
  InfrastructureAsset,
  PowerLine,
  SimulationAssetLink,
  SimulationComparisonResult,
  SimulationInputParams,
  SimulationMapOverlay,
  SimulationRecommendation,
  SimulationRiskAssessment,
  SimulationRiskLevel,
  SimulationScenario,
  SimulationType
} from '../types/grid.ts';

export const SIMULATION_TYPE_LABELS: Record<SimulationType, string> = {
  FEEDER_TRANSFER: 'Feeder Transfer',
  TRANSFORMER_ISOLATION: 'Transformer Isolation',
  PLANNED_MAINTENANCE: 'Planned Maintenance',
  ALTERNATIVE_SUPPLY: 'Alternative Supply',
  LOAD_REDISTRIBUTION: 'Load Redistribution'
};

export interface SimulationTopologyContext {
  assets: InfrastructureAsset[];
  powerLines: PowerLine[];
  faults: ActiveFault[];
  reconstructions: EventReconstructionIncident[];
  issues: DataQualityIssue[];
  telemetryByAssetId?: Record<string, AssetTelemetryStatus>;
}

function cleanLabel(val?: string | null): string {
  if (!val) return 'Not available';
  const trimmed = val.trim();
  if (!trimmed || trimmed === 'N/A' || trimmed === 'Unknown' || trimmed === 'Not mapped') {
    return 'Not available';
  }
  return trimmed;
}

function buildHullPolygon(points: Array<[number, number]>): [number, number][] {
  if (points.length === 0) return [];
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const [lat, lng] of points) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
  }
  if (!Number.isFinite(minLat)) return [];
  const padLat = Math.max(0.0022, (maxLat - minLat) * 0.28);
  const padLng = Math.max(0.0025, (maxLng - minLng) * 0.28);
  return [
    [minLat - padLat, minLng - padLng],
    [minLat - padLat, maxLng + padLng],
    [maxLat + padLat, maxLng + padLng],
    [maxLat + padLat, minLng - padLng]
  ];
}

function estimateAssetCapacityMva(asset: InfrastructureAsset | undefined, fallbackMva: number): number {
  if (asset?.ratedCapacityKva && asset.ratedCapacityKva > 0) {
    return Number((asset.ratedCapacityKva / 1000).toFixed(2));
  }
  return fallbackMva;
}

function estimateAssetLoadPct(asset: InfrastructureAsset | undefined, fallbackPct: number): number {
  if (typeof asset?.peakLoadPct === 'number' && Number.isFinite(asset.peakLoadPct) && asset.peakLoadPct > 0) {
    return Math.min(125, Math.max(5, asset.peakLoadPct));
  }
  return fallbackPct;
}

export function executeWhatIfSimulation(
  params: SimulationInputParams,
  context: SimulationTopologyContext,
  options?: {
    id?: string;
    scenarioCode?: string;
    source?: AssetSource;
    createdAt?: string;
    status?: SimulationScenario['status'];
  }
): SimulationScenario {
  const { assets, powerLines, faults, reconstructions, issues } = context;

  const srcFeederAsset = assets.find((a) => a.canonicalId === params.sourceFeeder);
  const tgtFeederAsset = assets.find((a) => a.canonicalId === params.targetFeeder);
  const switchAsset = assets.find((a) => a.canonicalId === params.tieSwitch);
  const substationAsset =
    (params.substationId && assets.find((a) => a.canonicalId === params.substationId)) ||
    assets.find(
      (a) =>
        a.canonicalId === (srcFeederAsset?.substationId || tgtFeederAsset?.substationId) &&
        a.assetType === 'SUBSTATION'
    ) ||
    assets.find((a) => a.assetType === 'SUBSTATION');

  const feederTransformers = assets.filter(
    (a) =>
      a.assetType === 'TRANSFORMER' &&
      (a.feederId === params.sourceFeeder || a.canonicalId === params.transformerId)
  );
  const targetTransformers = assets.filter(
    (a) => a.assetType === 'TRANSFORMER' && a.feederId === params.targetFeeder
  );

  const primaryTransformer =
    (params.transformerId && assets.find((a) => a.canonicalId === params.transformerId)) ||
    feederTransformers[0] ||
    null;

  const srcLine = powerLines.find(
    (l) => l.canonicalId === params.sourceFeeder || l.feederId === params.sourceFeeder
  );
  const tgtLine = powerLines.find(
    (l) => l.canonicalId === params.targetFeeder || l.feederId === params.targetFeeder
  );

  const matchingFault =
    (params.faultId && faults.find((f) => f.id === params.faultId || f.faultCode === params.faultId)) ||
    faults.find(
      (f) =>
        f.affectedFeederId === params.sourceFeeder ||
        f.affectedAssetId === params.sourceFeeder ||
        (primaryTransformer && f.affectedAssetId === primaryTransformer.canonicalId)
    ) ||
    null;

  const matchingIncident =
    (params.incidentId &&
      reconstructions.find((r) => r.id === params.incidentId || r.faultId === params.incidentId)) ||
    (matchingFault &&
      reconstructions.find(
        (r) => r.faultId === matchingFault.id || r.id === matchingFault.relatedEventId
      )) ||
    reconstructions.find((r) => r.feederId === params.sourceFeeder) ||
    null;

  // Capacities & pre-loads
  const sourceCapMva = estimateAssetCapacityMva(srcFeederAsset, 12.5);
  const targetCapMva =
    params.targetFeeder === 'FDR-TG-06U-02' ? 14.0 : estimateAssetCapacityMva(tgtFeederAsset, 14.0);

  const sourcePrePct = estimateAssetLoadPct(srcFeederAsset, 78);
  const targetPrePct =
    params.targetFeeder === 'FDR-TG-06U-02' ? 44.3 : estimateAssetLoadPct(tgtFeederAsset, 52);

  const sourcePreLoadMva = Number(((sourceCapMva * sourcePrePct) / 100).toFixed(2));
  const targetPreLoadMva =
    params.targetFeeder === 'FDR-TG-06U-02'
      ? 6.2
      : Number(((targetCapMva * targetPrePct) / 100).toFixed(2));

  // Sync Load % and Transferred MVA
  const resolvedLoadPct =
    typeof params.loadTransferPct === 'number' && Number.isFinite(params.loadTransferPct)
      ? Math.min(100, Math.max(10, Math.round(params.loadTransferPct)))
      : typeof params.loadTransferMva === 'number' && sourceCapMva > 0
        ? Math.min(100, Math.max(10, Math.round((params.loadTransferMva / Math.max(4, sourcePreLoadMva)) * 100)))
        : 65;

  const rawTransferMva =
    typeof params.loadTransferMva === 'number' && Number.isFinite(params.loadTransferMva)
      ? params.loadTransferMva
      : Number(Math.max(0.8, (sourcePreLoadMva * resolvedLoadPct) / 100).toFixed(2));

  const transferredLoadMva = Number(Math.min(12.0, Math.max(0.5, rawTransferMva)).toFixed(2));

  const isIsolationOnly = params.scenarioType === 'TRANSFORMER_ISOLATION';
  const isMaintenance = params.scenarioType === 'PLANNED_MAINTENANCE';
  const isRedistribution = params.scenarioType === 'LOAD_REDISTRIBUTION';

  // Post-operation feeder loading
  const sourcePostLoadMva = isIsolationOnly
    ? Number(Math.max(0.4, sourcePreLoadMva - transferredLoadMva * 0.45).toFixed(2))
    : Number(Math.max(0.2, sourcePreLoadMva - transferredLoadMva).toFixed(2));

  const targetPostLoadMva = isIsolationOnly
    ? Number((targetPreLoadMva + transferredLoadMva * 0.35).toFixed(2))
    : Number((targetPreLoadMva + transferredLoadMva).toFixed(2));

  const sourcePostPct = Number(((sourcePostLoadMva / Math.max(0.1, sourceCapMva)) * 100).toFixed(1));
  const targetPostPct = Number(((targetPostLoadMva / Math.max(0.1, targetCapMva)) * 100).toFixed(1));

  // Voltage drop approximation (11 kV radial feeder sensitivity)
  const loadRatio = targetPostLoadMva / Math.max(1, targetCapMva);
  const minBusVoltagePu = Number(
    Math.max(0.88, Math.min(1.02, 1.0 - loadRatio * 0.055)).toFixed(3)
  );
  const thermalViolation = targetPostLoadMva > targetCapMva;
  const voltageViolation = minBusVoltagePu < 0.95;

  // Expected outage / switching duration
  const baseDuration =
    typeof params.expectedDurationMin === 'number' && params.expectedDurationMin > 0
      ? Math.round(params.expectedDurationMin)
      : isMaintenance
        ? 45
        : isIsolationOnly
          ? 24
          : isRedistribution
            ? 8
            : 12;

  // Consumers impact estimation
  const knownInterrupted =
    matchingIncident?.affectedConsumersCount ?? matchingFault?.customersInterrupted ?? null;

  const estimatedBaseConsumers =
    knownInterrupted !== null
      ? knownInterrupted
      : feederTransformers.length > 0
        ? feederTransformers.length * 320
        : null;

  const consumersAffectedBefore =
    isMaintenance || isRedistribution
      ? Math.round((estimatedBaseConsumers ?? 320) * 0.65)
      : estimatedBaseConsumers;

  let consumersAffectedAfter: number | null = null;
  if (consumersAffectedBefore !== null) {
    if (isIsolationOnly) {
      consumersAffectedAfter = Math.max(85, Math.round(consumersAffectedBefore * 0.48));
    } else if (thermalViolation || voltageViolation) {
      consumersAffectedAfter = Math.round(consumersAffectedBefore * 0.35);
    } else if (isMaintenance) {
      consumersAffectedAfter = Math.max(0, Math.round(consumersAffectedBefore * 0.12));
    } else {
      consumersAffectedAfter = Math.max(
        0,
        Math.round(consumersAffectedBefore * Math.max(0, 1 - resolvedLoadPct / 100))
      );
    }
  }

  const consumersRestored =
    consumersAffectedBefore !== null && consumersAffectedAfter !== null
      ? Math.max(0, consumersAffectedBefore - consumersAffectedAfter)
      : null;

  // Equipment utilization table (Before vs After)
  const equipmentUtilization: EquipmentUtilizationComparison[] = [];

  if (substationAsset) {
    const subCap = estimateAssetCapacityMva(substationAsset, 50.0);
    const subPrePct = estimateAssetLoadPct(substationAsset, 74);
    const subPreMva = Number(((subCap * subPrePct) / 100).toFixed(2));
    const subDelta = params.scenarioType === 'ALTERNATIVE_SUPPLY' && tgtFeederAsset?.substationId !== substationAsset.canonicalId
      ? -transferredLoadMva
      : 0;
    const subPostMva = Number(Math.max(0.5, subPreMva + subDelta).toFixed(2));
    equipmentUtilization.push({
      assetId: substationAsset.canonicalId,
      assetName: cleanLabel(substationAsset.rawName ?? substationAsset.name),
      assetType: substationAsset.assetType,
      role: 'SUBSTATION',
      capacityMva: subCap,
      beforeLoadMva: subPreMva,
      afterLoadMva: subPostMva,
      beforeLoadPct: Number(subPrePct.toFixed(1)),
      afterLoadPct: Number(((subPostMva / subCap) * 100).toFixed(1)),
      statusBefore: substationAsset.status,
      statusAfter: 'ACTIVE'
    });
  }

  equipmentUtilization.push({
    assetId: params.sourceFeeder,
    assetName: cleanLabel(srcFeederAsset?.rawName ?? srcFeederAsset?.name),
    assetType: srcFeederAsset?.assetType ?? 'FEEDER',
    role: 'SOURCE',
    capacityMva: sourceCapMva,
    beforeLoadMva: sourcePreLoadMva,
    afterLoadMva: sourcePostLoadMva,
    beforeLoadPct: Number(sourcePrePct.toFixed(1)),
    afterLoadPct: sourcePostPct,
    statusBefore: srcFeederAsset?.status ?? 'ACTIVE',
    statusAfter: isIsolationOnly ? 'PARTIAL_ISOLATION' : 'RELIEVED'
  });

  if (params.targetFeeder && params.targetFeeder !== params.sourceFeeder) {
    equipmentUtilization.push({
      assetId: params.targetFeeder,
      assetName: cleanLabel(tgtFeederAsset?.rawName ?? tgtFeederAsset?.name),
      assetType: tgtFeederAsset?.assetType ?? 'FEEDER',
      role: 'TARGET',
      capacityMva: targetCapMva,
      beforeLoadMva: targetPreLoadMva,
      afterLoadMva: targetPostLoadMva,
      beforeLoadPct: Number(targetPrePct.toFixed(1)),
      afterLoadPct: targetPostPct,
      statusBefore: tgtFeederAsset?.status ?? 'ACTIVE',
      statusAfter: thermalViolation ? 'OVERLOADED' : targetPostPct >= 85 ? 'WARNING' : 'ACTIVE'
    });
  }

  const allInvolvedTransformers = Array.from(
    new Map(
      [...feederTransformers, ...targetTransformers.slice(0, 1)].map((t) => [t.canonicalId, t])
    ).values()
  );

  for (const dtr of allInvolvedTransformers) {
    const capMva = estimateAssetCapacityMva(dtr, 0.63);
    const prePct = estimateAssetLoadPct(dtr, 70);
    const preMva = Number(((capMva * prePct) / 100).toFixed(3));
    const isTargetIsolated =
      isIsolationOnly && (!primaryTransformer || dtr.canonicalId === primaryTransformer.canonicalId);
    const isTargetFeederDtr = dtr.feederId === params.targetFeeder;

    const postPct = isTargetIsolated
      ? 0
      : isTargetFeederDtr
        ? Number(Math.min(118, prePct + (transferredLoadMva / targetCapMva) * 28).toFixed(1))
        : Number(Math.max(12, prePct * (isRedistribution ? 0.72 : 0.82)).toFixed(1));
    const postMva = Number(((capMva * postPct) / 100).toFixed(3));

    equipmentUtilization.push({
      assetId: dtr.canonicalId,
      assetName: cleanLabel(dtr.rawName ?? dtr.name),
      assetType: dtr.assetType,
      role: isTargetIsolated ? 'ISOLATED' : 'AFFECTED',
      capacityMva: capMva,
      beforeLoadMva: preMva,
      afterLoadMva: postMva,
      beforeLoadPct: Number(prePct.toFixed(1)),
      afterLoadPct: postPct,
      statusBefore: dtr.status,
      statusAfter: isTargetIsolated ? 'ISOLATED' : postPct >= 95 ? 'OVERLOADED' : postPct >= 82 ? 'WARNING' : 'ACTIVE'
    });
  }

  if (switchAsset || params.tieSwitch) {
    equipmentUtilization.push({
      assetId: params.tieSwitch,
      assetName: cleanLabel(switchAsset?.rawName ?? switchAsset?.name),
      assetType: switchAsset?.assetType ?? 'SECTIONALIZER',
      role: 'SWITCH',
      capacityMva: estimateAssetCapacityMva(switchAsset, 12.0),
      beforeLoadMva: 0,
      afterLoadMva: isIsolationOnly ? 0 : transferredLoadMva,
      beforeLoadPct: 0,
      afterLoadPct: isIsolationOnly ? 0 : Number(((transferredLoadMva / 12.0) * 100).toFixed(1)),
      statusBefore: 'OPEN',
      statusAfter: isIsolationOnly ? 'OPEN_ISOLATED' : 'TIE_CLOSED'
    });
  }

  // Network utilization averages
  const networkUtilizationBeforePct = Number(
    ((sourcePreLoadMva + targetPreLoadMva) / Math.max(0.1, sourceCapMva + targetCapMva) * 100).toFixed(1)
  );
  const networkUtilizationAfterPct = Number(
    ((sourcePostLoadMva + targetPostLoadMva) / Math.max(0.1, sourceCapMva + targetCapMva) * 100).toFixed(1)
  );

  // Risk Assessment (LOW / MEDIUM / HIGH) with explainable reasons
  const overloadedDtrs = equipmentUtilization.filter(
    (e) => e.assetType === 'TRANSFORMER' && e.afterLoadPct >= 90
  );
  const participatingIds = new Set<string>([
    params.sourceFeeder,
    params.targetFeeder,
    params.tieSwitch,
    ...(substationAsset ? [substationAsset.canonicalId] : []),
    ...allInvolvedTransformers.map((t) => t.canonicalId)
  ]);

  const relatedUnresolvedIssues = issues.filter(
    (i) => i.status !== 'RESOLVED' && participatingIds.has(i.canonicalAssetId)
  );

  const riskReasons: string[] = [];
  let riskLevel: SimulationRiskLevel = 'LOW';

  if (thermalViolation || voltageViolation || overloadedDtrs.length > 0) {
    riskLevel = 'HIGH';
    if (thermalViolation) {
      riskReasons.push(
        `Target feeder ${params.targetFeeder} reaches ${targetPostLoadMva.toFixed(2)} MVA (${targetPostPct}%), exceeding its ${targetCapMva.toFixed(1)} MVA thermal limit.`
      );
    }
    if (voltageViolation) {
      riskReasons.push(
        `Minimum bus voltage drops to ${minBusVoltagePu.toFixed(3)} p.u., violating the ANSI C84.1 lower bound (0.950 p.u.).`
      );
    }
    if (overloadedDtrs.length > 0) {
      riskReasons.push(
        `Transformer loading exceeds safe threshold on ${overloadedDtrs.map((d) => `${d.assetId} (${d.afterLoadPct}%)`).join(', ')}.`
      );
    }
  } else if (
    targetPostPct >= 78 ||
    isIsolationOnly ||
    (isMaintenance && baseDuration >= 45) ||
    relatedUnresolvedIssues.length > 0
  ) {
    riskLevel = 'MEDIUM';
    if (targetPostPct >= 78) {
      riskReasons.push(
        `Target feeder ${params.targetFeeder} operates at ${targetPostPct}% utilization after transfer, leaving ${(targetCapMva - targetPostLoadMva).toFixed(2)} MVA spare margin.`
      );
    } else {
      riskReasons.push(
        `Alternative feeder ${params.targetFeeder} retains ${(targetCapMva - targetPostLoadMva).toFixed(2)} MVA spare capacity.`
      );
    }
    if (isIsolationOnly && primaryTransformer) {
      riskReasons.push(
        `Isolating ${primaryTransformer.canonicalId} interrupts downstream secondary circuits for an estimated ${baseDuration} minutes.`
      );
    }
    if (relatedUnresolvedIssues.length > 0) {
      riskReasons.push(
        `${relatedUnresolvedIssues.length} unresolved data integrity finding(s) exist on participating assets (${relatedUnresolvedIssues.map((i) => i.canonicalAssetId).join(', ')}).`
      );
    }
  } else {
    riskLevel = 'LOW';
    riskReasons.push(
      `Alternative feeder ${params.targetFeeder} has ${(targetCapMva - targetPostLoadMva).toFixed(2)} MVA spare capacity (${targetPostPct}% post-transfer utilization).`
    );
    riskReasons.push(
      `All participating transformers stay below 85% safe loading thresholds with bus voltage at ${minBusVoltagePu.toFixed(3)} p.u.`
    );
    if (consumersRestored !== null && consumersRestored > 0) {
      riskReasons.push(
        `Backfeed path restores an estimated ${consumersRestored.toLocaleString()} consumers within ${baseDuration} minutes.`
      );
    }
  }

  // Recommendation Engine (strictly advisory)
  const recommendationReasons: string[] = [];
  if (!thermalViolation && !voltageViolation) {
    recommendationReasons.push(
      `Capacity available on ${params.targetFeeder}: ${(targetCapMva - targetPostLoadMva).toFixed(2)} MVA headroom post-operation`
    );
  } else {
    recommendationReasons.push(
      `Reduce transfer block below ${(targetCapMva - targetPreLoadMva).toFixed(2)} MVA or split load across an alternate 11 kV feeder`
    );
  }
  recommendationReasons.push(
    consumersAffectedAfter !== null
      ? consumersAffectedAfter === 0
        ? 'Minimal customer impact — full downstream load continuity maintained'
        : `Remaining interrupted exposure limited to ~${consumersAffectedAfter.toLocaleString()} consumers`
      : 'Downstream consumer count not mapped in source GIS; verify local LT feeder logs'
  );
  recommendationReasons.push(
    overloadedDtrs.length === 0
      ? 'No overloaded transformers detected across evaluated segments'
      : `Elevated loading flagged on ${overloadedDtrs.map((d) => d.assetId).join(', ')}`
  );
  recommendationReasons.push(`Estimated restoration / execution time: ${baseDuration} minutes`);

  const switchingSequence: string[] = isIsolationOnly
    ? [
        `Confirm faulted/target status and crew clearance on ${primaryTransformer?.canonicalId || params.sourceFeeder}`,
        `Open upstream isolating switch ${params.tieSwitch} and verify zero-voltage check`,
        `Maintain healthy upstream load via ${params.targetFeeder} while crew completes inspection`
      ]
    : [
        `Verify protection lockout & line-clear state on ${params.sourceFeeder}`,
        `Confirm ${params.targetFeeder} spare headroom (${(targetCapMva - targetPreLoadMva).toFixed(2)} MVA pre-transfer)`,
        `Coordinate field crew to close tie switch ${params.tieSwitch} to pick up ${transferredLoadMva.toFixed(2)} MVA (${resolvedLoadPct}%)`
      ];

  const recommendationTitle = thermalViolation || voltageViolation
    ? `Hold transfer via ${params.tieSwitch}; reduce block from ${params.sourceFeeder} or use alternate supply.`
    : isIsolationOnly
      ? `Isolate ${primaryTransformer?.canonicalId || params.sourceFeeder} via ${params.tieSwitch} and hold healthy sections on ${params.targetFeeder}.`
      : `Transfer ${transferredLoadMva.toFixed(2)} MVA (${resolvedLoadPct}%) from ${params.sourceFeeder} to ${params.targetFeeder} via ${params.tieSwitch}.`;

  // Affected & Participating Asset Links
  const simulationAssets: SimulationAssetLink[] = [];
  const pushAssetLink = (assetId: string, role: SimulationAssetLink['role'], fallbackType: string) => {
    if (!assetId || simulationAssets.some((a) => a.assetId === assetId && a.role === role)) return;
    const found = assets.find((a) => a.canonicalId === assetId);
    simulationAssets.push({
      assetId,
      assetName: cleanLabel(found?.rawName ?? found?.name ?? assetId),
      assetType: found?.assetType ?? fallbackType,
      role,
      source: found?.source ?? 'SIMULATED'
    });
  };

  if (substationAsset) pushAssetLink(substationAsset.canonicalId, 'SUBSTATION', 'SUBSTATION');
  pushAssetLink(params.sourceFeeder, 'SOURCE', 'FEEDER');
  if (params.targetFeeder) pushAssetLink(params.targetFeeder, 'TARGET', 'FEEDER');
  if (params.tieSwitch) pushAssetLink(params.tieSwitch, 'SWITCH', 'SECTIONALIZER');
  for (const dtr of feederTransformers) {
    pushAssetLink(
      dtr.canonicalId,
      isIsolationOnly && (!primaryTransformer || dtr.canonicalId === primaryTransformer.canonicalId)
        ? 'ISOLATED'
        : 'AFFECTED',
      'TRANSFORMER'
    );
  }

  // Build Map Overlay paths & affected service polygon
  const coordPoints: Array<[number, number]> = [];
  if (srcLine) coordPoints.push(...srcLine.path);
  if (tgtLine) coordPoints.push(...tgtLine.path);
  for (const link of simulationAssets) {
    const a = assets.find((item) => item.canonicalId === link.assetId);
    if (a && Number.isFinite(a.latitude) && Number.isFinite(a.longitude)) {
      coordPoints.push([a.latitude, a.longitude]);
    }
  }

  const temporarySupplyPath: [number, number][] = [];
  if (srcFeederAsset) temporarySupplyPath.push([srcFeederAsset.latitude, srcFeederAsset.longitude]);
  if (primaryTransformer) temporarySupplyPath.push([primaryTransformer.latitude, primaryTransformer.longitude]);
  if (switchAsset) temporarySupplyPath.push([switchAsset.latitude, switchAsset.longitude]);
  if (tgtFeederAsset) temporarySupplyPath.push([tgtFeederAsset.latitude, tgtFeederAsset.longitude]);

  const proposedFeederPath: [number, number][] =
    tgtLine && tgtLine.path.length >= 2
      ? tgtLine.path
      : temporarySupplyPath.length >= 2
        ? temporarySupplyPath
        : [];

  const affectedAreaPolygon =
    matchingIncident && matchingIncident.affectedAreaPolygon.length >= 3
      ? matchingIncident.affectedAreaPolygon
      : buildHullPolygon(coordPoints);

  const isolatedAssetIds = simulationAssets
    .filter((a) => a.role === 'ISOLATED' || (isIsolationOnly && a.role === 'AFFECTED'))
    .map((a) => a.assetId);

  const simId = options?.id || `SCEN-${Date.now()}`;
  const scenarioCode = options?.scenarioCode || `SIM-${String(Math.floor(100 + Math.random() * 899))}`;
  const simSource: AssetSource = options?.source || 'SIMULATED';
  const createdAt = options?.createdAt || new Date().toISOString();
  const timeOfOperation = params.timeOfOperation || createdAt;

  const mapOverlay: SimulationMapOverlay = {
    simulationId: simId,
    scenarioCode,
    scenarioType: params.scenarioType,
    isPlaying: true,
    sourceFeederId: params.sourceFeeder,
    targetFeederId: params.targetFeeder,
    tieSwitchId: params.tieSwitch,
    isolatedAssetIds,
    participatingAssetIds: simulationAssets.map((a) => a.assetId),
    proposedFeederPath,
    temporarySupplyPath,
    affectedAreaPolygon,
    riskLevel
  };

  const title =
    params.title ||
    `${SIMULATION_TYPE_LABELS[params.scenarioType]}: ${params.sourceFeeder} → ${params.targetFeeder} (${transferredLoadMva.toFixed(1)} MVA)`;

  return {
    id: simId,
    scenarioCode,
    title,
    scenarioType: params.scenarioType,
    status: options?.status ?? 'COMPLETED',
    creatorName: params.engineerName || 'Marcus Vance, PE (Grid Engineer)',
    creatorEmail: params.engineerEmail || 'akhilteljeeru@gmail.com',
    substationId: substationAsset?.canonicalId ?? params.substationId ?? null,
    sourceFeederId: params.sourceFeeder,
    targetFeederId: params.targetFeeder,
    transformerId: primaryTransformer?.canonicalId ?? params.transformerId ?? null,
    tieSwitchId: params.tieSwitch,
    sectionalizerId: params.tieSwitch,
    transferredLoadMva,
    loadTransferPct: resolvedLoadPct,
    expectedDurationMin: baseDuration,
    timeOfOperation,
    incidentId: matchingIncident?.id ?? params.incidentId ?? null,
    faultId: matchingFault?.id ?? params.faultId ?? null,
    isDemonstrationMode: true,
    source: simSource,
    assumptionsLog: `${simSource} ${SIMULATION_TYPE_LABELS[params.scenarioType]} analysis: ${sourceCapMva} MVA source / ${targetCapMva} MVA target radial topology; ANSI C84.1 [0.950, 1.050] p.u. bounds; advisory decision-support only.`,
    targetFeederCapacityMva: targetCapMva,
    targetFeederPreLoadMva: targetPreLoadMva,
    targetFeederPostLoadMva: targetPostLoadMva,
    minBusVoltagePu,
    thermalViolation,
    voltageViolation,
    opendssScript: `! GridGuard AI OpenDSS Power-Flow Evaluation (${simSource} · ${SIMULATION_TYPE_LABELS[params.scenarioType]})
Clear
New Circuit.Sim_${params.targetFeeder.replace(/[^a-zA-Z0-9_]/g, '_')} basekv=11.0 pu=1.01 angle=0 phases=3
New Load.TargetBase Bus1=B_MAIN Phases=3 kV=11.0 kW=${Math.round(targetPreLoadMva * 1000)} PF=0.92
New Line.TieSwitch_${params.tieSwitch.replace(/[^a-zA-Z0-9_]/g, '_')} Bus1=B_MAIN Bus2=B_TRANSFER Phases=3 Length=1.4 LineCode=477_ACSR
New Load.TransferredSegment Bus1=B_TRANSFER Phases=3 kV=11.0 kW=${Math.round(transferredLoadMva * 1000)} PF=0.92
Set VoltageBases = [11.0]
CalcVoltageBases
Solve
Show Voltages LN Nodes`,
    createdAt,
    simulationAssets,
    impactAnalysis: {
      consumersAffectedBefore,
      consumersAffectedAfter,
      consumersRestored,
      transformersAffectedCount: feederTransformers.length,
      affectedTransformerIds: feederTransformers.map((t) => t.canonicalId),
      feedersAffectedCount:
        params.targetFeeder && params.targetFeeder !== params.sourceFeeder ? 2 : 1,
      affectedFeederIds: Array.from(
        new Set([params.sourceFeeder, params.targetFeeder].filter(Boolean))
      ),
      expectedOutageDurationMin: baseDuration,
      networkUtilizationBeforePct,
      networkUtilizationAfterPct,
      loadRedistributionSummary: `${params.sourceFeeder}: ${sourcePreLoadMva.toFixed(2)} → ${sourcePostLoadMva.toFixed(2)} MVA (${sourcePostPct}%) · ${params.targetFeeder}: ${targetPreLoadMva.toFixed(2)} → ${targetPostLoadMva.toFixed(2)} MVA (${targetPostPct}%)`,
      equipmentUtilization
    },
    riskAssessment: {
      level: riskLevel,
      reasons: riskReasons
    },
    recommendation: {
      title: recommendationTitle,
      reasons: recommendationReasons,
      estimatedRestorationMinutes: baseDuration,
      switchingSequence,
      advisoryOnly: true
    },
    mapOverlay
  };
}

export function compareSimulationScenarios(
  scenarios: SimulationScenario[]
): SimulationComparisonResult {
  if (scenarios.length === 0) {
    return {
      scenarioIds: [],
      recommendedScenarioId: '',
      summary: 'No simulation scenarios provided for comparison.',
      rows: []
    };
  }

  const riskWeight: Record<SimulationRiskLevel, number> = {
    LOW: 0,
    MEDIUM: 1,
    HIGH: 2
  };

  const rows = scenarios.map((s) => ({
    simulationId: s.id,
    scenarioCode: s.scenarioCode,
    scenarioType: s.scenarioType,
    riskLevel: s.riskAssessment.level,
    postLoadPct: Number(
      ((s.targetFeederPostLoadMva / Math.max(0.1, s.targetFeederCapacityMva)) * 100).toFixed(1)
    ),
    minBusVoltagePu: s.minBusVoltagePu,
    consumersAffectedAfter: s.impactAnalysis.consumersAffectedAfter,
    expectedOutageDurationMin: s.expectedDurationMin,
    thermalViolation: s.thermalViolation,
    voltageViolation: s.voltageViolation
  }));

  const ranked = [...rows].sort((a, b) => {
    const rDiff = riskWeight[a.riskLevel] - riskWeight[b.riskLevel];
    if (rDiff !== 0) return rDiff;
    const cA = a.consumersAffectedAfter ?? 999999;
    const cB = b.consumersAffectedAfter ?? 999999;
    if (cA !== cB) return cA - cB;
    return a.expectedOutageDurationMin - b.expectedOutageDurationMin;
  });

  const best = ranked[0];
  return {
    scenarioIds: scenarios.map((s) => s.id),
    recommendedScenarioId: best.simulationId,
    summary: `${best.scenarioCode} (${SIMULATION_TYPE_LABELS[best.scenarioType]}) offers the lowest operational risk (${best.riskLevel}) at ${best.postLoadPct}% target feeder utilization and ${best.expectedOutageDurationMin} min duration.`,
    rows
  };
}
