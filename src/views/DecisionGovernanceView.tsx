import React, { useEffect, useMemo, useState } from 'react';
import { useGrid } from '../context/GridContext';
import {
  EngineeringDecision,
  PendingDecisionDraft,
  PriorityLevel,
  RiskLevel,
  VerificationChecklistState
} from '../types/grid';
import {
  FileCheck2,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Plus,
  UserCheck,
  FileText,
  MessageSquare,
  MapPin,
  Network,
  Wrench,
  Download,
  BarChart3,
  ArrowUpRight,
  BrainCircuit,
  Flag,
  CheckSquare
} from 'lucide-react';
import { SourceBadge } from '../components/ui/SourceBadge';
import { formatMissingValue, INITIAL_EVENT_RECONSTRUCTIONS } from '../services/syntheticData';
import {
  computeGovernanceAnalytics,
  isApprovedActiveDecisionStatus,
  isChecklistComplete,
  isPendingDecisionStatus
} from '../services/governanceHelpers';
import { exportIncidentResolutionPdf } from '../services/incidentResolutionPdfReport';

type GovernanceTab = 'WORKFLOW' | 'ANALYTICS';
type QueueFilter =
  | 'ALL'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'ACTIVE_TASKS'
  | 'COMPLETED'
  | 'ESCALATED';

const LIFECYCLE_STAGES = [
  'DRAFT',
  'PENDING_REVIEW',
  'APPROVED',
  'IN_PROGRESS',
  'COMPLETED',
  'CLOSED'
] as const;

function getLifecycleStageIndex(status: EngineeringDecision['status']): number {
  switch (status) {
    case 'DRAFT':
      return 0;
    case 'SUBMITTED':
    case 'PENDING_REVIEW':
    case 'UNDER_REVIEW':
      return 1;
    case 'APPROVED':
      return 2;
    case 'IN_PROGRESS':
      return 3;
    case 'COMPLETED':
    case 'IMPLEMENTED':
      return 4;
    case 'CLOSED':
      return 5;
    case 'REJECTED':
    default:
      return 1;
  }
}

interface DecisionGovernanceViewProps {
  embedded?: boolean;
}

export const DecisionGovernanceView: React.FC<DecisionGovernanceViewProps> = ({
  embedded = false
}) => {
  const {
    scopedDecisions,
    decisions,
    fieldTasks,
    fieldEvidence,
    faults,
    assets,
    scenarios,
    selectedAssetId,
    pendingDecisionDraft,
    clearPendingDecisionDraft,
    selectAsset,
    focusAssetOnMap,
    openKnowledgeGraphForAsset,
    openFieldTaskForAsset,
    setActiveTaskId,
    setActiveView,
    geoScopeLabel,
    hasRegionSelection,
    resetGeoFilter,
    currentRole,
    rolePermissions,
    reviewDecision,
    submitDecision,
    toggleDecisionEscalation,
    verifyAndCloseDecision,
    recordResolutionReportExportAudit
  } = useGrid();

  const [activeTab, setActiveTab] = useState<GovernanceTab>('WORKFLOW');
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('ALL');

  const filteredDecisions = useMemo(() => {
    const taskDecisionIds = new Set(
      fieldTasks
        .filter((t) => t.status === 'ASSIGNED' || t.status === 'IN_PROGRESS' || t.status === 'PAUSED')
        .map((t) => t.decisionId)
    );
    switch (queueFilter) {
      case 'PENDING':
        return scopedDecisions.filter((d) => isPendingDecisionStatus(d.status));
      case 'APPROVED':
        return scopedDecisions.filter((d) => isApprovedActiveDecisionStatus(d.status));
      case 'REJECTED':
        return scopedDecisions.filter((d) => d.status === 'REJECTED');
      case 'ACTIVE_TASKS':
        return scopedDecisions.filter((d) => taskDecisionIds.has(d.id));
      case 'COMPLETED':
        return scopedDecisions.filter(
          (d) => d.status === 'CLOSED' || d.status === 'COMPLETED' || d.status === 'IMPLEMENTED'
        );
      case 'ESCALATED':
        return scopedDecisions.filter((d) => Boolean(d.escalated));
      case 'ALL':
      default:
        return scopedDecisions;
    }
  }, [scopedDecisions, fieldTasks, queueFilter]);

  const [selectedDecision, setSelectedDecision] = useState<EngineeringDecision | null>(
    filteredDecisions[0] || null
  );
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [assignEngineer, setAssignEngineer] = useState<string>('Rohan Kulkarni (Field Engineer)');
  const [assignTeam, setAssignTeam] = useState<string>('Hyderabad Metro Rapid Response Crew-01');
  const [assignPriority, setAssignPriority] = useState<PriorityLevel>('HIGH');
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSuccess, setReviewSuccess] = useState<string | null>(null);

  // 5-item Verification Checklist State
  const [checklist, setChecklist] = useState<VerificationChecklistState>({
    faultResolved: false,
    equipmentTested: false,
    powerRestored: false,
    safetyChecksCompleted: false,
    documentationCompleted: false
  });
  const [resolutionSummary, setResolutionSummary] = useState<string>('');

  // Analytics filters
  const [analyticsState, setAnalyticsState] = useState<string>('');
  const [analyticsDistrict, setAnalyticsDistrict] = useState<string>('');
  const [analyticsArea, setAnalyticsArea] = useState<string>('');
  const [analyticsPriority, setAnalyticsPriority] = useState<PriorityLevel | ''>('');
  const [analyticsEngineer, setAnalyticsEngineer] = useState<string>('');
  const [analyticsDateFrom, setAnalyticsDateFrom] = useState<string>('');
  const [analyticsDateTo, setAnalyticsDateTo] = useState<string>('');

  useEffect(() => {
    setSelectedDecision((prev) => {
      if (prev && filteredDecisions.some((d) => d.id === prev.id)) {
        return filteredDecisions.find((d) => d.id === prev.id) || null;
      }
      return filteredDecisions[0] || null;
    });
  }, [filteredDecisions]);

  useEffect(() => {
    if (!selectedDecision) return;
    if (selectedDecision.verificationChecklist) {
      setChecklist(selectedDecision.verificationChecklist);
    } else {
      setChecklist({
        faultResolved: false,
        equipmentTested: false,
        powerRestored: false,
        safetyChecksCompleted: false,
        documentationCompleted: false
      });
    }
    setResolutionSummary(selectedDecision.resolutionSummary || '');
  }, [selectedDecision]);

  // New proposal modal state
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newRationale, setNewRationale] = useState<string>('');
  const [newRisk, setNewRisk] = useState<string>('');
  const [newPriority, setNewPriority] = useState<PriorityLevel>('HIGH');
  const [newRiskLevel, setNewRiskLevel] = useState<RiskLevel>('MEDIUM');
  const [newTargetAssetId, setNewTargetAssetId] = useState<string>(
    selectedAssetId || 'SW-TG-06U-14'
  );
  const [draftEvidence, setDraftEvidence] = useState<PendingDecisionDraft | null>(null);

  useEffect(() => {
    if (!pendingDecisionDraft) return;
    setNewTitle(pendingDecisionDraft.title);
    setNewRationale(pendingDecisionDraft.rationale);
    setNewRisk(pendingDecisionDraft.riskAssessment);
    setNewTargetAssetId(pendingDecisionDraft.targetAssetId);
    setDraftEvidence(pendingDecisionDraft);
    setShowCreateModal(true);
    clearPendingDecisionDraft();
  }, [pendingDecisionDraft, clearPendingDecisionDraft]);

  const dashboardCounts = useMemo(() => {
    return computeGovernanceAnalytics({
      decisions: scopedDecisions,
      tasks: fieldTasks,
      faults,
      assets
    });
  }, [scopedDecisions, fieldTasks, faults, assets]);

  const analyticsData = useMemo(() => {
    return computeGovernanceAnalytics({
      decisions,
      tasks: fieldTasks,
      faults,
      assets,
      filters: {
        state: analyticsState || undefined,
        district: analyticsDistrict || undefined,
        area: analyticsArea || undefined,
        priority: analyticsPriority,
        engineer: analyticsEngineer || undefined,
        dateFrom: analyticsDateFrom || undefined,
        dateTo: analyticsDateTo || undefined
      }
    });
  }, [
    decisions,
    fieldTasks,
    faults,
    assets,
    analyticsState,
    analyticsDistrict,
    analyticsArea,
    analyticsPriority,
    analyticsEngineer,
    analyticsDateFrom,
    analyticsDateTo
  ]);

  const stateOptions = useMemo(
    () => Array.from(new Set(assets.map((a) => a.state).filter(Boolean))).sort(),
    [assets]
  );
  const districtOptions = useMemo(
    () =>
      Array.from(
        new Set(
          assets
            .filter((a) => !analyticsState || a.state === analyticsState)
            .map((a) => a.district)
            .filter(Boolean)
        )
      ).sort(),
    [assets, analyticsState]
  );
  const areaOptions = useMemo(
    () =>
      Array.from(
        new Set(
          assets
            .filter(
              (a) =>
                (!analyticsState || a.state === analyticsState) &&
                (!analyticsDistrict || a.district === analyticsDistrict)
            )
            .map((a) => a.area)
            .filter(Boolean)
        )
      ).sort(),
    [assets, analyticsState, analyticsDistrict]
  );

  const linkedTask = useMemo(() => {
    if (!selectedDecision) return null;
    return (
      fieldTasks.find(
        (t) => t.id === selectedDecision.assignedTaskId || t.decisionId === selectedDecision.id
      ) || null
    );
  }, [fieldTasks, selectedDecision]);

  const linkedEvidence = useMemo(() => {
    if (!selectedDecision) return [];
    return fieldEvidence.filter(
      (ev) => ev.decisionId === selectedDecision.id || (linkedTask && ev.taskId === linkedTask.id)
    );
  }, [fieldEvidence, selectedDecision, linkedTask]);

  const handleReviewAction = (action: 'APPROVE' | 'REJECT') => {
    if (!selectedDecision) return;
    setReviewError(null);
    setReviewSuccess(null);

    const result = reviewDecision(
      selectedDecision.id,
      action,
      reviewNotes || `Decision ${action.toLowerCase()}ed under engineering governance rules.`,
      action === 'APPROVE'
        ? {
            assignedEngineer: assignEngineer,
            assignedTeam: assignTeam,
            priority: assignPriority
          }
        : undefined
    );
    if (!result.success) {
      setReviewError(result.error || 'Approval failed.');
    } else {
      setReviewSuccess(
        action === 'APPROVE'
          ? `Decision ${selectedDecision.decisionCode} approved and Field Task ${result.createdTask?.taskCode || ''} dispatched.`
          : `Decision ${selectedDecision.decisionCode} rejected and logged.`
      );
      setReviewNotes('');
    }
  };

  const handleVerifyAndClose = () => {
    if (!selectedDecision) return;
    setReviewError(null);
    setReviewSuccess(null);
    const res = verifyAndCloseDecision(selectedDecision.id, checklist, resolutionSummary);
    if (!res.success) {
      setReviewError(res.error || 'Checklist verification failed.');
    } else {
      setReviewSuccess(
        `Case ${selectedDecision.decisionCode} verified across all 5 safety & restoration checks and closed.`
      );
    }
  };

  const handleExportPdf = () => {
    if (!selectedDecision) return;
    const fault = faults.find(
      (f) => f.id === selectedDecision.faultId || f.affectedAssetId === selectedDecision.targetAssetId
    );
    const incident = INITIAL_EVENT_RECONSTRUCTIONS.find(
      (inc) => inc.id === selectedDecision.incidentId || inc.faultId === selectedDecision.faultId
    );
    const scenario = scenarios.find(
      (s) => s.id === selectedDecision.evidenceBundle.simulationScenarioId
    );
    exportIncidentResolutionPdf({
      decision: selectedDecision,
      fault,
      incident,
      scenario,
      task: linkedTask,
      evidence: linkedEvidence,
      assets
    });
    recordResolutionReportExportAudit(selectedDecision);
    setReviewSuccess(`Exported Incident Resolution PDF for ${selectedDecision.decisionCode}.`);
  };

  const handleCreateProposal = () => {
    if (!newTitle || !newRationale) return;
    const created = submitDecision({
      title: newTitle,
      rationale: newRationale,
      riskAssessment: newRisk || 'Standard operational risk assessment applies.',
      targetAssetId: newTargetAssetId || selectedAssetId || 'SUB-TG-06U',
      priority: newPriority,
      riskLevel: newRiskLevel,
      evidenceBundle: draftEvidence
        ? {
            conflictIssueIds: draftEvidence.conflictIssueIds,
            eventTimelineIds: draftEvidence.eventTimelineIds,
            simulationScenarioId: draftEvidence.simulationScenarioId,
            affectedCustomersCount: draftEvidence.affectedCustomersCount,
            reliabilityImpact: draftEvidence.reliabilityImpact,
            ...(draftEvidence.aiRecommendationSummary
              ? { aiRecommendationSummary: draftEvidence.aiRecommendationSummary }
              : {}),
            ...(typeof draftEvidence.aiConfidenceScore === 'number'
              ? { aiConfidenceScore: draftEvidence.aiConfidenceScore }
              : {}),
            ...(draftEvidence.aiReasons ? { aiReasons: draftEvidence.aiReasons } : {})
          }
        : undefined
    });
    setSelectedDecision(created);
    setShowCreateModal(false);
    setNewTitle('');
    setNewRationale('');
    setNewRisk('');
    setDraftEvidence(null);
  };

  const lifecycleIdx = selectedDecision ? getLifecycleStageIndex(selectedDecision.status) : 0;

  return (
    <div className={embedded ? 'space-y-5' : 'space-y-6 max-w-7xl mx-auto'}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            <h2 className={embedded ? 'text-sm font-bold text-slate-900 dark:text-white' : 'text-lg font-bold text-slate-900 dark:text-white'}>
              Decision Traceability, Approvals &amp; Closure Governance
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Human-in-the-loop approval lifecycle, field dispatch verification, closure governance, and operational analytics.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-lg bg-slate-200/70 dark:bg-slate-800 p-0.5 text-xs overflow-x-auto no-scrollbar max-w-full">
            <button
              type="button"
              onClick={() => setActiveTab('WORKFLOW')}
              className={`min-h-[44px] lg:min-h-0 px-3 py-1.5 rounded-md font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'WORKFLOW'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Governance &amp; Approvals
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ANALYTICS')}
              className={`min-h-[44px] lg:min-h-0 px-3 py-1.5 rounded-md font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'ANALYTICS'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Analytics &amp; Performance</span>
            </button>
          </div>

          {!embedded && hasRegionSelection && (
            <button
              type="button"
              onClick={resetGeoFilter}
              className="min-h-[44px] lg:min-h-0 px-2.5 py-1.5 text-[11px] font-mono text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/20 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Scope: {geoScopeLabel} (Clear)
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            disabled={!rolePermissions.canSubmitDecision}
            className="min-h-[44px] lg:min-h-0 px-3.5 py-1.5 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Decision Proposal</span>
          </button>
        </div>
      </div>

      {/* Role Notice */}
      <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
          <UserCheck className="w-4 h-4 text-cyan-500 shrink-0" />
          <span>
            Active Role: <strong>{rolePermissions.label}</strong> ({rolePermissions.actorName})
          </span>
          {currentRole === 'GRID_ENGINEER' && (
            <span className="text-amber-600 dark:text-amber-400">
              (Proposer: Can submit proposals; separation-of-duties blocks self-approval)
            </span>
          )}
          {currentRole === 'REVIEWER_APPROVER' && (
            <span className="text-emerald-600 dark:text-emerald-400">
              (Utility Manager: Authorized to Approve/Reject, Dispatch Teams, and Verify &amp; Close Cases)
            </span>
          )}
          {currentRole === 'FIELD_ENGINEER' && (
            <span className="text-cyan-600 dark:text-cyan-400">
              (Field Engineer: Execute assigned tasks &amp; submit inspection evidence in Module 08)
            </span>
          )}
        </div>
        <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
          Human-in-the-loop required · Zero automated SCADA switching
        </span>
      </div>

      {activeTab === 'ANALYTICS' ? (
        /* Analytics & Performance Tab */
        <div className="space-y-6">
          {/* Analytics Filters */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
            <div>
              <label className="text-[10px] font-mono text-slate-400 block mb-1">STATE</label>
              <select
                value={analyticsState}
                onChange={(e) => {
                  setAnalyticsState(e.target.value);
                  setAnalyticsDistrict('');
                  setAnalyticsArea('');
                }}
                className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              >
                <option value="">All States</option>
                {stateOptions.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-mono text-slate-400 block mb-1">DISTRICT</label>
              <select
                value={analyticsDistrict}
                onChange={(e) => {
                  setAnalyticsDistrict(e.target.value);
                  setAnalyticsArea('');
                }}
                className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              >
                <option value="">All Districts</option>
                {districtOptions.map((dist) => (
                  <option key={dist} value={dist}>
                    {dist}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-mono text-slate-400 block mb-1">AREA</label>
              <select
                value={analyticsArea}
                onChange={(e) => setAnalyticsArea(e.target.value)}
                className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              >
                <option value="">All Areas</option>
                {areaOptions.map((ar) => (
                  <option key={ar} value={ar}>
                    {ar}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-mono text-slate-400 block mb-1">PRIORITY</label>
              <select
                value={analyticsPriority}
                onChange={(e) => setAnalyticsPriority(e.target.value as PriorityLevel | '')}
                className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              >
                <option value="">All Priorities</option>
                <option value="CRITICAL">CRITICAL</option>
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-mono text-slate-400 block mb-1">ENGINEER</label>
              <input
                type="text"
                placeholder="Filter name..."
                value={analyticsEngineer}
                onChange={(e) => setAnalyticsEngineer(e.target.value)}
                className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-slate-400 block mb-1">DATE FROM</label>
              <input
                type="date"
                value={analyticsDateFrom}
                onChange={(e) => setAnalyticsDateFrom(e.target.value)}
                className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-slate-400 block mb-1">DATE TO</label>
              <input
                type="date"
                value={analyticsDateTo}
                onChange={(e) => setAnalyticsDateTo(e.target.value)}
                className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              />
            </div>
          </div>

          {/* Analytics KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] font-mono text-slate-400">OPEN INCIDENTS</div>
              <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1 tabular-nums">
                {analyticsData.openIncidentsCount}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] font-mono text-slate-400">PENDING APPROVALS</div>
              <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400 mt-1 tabular-nums">
                {analyticsData.pendingApprovalsCount}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] font-mono text-slate-400">ACTIVE FIELD TASKS</div>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1 tabular-nums">
                {analyticsData.activeFieldTasksCount}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] font-mono text-slate-400">AVG RESOLUTION TIME</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                {analyticsData.avgResolutionMinutes}m
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] font-mono text-slate-400">ASSET RELIABILITY</div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
                {analyticsData.assetReliabilityPct}%
              </div>
            </div>
          </div>

          {/* Trends & Team Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-500 dark:text-slate-400">
                Incident vs. Verified Resolution Trend
              </h3>
              <div className="space-y-3">
                {analyticsData.incidentTrends.map((row) => {
                  const incPct = Math.min(100, row.incidents * 20);
                  const resPct = Math.min(100, row.resolved * 20);
                  return (
                    <div key={row.label} className="space-y-1 text-xs">
                      <div className="flex items-center justify-between font-mono text-[11px] tabular-nums">
                        <span className="text-slate-700 dark:text-slate-300">{row.label}</span>
                        <span className="text-slate-500 dark:text-slate-400">
                          {row.incidents} detected · {row.resolved} closed
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex gap-0.5">
                        <div
                          className="h-full bg-emerald-500 rounded-l-full"
                          style={{ width: `${resPct}%` }}
                        />
                        <div
                          className="h-full bg-amber-500/70 rounded-r-full"
                          style={{ width: `${Math.max(0, incPct - resPct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-500 dark:text-slate-400">
                Field Team Performance
              </h3>
              <div className="space-y-2.5 text-xs">
                {analyticsData.teamPerformance.length === 0 ? (
                  <p className="text-slate-500 py-6 text-center">
                    No field team records match the selected analytics filters.
                  </p>
                ) : (
                  analyticsData.teamPerformance.map((team) => (
                    <div
                      key={team.teamName}
                      className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 dark:text-white truncate">
                          {team.teamName}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                          {team.completedOrVerified} of {team.assigned} tasks verified/completed
                        </div>
                      </div>
                      <span className="text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400 tabular-nums shrink-0">
                        {team.completionRatePct}%
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Governance & Approvals Workflow Tab */
        <>
          {/* 6 Governance Queue KPI Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { id: 'PENDING' as const, label: 'Pending Decisions', value: dashboardCounts.pendingApprovalsCount, tone: 'text-cyan-600 dark:text-cyan-400' },
              {
                id: 'APPROVED' as const,
                label: 'Approved Decisions',
                value: scopedDecisions.filter((d) => isApprovedActiveDecisionStatus(d.status)).length,
                tone: 'text-emerald-600 dark:text-emerald-400'
              },
              { id: 'REJECTED' as const, label: 'Rejected Decisions', value: dashboardCounts.rejectedDecisionsCount, tone: 'text-rose-600 dark:text-rose-400' },
              { id: 'ACTIVE_TASKS' as const, label: 'Active Field Tasks', value: dashboardCounts.activeFieldTasksCount, tone: 'text-amber-600 dark:text-amber-400' },
              { id: 'COMPLETED' as const, label: 'Completed Investigations', value: dashboardCounts.completedInvestigationsCount, tone: 'text-indigo-600 dark:text-indigo-400' },
              { id: 'ESCALATED' as const, label: 'Escalated Cases', value: dashboardCounts.escalatedCasesCount, tone: 'text-orange-600 dark:text-orange-400' }
            ].map((card) => {
              const active = queueFilter === card.id;
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => setQueueFilter(active ? 'ALL' : card.id)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    active
                      ? 'bg-cyan-50/50 dark:bg-cyan-950/20 border-cyan-500 ring-1 ring-cyan-500'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                    {card.label}
                  </div>
                  <div className={`text-xl font-bold font-mono mt-1 tabular-nums ${card.tone}`}>
                    {card.value}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Main Layout: List & Detail */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Decision Proposals List */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3 h-fit">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-2 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-400">
                  Proposals ({filteredDecisions.length})
                </h3>
                {queueFilter !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => setQueueFilter('ALL')}
                    className="text-[11px] text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                  >
                    Show All
                  </button>
                )}
              </div>

              <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
                {filteredDecisions.length === 0 ? (
                  <div className="py-8 px-3 text-center text-xs text-slate-500 dark:text-slate-400">
                    No engineering decision proposals match this filter for {geoScopeLabel}.
                  </div>
                ) : (
                  filteredDecisions.map((dec) => {
                    const isSelected = selectedDecision?.id === dec.id;
                    const isClosed = dec.status === 'CLOSED';
                    const isRejected = dec.status === 'REJECTED';
                    const isPending = isPendingDecisionStatus(dec.status);

                    return (
                      <div
                        key={dec.id}
                        onClick={() => {
                          setSelectedDecision(dec);
                          setReviewError(null);
                          setReviewSuccess(null);
                          if (dec.targetAssetId) {
                            selectAsset(dec.targetAssetId, 'decisions', {
                              zoom: 15,
                              openPopup: false
                            });
                          }
                        }}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-cyan-500 bg-cyan-50/40 dark:bg-cyan-950/20 ring-1 ring-cyan-500'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-mono text-xs font-bold text-slate-900 dark:text-white truncate">
                              {dec.decisionCode}
                            </span>
                            <SourceBadge source={dec.source} compact />
                          </div>
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold whitespace-nowrap shrink-0 ${
                              isClosed
                                ? 'text-indigo-600 bg-indigo-500/10'
                                : isRejected
                                  ? 'text-rose-600 bg-rose-500/10'
                                  : isPending
                                    ? 'text-cyan-600 bg-cyan-500/10'
                                    : 'text-emerald-600 bg-emerald-500/10'
                            }`}
                          >
                            {dec.status}
                          </span>
                        </div>
                        <h4 className="text-xs font-medium text-slate-800 dark:text-slate-200 line-clamp-2">
                          {dec.title}
                        </h4>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {dec.priority || 'HIGH'}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            Risk: {dec.riskLevel || 'MEDIUM'}
                          </span>
                          {dec.escalated && (
                            <span className="px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-600 dark:text-orange-400 font-bold">
                              ESCALATED
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-2 font-mono flex items-center justify-between gap-2">
                          <span className="truncate">
                            {dec.targetAssetId} {dec.incidentId ? `· ${dec.incidentId}` : ''}
                          </span>
                          <span className="shrink-0">{dec.createdAt.slice(0, 10)}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Selected Decision Detail, Lifecycle, Verification & Export Panel */}
            <div className="lg:col-span-2 space-y-4">
              {selectedDecision ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
                    <div className="min-w-0">
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400">
                          {selectedDecision.decisionCode}
                        </span>
                        <SourceBadge source={selectedDecision.source} />
                        {selectedDecision.incidentId && (
                          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                            Incident: {selectedDecision.incidentId}
                          </span>
                        )}
                        <span className="text-xs font-mono text-slate-500">
                          · {selectedDecision.createdAt.replace('T', ' ').slice(0, 16)} UTC
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                        {selectedDecision.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] font-mono">
                        <span className="text-slate-500">
                          Asset:{' '}
                          <strong className="text-cyan-600 dark:text-cyan-400">
                            {selectedDecision.targetAssetId}
                          </strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => focusAssetOnMap(selectedDecision.targetAssetId)}
                          className="px-2 py-0.5 rounded bg-cyan-600/10 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-600/20 inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <MapPin className="w-3 h-3" />
                          <span>Map</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openKnowledgeGraphForAsset(selectedDecision.targetAssetId)}
                          className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Network className="w-3 h-3 text-cyan-500" />
                          <span>Graph</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            toggleDecisionEscalation(
                              selectedDecision.id,
                              'Manager review escalation requested.'
                            )
                          }
                          className="px-2 py-0.5 rounded bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-500/20 inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Flag className="w-3 h-3" />
                          <span>{selectedDecision.escalated ? 'De-escalate' : 'Escalate'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col sm:items-end gap-2 shrink-0">
                      <span
                        className={`text-xs font-mono px-2.5 py-1 rounded font-bold whitespace-nowrap ${
                          selectedDecision.status === 'CLOSED'
                            ? 'text-indigo-600 bg-indigo-500/10 border border-indigo-500/20'
                            : selectedDecision.status === 'REJECTED'
                              ? 'text-rose-600 bg-rose-500/10 border border-rose-500/20'
                              : isPendingDecisionStatus(selectedDecision.status)
                                ? 'text-cyan-600 bg-cyan-500/10 border border-cyan-500/20'
                                : 'text-emerald-600 bg-emerald-500/10 border border-emerald-500/20'
                        }`}
                      >
                        {selectedDecision.status}
                      </span>
                      <button
                        type="button"
                        onClick={handleExportPdf}
                        className="px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 dark:hover:bg-slate-700 border border-slate-700 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Export Resolution PDF</span>
                      </button>
                    </div>
                  </div>

                  {/* Lifecycle Progress Stepper */}
                  {selectedDecision.status !== 'REJECTED' && (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2">
                        Governance Lifecycle Progress
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 text-[10px] font-mono">
                        {LIFECYCLE_STAGES.map((stage, i) => {
                          const reached = i <= lifecycleIdx;
                          return (
                            <div
                              key={stage}
                              className={`px-2 py-1.5 rounded text-center font-semibold truncate ${
                                reached
                                  ? 'bg-cyan-600 text-white'
                                  : 'bg-white dark:bg-slate-900 text-slate-400 border border-slate-200 dark:border-slate-800'
                              }`}
                            >
                              {stage.replace('_', ' ')}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Rationale & Risk Assessment */}
                  <div className="space-y-3 text-xs leading-relaxed">
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white mb-1">
                        Operational Rationale:
                      </h4>
                      <p className="text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-200 dark:border-slate-700/60">
                        {selectedDecision.rationale}
                      </p>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white mb-1">
                        Risk &amp; Constraint Assessment:
                      </h4>
                      <p className="text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-200 dark:border-slate-700/60">
                        {selectedDecision.riskAssessment}
                      </p>
                    </div>
                  </div>

                  {/* Attached Evidence Bundle */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-cyan-500" />
                        <span>Attached Evidence Bundle</span>
                      </h4>
                      <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                        Verified Cryptographic Package
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs font-mono">
                      <div className="p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 block">CONFLICT ISSUES</span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {selectedDecision.evidenceBundle.conflictIssueIds.length > 0
                            ? selectedDecision.evidenceBundle.conflictIssueIds.join(', ')
                            : 'Not available'}
                        </span>
                      </div>
                      <div className="p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 block">TIMELINE EVIDENCE</span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {selectedDecision.evidenceBundle.eventTimelineIds.length} Events Linked
                        </span>
                      </div>
                      <div className="p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 block">CUSTOMERS RESTORED</span>
                        <span className="font-bold text-emerald-500 tabular-nums">
                          {formatMissingValue(
                            selectedDecision.evidenceBundle.affectedCustomersCount,
                            ' Accounts'
                          )}
                        </span>
                      </div>
                      <div className="p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 block">SIMULATION MODEL</span>
                        <span className="font-bold text-purple-400">
                          {formatMissingValue(selectedDecision.evidenceBundle.simulationScenarioId)}
                        </span>
                      </div>
                    </div>

                    {selectedDecision.evidenceBundle.aiRecommendationSummary && (
                      <div className="p-3 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between gap-2 text-indigo-700 dark:text-indigo-300 font-semibold">
                          <span className="flex items-center gap-1.5">
                            <BrainCircuit className="w-3.5 h-3.5" />
                            <span>AI Explainable Recommendation</span>
                          </span>
                          {typeof selectedDecision.evidenceBundle.aiConfidenceScore === 'number' && (
                            <span className="font-mono text-[11px] tabular-nums">
                              {selectedDecision.evidenceBundle.aiConfidenceScore}% Confidence
                            </span>
                          )}
                        </div>
                        <p className="text-slate-800 dark:text-slate-200 font-medium">
                          {selectedDecision.evidenceBundle.aiRecommendationSummary}
                        </p>
                        {selectedDecision.evidenceBundle.aiReasons &&
                          selectedDecision.evidenceBundle.aiReasons.length > 0 && (
                            <ul className="space-y-0.5 text-[11px] text-slate-600 dark:text-slate-300">
                              {selectedDecision.evidenceBundle.aiReasons.map((r, i) => (
                                <li key={i}>• {r}</li>
                              ))}
                            </ul>
                          )}
                      </div>
                    )}

                    <div className="text-[11px] text-slate-500 font-mono break-all pt-1">
                      SHA-256 Digest: {selectedDecision.signatureHash}
                    </div>
                  </div>

                  {/* Linked Field Task & Field Evidence Summary */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700/60 space-y-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Wrench className="w-3.5 h-3.5 text-cyan-500" />
                        <span>Linked Field Operations &amp; Evidence</span>
                      </h4>
                      <button
                        type="button"
                        onClick={() => {
                          if (linkedTask) {
                            setActiveTaskId(linkedTask.id);
                            setActiveView('field');
                          } else {
                            openFieldTaskForAsset(selectedDecision.targetAssetId);
                          }
                        }}
                        className="text-[11px] font-semibold text-cyan-600 dark:text-cyan-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>Open in Field Operations</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    </div>
                    {linkedTask ? (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[11px]">
                        <div>
                          <span className="text-slate-400 block">TASK ID &amp; STATUS</span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {linkedTask.taskCode} · {linkedTask.status}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">CREW ASSIGNED</span>
                          <span className="text-slate-800 dark:text-slate-200">
                            {linkedTask.assignedEngineer}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">EVIDENCE RECORDS</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {linkedEvidence.length} Uploaded
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-slate-500 dark:text-slate-400">
                        Field execution task is automatically created and dispatched upon Manager approval.
                      </p>
                    )}
                  </div>

                  {/* Review History / Comments */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                      <span>Review Comments &amp; Governance Trail</span>
                    </h4>
                    <div className="space-y-2">
                      {selectedDecision.comments.map((c, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg text-xs space-y-1 border border-slate-100 dark:border-slate-800"
                        >
                          <div className="flex items-center justify-between text-slate-500 text-[11px] font-mono">
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              {c.author} ({c.role})
                            </span>
                            <span>{c.timestamp.replace('T', ' ').slice(0, 19)}</span>
                          </div>
                          <p className="text-slate-700 dark:text-slate-300">{c.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Error or Success Messages */}
                  {reviewError && (
                    <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 rounded-lg flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                      <span>{reviewError}</span>
                    </div>
                  )}

                  {reviewSuccess && (
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 rounded-lg flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>{reviewSuccess}</span>
                    </div>
                  )}

                  {/* Step 1: Manager Approval & Auto-Dispatch Controls */}
                  {isPendingDecisionStatus(selectedDecision.status) && (
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                            Dispatch Engineer (on Approve)
                          </label>
                          <input
                            type="text"
                            value={assignEngineer}
                            onChange={(e) => setAssignEngineer(e.target.value)}
                            className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                            Field Team
                          </label>
                          <input
                            type="text"
                            value={assignTeam}
                            onChange={(e) => setAssignTeam(e.target.value)}
                            className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                            Task Priority
                          </label>
                          <select
                            value={assignPriority}
                            onChange={(e) => setAssignPriority(e.target.value as PriorityLevel)}
                            className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                          >
                            <option value="CRITICAL">CRITICAL</option>
                            <option value="HIGH">HIGH</option>
                            <option value="MEDIUM">MEDIUM</option>
                            <option value="LOW">LOW</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-900 dark:text-white">
                          Manager Sign-Off Comments:
                        </label>
                        <textarea
                          rows={2}
                          value={reviewNotes}
                          onChange={(e) => setReviewNotes(e.target.value)}
                          placeholder="Enter formal engineering approval conditions or rejection reasons..."
                          className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => handleReviewAction('REJECT')}
                          className="px-4 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-950/50 rounded-lg transition-colors border border-rose-200 dark:border-rose-900 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Reject Proposal
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReviewAction('APPROVE')}
                          className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors shadow-sm flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          <span>Authorize &amp; Dispatch Field Team</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Step 2: 5-Point Verification Checklist & Case Closure */}
                  {isApprovedActiveDecisionStatus(selectedDecision.status) && (
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <CheckSquare className="w-4 h-4 text-emerald-500" />
                          <span>Mandatory 5-Point Incident Verification Checklist &amp; Case Closure</span>
                        </h4>
                        <span className="text-[11px] font-mono text-slate-500">
                          {
                            [
                              checklist.faultResolved,
                              checklist.equipmentTested,
                              checklist.powerRestored,
                              checklist.safetyChecksCompleted,
                              checklist.documentationCompleted
                            ].filter(Boolean).length
                          }
                          /5 Confirmed
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {(
                          [
                            ['faultResolved', 'Fault Resolved & Root Cause Eliminated'],
                            ['equipmentTested', 'Equipment Insulation & Load Tested'],
                            ['powerRestored', 'Consumer Power Restored Normally'],
                            ['safetyChecksCompleted', 'Lockout/Tagout & Safety Checks Completed'],
                            ['documentationCompleted', 'Field Evidence & Governance Docs Completed']
                          ] as const
                        ).map(([key, label]) => (
                          <label
                            key={key}
                            className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={checklist[key]}
                              onChange={(e) =>
                                setChecklist((prev) => ({ ...prev, [key]: e.target.checked }))
                              }
                              className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                            />
                            <span className="text-slate-700 dark:text-slate-200">{label}</span>
                          </label>
                        ))}
                      </div>

                      <textarea
                        rows={2}
                        value={resolutionSummary}
                        onChange={(e) => setResolutionSummary(e.target.value)}
                        placeholder="Final closure & restoration summary for audit archive..."
                        className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                      />

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        {!rolePermissions.canVerifyAndClose ? (
                          <span className="text-[11px] text-amber-600 dark:text-amber-400">
                            Switch role to Utility Manager or Administrator to verify and close case.
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            Closing updates decision to CLOSED, task to VERIFIED, and fault to RESTORED.
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={handleVerifyAndClose}
                          disabled={!isChecklistComplete(checklist) || !rolePermissions.canVerifyAndClose}
                          className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Verify Checklist &amp; Close Incident</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Closed Archive Summary */}
                  {selectedDecision.status === 'CLOSED' && selectedDecision.verificationChecklist && (
                    <div className="p-4 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/50 space-y-2 text-xs">
                      <div className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center justify-between">
                        <span>Case Verified &amp; Permanently Closed</span>
                        <span className="font-mono text-[11px]">
                          By {selectedDecision.closedBy}
                        </span>
                      </div>
                      <p className="text-indigo-800 dark:text-indigo-300">
                        {selectedDecision.resolutionSummary}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-12 text-center text-slate-400">
                  Select a decision proposal to inspect.
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Create Proposal Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-[calc(100vw-1.5rem)] sm:w-full max-h-[90dvh] overflow-y-auto p-4 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Draft New Engineering Decision Proposal
              </h3>
              <button
                type="button"
                aria-label="Close modal"
                onClick={() => setShowCreateModal(false)}
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="space-y-1 sm:col-span-1">
                  <label className="font-semibold text-slate-900 dark:text-white">
                    Target Asset ID:
                  </label>
                  <input
                    type="text"
                    value={newTargetAssetId}
                    onChange={(e) => setNewTargetAssetId(e.target.value)}
                    placeholder="e.g., SW-TG-06U-14"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-900 dark:text-white">Priority:</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as PriorityLevel)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  >
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-900 dark:text-white">Risk Level:</label>
                  <select
                    value={newRiskLevel}
                    onChange={(e) => setNewRiskLevel(e.target.value as RiskLevel)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  >
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-900 dark:text-white">
                  Proposal Title:
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g., Load Transfer Switching for Substation / Line Maintenance"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-900 dark:text-white">
                  Operational Rationale:
                </label>
                <textarea
                  rows={3}
                  value={newRationale}
                  onChange={(e) => setNewRationale(e.target.value)}
                  placeholder="Explain why this reconfiguration is required and what customer reliability benefits it offers..."
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-900 dark:text-white">
                  Risk &amp; Constraint Assessment:
                </label>
                <textarea
                  rows={2}
                  value={newRisk}
                  onChange={(e) => setNewRisk(e.target.value)}
                  placeholder="State feeder capacity headroom, voltage drop expectations, and lineworker clearance status..."
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>

              {draftEvidence?.aiRecommendationSummary && (
                <div className="p-2.5 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 space-y-1 text-[11px]">
                  <div className="flex items-center justify-between font-semibold text-indigo-700 dark:text-indigo-300">
                    <span className="flex items-center gap-1">
                      <BrainCircuit className="w-3.5 h-3.5" />
                      <span>AI Evidence Attached</span>
                    </span>
                    {typeof draftEvidence.aiConfidenceScore === 'number' && (
                      <span className="font-mono tabular-nums">
                        {draftEvidence.aiConfidenceScore}% conf.
                      </span>
                    )}
                  </div>
                  <p className="text-slate-700 dark:text-slate-200">
                    {draftEvidence.aiRecommendationSummary}
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="w-full sm:w-auto min-h-[44px] lg:min-h-0 px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateProposal}
                className="w-full sm:w-auto min-h-[44px] lg:min-h-0 px-4 py-2 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg cursor-pointer"
              >
                Submit Proposal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
