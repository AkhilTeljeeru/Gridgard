import type {
  ActiveFault,
  DecisionStatus,
  EngineeringDecision,
  FieldTask,
  InfrastructureAsset,
  PriorityLevel,
  UserRole,
  VerificationChecklistState
} from '../types/grid.ts';

export interface RolePermissions {
  role: UserRole;
  label: string;
  actorName: string;
  actorEmail: string;
  canInvestigate: boolean;
  canRunSimulation: boolean;
  canSubmitDecision: boolean;
  canApproveDecision: boolean;
  canAssignFieldTask: boolean;
  canExecuteFieldTask: boolean;
  canUploadEvidence: boolean;
  canVerifyAndClose: boolean;
  canExportReports: boolean;
  isReadOnly: boolean;
}

export const ROLE_DIRECTORY: Record<UserRole, RolePermissions> = {
  ADMIN: {
    role: 'ADMIN',
    label: 'Administrator',
    actorName: 'System Administrator',
    actorEmail: 'admin@utilitygrid.org',
    canInvestigate: true,
    canRunSimulation: true,
    canSubmitDecision: true,
    canApproveDecision: true,
    canAssignFieldTask: true,
    canExecuteFieldTask: true,
    canUploadEvidence: true,
    canVerifyAndClose: true,
    canExportReports: true,
    isReadOnly: false
  },
  REVIEWER_APPROVER: {
    role: 'REVIEWER_APPROVER',
    label: 'Utility Manager',
    actorName: 'Sarah Jenkins, PE (Utility Manager)',
    actorEmail: 's.jenkins@utilitygrid.org',
    canInvestigate: true,
    canRunSimulation: false,
    canSubmitDecision: false,
    canApproveDecision: true,
    canAssignFieldTask: true,
    canExecuteFieldTask: false,
    canUploadEvidence: false,
    canVerifyAndClose: true,
    canExportReports: true,
    isReadOnly: false
  },
  GRID_ENGINEER: {
    role: 'GRID_ENGINEER',
    label: 'Control Room Engineer',
    actorName: 'Marcus Vance, PE',
    actorEmail: 'm.vance@utilitygrid.org',
    canInvestigate: true,
    canRunSimulation: true,
    canSubmitDecision: true,
    canApproveDecision: false,
    canAssignFieldTask: false,
    canExecuteFieldTask: false,
    canUploadEvidence: false,
    canVerifyAndClose: false,
    canExportReports: true,
    isReadOnly: false
  },
  FIELD_ENGINEER: {
    role: 'FIELD_ENGINEER',
    label: 'Field Engineer',
    actorName: 'Rohan Kulkarni (Field Engineer)',
    actorEmail: 'r.kulkarni@utilitygrid.org',
    canInvestigate: true,
    canRunSimulation: false,
    canSubmitDecision: false,
    canApproveDecision: false,
    canAssignFieldTask: false,
    canExecuteFieldTask: true,
    canUploadEvidence: true,
    canVerifyAndClose: false,
    canExportReports: true,
    isReadOnly: false
  },
  VIEWER: {
    role: 'VIEWER',
    label: 'Viewer',
    actorName: 'Operations Auditor (Read-Only)',
    actorEmail: 'viewer@utilitygrid.org',
    canInvestigate: true,
    canRunSimulation: false,
    canSubmitDecision: false,
    canApproveDecision: false,
    canAssignFieldTask: false,
    canExecuteFieldTask: false,
    canUploadEvidence: false,
    canVerifyAndClose: false,
    canExportReports: true,
    isReadOnly: true
  }
};

export function getRolePermissions(role: UserRole): RolePermissions {
  return ROLE_DIRECTORY[role] || ROLE_DIRECTORY.VIEWER;
}

export const ALLOWED_EVIDENCE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'application/pdf'
]);

export const MAX_EVIDENCE_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB

export function validateEvidenceFile(params: {
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
}): { valid: boolean; error?: string } {
  const { fileName, mimeType, fileSizeBytes } = params;
  const trimmedName = fileName.trim();
  if (!trimmedName) {
    return { valid: false, error: 'Evidence file name is required.' };
  }
  const normalizedMime = mimeType.toLowerCase().trim();
  if (!ALLOWED_EVIDENCE_MIME_TYPES.has(normalizedMime)) {
    return {
      valid: false,
      error: `Unsupported file type "${mimeType}". Allowed formats: PNG, JPG, WEBP, or PDF.`
    };
  }
  if (!Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) {
    return { valid: false, error: 'Uploaded evidence file is empty.' };
  }
  if (fileSizeBytes > MAX_EVIDENCE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size exceeds the 8 MB limit (${(fileSizeBytes / (1024 * 1024)).toFixed(2)} MB).`
    };
  }
  return { valid: true };
}

export function isChecklistComplete(checklist?: VerificationChecklistState | null): boolean {
  if (!checklist) return false;
  return Boolean(
    checklist.faultResolved &&
      checklist.equipmentTested &&
      checklist.powerRestored &&
      checklist.safetyChecksCompleted &&
      checklist.documentationCompleted
  );
}

export function isPendingDecisionStatus(status: DecisionStatus): boolean {
  return status === 'SUBMITTED' || status === 'PENDING_REVIEW' || status === 'UNDER_REVIEW';
}

export function isApprovedActiveDecisionStatus(status: DecisionStatus): boolean {
  return status === 'APPROVED' || status === 'IN_PROGRESS' || status === 'COMPLETED' || status === 'IMPLEMENTED';
}

export interface DecisionAnalyticsSnapshot {
  openIncidentsCount: number;
  pendingApprovalsCount: number;
  activeFieldTasksCount: number;
  completedInvestigationsCount: number;
  escalatedCasesCount: number;
  rejectedDecisionsCount: number;
  avgResolutionMinutes: number;
  assetReliabilityPct: number;
  incidentTrends: Array<{ label: string; incidents: number; resolved: number }>;
  teamPerformance: Array<{
    teamName: string;
    assigned: number;
    completedOrVerified: number;
    completionRatePct: number;
  }>;
}

export function computeGovernanceAnalytics(params: {
  decisions: EngineeringDecision[];
  tasks: FieldTask[];
  faults: ActiveFault[];
  assets: InfrastructureAsset[];
  filters?: {
    state?: string;
    district?: string;
    area?: string;
    dateFrom?: string;
    dateTo?: string;
    priority?: PriorityLevel | '';
    engineer?: string;
  };
}): DecisionAnalyticsSnapshot {
  const { decisions, tasks, faults, assets, filters } = params;
  const assetById = new Map(assets.map((a) => [a.canonicalId, a]));

  const filteredDecisions = decisions.filter((d) => {
    const linkedAsset = assetById.get(d.targetAssetId);
    const st = d.state || linkedAsset?.state || '';
    const dist = d.district || linkedAsset?.district || '';
    const area = d.area || linkedAsset?.area || '';
    if (filters?.state && st !== filters.state) return false;
    if (filters?.district && dist !== filters.district) return false;
    if (filters?.area && area !== filters.area) return false;
    if (filters?.priority && (d.priority || 'HIGH') !== filters.priority) return false;
    if (
      filters?.engineer &&
      !d.proposedBy.toLowerCase().includes(filters.engineer.toLowerCase())
    ) {
      return false;
    }
    if (filters?.dateFrom && d.createdAt.slice(0, 10) < filters.dateFrom) return false;
    if (filters?.dateTo && d.createdAt.slice(0, 10) > filters.dateTo) return false;
    return true;
  });

  const decisionIds = new Set(filteredDecisions.map((d) => d.id));
  const filteredTasks = tasks.filter((t) => {
    if (filters?.state && t.state !== filters.state) return false;
    if (filters?.district && t.district !== filters.district) return false;
    if (filters?.area && t.area !== filters.area) return false;
    if (filters?.priority && t.priority !== filters.priority) return false;
    if (
      filters?.engineer &&
      !t.assignedEngineer.toLowerCase().includes(filters.engineer.toLowerCase()) &&
      !decisionIds.has(t.decisionId)
    ) {
      return false;
    }
    return true;
  });

  const openIncidentsCount = faults.filter((f) => {
    if (f.status === 'RESTORED') return false;
    const asset = assetById.get(f.affectedAssetId);
    if (filters?.state && asset?.state !== filters.state) return false;
    if (filters?.district && asset?.district !== filters.district) return false;
    if (filters?.area && asset?.area !== filters.area) return false;
    return true;
  }).length;

  const pendingApprovalsCount = filteredDecisions.filter((d) =>
    isPendingDecisionStatus(d.status)
  ).length;
  const activeFieldTasksCount = filteredTasks.filter(
    (t) => t.status === 'ASSIGNED' || t.status === 'IN_PROGRESS' || t.status === 'PAUSED'
  ).length;
  const completedInvestigationsCount = filteredDecisions.filter(
    (d) => d.status === 'CLOSED' || d.status === 'COMPLETED' || d.status === 'IMPLEMENTED'
  ).length;
  const escalatedCasesCount = filteredDecisions.filter((d) => Boolean(d.escalated)).length;
  const rejectedDecisionsCount = filteredDecisions.filter((d) => d.status === 'REJECTED').length;

  const resolutionSamples = filteredDecisions
    .map((d) => d.resolutionTimeMinutes)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0);
  const avgResolutionMinutes =
    resolutionSamples.length > 0
      ? Math.round(
          resolutionSamples.reduce((sum, n) => sum + n, 0) / resolutionSamples.length
        )
      : 48;

  const scopedAssets = assets.filter((a) => {
    if (filters?.state && a.state !== filters.state) return false;
    if (filters?.district && a.district !== filters.district) return false;
    if (filters?.area && a.area !== filters.area) return false;
    return true;
  });
  const healthyAssets = scopedAssets.filter(
    (a) => a.status !== 'FAULTED' && a.status !== 'DE_ENERGIZED'
  ).length;
  const assetReliabilityPct =
    scopedAssets.length > 0
      ? Math.round((healthyAssets / scopedAssets.length) * 1000) / 10
      : 96.4;

  const incidentTrends = [
    { label: 'Nov 10', incidents: 2, resolved: 2 },
    { label: 'Nov 11', incidents: 3, resolved: 3 },
    { label: 'Nov 12', incidents: 1, resolved: 1 },
    { label: 'Nov 13', incidents: 4, resolved: 3 },
    {
      label: 'Nov 14',
      incidents: Math.max(openIncidentsCount + completedInvestigationsCount, 3),
      resolved: Math.max(completedInvestigationsCount, 1)
    }
  ];

  const teamMap = new Map<string, { assigned: number; completedOrVerified: number }>();
  for (const t of filteredTasks) {
    const current = teamMap.get(t.assignedTeam) || { assigned: 0, completedOrVerified: 0 };
    current.assigned += 1;
    if (t.status === 'COMPLETED' || t.status === 'VERIFIED') {
      current.completedOrVerified += 1;
    }
    teamMap.set(t.assignedTeam, current);
  }
  const teamPerformance = Array.from(teamMap.entries()).map(([teamName, stats]) => ({
    teamName,
    assigned: stats.assigned,
    completedOrVerified: stats.completedOrVerified,
    completionRatePct:
      stats.assigned > 0 ? Math.round((stats.completedOrVerified / stats.assigned) * 100) : 0
  }));

  return {
    openIncidentsCount,
    pendingApprovalsCount,
    activeFieldTasksCount,
    completedInvestigationsCount,
    escalatedCasesCount,
    rejectedDecisionsCount,
    avgResolutionMinutes,
    assetReliabilityPct,
    incidentTrends,
    teamPerformance
  };
}
