import React, { useEffect, useMemo, useState } from 'react';
import { useGrid } from '../context/GridContext';
import { SourceBadge } from '../components/ui/SourceBadge';
import { GridMapComponent } from '../components/map/GridMapComponent';
import { KnowledgeGraphCanvas } from '../components/graph/KnowledgeGraphCanvas';
import { formatMissingValue } from '../services/syntheticData';
import { SIMULATION_TYPE_LABELS } from '../services/simulationEngine';
import { exportSimulationDecisionReportPdf } from '../services/simulationPdfReport';
import { isPendingDecisionStatus } from '../services/governanceHelpers';
import { DecisionGovernanceView } from './DecisionGovernanceView';
import type { SimulationRiskLevel, SimulationType } from '../types/grid';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Cpu,
  Download,
  FileCheck2,
  FileCode,
  GitBranch,
  History,
  Layers,
  Map as MapIcon,
  MessageSquare,
  Pause,
  Play,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Zap
} from 'lucide-react';

type CenterWorkspaceTab = 'map' | 'graph' | 'comparison' | 'alternatives' | 'opendss';

const SIMULATION_TYPES: SimulationType[] = [
  'FEEDER_TRANSFER',
  'TRANSFORMER_ISOLATION',
  'PLANNED_MAINTENANCE',
  'ALTERNATIVE_SUPPLY',
  'LOAD_REDISTRIBUTION'
];

function getRiskBannerClasses(level: SimulationRiskLevel): {
  container: string;
  badge: string;
  text: string;
  label: string;
} {
  switch (level) {
    case 'HIGH':
      return {
        container:
          'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/70',
        badge:
          'bg-rose-600 text-white',
        text: 'text-rose-700 dark:text-rose-300',
        label: 'HIGH RISK'
      };
    case 'MEDIUM':
      return {
        container:
          'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/70',
        badge:
          'bg-amber-600 text-white',
        text: 'text-amber-700 dark:text-amber-300',
        label: 'MEDIUM RISK'
      };
    default:
      return {
        container:
          'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/70',
        badge:
          'bg-emerald-600 text-white',
        text: 'text-emerald-700 dark:text-emerald-300',
        label: 'LOW RISK'
      };
  }
}

export const SimulatorView: React.FC = () => {
  const {
    scenarios,
    scopedScenarios,
    scopedAssets,
    assets,
    faults,
    eventReconstructions,
    selectedAssetId,
    selectedFaultId,
    selectedReconstructionId,
    activeRootCauseAnalysis,
    activeSimulation,
    activeSimulationOverlay,
    simulationOverlayPlaying,
    geoScopeLabel,
    hasRegionSelection,
    pendingSimulationParams,
    clearPendingSimulationParams,
    selectAsset,
    selectSimulationScenario,
    setSimulationOverlayPlaying,
    compareSimulations,
    recordReportExportAudit,
    prepareDecisionFromContext,
    openEventReconstructionForFault,
    openEventReconstructionForAsset,
    resetGeoFilter,
    runSimulation,
    getAssetHealth,
    scopedAiSnapshot,
    simulatorTab,
    setSimulatorTab,
    scopedDecisions,
    decisions,
    rolePermissions,
    reviewDecision,
    submitDecision,
    pendingDecisionDraft
  } = useGrid();

  const poolAssets = scopedAssets.length > 0 ? scopedAssets : assets;

  const substations = useMemo(
    () => poolAssets.filter((a) => a.assetType === 'SUBSTATION'),
    [poolAssets]
  );

  const feeders = useMemo(
    () =>
      poolAssets.filter(
        (a) =>
          a.assetType === 'FEEDER' ||
          a.osmType === 'line' ||
          a.osmType === 'minor_line' ||
          a.osmType === 'cable'
      ),
    [poolAssets]
  );

  const transformers = useMemo(
    () => poolAssets.filter((a) => a.assetType === 'TRANSFORMER'),
    [poolAssets]
  );

  const switches = useMemo(
    () =>
      poolAssets.filter(
        (a) =>
          a.assetType === 'SECTIONALIZER' ||
          a.assetType === 'CIRCUIT_BREAKER' ||
          a.assetType === 'RECLOSER' ||
          a.osmType === 'switch'
      ),
    [poolAssets]
  );

  // Scenario Builder State
  const [scenarioType, setScenarioType] = useState<SimulationType>('FEEDER_TRANSFER');
  const [substationId, setSubstationId] = useState<string>('');
  const [sourceFeeder, setSourceFeeder] = useState<string>('');
  const [targetFeeder, setTargetFeeder] = useState<string>('');
  const [transformerId, setTransformerId] = useState<string>('');
  const [tieSwitch, setTieSwitch] = useState<string>('');
  const [loadTransferPct, setLoadTransferPct] = useState<number>(65);
  const [loadTransferMva, setLoadTransferMva] = useState<number>(3.4);
  const [expectedDurationMin, setExpectedDurationMin] = useState<number>(15);
  const [timeOfOperation, setTimeOfOperation] = useState<string>(() =>
    new Date().toISOString().slice(0, 16)
  );
  const [centerTab, setCenterTab] = useState<CenterWorkspaceTab>('map');
  const [compareIds, setCompareIds] = useState<string[]>(() =>
    scenarios.slice(0, 2).map((s) => s.id)
  );
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [copiedScript, setCopiedScript] = useState<boolean>(false);
  const [inlineComment, setInlineComment] = useState<string>('');
  const [inlineFeedback, setInlineFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (pendingDecisionDraft) {
      setSimulatorTab('governance');
    }
  }, [pendingDecisionDraft, setSimulatorTab]);

  // Sync incoming handoffs from Event Reconstruction / RCA / Map
  useEffect(() => {
    if (!pendingSimulationParams) return;
    if (pendingSimulationParams.sourceFeeder) {
      setSourceFeeder(pendingSimulationParams.sourceFeeder);
      const srcObj = assets.find((a) => a.canonicalId === pendingSimulationParams.sourceFeeder);
      if (srcObj?.substationId) setSubstationId(srcObj.substationId);
    }
    if (pendingSimulationParams.targetFeeder) {
      setTargetFeeder(pendingSimulationParams.targetFeeder);
    }
    if (pendingSimulationParams.tieSwitch) {
      setTieSwitch(pendingSimulationParams.tieSwitch);
    }
    if (typeof pendingSimulationParams.loadTransferMva === 'number') {
      setLoadTransferMva(pendingSimulationParams.loadTransferMva);
    }
    clearPendingSimulationParams();
  }, [pendingSimulationParams, assets, clearPendingSimulationParams]);

  // Cascade defaults when scoped assets load or change
  useEffect(() => {
    if (substations.length > 0 && !substations.some((s) => s.canonicalId === substationId)) {
      setSubstationId(substations[0].canonicalId);
    }
  }, [substations, substationId]);

  const filteredFeeders = useMemo(() => {
    if (!substationId) return feeders;
    const subFeeders = feeders.filter((f) => f.substationId === substationId);
    return subFeeders.length > 0 ? subFeeders : feeders;
  }, [feeders, substationId]);

  useEffect(() => {
    if (feeders.length > 0 && !feeders.some((f) => f.canonicalId === sourceFeeder)) {
      setSourceFeeder(filteredFeeders[0]?.canonicalId || feeders[0].canonicalId);
    }
    if (feeders.length > 1 && !feeders.some((f) => f.canonicalId === targetFeeder)) {
      const alternate =
        feeders.find((f) => f.canonicalId !== (filteredFeeders[0]?.canonicalId || feeders[0].canonicalId) && f.status !== 'FAULTED') ||
        feeders[1];
      setTargetFeeder(alternate.canonicalId);
    } else if (feeders.length === 1 && !targetFeeder) {
      setTargetFeeder(feeders[0].canonicalId);
    }
  }, [feeders, filteredFeeders, sourceFeeder, targetFeeder]);

  const filteredTransformers = useMemo(() => {
    const byFeeder = transformers.filter((t) => !sourceFeeder || t.feederId === sourceFeeder);
    return byFeeder.length > 0 ? byFeeder : transformers;
  }, [transformers, sourceFeeder]);

  useEffect(() => {
    if (filteredTransformers.length > 0 && !filteredTransformers.some((t) => t.canonicalId === transformerId)) {
      setTransformerId(filteredTransformers[0].canonicalId);
    }
  }, [filteredTransformers, transformerId]);

  useEffect(() => {
    if (switches.length > 0 && !switches.some((sw) => sw.canonicalId === tieSwitch)) {
      const preferred = switches.find((s) => s.assetType === 'SECTIONALIZER') || switches[0];
      setTieSwitch(preferred.canonicalId);
    }
  }, [switches, tieSwitch]);

  // Keep comparison selections valid when new scenarios are created
  useEffect(() => {
    setCompareIds((prev) => {
      const valid = prev.filter((id) => scenarios.some((s) => s.id === id));
      if (valid.length >= 2) return valid;
      return scenarios.slice(0, Math.min(3, scenarios.length)).map((s) => s.id);
    });
  }, [scenarios]);

  // Estimate MVA when load percentage changes
  const handleLoadPctChange = (pct: number) => {
    setLoadTransferPct(pct);
    const srcAsset = assets.find((a) => a.canonicalId === sourceFeeder);
    const capMva = srcAsset?.ratedCapacityKva ? srcAsset.ratedCapacityKva / 1000 : 12.5;
    const preLoadPct = srcAsset?.peakLoadPct && srcAsset.peakLoadPct > 0 ? srcAsset.peakLoadPct : 76;
    const preLoadMva = (capMva * preLoadPct) / 100;
    const computedMva = Number(Math.max(0.8, Math.min(11.5, (preLoadMva * pct) / 100)).toFixed(2));
    setLoadTransferMva(computedMva);
  };

  const activeScenario =
    activeSimulation || scopedScenarios[0] || scenarios[0] || null;

  const linkedIncident = useMemo(() => {
    if (activeScenario?.incidentId) {
      return eventReconstructions.find((r) => r.id === activeScenario.incidentId) || null;
    }
    return (
      eventReconstructions.find(
        (r) =>
          r.id === selectedReconstructionId ||
          r.faultId === selectedFaultId ||
          r.feederId === sourceFeeder
      ) || null
    );
  }, [activeScenario, eventReconstructions, selectedReconstructionId, selectedFaultId, sourceFeeder]);

  const linkedFault = useMemo(() => {
    const fId = activeScenario?.faultId || selectedFaultId || linkedIncident?.faultId;
    if (!fId) return null;
    return faults.find((f) => f.id === fId || f.faultCode === fId) || null;
  }, [activeScenario, selectedFaultId, linkedIncident, faults]);

  const comparisonResult = useMemo(
    () => compareSimulations(compareIds),
    [compareIds, compareSimulations]
  );

  const showNotice = (msg: string) => {
    setNoticeMessage(msg);
    setTimeout(() => setNoticeMessage(null), 4500);
  };

  const handleRunSimulation = () => {
    const src = sourceFeeder || 'FDR-TG-06U-01';
    const tgt = targetFeeder || 'FDR-TG-06U-02';
    const sw = tieSwitch || 'SW-TG-06U-14';
    const isoOpTime = timeOfOperation
      ? new Date(timeOfOperation).toISOString()
      : new Date().toISOString();

    const created = runSimulation({
      scenarioType,
      substationId: substationId || null,
      sourceFeeder: src,
      targetFeeder: tgt,
      transformerId: transformerId || null,
      tieSwitch: sw,
      loadTransferPct,
      loadTransferMva,
      expectedDurationMin,
      timeOfOperation: isoOpTime,
      incidentId: linkedIncident?.id ?? null,
      faultId: linkedFault?.id ?? null
    });

    showNotice(
      `${created.scenarioCode} completed (${SIMULATION_TYPE_LABELS[created.scenarioType]}): ${created.riskAssessment.level} RISK evaluated.`
    );
  };

  const handleExportPdf = () => {
    if (!activeScenario) return;
    exportSimulationDecisionReportPdf(activeScenario);
    recordReportExportAudit(activeScenario);
    showNotice(`Exported Decision Support Report PDF for ${activeScenario.scenarioCode}.`);
  };

  const handleToggleCompareScenario = (id: string) => {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleCopyOpenDss = () => {
    if (!activeScenario) return;
    navigator.clipboard.writeText(activeScenario.opendssScript);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const pendingApprovalsCount = useMemo(
    () => scopedDecisions.filter((d) => isPendingDecisionStatus(d.status)).length,
    [scopedDecisions]
  );

  const linkedSimulationDecision = useMemo(() => {
    if (!activeScenario) return null;
    return (
      decisions.find(
        (d) =>
          d.evidenceBundle.simulationScenarioId === activeScenario.scenarioCode ||
          d.evidenceBundle.simulationScenarioId === activeScenario.id ||
          (d.targetAssetId ===
            (activeScenario.tieSwitchId ||
              activeScenario.transformerId ||
              activeScenario.sourceFeederId) &&
            isPendingDecisionStatus(d.status))
      ) || null
    );
  }, [decisions, activeScenario]);

  const handleInlineSubmitFromScenario = () => {
    if (!activeScenario) return;
    if (!rolePermissions.canSubmitDecision) {
      prepareDecisionFromContext(activeScenario);
      return;
    }
    const targetId =
      activeScenario.tieSwitchId ||
      activeScenario.transformerId ||
      activeScenario.sourceFeederId ||
      'SW-TG-06U-14';
    const created = submitDecision({
      title: `Authorize ${activeScenario.scenarioCode}: ${activeScenario.recommendation.title}`,
      rationale: `${inlineComment ? `${inlineComment} — ` : ''}What-If Simulation (${activeScenario.scenarioCode} · ${activeScenario.scenarioType}): ${activeScenario.recommendation.reasons.join('; ')}. Post-operation loading ${activeScenario.targetFeederPostLoadMva.toFixed(2)} / ${activeScenario.targetFeederCapacityMva} MVA, min bus voltage ${activeScenario.minBusVoltagePu} p.u.`,
      riskAssessment: `${activeScenario.riskAssessment.level} RISK: ${activeScenario.riskAssessment.reasons.join(' ')}`,
      targetAssetId: targetId,
      priority:
        activeScenario.riskAssessment.level === 'HIGH'
          ? 'CRITICAL'
          : activeScenario.riskAssessment.level === 'MEDIUM'
            ? 'HIGH'
            : 'MEDIUM',
      riskLevel: activeScenario.riskAssessment.level,
      evidenceBundle: {
        conflictIssueIds: activeRootCauseAnalysis.evidenceIssueIds,
        eventTimelineIds: activeRootCauseAnalysis.evidenceEventIds,
        simulationScenarioId: activeScenario.scenarioCode,
        affectedCustomersCount: activeScenario.impactAnalysis.consumersAffectedAfter,
        reliabilityImpact: `${activeScenario.scenarioCode} · Restores ${activeScenario.impactAnalysis.consumersRestored ?? 'N/A'} consumers · Est. window ${activeScenario.expectedDurationMin} min`
      }
    });
    setInlineComment('');
    setInlineFeedback(`Submitted ${created.decisionCode} for Utility Manager approval.`);
  };

  const handleInlineReview = (action: 'APPROVE' | 'REJECT') => {
    if (!linkedSimulationDecision) return;
    const res = reviewDecision(
      linkedSimulationDecision.id,
      action,
      inlineComment || `Reviewed inside What-If Simulator (${action}).`
    );
    if (res.success) {
      setInlineComment('');
      setInlineFeedback(
        action === 'APPROVE'
          ? `${linkedSimulationDecision.decisionCode} approved & field task ${res.createdTask?.taskCode || ''} dispatched.`
          : `${linkedSimulationDecision.decisionCode} rejected and audit-logged.`
      );
    } else {
      setInlineFeedback(res.error || 'Action blocked by RBAC rules.');
    }
  };

  const riskStyles = getRiskBannerClasses(activeScenario?.riskAssessment.level ?? 'LOW');

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto">
      {/* Top Header & Operational Context Strip */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <Cpu className="w-5 h-5 text-cyan-600 dark:text-cyan-400 shrink-0" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                What-If Simulator &amp; Decision Governance
              </h2>
              {activeScenario && simulatorTab === 'studio' && <SourceBadge source={activeScenario.source} />}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Simulate feeder transfers, evaluate risks, review proposals, add operational comments, and submit or approve decisions in one workspace.
            </p>
          </div>

          {/* Primary Sub-Workspace Switcher: Simulation Studio vs Decisions & Approvals */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/70">
              <button
                type="button"
                onClick={() => setSimulatorTab('studio')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  simulatorTab === 'studio'
                    ? 'bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>Simulation Studio</span>
              </button>
              <button
                type="button"
                onClick={() => setSimulatorTab('governance')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  simulatorTab === 'governance'
                    ? 'bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <FileCheck2 className="w-3.5 h-3.5" />
                <span>Decisions &amp; Approvals</span>
                {pendingApprovalsCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 font-mono text-[10px] tabular-nums">
                    {pendingApprovalsCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {simulatorTab === 'studio' && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
            {hasRegionSelection && (
              <button
                type="button"
                onClick={resetGeoFilter}
                className="px-2.5 py-1.5 text-xs font-mono text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800 rounded-lg hover:bg-cyan-100 dark:hover:bg-cyan-900/40 transition-colors whitespace-nowrap shrink-0"
              >
                Scope: {geoScopeLabel} (Clear)
              </button>
            )}

            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-mono uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap">
                Saved Scenario:
              </label>
              <select
                value={activeScenario?.id || ''}
                onChange={(e) => selectSimulationScenario(e.target.value || null)}
                className="px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 max-w-[260px]"
              >
                {scenarios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.scenarioCode} · {SIMULATION_TYPE_LABELS[s.scenarioType]} [{s.riskAssessment.level}]
                  </option>
                ))}
              </select>
            </div>

            {linkedIncident && (
              <button
                type="button"
                onClick={() =>
                  linkedFault
                    ? openEventReconstructionForFault(linkedFault.id)
                    : openEventReconstructionForAsset(
                        activeScenario?.transformerId ||
                          activeScenario?.sourceFeederId ||
                          activeRootCauseAnalysis.canonicalAssetId
                      )
                }
                className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <History className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                <span>Timeline: {linkedIncident.id}</span>
              </button>
            )}
          </div>
        </div>
        )}

        {/* Context & Advisory Policy Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-600 dark:text-slate-300">
            <span>
              <strong className="text-slate-800 dark:text-slate-100">Active Focus:</strong>{' '}
              <span className="font-mono text-cyan-600 dark:text-cyan-400">
                {selectedAssetId || activeScenario?.transformerId || activeScenario?.sourceFeederId || 'Not selected'}
              </span>
            </span>
            <span>
              <strong className="text-slate-800 dark:text-slate-100">Linked Incident:</strong>{' '}
              <span className="font-mono">
                {linkedIncident ? `${linkedIncident.id} (${linkedIncident.title})` : 'Standby / Planned Study'}
              </span>
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>
              Advisory decision-support only — zero automatic breaker control signals emitted.
            </span>
          </div>
        </div>

        {/* Phase 7: AI Pre-Simulation Health & Target Feeder Advisory */}
        {(() => {
          const srcHealth = sourceFeeder ? getAssetHealth(sourceFeeder) : undefined;
          const tgtHealth = targetFeeder ? getAssetHealth(targetFeeder) : undefined;
          const dtrHealth = transformerId ? getAssetHealth(transformerId) : undefined;
          const tgtPred = targetFeeder
            ? scopedAiSnapshot.predictions.find((p) => p.assetId === targetFeeder)
            : undefined;
          if (!srcHealth && !tgtHealth && !dtrHealth) return null;
          return (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-indigo-700 dark:text-indigo-300">
                <BrainCircuit className="w-4 h-4 shrink-0" />
                <span>AI Pre-Simulation Advisory:</span>
              </div>
              <div className="flex flex-wrap items-center gap-4 font-mono text-[11px] tabular-nums text-slate-700 dark:text-slate-300">
                {srcHealth && (
                  <span>
                    Source {srcHealth.assetId}: <strong>{srcHealth.healthScore}/100</strong> ({srcHealth.category})
                  </span>
                )}
                {tgtHealth && (
                  <span>
                    Target {tgtHealth.assetId}: <strong>{tgtHealth.healthScore}/100</strong> ({tgtHealth.category}
                    {tgtPred ? ` · ${tgtPred.probabilityPct}% overload risk` : ''})
                  </span>
                )}
                {dtrHealth && (
                  <span>
                    Transformer {dtrHealth.assetId}: <strong>{dtrHealth.healthScore}/100</strong> ({dtrHealth.category})
                  </span>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {simulatorTab === 'governance' ? (
        <DecisionGovernanceView embedded />
      ) : (
        <>
      {noticeMessage && (
        <div className="px-4 py-2.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 rounded-xl flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{noticeMessage}</span>
          </div>
        </div>
      )}

      {/* 3-Section Workspace: Left Builder | Center Map/Graph/Comparison | Right Impact/Risk/Recommendation */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* LEFT PANEL: Scenario Builder (~25%) */}
        <div className="xl:col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-4">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-2.5 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-700 dark:text-slate-200 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-500" />
              <span>Scenario Builder</span>
            </h3>
            <span className="text-[11px] font-mono text-slate-400 tabular-nums">
              {feeders.length} Feeders
            </span>
          </div>

          {/* 5 Simulation Types */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
              Simulation Type
            </label>
            <div className="grid grid-cols-1 gap-1.5">
              {SIMULATION_TYPES.map((typeKey) => {
                const isSelected = scenarioType === typeKey;
                return (
                  <button
                    key={typeKey}
                    type="button"
                    onClick={() => setScenarioType(typeKey)}
                    className={`w-full text-left px-3 py-2 rounded-lg border text-xs font-medium transition-colors flex items-center justify-between ${
                      isSelected
                        ? 'bg-cyan-50 dark:bg-cyan-950/50 border-cyan-500 text-cyan-800 dark:text-cyan-200 font-semibold'
                        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/70 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>{SIMULATION_TYPE_LABELS[typeKey]}</span>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-cyan-500 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Asset Selection */}
          <div className="space-y-3 text-xs pt-1 border-t border-slate-200 dark:border-slate-800">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Substation
              </label>
              <select
                value={substationId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSubstationId(val);
                  if (val) selectAsset(val, 'simulator', { zoom: 14, openPopup: false });
                }}
                className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-slate-800 dark:text-slate-200"
              >
                {substations.length > 0 ? (
                  substations.map((s) => (
                    <option key={s.canonicalId} value={s.canonicalId}>
                      [{s.source}] {s.canonicalId} · {formatMissingValue(s.rawName ?? s.name)}
                    </option>
                  ))
                ) : (
                  <option value="">Not available</option>
                )}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Source Feeder
              </label>
              <select
                value={sourceFeeder}
                onChange={(e) => {
                  const val = e.target.value;
                  setSourceFeeder(val);
                  if (val) selectAsset(val, 'simulator', { zoom: 15, openPopup: false });
                }}
                className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-slate-800 dark:text-slate-200"
              >
                {filteredFeeders.length > 0 ? (
                  filteredFeeders.map((f) => (
                    <option key={f.canonicalId} value={f.canonicalId}>
                      [{f.source}] {f.canonicalId} ({f.status})
                    </option>
                  ))
                ) : (
                  <option value="">No feeders available</option>
                )}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Target / Alternative Feeder
              </label>
              <select
                value={targetFeeder}
                onChange={(e) => {
                  const val = e.target.value;
                  setTargetFeeder(val);
                  if (val) selectAsset(val, 'simulator', { zoom: 15, openPopup: false });
                }}
                className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-slate-800 dark:text-slate-200"
              >
                {feeders.length > 0 ? (
                  feeders.map((f) => (
                    <option key={f.canonicalId} value={f.canonicalId}>
                      [{f.source}] {f.canonicalId} ({f.status})
                    </option>
                  ))
                ) : (
                  <option value="">No target feeders available</option>
                )}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Affected Transformer
              </label>
              <select
                value={transformerId}
                onChange={(e) => {
                  const val = e.target.value;
                  setTransformerId(val);
                  if (val) selectAsset(val, 'simulator', { zoom: 16, openPopup: false });
                }}
                className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-slate-800 dark:text-slate-200"
              >
                {filteredTransformers.length > 0 ? (
                  filteredTransformers.map((t) => (
                    <option key={t.canonicalId} value={t.canonicalId}>
                      [{t.source}] {t.canonicalId} · {formatMissingValue(t.ratedCapacityKva, ' kVA')}
                    </option>
                  ))
                ) : (
                  <option value="">Not available</option>
                )}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Tie / Sectionalizing Switch
              </label>
              <select
                value={tieSwitch}
                onChange={(e) => {
                  const val = e.target.value;
                  setTieSwitch(val);
                  if (val) selectAsset(val, 'simulator', { zoom: 16, openPopup: false });
                }}
                className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-slate-800 dark:text-slate-200"
              >
                {switches.length > 0 ? (
                  switches.map((sw) => (
                    <option key={sw.canonicalId} value={sw.canonicalId}>
                      [{sw.source}] {sw.canonicalId} · {formatMissingValue(sw.rawName ?? sw.name)}
                    </option>
                  ))
                ) : (
                  <option value="">Not available</option>
                )}
              </select>
            </div>
          </div>

          {/* Operational Parameters */}
          <div className="space-y-3 text-xs pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Load Share Percentage
                </label>
                <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400 tabular-nums">
                  {loadTransferPct}% ({loadTransferMva.toFixed(2)} MVA)
                </span>
              </div>
              <input
                type="range"
                min={10}
                max={100}
                step={5}
                value={loadTransferPct}
                onChange={(e) => handleLoadPctChange(Number(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-400">
                <span>10% Partial</span>
                <span>50% Split</span>
                <span>100% Full</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                  Transfer Load (MVA)
                </label>
                <input
                  type="number"
                  min={0.5}
                  max={12.0}
                  step={0.1}
                  value={loadTransferMva}
                  onChange={(e) => setLoadTransferMva(Math.max(0.5, Number(e.target.value) || 0.5))}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono tabular-nums text-slate-800 dark:text-slate-200"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                  Duration (min)
                </label>
                <input
                  type="number"
                  min={1}
                  max={480}
                  step={1}
                  value={expectedDurationMin}
                  onChange={(e) => setExpectedDurationMin(Math.max(1, Number(e.target.value) || 15))}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono tabular-nums text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                Time of Operation
              </label>
              <input
                type="datetime-local"
                value={timeOfOperation}
                onChange={(e) => setTimeOfOperation(e.target.value)}
                className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-slate-800 dark:text-slate-200"
              />
            </div>

            <button
              type="button"
              onClick={handleRunSimulation}
              className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run Simulation</span>
            </button>
          </div>
        </div>

        {/* CENTER PANEL: Map + Knowledge Graph + Current vs Proposed + Compare Alternatives (~42%) */}
        <div className="xl:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
          {/* Tab Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => setCenterTab('map')}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  centerTab === 'map'
                    ? 'bg-cyan-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <MapIcon className="w-3.5 h-3.5" />
                <span>Interactive Map</span>
              </button>

              <button
                type="button"
                onClick={() => setCenterTab('graph')}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  centerTab === 'graph'
                    ? 'bg-cyan-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <GitBranch className="w-3.5 h-3.5" />
                <span>Knowledge Graph</span>
              </button>

              <button
                type="button"
                onClick={() => setCenterTab('comparison')}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  centerTab === 'comparison'
                    ? 'bg-cyan-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Current vs Proposed</span>
              </button>

              <button
                type="button"
                onClick={() => setCenterTab('alternatives')}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  centerTab === 'alternatives'
                    ? 'bg-cyan-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Scale className="w-3.5 h-3.5" />
                <span>Compare ({compareIds.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setCenterTab('opendss')}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  centerTab === 'opendss'
                    ? 'bg-cyan-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>OpenDSS</span>
              </button>
            </div>

            {(centerTab === 'map' || centerTab === 'graph') && (
              <button
                type="button"
                onClick={() => setSimulationOverlayPlaying((p) => !p)}
                className="px-2.5 py-1 text-[11px] font-mono font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-md text-slate-700 dark:text-slate-200 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {simulationOverlayPlaying ? (
                  <>
                    <Pause className="w-3 h-3 text-cyan-500" />
                    <span>Pause Overlay</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3 text-emerald-500" />
                    <span>Animate Flow</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Center Panel Content */}
          {centerTab === 'map' && (
            <div className="space-y-2.5">
              <GridMapComponent
                heightClass="h-[460px]"
                simulationOverlay={activeSimulationOverlay}
              />
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/70 rounded-lg text-[11px] text-slate-600 dark:text-slate-300">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5 bg-cyan-500 inline-block" />
                    <span>Proposed Feeder Path</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5 bg-emerald-500 inline-block" />
                    <span>Temporary Supply Route</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-rose-500/80 inline-block" />
                    <span>Isolated Asset</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-amber-400/50 border border-amber-500 inline-block" />
                    <span>Affected Service Area</span>
                  </span>
                </div>
                {activeScenario && (
                  <span className="font-mono text-slate-500 dark:text-slate-400">
                    {activeScenario.scenarioCode}
                  </span>
                )}
              </div>
            </div>
          )}

          {centerTab === 'graph' && (
            <div className="space-y-2.5">
              <KnowledgeGraphCanvas
                heightClass="h-[460px]"
                compactLegend
                simulationOverlay={activeSimulationOverlay}
              />
              <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/70 rounded-lg text-[11px] text-slate-600 dark:text-slate-300 flex flex-wrap items-center justify-between gap-2">
                <span>
                  Graph highlights temporary tie closure{' '}
                  <strong className="font-mono text-emerald-600 dark:text-emerald-400">
                    SIM_TEMP_SUPPLY
                  </strong>{' '}
                  ({activeScenario?.tieSwitchId} &harr; {activeScenario?.targetFeederId}) and participating assets.
                </span>
                <span className="font-mono text-slate-400">
                  {activeScenario?.simulationAssets.length ?? 0} linked nodes
                </span>
              </div>
            </div>
          )}

          {centerTab === 'comparison' && activeScenario && (
            <div className="space-y-4">
              {/* Side-by-side Current vs Proposed Network */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/70 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono font-bold uppercase text-slate-500 dark:text-slate-400">
                      Current Network State
                    </span>
                    <span className="text-[11px] font-mono text-rose-600 dark:text-rose-400 font-semibold">
                      Baseline
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-700 dark:text-slate-200">
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Tie Switch State</span>
                      <span className="font-mono font-semibold">{activeScenario.tieSwitchId} (OPEN)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Target Feeder Pre-Load</span>
                      <span className="font-mono font-semibold tabular-nums">
                        {activeScenario.targetFeederPreLoadMva.toFixed(2)} / {activeScenario.targetFeederCapacityMva.toFixed(1)} MVA
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Network Utilization</span>
                      <span className="font-mono font-semibold tabular-nums">
                        {activeScenario.impactAnalysis.networkUtilizationBeforePct}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Affected Consumers</span>
                      <span className="font-mono font-semibold tabular-nums">
                        {activeScenario.impactAnalysis.consumersAffectedBefore !== null
                          ? activeScenario.impactAnalysis.consumersAffectedBefore.toLocaleString()
                          : 'Not available'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-cyan-50/70 dark:bg-cyan-950/25 border border-cyan-200 dark:border-cyan-800/70 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono font-bold uppercase text-cyan-700 dark:text-cyan-300">
                      Proposed Configuration
                    </span>
                    <span className="text-[11px] font-mono text-cyan-700 dark:text-cyan-300 font-semibold">
                      {SIMULATION_TYPE_LABELS[activeScenario.scenarioType]}
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-700 dark:text-slate-200">
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Tie Switch Action</span>
                      <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        {activeScenario.tieSwitchId} ({activeScenario.scenarioType === 'TRANSFORMER_ISOLATION' ? 'ISOLATE' : 'TIE_CLOSED'})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Target Feeder Post-Load</span>
                      <span className={`font-mono font-semibold tabular-nums ${activeScenario.thermalViolation ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {activeScenario.targetFeederPostLoadMva.toFixed(2)} / {activeScenario.targetFeederCapacityMva.toFixed(1)} MVA
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Network Utilization</span>
                      <span className="font-mono font-semibold tabular-nums">
                        {activeScenario.impactAnalysis.networkUtilizationAfterPct}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Remaining Exposure</span>
                      <span className="font-mono font-semibold tabular-nums">
                        {activeScenario.impactAnalysis.consumersAffectedAfter !== null
                          ? activeScenario.impactAnalysis.consumersAffectedAfter.toLocaleString()
                          : 'Not available'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Equipment Utilization Comparison Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Equipment Loading & Status Comparison
                  </span>
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    {activeScenario.impactAnalysis.loadRedistributionSummary}
                  </span>
                </div>
                <div className="overflow-x-auto max-h-[300px]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/40 text-[11px] font-mono uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-2 px-3">Asset ID</th>
                        <th className="py-2 px-3">Role</th>
                        <th className="py-2 px-3">Before</th>
                        <th className="py-2 px-3">After</th>
                        <th className="py-2 px-3">Transition</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {activeScenario.impactAnalysis.equipmentUtilization.map((row) => (
                        <tr key={`${row.assetId}-${row.role}`} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                          <td className="py-2 px-3 font-mono font-semibold text-slate-800 dark:text-slate-100">
                            <button
                              type="button"
                              onClick={() => selectAsset(row.assetId, 'simulator', { zoom: 15, openPopup: true })}
                              className="hover:text-cyan-600 dark:hover:text-cyan-400 underline-offset-2 hover:underline cursor-pointer"
                            >
                              {row.assetId}
                            </button>
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                            {row.role}
                          </td>
                          <td className="py-2 px-3 font-mono tabular-nums text-slate-600 dark:text-slate-300">
                            {row.beforeLoadPct}% ({row.beforeLoadMva} MVA)
                          </td>
                          <td className={`py-2 px-3 font-mono tabular-nums font-semibold ${
                            row.afterLoadPct >= 95
                              ? 'text-rose-600 dark:text-rose-400'
                              : row.afterLoadPct >= 80
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                          }`}>
                            {row.afterLoadPct}% ({row.afterLoadMva} MVA)
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                            {row.statusBefore} &rarr;{' '}
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {row.statusAfter}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {centerTab === 'alternatives' && (
            <div className="space-y-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/70 rounded-xl space-y-2">
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Select Scenarios to Compare Side-by-Side
                </div>
                <div className="flex flex-wrap gap-2">
                  {scenarios.map((s) => {
                    const checked = compareIds.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleToggleCompareScenario(s.id)}
                        className={`px-2.5 py-1 text-[11px] font-mono rounded-lg border transition-colors cursor-pointer ${
                          checked
                            ? 'bg-cyan-600 text-white border-cyan-600'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {s.scenarioCode} ({s.riskAssessment.level})
                      </button>
                    );
                  })}
                </div>
              </div>

              {comparisonResult.recommendedScenarioId && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-200 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">Recommended Alternative Identified</div>
                    <p className="mt-0.5 text-[11px]">{comparisonResult.summary}</p>
                  </div>
                </div>
              )}

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-[11px] font-mono uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2 px-3">Scenario</th>
                      <th className="py-2 px-3">Type</th>
                      <th className="py-2 px-3">Risk</th>
                      <th className="py-2 px-3">Post Load</th>
                      <th className="py-2 px-3">Min V (p.u.)</th>
                      <th className="py-2 px-3">Outage After</th>
                      <th className="py-2 px-3">Window</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {comparisonResult.rows.map((row) => {
                      const isBest = row.simulationId === comparisonResult.recommendedScenarioId;
                      return (
                        <tr
                          key={row.simulationId}
                          onClick={() => selectSimulationScenario(row.simulationId)}
                          className={`cursor-pointer transition-colors ${
                            isBest
                              ? 'bg-emerald-50/60 dark:bg-emerald-950/20'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                          }`}
                        >
                          <td className="py-2 px-3 font-mono font-semibold text-slate-900 dark:text-white">
                            {row.scenarioCode} {isBest && <span className="text-emerald-600 dark:text-emerald-400">(Best)</span>}
                          </td>
                          <td className="py-2 px-3 text-slate-600 dark:text-slate-300">
                            {SIMULATION_TYPE_LABELS[row.scenarioType]}
                          </td>
                          <td className="py-2 px-3 font-mono font-bold">
                            <span
                              className={
                                row.riskLevel === 'HIGH'
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : row.riskLevel === 'MEDIUM'
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-emerald-600 dark:text-emerald-400'
                              }
                            >
                              {row.riskLevel}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono tabular-nums">{row.postLoadPct}%</td>
                          <td className="py-2 px-3 font-mono tabular-nums">{row.minBusVoltagePu.toFixed(3)}</td>
                          <td className="py-2 px-3 font-mono tabular-nums">
                            {row.consumersAffectedAfter !== null ? row.consumersAffectedAfter.toLocaleString() : 'Not available'}
                          </td>
                          <td className="py-2 px-3 font-mono tabular-nums">{row.expectedOutageDurationMin} min</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {centerTab === 'opendss' && activeScenario && (
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-slate-200 space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span>OPENDSS POWER-FLOW MODEL ({activeScenario.scenarioCode})</span>
                <button
                  type="button"
                  onClick={handleCopyOpenDss}
                  className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedScript ? 'Copied' : 'Copy Script'}</span>
                </button>
              </div>
              <pre className="overflow-x-auto text-emerald-400 text-[11px] max-h-[410px] leading-relaxed">
                {activeScenario.opendssScript}
              </pre>
            </div>
          )}
        </div>

        {/* RIGHT PANEL: Impact Analysis, Risk Assessment, Explainable Recommendation & Actions (~33%) */}
        <div className="xl:col-span-4 space-y-4">
          {activeScenario ? (
            <>
              {/* Impact Analysis Card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-cyan-500" />
                    <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-700 dark:text-slate-200">
                      Impact Analysis
                    </h3>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                    {activeScenario.scenarioCode}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
                    <div className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400">
                      Consumers Impacted
                    </div>
                    <div className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
                      {activeScenario.impactAnalysis.consumersAffectedBefore !== null
                        ? `${activeScenario.impactAnalysis.consumersAffectedBefore.toLocaleString()} → ${activeScenario.impactAnalysis.consumersAffectedAfter?.toLocaleString() ?? 'Not available'}`
                        : 'Not available'}
                    </div>
                    <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 tabular-nums">
                      {activeScenario.impactAnalysis.consumersRestored !== null
                        ? `Restores ~${activeScenario.impactAnalysis.consumersRestored.toLocaleString()}`
                        : 'Consumer count not mapped'}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
                    <div className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400">
                      Est. Outage Window
                    </div>
                    <div className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
                      {activeScenario.impactAnalysis.expectedOutageDurationMin} min
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5 tabular-nums">
                      {activeScenario.impactAnalysis.transformersAffectedCount} DTR · {activeScenario.impactAnalysis.feedersAffectedCount} Feeders
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
                    <div className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400">
                      Target Feeder Loading
                    </div>
                    <div className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
                      {activeScenario.targetFeederPostLoadMva.toFixed(2)} / {activeScenario.targetFeederCapacityMva.toFixed(1)} MVA
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5 tabular-nums">
                      Util: {activeScenario.impactAnalysis.networkUtilizationBeforePct}% &rarr; {activeScenario.impactAnalysis.networkUtilizationAfterPct}%
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
                    <div className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400">
                      Min Bus Voltage
                    </div>
                    <div className={`text-sm font-bold font-mono tabular-nums mt-0.5 ${
                      activeScenario.voltageViolation
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}>
                      {activeScenario.minBusVoltagePu.toFixed(3)} p.u.
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                      ANSI C84.1 &ge; 0.950 p.u.
                    </div>
                  </div>
                </div>
              </div>

              {/* Risk Assessment Card (Explicit badge + icon, no border-l-4) */}
              <div className={`border rounded-xl p-4 space-y-2.5 ${riskStyles.container}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {activeScenario.riskAssessment.level === 'HIGH' ? (
                      <AlertTriangle className={`w-4 h-4 shrink-0 ${riskStyles.text}`} />
                    ) : activeScenario.riskAssessment.level === 'MEDIUM' ? (
                      <Zap className={`w-4 h-4 shrink-0 ${riskStyles.text}`} />
                    ) : (
                      <ShieldCheck className={`w-4 h-4 shrink-0 ${riskStyles.text}`} />
                    )}
                    <h3 className={`text-xs font-bold uppercase tracking-wider font-mono ${riskStyles.text}`}>
                      Risk Assessment
                    </h3>
                  </div>

                  <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold whitespace-nowrap ${riskStyles.badge}`}>
                    {riskStyles.label}
                  </span>
                </div>

                <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-200">
                  {activeScenario.riskAssessment.reasons.map((reason, idx) => (
                    <li key={idx} className="flex items-start gap-2 leading-snug">
                      <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${
                        activeScenario.riskAssessment.level === 'HIGH'
                          ? 'bg-rose-500'
                          : activeScenario.riskAssessment.level === 'MEDIUM'
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                      }`} />
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Explainable Recommendation Card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="w-4 h-4 text-cyan-500" />
                    <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-700 dark:text-slate-200">
                      Recommended Action
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono uppercase text-amber-600 dark:text-amber-400 font-semibold">
                    Advisory Only
                  </span>
                </div>

                <p className="text-xs font-semibold text-slate-900 dark:text-white leading-snug">
                  {activeScenario.recommendation.title}
                </p>

                <div className="space-y-1">
                  <div className="text-[11px] font-mono uppercase text-slate-500 dark:text-slate-400">
                    Explainable Basis
                  </div>
                  <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                    {activeScenario.recommendation.reasons.map((reason, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-1 pt-1 border-t border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] font-mono uppercase text-slate-500 dark:text-slate-400">
                    Advisory Switching Sequence
                  </div>
                  <ol className="space-y-1 text-xs text-slate-600 dark:text-slate-300 list-decimal list-inside">
                    {activeScenario.recommendation.switchingSequence.map((step, idx) => (
                      <li key={idx} className="leading-snug">
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Inline Governance Decision Review, Comments & Approval Card */}
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono uppercase font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-cyan-500" />
                      <span>Decision Proposal &amp; Approval</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setSimulatorTab('governance')}
                      className="text-[11px] font-mono font-semibold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                    >
                      All Proposals ({scopedDecisions.length}) &rarr;
                    </button>
                  </div>

                  {linkedSimulationDecision && (
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-[11px] space-y-1">
                      <div className="flex items-center justify-between gap-2 font-mono">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {linkedSimulationDecision.decisionCode}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 font-bold">
                          {linkedSimulationDecision.status}
                        </span>
                      </div>
                      <div className="text-slate-600 dark:text-slate-300 truncate">
                        {linkedSimulationDecision.title}
                      </div>
                    </div>
                  )}

                  <textarea
                    rows={2}
                    value={inlineComment}
                    onChange={(e) => setInlineComment(e.target.value)}
                    placeholder="Add engineering rationale, switching instructions, or manager approval comments..."
                    className="w-full p-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />

                  {inlineFeedback && (
                    <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg px-2.5 py-1.5">
                      {inlineFeedback}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleExportPdf}
                      className="px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                      <span>Export PDF</span>
                    </button>

                    {linkedSimulationDecision &&
                    isPendingDecisionStatus(linkedSimulationDecision.status) &&
                    rolePermissions.canApproveDecision ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleInlineReview('REJECT')}
                          className="px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => handleInlineReview('APPROVE')}
                          className="flex-1 px-3 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Approve &amp; Dispatch</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={handleInlineSubmitFromScenario}
                        className="flex-1 min-w-[150px] px-3 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-cyan-600 hover:bg-slate-800 dark:hover:bg-cyan-500 rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <span>
                          {rolePermissions.canSubmitDecision
                            ? 'Submit Proposal'
                            : 'Open Proposal Draft'}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 text-xs text-slate-500 dark:text-slate-400 text-center">
              Configure network parameters on the left and select <strong>Run Simulation</strong> to generate impact metrics, risk level, and recommendations.
            </div>
          )}
        </div>
      </div>
        </>
      )}
    </div>
  );
};
