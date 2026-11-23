import type {
  ActiveFault,
  AuditLog,
  EngineerRecommendation,
  EventReconstructionIncident,
  FieldEngineer,
  FieldEngineerStatus,
  FieldEvidence,
  FieldOperationsDashboardMetrics,
  FieldTask,
  GeoFenceEvent,
  GeoFenceZone,
  InfrastructureAsset,
  LiveIncidentTimelineStep,
  LiveRouteInfo,
  MaintenanceZone
} from '../types/grid.ts';

export const INITIAL_FIELD_ENGINEERS: FieldEngineer[] = [
  {
    engineerId: 'ENG-HYD-01',
    employeeId: 'EMP-1042',
    name: 'Rahul Kumar (Field Engineer)',
    email: 'rahul.kumar@utilitygrid.org',
    phone: '+91-98490-41208',
    team: 'Hyderabad Metro Rapid Response Crew-01',
    assignedArea: 'HITEC City · Madhapur',
    state: 'Telangana',
    district: 'Hyderabad',
    skills: ['TRANSFORMER', 'FEEDER', 'CIRCUIT_BREAKER', 'THERMOGRAPHY', '11KV_JOINTS'],
    status: 'AVAILABLE',
    currentTaskId: null,
    currentTaskCode: null,
    currentAssetId: null,
    latitude: 17.4465,
    longitude: 78.3872,
    speedKmh: 0,
    headingDeg: 245,
    batteryPct: 88,
    networkStatus: '5G',
    activeWorkloadCount: 0,
    lastLocationUpdate: new Date(Date.now() - 25_000).toISOString(),
    source: 'DEMO'
  },
  {
    engineerId: 'ENG-HYD-02',
    employeeId: 'EMP-1089',
    name: 'Akhil Reddy (Field Engineer)',
    email: 'akhil.reddy@utilitygrid.org',
    phone: '+91-98490-55912',
    team: 'Cyberabad Protection & Switchgear Team',
    assignedArea: 'Gachibowli · Mindspace',
    state: 'Telangana',
    district: 'Hyderabad',
    skills: ['SECTIONALIZER', 'RECLOSER', 'CIRCUIT_BREAKER', 'SUBSTATION', 'SCADA_SWITCH'],
    status: 'AVAILABLE',
    currentTaskId: null,
    currentTaskCode: null,
    currentAssetId: null,
    latitude: 17.4368,
    longitude: 78.3685,
    speedKmh: 18,
    headingDeg: 62,
    batteryPct: 92,
    networkStatus: '4G_LTE',
    activeWorkloadCount: 0,
    lastLocationUpdate: new Date(Date.now() - 18_000).toISOString(),
    source: 'DEMO'
  },
  {
    engineerId: 'ENG-HYD-03',
    employeeId: 'EMP-1104',
    name: 'Priya Sharma (Field Engineer)',
    email: 'priya.sharma@utilitygrid.org',
    phone: '+91-98490-63219',
    team: 'Madhapur EHT Substation Diagnostics',
    assignedArea: 'Madhapur · Kondapur',
    state: 'Telangana',
    district: 'Hyderabad',
    skills: ['SUBSTATION', 'TRANSFORMER', 'DGA_SAMPLING', 'MEGGER'],
    status: 'ON_BREAK',
    currentTaskId: null,
    currentTaskCode: null,
    currentAssetId: null,
    latitude: 17.4521,
    longitude: 78.3958,
    speedKmh: 0,
    headingDeg: 0,
    batteryPct: 64,
    networkStatus: '4G_LTE',
    activeWorkloadCount: 0,
    lastLocationUpdate: new Date(Date.now() - 120_000).toISOString(),
    source: 'DEMO'
  },
  {
    engineerId: 'ENG-BLR-01',
    employeeId: 'EMP-2015',
    name: 'Rohan Kulkarni (Field Engineer)',
    email: 'r.kulkarni@utilitygrid.org',
    phone: '+91-98801-74520',
    team: 'Bengaluru East Rapid Response Crew-02',
    assignedArea: 'Indiranagar · CMH Road',
    state: 'Karnataka',
    district: 'Bengaluru Urban',
    skills: ['TRANSFORMER', '11KV_JOINTS', 'MEGGER', 'THERMOGRAPHY'],
    status: 'TRAVELING',
    currentTaskId: 'TSK-KA-01U-01',
    currentTaskCode: 'TSK-KA-01U-01',
    currentAssetId: 'DTR-KA-01U-301',
    latitude: 12.9746,
    longitude: 77.6348,
    speedKmh: 34,
    headingDeg: 118,
    batteryPct: 79,
    networkStatus: '5G',
    activeWorkloadCount: 1,
    lastLocationUpdate: new Date(Date.now() - 12_000).toISOString(),
    source: 'DEMO'
  },
  {
    engineerId: 'ENG-MUM-01',
    employeeId: 'EMP-3018',
    name: 'Ananya Deshmukh (Field Engineer)',
    email: 'a.deshmukh@utilitygrid.org',
    phone: '+91-98204-81234',
    team: 'Mumbai Suburban BKC Field Unit-01',
    assignedArea: 'Bandra Kurla Complex',
    state: 'Maharashtra',
    district: 'Mumbai Suburban',
    skills: ['TRANSFORMER', 'FEEDER', 'CSS_MAINTENANCE', 'MEGGER'],
    status: 'WORKING',
    currentTaskId: 'TSK-MH-01U-01',
    currentTaskCode: 'TSK-MH-01U-01',
    currentAssetId: 'DTR-MH-01U-401',
    latitude: 19.0606,
    longitude: 72.8625,
    speedKmh: 0,
    headingDeg: 0,
    batteryPct: 71,
    networkStatus: '4G_LTE',
    activeWorkloadCount: 1,
    lastLocationUpdate: new Date(Date.now() - 45_000).toISOString(),
    source: 'DEMO'
  },
  {
    engineerId: 'ENG-MUM-02',
    employeeId: 'EMP-3044',
    name: 'Vikram Deshmukh (Field Engineer)',
    email: 'v.deshmukh@utilitygrid.org',
    phone: '+91-98204-99401',
    team: 'Mumbai Sub-Transmission Protection Team',
    assignedArea: 'Andheri East · Powai',
    state: 'Maharashtra',
    district: 'Mumbai Suburban',
    skills: ['CIRCUIT_BREAKER', 'SUBSTATION', 'PROTECTION_RELAY'],
    status: 'OFFLINE',
    currentTaskId: null,
    currentTaskCode: null,
    currentAssetId: null,
    latitude: 19.1136,
    longitude: 72.8697,
    speedKmh: 0,
    headingDeg: 0,
    batteryPct: 19,
    networkStatus: 'OFFLINE',
    activeWorkloadCount: 0,
    lastLocationUpdate: new Date(Date.now() - 1_800_000).toISOString(),
    source: 'DEMO'
  }
];

export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  return haversineDistanceKm(lat1, lon1, lat2, lon2) * 1000;
}

export function estimateDrivingMinutes(distanceKm: number, speedKmh = 28): number {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0.05) return 1;
  const urbanSpeed = Math.max(speedKmh, 18);
  const raw = (distanceKm / urbanSpeed) * 60;
  return Math.max(1, Math.round(raw + 2)); // +2 min urban traffic / site access buffer
}

/**
 * Intelligent Engineer Recommendation Engine:
 * Ranks engineers by proximity to fault/asset, availability status, current workload,
 * and equipment skill compatibility. Preserves human manager final approval.
 */
export function recommendEngineersForAsset(params: {
  asset: Pick<
    InfrastructureAsset,
    'canonicalId' | 'assetType' | 'latitude' | 'longitude' | 'state' | 'district'
  >;
  engineers: FieldEngineer[];
  tasks: FieldTask[];
}): EngineerRecommendation[] {
  const { asset, engineers, tasks } = params;

  const activeTaskStatuses = new Set([
    'ASSIGNED',
    'ACCEPTED',
    'TRAVELING',
    'ON_SITE',
    'INSPECTION',
    'REPAIR',
    'VERIFICATION',
    'IN_PROGRESS',
    'PAUSED'
  ]);

  const recommendations: EngineerRecommendation[] = engineers.map((eng) => {
    const distanceKm =
      Math.round(haversineDistanceKm(eng.latitude, eng.longitude, asset.latitude, asset.longitude) * 100) /
      100;
    const etaMinutes = estimateDrivingMinutes(distanceKm, eng.speedKmh > 10 ? eng.speedKmh : 26);

    const workloadCount = tasks.filter(
      (t) =>
        (t.engineerId === eng.engineerId ||
          t.assignedEngineerEmail.toLowerCase() === eng.email.toLowerCase() ||
          t.assignedEngineer.toLowerCase() === eng.name.toLowerCase()) &&
        activeTaskStatuses.has(t.status)
    ).length;

    const skillMatch = eng.skills.includes(asset.assetType)
      ? 100
      : eng.skills.some((s) => ['TRANSFORMER', 'FEEDER', 'SUBSTATION', 'CIRCUIT_BREAKER'].includes(s))
        ? 80
        : 65;

    const statusBonus =
      eng.status === 'AVAILABLE'
        ? 30
        : eng.status === 'ON_BREAK'
          ? 8
          : eng.status === 'TRAVELING'
            ? -5
            : eng.status === 'WORKING'
              ? -12
              : -45;

    const distanceScore = Math.max(0, 50 - Math.min(distanceKm * 4.5, 50));
    const workloadPenalty = workloadCount * 14;
    const compositeScore = Math.max(
      0,
      Math.min(100, Math.round(distanceScore + statusBonus + skillMatch * 0.25 - workloadPenalty))
    );

    const reasonParts: string[] = [];
    if (eng.status === 'AVAILABLE') reasonParts.push('Available immediately');
    else reasonParts.push(`Status: ${eng.status}`);
    reasonParts.push(`${distanceKm.toFixed(2)} km away (~${etaMinutes} min ETA)`);
    reasonParts.push(`${skillMatch}% asset skill match`);
    if (workloadCount > 0) reasonParts.push(`${workloadCount} active task(s)`);

    return {
      engineerId: eng.engineerId,
      employeeId: eng.employeeId,
      name: eng.name,
      email: eng.email,
      team: eng.team,
      status: eng.status,
      distanceKm,
      etaMinutes,
      workloadCount,
      skillMatchPct: skillMatch,
      compositeScore,
      recommended: false,
      reason: reasonParts.join(' · ')
    };
  });

  recommendations.sort((a, b) => b.compositeScore - a.compositeScore || a.distanceKm - b.distanceKm);
  if (recommendations.length > 0 && recommendations[0].status !== 'OFFLINE') {
    recommendations[0].recommended = true;
  }
  return recommendations;
}

/**
 * Generates a realistic multi-waypoint driving corridor route between engineer GPS and target asset.
 * Used immediately and as deterministic fallback when external Mapbox Directions API is unavailable.
 */
export function computeFallbackRoute(params: {
  engineer: FieldEngineer;
  task: FieldTask;
  destAsset?: InfrastructureAsset | null;
  originLat?: number;
  originLon?: number;
}): LiveRouteInfo {
  const { engineer, task, destAsset } = params;
  const destLat = destAsset?.latitude ?? task.gpsLat;
  const destLon = destAsset?.longitude ?? task.gpsLon;
  const startLat = params.originLat ?? engineer.latitude;
  const startLon = params.originLon ?? engineer.longitude;

  const remainingDistanceKm =
    Math.round(haversineDistanceKm(engineer.latitude, engineer.longitude, destLat, destLon) * 100) /
    100;
  const totalDistanceKm = Math.max(
    remainingDistanceKm,
    Math.round(haversineDistanceKm(startLat, startLon, destLat, destLon) * 100) / 100,
    0.1
  );

  // Build 6-point slightly curved arterial road corridor
  const coords: [number, number][] = [];
  const steps = 6;
  const dLat = destLat - engineer.latitude;
  const dLon = destLon - engineer.longitude;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const bend = Math.sin(t * Math.PI) * 0.0012;
    coords.push([
      Number((engineer.longitude + dLon * t + bend).toFixed(6)),
      Number((engineer.latitude + dLat * t - bend * 0.65).toFixed(6))
    ]);
  }

  const speedKmh = engineer.speedKmh > 0 ? engineer.speedKmh : engineer.status === 'TRAVELING' ? 32 : 26;
  const etaMinutes =
    task.status === 'COMPLETED' || task.status === 'VERIFIED' || remainingDistanceKm < 0.08
      ? 0
      : estimateDrivingMinutes(remainingDistanceKm, speedKmh);
  const progressPct =
    task.status === 'COMPLETED' || task.status === 'VERIFIED'
      ? 100
      : remainingDistanceKm < 0.08
        ? 98
        : Math.max(
            5,
            Math.min(96, Math.round(((totalDistanceKm - remainingDistanceKm) / totalDistanceKm) * 100))
          );

  return {
    routeId: `RTE-${task.id}-${engineer.engineerId}`,
    taskId: task.id,
    taskCode: task.taskCode,
    engineerId: engineer.engineerId,
    engineerName: engineer.name,
    assetId: task.assetId,
    assetName: task.assetName,
    originLat: startLat,
    originLon: startLon,
    currentLat: engineer.latitude,
    currentLon: engineer.longitude,
    destLat,
    destLon,
    coordinates: coords,
    totalDistanceKm,
    remainingDistanceKm,
    etaMinutes,
    speedKmh,
    progressPct,
    provider: 'GRIDGUARD_CORRIDOR',
    updatedAt: new Date().toISOString()
  };
}

/**
 * Builds circular Geo-Fence zones around critical Substations, Transformers,
 * Maintenance Zones, and Active Fault Locations.
 */
export function buildGeoFencesForGrid(params: {
  assets: InfrastructureAsset[];
  faults: ActiveFault[];
  maintenanceZones: MaintenanceZone[];
}): GeoFenceZone[] {
  const { assets, faults, maintenanceZones } = params;
  const zones: GeoFenceZone[] = [];
  const seen = new Set<string>();

  for (const fault of faults) {
    if (fault.status === 'RESTORED') continue;
    const id = `GF-FLT-${fault.affectedAssetId}`;
    if (seen.has(id)) continue;
    seen.add(id);
    zones.push({
      id,
      name: `Fault Work Zone · ${fault.affectedAssetId}`,
      fenceType: 'FAULT_LOCATION',
      assetId: fault.affectedAssetId,
      centerLat: fault.latitude,
      centerLon: fault.longitude,
      radiusMeters: Math.max(fault.faultRadiusMeters ?? 250, 220),
      active: true
    });
  }

  for (const zone of maintenanceZones) {
    if (zone.status === 'COMPLETED' || zone.coordinates.length === 0) continue;
    const avgLat = zone.coordinates.reduce((acc, c) => acc + c[0], 0) / zone.coordinates.length;
    const avgLon = zone.coordinates.reduce((acc, c) => acc + c[1], 0) / zone.coordinates.length;
    const id = `GF-MNT-${zone.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    zones.push({
      id,
      name: `Maintenance Zone · ${zone.zoneName}`,
      fenceType: 'MAINTENANCE_ZONE',
      assetId: zone.feederId,
      centerLat: avgLat,
      centerLon: avgLon,
      radiusMeters: 300,
      active: true
    });
  }

  for (const asset of assets) {
    if (asset.assetType !== 'SUBSTATION' && asset.assetType !== 'TRANSFORMER') continue;
    if (asset.source !== 'DEMO' && asset.status !== 'FAULTED' && asset.status !== 'WARNING') continue;
    const id = `GF-AST-${asset.canonicalId}`;
    if (seen.has(id)) continue;
    seen.add(id);
    zones.push({
      id,
      name: `${asset.assetType === 'SUBSTATION' ? 'Substation' : 'Transformer'} Perimeter · ${asset.canonicalId}`,
      fenceType: asset.assetType === 'SUBSTATION' ? 'SUBSTATION' : 'TRANSFORMER',
      assetId: asset.canonicalId,
      centerLat: asset.latitude,
      centerLon: asset.longitude,
      radiusMeters: asset.assetType === 'SUBSTATION' ? 220 : 140,
      active: true
    });
  }

  return zones.slice(0, 48);
}

/**
 * Evaluates Geo-Fence entry, exit, and asset arrival transitions when an engineer updates GPS coordinates.
 */
export function evaluateGeoFenceTransitions(params: {
  engineer: FieldEngineer;
  prevLat: number;
  prevLon: number;
  newLat: number;
  newLon: number;
  fences: GeoFenceZone[];
  completedTaskFlag?: boolean;
}): GeoFenceEvent[] {
  const { engineer, prevLat, prevLon, newLat, newLon, fences, completedTaskFlag } = params;
  const nowIso = new Date().toISOString();
  const events: GeoFenceEvent[] = [];

  for (const fence of fences) {
    const prevDist = haversineDistanceMeters(prevLat, prevLon, fence.centerLat, fence.centerLon);
    const newDist = haversineDistanceMeters(newLat, newLon, fence.centerLat, fence.centerLon);
    const wasInside = prevDist <= fence.radiusMeters;
    const isInside = newDist <= fence.radiusMeters;

    if (!wasInside && isInside) {
      events.push({
        id: `GFE-${Date.now()}-${fence.assetId}-ENTER`,
        engineerId: engineer.engineerId,
        engineerName: engineer.name,
        taskId: engineer.currentTaskId,
        fenceId: fence.id,
        fenceName: fence.name,
        fenceType: fence.fenceType,
        assetId: fence.assetId,
        eventType: 'ENTER_WORK_ZONE',
        latitude: newLat,
        longitude: newLon,
        distanceToCenterMeters: Math.round(newDist),
        timestamp: nowIso,
        summary: `${engineer.name} entered ${fence.name} (${Math.round(newDist)}m from center).`
      });
    }

    if (wasInside && !isInside) {
      events.push({
        id: `GFE-${Date.now()}-${fence.assetId}-LEAVE`,
        engineerId: engineer.engineerId,
        engineerName: engineer.name,
        taskId: engineer.currentTaskId,
        fenceId: fence.id,
        fenceName: fence.name,
        fenceType: fence.fenceType,
        assetId: fence.assetId,
        eventType: 'LEAVE_WORK_ZONE',
        latitude: newLat,
        longitude: newLon,
        distanceToCenterMeters: Math.round(newDist),
        timestamp: nowIso,
        summary: `${engineer.name} exited ${fence.name} (${Math.round(newDist)}m from center).`
      });
    }

    if (
      engineer.currentAssetId === fence.assetId &&
      newDist <= 65 &&
      prevDist > 65
    ) {
      events.push({
        id: `GFE-${Date.now()}-${fence.assetId}-REACHED`,
        engineerId: engineer.engineerId,
        engineerName: engineer.name,
        taskId: engineer.currentTaskId,
        fenceId: fence.id,
        fenceName: fence.name,
        fenceType: fence.fenceType,
        assetId: fence.assetId,
        eventType: 'REACHED_ASSET',
        latitude: newLat,
        longitude: newLon,
        distanceToCenterMeters: Math.round(newDist),
        timestamp: nowIso,
        summary: `${engineer.name} arrived within 65m of assigned asset ${fence.assetId}.`
      });
    }

    if (completedTaskFlag && engineer.currentAssetId === fence.assetId && isInside) {
      events.push({
        id: `GFE-${Date.now()}-${fence.assetId}-COMPLETE`,
        engineerId: engineer.engineerId,
        engineerName: engineer.name,
        taskId: engineer.currentTaskId,
        fenceId: fence.id,
        fenceName: fence.name,
        fenceType: fence.fenceType,
        assetId: fence.assetId,
        eventType: 'COMPLETED_WORK',
        latitude: newLat,
        longitude: newLon,
        distanceToCenterMeters: Math.round(newDist),
        timestamp: nowIso,
        summary: `${engineer.name} completed field work inside ${fence.name}.`
      });
    }
  }

  return events;
}

/**
 * Generates an automatic real-time operational Incident Timeline from fault detection through closure.
 */
export function buildLiveIncidentTimeline(params: {
  task?: FieldTask | null;
  fault?: ActiveFault | null;
  reconstruction?: EventReconstructionIncident | null;
  evidence?: FieldEvidence[];
  auditLogs?: AuditLog[];
}): LiveIncidentTimelineStep[] {
  const { task, fault, reconstruction, evidence = [], auditLogs = [] } = params;
  const taskEvidence = task ? evidence.filter((e) => e.taskId === task.id) : [];

  const statusOrder: Record<FieldTask['status'], number> = {
    ASSIGNED: 3,
    ACCEPTED: 4,
    TRAVELING: 5,
    IN_PROGRESS: 6,
    PAUSED: 6,
    ON_SITE: 6,
    INSPECTION: 7,
    REPAIR: 8,
    VERIFICATION: 8,
    COMPLETED: 9,
    VERIFIED: 10
  };
  const stageRank = task ? statusOrder[task.status] ?? 3 : fault ? 2 : 1;

  const approvalLog = auditLogs.find(
    (l) =>
      l.actionType === 'DECISION_APPROVED' &&
      (task?.decisionId ? l.entityId === task.decisionId : true)
  );
  const closeLog = auditLogs.find(
    (l) =>
      (l.actionType === 'INCIDENT_CLOSED' || l.actionType === 'CASE_VERIFIED') &&
      (task?.assetId ? l.relatedAssetId === task.assetId : true)
  );

  const steps: LiveIncidentTimelineStep[] = [
    {
      id: 'TL-01',
      stage: 'FAULT_DETECTED',
      label: 'Fault Detected',
      timestamp: fault?.detectedAt ?? reconstruction?.detectedAt ?? task?.createdAt ?? null,
      status: fault || reconstruction || task ? 'COMPLETED' : 'PENDING',
      actor: 'SCADA / Smart Meter Telemetry',
      detail: fault
        ? `${fault.faultCode}: ${fault.title} (${fault.severity})`
        : task
          ? `Triggered investigation on ${task.assetId}`
          : 'Awaiting telemetry trigger'
    },
    {
      id: 'TL-02',
      stage: 'MANAGER_NOTIFIED',
      label: 'Manager Notified',
      timestamp: approvalLog?.timestamp ?? fault?.lastUpdated ?? task?.createdAt ?? null,
      status: stageRank >= 2 ? 'COMPLETED' : 'ACTIVE',
      actor: 'GridGuard Decision Governance',
      detail: task
        ? `Linked decision ${task.decisionCode} reviewed & escalated to operations queue.`
        : 'Control Room alert broadcasted to Utility Manager.'
    },
    {
      id: 'TL-03',
      stage: 'ENGINEER_ASSIGNED',
      label: 'Engineer Assigned',
      timestamp: task?.createdAt ?? null,
      status: task ? 'COMPLETED' : 'PENDING',
      actor: 'Utility Manager',
      detail: task
        ? `${task.assignedEngineer} (${task.assignedTeam}) assigned ${task.taskCode}.`
        : 'Pending intelligent dispatch selection.'
    },
    {
      id: 'TL-04',
      stage: 'ENGINEER_ACCEPTED',
      label: 'Engineer Accepted',
      timestamp: task?.acceptedAt ?? (stageRank >= 4 ? task?.updatedAt ?? null : null),
      status: stageRank >= 4 ? 'COMPLETED' : task ? 'ACTIVE' : 'PENDING',
      actor: task?.assignedEngineer ?? 'Field Engineer',
      detail:
        stageRank >= 4
          ? 'Field engineer acknowledged LOTO safety notes and accepted work order.'
          : 'Awaiting field crew acceptance.'
    },
    {
      id: 'TL-05',
      stage: 'NAVIGATION_STARTED',
      label: 'Started Navigation',
      timestamp: task?.startedAt ?? (stageRank >= 5 ? task?.updatedAt ?? null : null),
      status: stageRank >= 5 ? 'COMPLETED' : stageRank === 4 ? 'ACTIVE' : 'PENDING',
      actor: task?.assignedEngineer ?? 'Field Engineer',
      detail:
        stageRank >= 5
          ? `Live GPS route streaming active toward ${task?.assetId ?? 'target site'}.`
          : 'Route telemetry initializes upon departure.'
    },
    {
      id: 'TL-06',
      stage: 'ARRIVED_ON_SITE',
      label: 'Arrived On Site',
      timestamp: task?.arrivedAt ?? (stageRank >= 6 ? task?.startedAt ?? task?.updatedAt ?? null : null),
      status: stageRank >= 6 ? 'COMPLETED' : stageRank === 5 ? 'ACTIVE' : 'PENDING',
      actor: 'Geo-Fence Sensor + Crew Check-In',
      detail:
        stageRank >= 6
          ? `Crew arrived at ${task?.faultLocation ?? 'asset perimeter'}.`
          : 'Triggered automatically when engineer enters asset geofence.'
    },
    {
      id: 'TL-07',
      stage: 'INSPECTION_COMPLETED',
      label: 'Inspection & Evidence Uploaded',
      timestamp: taskEvidence[0]?.uploadedAt ?? (stageRank >= 7 ? task?.updatedAt ?? null : null),
      status: taskEvidence.length > 0 || stageRank >= 7 ? 'COMPLETED' : stageRank === 6 ? 'ACTIVE' : 'PENDING',
      actor: taskEvidence[0]?.uploadedBy ?? task?.assignedEngineer ?? 'Field Engineer',
      detail:
        taskEvidence.length > 0
          ? `${taskEvidence.length} geo-tagged evidence record(s) logged (${taskEvidence[0].inspectionResult}).`
          : 'Upload inspection photos, meter readings & notes.'
    },
    {
      id: 'TL-08',
      stage: 'REPAIR_COMPLETED',
      label: 'Repair Completed',
      timestamp: task?.completedAt ?? (stageRank >= 8 ? task?.updatedAt ?? null : null),
      status: stageRank >= 9 ? 'COMPLETED' : stageRank >= 7 ? 'ACTIVE' : 'PENDING',
      actor: task?.assignedEngineer ?? 'Field Engineer',
      detail:
        task?.completionNotes ||
        (stageRank >= 9
          ? 'Field repair finalized and equipment ready for re-energization.'
          : 'Awaiting repair sign-off from field crew.')
    },
    {
      id: 'TL-09',
      stage: 'POWER_RESTORED',
      label: 'Power Restored & Verified',
      timestamp: task?.verifiedAt ?? (fault?.status === 'RESTORED' ? fault.lastUpdated : null),
      status:
        task?.status === 'VERIFIED' || fault?.status === 'RESTORED'
          ? 'COMPLETED'
          : stageRank === 9
            ? 'ACTIVE'
            : 'PENDING',
      actor: task?.verifiedBy ?? 'Utility Manager',
      detail:
        task?.status === 'VERIFIED' || fault?.status === 'RESTORED'
          ? `Verified by ${task?.verifiedBy || 'Manager'}; feeder voltage stabilized.`
          : 'Pending final manager safety & restoration verification.'
    },
    {
      id: 'TL-10',
      stage: 'INCIDENT_CLOSED',
      label: 'Incident Closed & Audited',
      timestamp: closeLog?.timestamp ?? task?.verifiedAt ?? null,
      status: task?.status === 'VERIFIED' ? 'COMPLETED' : 'PENDING',
      actor: 'Immutable Audit Registry',
      detail:
        task?.status === 'VERIFIED'
          ? 'Complete field record, evidence, and signature sealed in audit trail.'
          : 'Closes automatically once manager signs final checklist.'
    }
  ];

  return steps;
}

export function computeFieldDashboardMetrics(params: {
  engineers: FieldEngineer[];
  tasks: FieldTask[];
  faults: ActiveFault[];
  routes: LiveRouteInfo[];
  geofenceEvents: GeoFenceEvent[];
}): FieldOperationsDashboardMetrics {
  const { engineers, tasks, faults, routes, geofenceEvents } = params;
  const engineersOnline = engineers.filter((e) => e.status !== 'OFFLINE').length;
  const engineersAvailable = engineers.filter((e) => e.status === 'AVAILABLE').length;
  const engineersTraveling = engineers.filter((e) => e.status === 'TRAVELING').length;
  const engineersOnSite = engineers.filter((e) => e.status === 'WORKING').length;

  const openTasks = tasks.filter((t) => t.status !== 'COMPLETED' && t.status !== 'VERIFIED').length;
  const completedTasksToday = tasks.filter(
    (t) => t.status === 'COMPLETED' || t.status === 'VERIFIED'
  ).length;
  const highPriorityIncidents = faults.filter(
    (f) => f.status !== 'RESTORED' && (f.severity === 'CRITICAL' || f.severity === 'WARNING')
  ).length;

  const routeEtas = routes.map((r) => r.etaMinutes).filter((n) => Number.isFinite(n) && n > 0);
  const avgResponseTimeMin =
    routeEtas.length > 0
      ? Math.round(routeEtas.reduce((acc, n) => acc + n, 0) / routeEtas.length)
      : 14;

  const repairDurationsMin = tasks
    .filter((t) => t.startedAt && t.completedAt)
    .map((t) => {
      const start = new Date(t.startedAt!).getTime();
      const end = new Date(t.completedAt!).getTime();
      return Math.max(5, Math.round((end - start) / 60_000));
    });
  const avgRepairTimeMin =
    repairDurationsMin.length > 0
      ? Math.round(repairDurationsMin.reduce((a, b) => a + b, 0) / repairDurationsMin.length)
      : 28;

  return {
    engineersOnline,
    engineersAvailable,
    engineersTraveling,
    engineersOnSite,
    openTasks,
    completedTasksToday,
    highPriorityIncidents,
    avgResponseTimeMin,
    avgRepairTimeMin,
    activeRoutesCount: routes.filter((r) => r.progressPct < 100).length,
    geofenceAlertsCount: geofenceEvents.length,
    calculatedAt: new Date().toISOString()
  };
}

export function mapTaskStatusToEngineerStatus(taskStatus: FieldTask['status']): FieldEngineerStatus {
  switch (taskStatus) {
    case 'TRAVELING':
      return 'TRAVELING';
    case 'ACCEPTED':
      return 'TRAVELING';
    case 'ON_SITE':
    case 'INSPECTION':
    case 'REPAIR':
    case 'VERIFICATION':
    case 'IN_PROGRESS':
      return 'WORKING';
    case 'PAUSED':
      return 'ON_BREAK';
    case 'COMPLETED':
    case 'VERIFIED':
      return 'AVAILABLE';
    default:
      return 'TRAVELING';
  }
}
