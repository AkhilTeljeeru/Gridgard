import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  Cpu,
  FileCheck2,
  MapPin,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
  Wrench,
  Zap
} from 'lucide-react';
import { useGrid } from '../../context/GridContext';
import { AssetHealthGauge } from './AssetHealthGauge';
import { AssetAiTimelinePanel } from './AssetAiTimelinePanel';
import { MobileRecordCardList } from '../ui/MobileRecordCard';

type PredictiveTab = 'recommendations' | 'predictions' | 'risk' | 'patterns';

export const PredictiveAnalyticsSection: React.FC = () => {
  const {
    scopedAiSnapshot,
    selectedAssetId,
    selectAsset,
    focusAssetOnMap,
    getAssetTimeline,
    recalculateAiIntelligence,
    prepareDecisionFromAiRecommendation,
    launchSimulationFromAiRecommendation,
    aiLastRecalculatedAt,
    geoScopeLabel,
    rolePermissions
  } = useGrid();

  const [activeTab, setActiveTab] = useState<PredictiveTab>('recommendations');
  const [riskScopeFilter, setRiskScopeFilter] = useState<
    'ALL' | 'STATE' | 'DISTRICT' | 'AREA' | 'SUBSTATION' | 'FEEDER'
  >('ALL');

  const {
    healthScores,
    predictions,
    riskIndices,
    recommendations,
    patterns,
    maintenanceQueue,
    monthlyFailureTrends,
    modelMetrics
  } = scopedAiSnapshot;

  const criticalCount = healthScores.filter((h) => h.category === 'CRITICAL').length;
  const warningCount = healthScores.filter((h) => h.category === 'WARNING').length;
  const healthyCount = healthScores.filter((h) => h.category === 'HEALTHY').length;
  const totalScored = Math.max(1, healthScores.length);

  const attentionCount = criticalCount + warningCount;
  const predictedHighCount = predictions.filter((p) => p.riskLevel === 'HIGH').length;
  const highRiskZonesCount = riskIndices.filter((r) => r.riskLevel === 'HIGH').length;
  const overdueBacklogCount = healthScores.filter((h) => h.maintenanceOverdueDays >= 60).length;

  const focusedAssetId = useMemo(() => {
    if (selectedAssetId && healthScores.some((h) => h.assetId === selectedAssetId)) {
      return selectedAssetId;
    }
    return healthScores[0]?.assetId || 'DTR-TG-06U-104';
  }, [selectedAssetId, healthScores]);

  const focusedHealth = useMemo(
    () => healthScores.find((h) => h.assetId === focusedAssetId) || healthScores[0],
    [healthScores, focusedAssetId]
  );

  const focusedTimeline = useMemo(
    () => (focusedHealth ? getAssetTimeline(focusedHealth.assetId) : []),
    [focusedHealth, getAssetTimeline]
  );

  const filteredRiskIndices = useMemo(() => {
    if (riskScopeFilter === 'ALL') return riskIndices;
    return riskIndices.filter((r) => r.scopeLevel === riskScopeFilter);
  }, [riskIndices, riskScopeFilter]);

  const maxTrendVal = Math.max(
    8,
    ...monthlyFailureTrends.flatMap((t) => [t.actualFaults, t.predictedFaults, t.preventiveActions])
  );

  return (
    <section
      aria-label="AI Intelligence Engine & Predictive Analytics"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/90"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <BrainCircuit className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-base font-semibold tracking-tight text-slate-900 dark:text-white">
              AI Intelligence Engine &amp; Predictive Decision Support
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Scope: {geoScopeLabel} · Advisory only (all switching &amp; maintenance actions require human approval) · Model {modelMetrics.modelVersion}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
            Last run {new Date(aiLastRecalculatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button
            type="button"
            onClick={recalculateAiIntelligence}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 whitespace-nowrap shrink-0 dark:border-indigo-800/70 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-900/60"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Recalculate AI Models
          </button>
        </div>
      </div>

      {/* 4 Predictive KPI Cards */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-950/50">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Assets Requiring Attention</span>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {attentionCount}
            </span>
            <span className="text-xs font-semibold text-red-600 dark:text-red-400 tabular-nums">
              {criticalCount} Critical · {warningCount} Warning
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-950/50">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Predicted Failures (30d)</span>
            <TrendingUp className="h-4 w-4 text-red-500" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {predictions.length}
            </span>
            <span className="text-xs text-slate-600 dark:text-slate-300 tabular-nums">
              {predictedHighCount} High Risk Forecasts
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-950/50">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>High-Risk Substations / Feeders</span>
            <ShieldAlert className="h-4 w-4 text-orange-500" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {highRiskZonesCount}
            </span>
            <span className="text-xs text-slate-600 dark:text-slate-300 tabular-nums">
              of {riskIndices.length} Geo/Grid Scopes
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-950/50">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Maintenance Backlog (&ge;60d)</span>
            <Wrench className="h-4 w-4 text-sky-500" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {overdueBacklogCount}
            </span>
            <span className="text-xs text-slate-600 dark:text-slate-300 tabular-nums">
              {maintenanceQueue.filter((q) => q.priority === 'CRITICAL').length} Urgent Priority
            </span>
          </div>
        </div>
      </div>

      {/* Asset Health Distribution Bar */}
      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            Asset Health Distribution ({healthScores.length} Scored Assets)
          </span>
          <span className="text-slate-600 dark:text-slate-400 tabular-nums">
            Healthy (80–100): {healthyCount} · Warning (50–79): {warningCount} · Critical (0–49): {criticalCount}
          </span>
        </div>
        <div className="mt-2 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div
            className="bg-emerald-500"
            style={{ width: `${Math.round((healthyCount / totalScored) * 100)}%` }}
            title={`Healthy: ${healthyCount}`}
          />
          <div
            className="bg-amber-500"
            style={{ width: `${Math.round((warningCount / totalScored) * 100)}%` }}
            title={`Warning: ${warningCount}`}
          />
          <div
            className="bg-red-500"
            style={{ width: `${Math.round((criticalCount / totalScored) * 100)}%` }}
            title={`Critical: ${criticalCount}`}
          />
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="mt-4 flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-slate-200 pb-3 dark:border-slate-800">
        {(
          [
            { id: 'recommendations', label: `Explainable AI Recommendations (${recommendations.length})` },
            { id: 'predictions', label: `Failure Predictions & AI Timeline (${predictions.length})` },
            { id: 'risk', label: `Grid Risk Index & Trends (${riskIndices.length})` },
            { id: 'patterns', label: `Incident Patterns & Maint. Queue (${maintenanceQueue.length})` }
          ] as Array<{ id: PredictiveTab; label: string }>
        ).map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-[44px] lg:min-h-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition whitespace-nowrap shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Explainable Recommendations & Asset Health Gauge */}
      {activeTab === 'recommendations' && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-7">
            {recommendations.map((rec) => {
              const prioColor =
                rec.priority === 'CRITICAL'
                  ? 'text-red-600 dark:text-red-400'
                  : rec.priority === 'HIGH'
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-sky-600 dark:text-sky-400';
              return (
                <article
                  key={rec.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/60"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
                        <span className={prioColor}>{rec.priority} PRIORITY</span>
                        <span className="text-slate-400">·</span>
                        <span className="font-mono text-slate-600 dark:text-slate-300">
                          {rec.assetId}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-indigo-600 dark:text-indigo-400 tabular-nums">
                          {rec.confidenceScore}% Confidence
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                          Health {rec.healthScore}/100
                        </span>
                      </div>
                      <h3 className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                        {rec.assetName}
                      </h3>
                    </div>

                    <button
                      type="button"
                      onClick={() => selectAsset(rec.assetId, 'overview', { openPopup: false })}
                      className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Inspect Factors
                    </button>
                  </div>

                  <p className="mt-1.5 text-xs font-medium text-slate-800 dark:text-slate-200">
                    {rec.recommendation}
                  </p>

                  <div className="mt-2.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Explainable Reasoning
                    </span>
                    <ul className="mt-1 space-y-1">
                      {rec.reasons.map((reason, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-300"
                        >
                          <span className="mt-1 text-indigo-500">•</span>
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-2.5 text-[11px] dark:border-slate-800">
                    <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                      Expected Impact: -{rec.expectedRiskReductionPct}% fault &amp; outage risk
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => focusAssetOnMap(rec.assetId)}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        <MapPin className="h-3 w-3" />
                        Map
                      </button>
                      <button
                        type="button"
                        onClick={() => launchSimulationFromAiRecommendation(rec)}
                        className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1 font-semibold text-sky-700 hover:bg-sky-100 whitespace-nowrap shrink-0 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300"
                      >
                        <Zap className="h-3 w-3" />
                        Simulate What-If
                      </button>
                      <button
                        type="button"
                        disabled={rolePermissions.isReadOnly}
                        onClick={() => prepareDecisionFromAiRecommendation(rec)}
                        className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1 font-semibold text-white hover:bg-indigo-700 disabled:opacity-45 whitespace-nowrap shrink-0"
                      >
                        <FileCheck2 className="h-3 w-3" />
                        Draft Decision
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Right Column: Health Score Breakdown Gauge + Ranked Asset Scores */}
          <div className="space-y-4 lg:col-span-5">
            {focusedHealth && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Asset Health Factor Breakdown
                  </span>
                  <select
                    aria-label="Select asset for health inspection"
                    value={focusedHealth.assetId}
                    onChange={(e) => selectAsset(e.target.value, 'overview', { openPopup: false })}
                    className="max-w-[200px] rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    {healthScores.map((h) => (
                      <option key={h.assetId} value={h.assetId}>
                        {h.assetId} ({h.healthScore}/100)
                      </option>
                    ))}
                  </select>
                </div>
                <AssetHealthGauge health={focusedHealth} showFactors />
              </div>
            )}

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/60">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Lowest Health Assets (Live Ranking)
              </h4>
              <div className="mt-2.5 divide-y divide-slate-200 dark:divide-slate-800">
                {healthScores.slice(0, 6).map((h) => (
                  <button
                    key={h.assetId}
                    type="button"
                    onClick={() => selectAsset(h.assetId, 'overview', { openPopup: false })}
                    className="flex w-full items-center justify-between gap-2 py-2 text-left text-xs transition hover:bg-slate-100/70 dark:hover:bg-slate-900/80"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-800 dark:text-slate-200">
                        {h.assetName}
                      </p>
                      <p className="truncate font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {h.assetId} · {h.district}
                      </p>
                    </div>
                    <div className="shrink-0 text-right tabular-nums">
                      <span
                        className={`font-bold ${
                          h.category === 'CRITICAL'
                            ? 'text-red-600 dark:text-red-400'
                            : h.category === 'WARNING'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {h.healthScore}/100
                      </span>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">{h.category}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Predictive Maintenance Forecasts & 7-Stage Asset AI Timeline */}
      {activeTab === 'predictions' && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-2.5">Asset</th>
                    <th className="px-3 py-2.5">Failure Type</th>
                    <th className="px-3 py-2.5 text-right">Prob.</th>
                    <th className="px-3 py-2.5 text-right">Conf.</th>
                    <th className="px-3 py-2.5">Window</th>
                    <th className="px-3 py-2.5">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {predictions.map((pred) => {
                    const isFocused = pred.assetId === focusedAssetId;
                    return (
                      <tr
                        key={pred.id}
                        onClick={() => selectAsset(pred.assetId, 'overview', { openPopup: false })}
                        className={`cursor-pointer transition ${
                          isFocused
                            ? 'bg-indigo-50/70 dark:bg-indigo-950/40'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-900/60'
                        }`}
                      >
                        <td className="px-3 py-2.5">
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {pred.assetName}
                          </p>
                          <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                            {pred.assetId}
                          </p>
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`font-semibold ${
                              pred.riskLevel === 'HIGH'
                                ? 'text-red-600 dark:text-red-400'
                                : pred.riskLevel === 'MEDIUM'
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {pred.failureType.replace(/_/g, ' ')}
                          </span>
                          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            {pred.supportingEvidence[0]}
                          </p>
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold tabular-nums text-slate-900 dark:text-white">
                          {pred.probabilityPct}%
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-indigo-600 dark:text-indigo-400 font-semibold">
                          {pred.confidenceScore}%
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap font-mono text-slate-700 dark:text-slate-300">
                          {pred.estimatedFailureWindow}
                        </td>
                        <td className="px-3 py-2.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              focusAssetOnMap(pred.assetId);
                            }}
                            className="rounded border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            Locate
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <MobileRecordCardList
              detailTitle="Failure Forecast Details"
              onInspectAsset={(id) => focusAssetOnMap(id)}
              items={predictions.map((pred) => {
                const h = healthScores.find((s) => s.assetId === pred.assetId);
                return {
                  id: pred.id,
                  assetName: pred.assetName,
                  assetId: pred.assetId,
                  status: `${pred.riskLevel} (${pred.probabilityPct}%)`,
                  statusTone:
                    pred.riskLevel === 'HIGH'
                      ? 'critical'
                      : pred.riskLevel === 'MEDIUM'
                        ? 'warning'
                        : 'healthy',
                  health: h ? `${h.healthScore}/100` : `${pred.confidenceScore}% conf`,
                  location: geoScopeLabel,
                  lastUpdated: pred.estimatedFailureWindow,
                  summary: `${pred.failureType.replace(/_/g, ' ')} — ${pred.supportingEvidence[0] || ''}`,
                  detailFields: [
                    { label: 'Failure Probability', value: `${pred.probabilityPct}%` },
                    { label: 'Model Confidence', value: `${pred.confidenceScore}%` },
                    { label: 'Forecast Window', value: pred.estimatedFailureWindow }
                  ]
                };
              })}
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/40 lg:col-span-5">
            <AssetAiTimelinePanel
              assetLabel={focusedHealth ? `${focusedHealth.assetId}` : focusedAssetId}
              stages={focusedTimeline}
            />
          </div>
        </div>
      )}

      {/* Tab 3: Grid Risk Index & Monthly Failure Trends */}
      {activeTab === 'risk' && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Multi-Level Grid Risk Index
              </span>
              <div className="flex flex-wrap gap-1">
                {(['ALL', 'STATE', 'DISTRICT', 'AREA', 'SUBSTATION', 'FEEDER'] as const).map(
                  (lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setRiskScopeFilter(lvl)}
                      className={`rounded px-2 py-1 text-[11px] font-semibold whitespace-nowrap shrink-0 ${
                        riskScopeFilter === lvl
                          ? 'bg-slate-900 text-white dark:bg-indigo-600'
                          : 'border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`}
                    >
                      {lvl}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {filteredRiskIndices.map((entry) => {
                const riskText =
                  entry.riskLevel === 'HIGH'
                    ? 'text-red-600 dark:text-red-400'
                    : entry.riskLevel === 'MEDIUM'
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-emerald-600 dark:text-emerald-400';
                return (
                  <div
                    key={entry.id}
                    className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        {entry.scopeLevel}
                      </span>
                      <span className={`text-xs font-bold tabular-nums ${riskText}`}>
                        {entry.riskLevel} ({entry.riskScore}/100)
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {entry.name}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-300 tabular-nums">
                      {entry.activeIncidentsCount} active faults · Avg Health {entry.avgAssetHealth}/100 · Load{' '}
                      {entry.avgLoadPct}% · Backlog {entry.maintenanceBacklogCount}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Monthly Failure vs Prediction Trend Chart */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/50 lg:col-span-5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Monthly Failure Trends vs. AI Forecasts
            </h4>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Actual fault events compared with 30-day AI forecast volume &amp; preventive work orders.
            </p>
            <div className="mt-4 space-y-3">
              {monthlyFailureTrends.map((row) => (
                <div key={row.month} className="space-y-1">
                  <div className="flex items-center justify-between text-xs tabular-nums">
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      {row.month}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Actual {row.actualFaults} · Predicted {row.predictedFaults} · Preventive {row.preventiveActions}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-red-500"
                        style={{ width: `${Math.round((row.actualFaults / maxTrendVal) * 100)}%` }}
                      />
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-indigo-500"
                        style={{ width: `${Math.round((row.predictedFaults / maxTrendVal) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-4 border-t border-slate-200 pt-2.5 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <span>Red: Actual Faults</span>
              <span>Indigo: AI Predicted Faults</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Incident Pattern Detection & Maintenance Prioritization Queue */}
      {activeTab === 'patterns' && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="space-y-2.5 lg:col-span-5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Detected Incident Patterns
            </h4>
            {patterns.map((pat) => (
              <div
                key={pat.id}
                className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/50"
              >
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span
                    className={`font-semibold ${
                      pat.severity === 'CRITICAL'
                        ? 'text-red-600 dark:text-red-400'
                        : pat.severity === 'WARNING'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-sky-600 dark:text-sky-400'
                    }`}
                  >
                    {pat.patternType.replace(/_/g, ' ')}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                    {pat.occurrencesCount} signals
                  </span>
                </div>
                <p className="mt-1 text-xs font-semibold text-slate-900 dark:text-white">
                  {pat.title}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                  {pat.summary}
                </p>
                <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  Scope: {pat.geographicScope}
                  {pat.seasonalityTag ? ` · ${pat.seasonalityTag}` : ''}
                </p>
              </div>
            ))}
          </div>

          <div className="lg:col-span-7">
            <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-2.5">Rank</th>
                    <th className="px-3 py-2.5">Asset</th>
                    <th className="px-3 py-2.5">Priority</th>
                    <th className="px-3 py-2.5 text-right">Health</th>
                    <th className="px-3 py-2.5 text-right">Fail Prob.</th>
                    <th className="px-3 py-2.5 text-right">Customers</th>
                    <th className="px-3 py-2.5">Window</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {maintenanceQueue.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/60">
                      <td className="px-3 py-2.5 font-mono font-semibold text-slate-500 tabular-nums">
                        #{idx + 1}
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {item.assetName}
                        </p>
                        <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {item.assetId} · {item.reasonSummary}
                        </p>
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`font-semibold ${
                            item.priority === 'CRITICAL'
                              ? 'text-red-600 dark:text-red-400'
                              : item.priority === 'HIGH'
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-sky-600 dark:text-sky-400'
                          }`}
                        >
                          {item.priority}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                        {item.healthScore}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-red-600 dark:text-red-400 font-semibold">
                        {item.failureProbabilityPct}%
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-300">
                        {item.customerImpactCount ?? 'N/A'}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap font-mono text-slate-600 dark:text-slate-300">
                        {item.recommendedWindow}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <MobileRecordCardList
              detailTitle="Maintenance Queue Details"
              onInspectAsset={(id) => focusAssetOnMap(id)}
              items={maintenanceQueue.map((item, idx) => ({
                id: item.id,
                assetName: `#${idx + 1} · ${item.assetName}`,
                assetId: item.assetId,
                status: item.priority,
                statusTone:
                  item.priority === 'CRITICAL'
                    ? 'critical'
                    : item.priority === 'HIGH'
                      ? 'warning'
                      : 'info',
                health: `${item.healthScore}/100`,
                location: geoScopeLabel,
                lastUpdated: item.recommendedWindow,
                summary: item.reasonSummary,
                detailFields: [
                  { label: 'Failure Probability', value: `${item.failureProbabilityPct}%` },
                  { label: 'Affected Customers', value: item.customerImpactCount ?? 'N/A' },
                  { label: 'Recommended Window', value: item.recommendedWindow }
                ]
              }))}
            />
          </div>
        </div>
      )}

      {/* Model Performance & Drift Telemetry Footer */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-2.5 text-xs dark:border-slate-800 dark:bg-slate-950/40">
        <div className="flex flex-wrap items-center gap-2 text-slate-700 dark:text-slate-300">
          <Cpu className="h-4 w-4 text-indigo-500" />
          <span className="font-semibold">{modelMetrics.algorithm}</span>
          <span className="text-slate-400">·</span>
          <span className="tabular-nums">{modelMetrics.trainingSamples.toLocaleString()} training samples</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-slate-600 dark:text-slate-400 tabular-nums">
          <span>Precision {modelMetrics.precisionPct}%</span>
          <span>Recall {modelMetrics.recallPct}%</span>
          <span>F1 {modelMetrics.f1Score.toFixed(2)}</span>
          <span>ROC-AUC {modelMetrics.rocAuc.toFixed(2)}</span>
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
            <Activity className="mr-1 inline h-3.5 w-3.5" />
            Drift: {modelMetrics.driftStatus}
          </span>
        </div>
      </div>
    </section>
  );
};
