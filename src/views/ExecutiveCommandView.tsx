import React, { useMemo, useState } from 'react';
import { useGrid } from '../context/GridContext';
import type { DashboardWidgetId, RegionalKpiScope } from '../types/grid';
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Bookmark,
  BrainCircuit,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Globe,
  Scale,
  SlidersHorizontal,
  Star,
  TrendingUp
} from 'lucide-react';

const WIDGET_LABELS: Record<DashboardWidgetId, string> = {
  EXECUTIVE_KPI_STRIP: 'Executive KPI Strip',
  REGIONAL_PERFORMANCE: 'Regional Performance Analytics',
  AI_INSIGHTS: 'AI Operational Insights',
  SCENARIO_COMPARISON: 'Multi-Scenario Comparison',
  INCIDENT_TRENDS: 'Monthly Incident Trends',
  LIFECYCLE_WATCH: 'Asset Lifecycle Milestone Watch'
};

interface ExecutiveCommandViewProps {
  embedded?: boolean;
}

export const ExecutiveCommandView: React.FC<ExecutiveCommandViewProps> = ({ embedded = false }) => {
  const {
    scopedAssets,
    scopedFaults,
    scopedDecisions,
    scopedAiSnapshot,
    regionalKpis,
    aiOperationalInsights,
    enterpriseScenarioComparison,
    assetLifecycleRecords,
    dashboardCustomization,
    moveDashboardWidget,
    toggleDashboardWidget,
    toggleFavoriteRegion,
    saveMapFilterPreset,
    applyMapFilterPreset,
    updateCustomKpiTargets,
    geoFilter,
    updateGeoFilterLevel,
    resetGeoFilter,
    geoScopeLabel,
    exportReport,
    focusAssetOnMap,
    setActiveView
  } = useGrid();

  const [scopeTab, setScopeTab] = useState<RegionalKpiScope | 'ALL'>('ALL');
  const [showCustomize, setShowCustomize] = useState(false);
  const [presetName, setPresetName] = useState('');

  const stateOptions = useMemo(() => {
    const set = new Set<string>();
    regionalKpis.filter((k) => k.scopeLevel === 'STATE').forEach((k) => set.add(k.regionName));
    return Array.from(set);
  }, [regionalKpis]);

  const districtOptions = useMemo(() => {
    return regionalKpis
      .filter((k) => k.scopeLevel === 'DISTRICT' && (!geoFilter.state || k.parentRegion === geoFilter.state))
      .map((k) => k.regionName);
  }, [regionalKpis, geoFilter.state]);

  const areaOptions = useMemo(() => {
    return regionalKpis
      .filter((k) => k.scopeLevel === 'AREA' && (!geoFilter.district || k.parentRegion === geoFilter.district))
      .map((k) => k.regionName);
  }, [regionalKpis, geoFilter.district]);

  const filteredKpis = useMemo(() => {
    return regionalKpis.filter((k) => {
      if (scopeTab !== 'ALL' && k.scopeLevel !== scopeTab) return false;
      if (geoFilter.state && k.scopeLevel === 'STATE' && k.regionName !== geoFilter.state) return false;
      if (geoFilter.district && k.scopeLevel === 'DISTRICT' && k.regionName !== geoFilter.district) return false;
      return true;
    });
  }, [regionalKpis, scopeTab, geoFilter.state, geoFilter.district]);

  const totalGridHealthPct = useMemo(() => {
    const list = scopedAiSnapshot.healthScores;
    if (list.length === 0) return 92;
    return Math.round((list.reduce((s, h) => s + h.healthScore, 0) / list.length) * 10) / 10;
  }, [scopedAiSnapshot.healthScores]);

  const activeFaultsCount = scopedFaults.filter((f) => f.status !== 'RESTORED').length;
  const pendingApprovalsCount = scopedDecisions.filter(
    (d) => d.status === 'PENDING_REVIEW' || d.status === 'SUBMITTED'
  ).length;
  const currentScopeKpi = useMemo(() => {
    if (geoFilter.area) {
      return regionalKpis.find((k) => k.scopeLevel === 'AREA' && k.regionName === geoFilter.area) || regionalKpis[0];
    }
    if (geoFilter.district) {
      return regionalKpis.find((k) => k.scopeLevel === 'DISTRICT' && k.regionName === geoFilter.district) || regionalKpis[0];
    }
    if (geoFilter.state) {
      return regionalKpis.find((k) => k.scopeLevel === 'STATE' && k.regionName === geoFilter.state) || regionalKpis[0];
    }
    return regionalKpis[0];
  }, [regionalKpis, geoFilter.state, geoFilter.district, geoFilter.area]);

  const renderWidget = (widgetId: DashboardWidgetId) => {
    if (dashboardCustomization.hiddenWidgets.includes(widgetId)) return null;

    switch (widgetId) {
      case 'EXECUTIVE_KPI_STRIP':
        return (
          <div key={widgetId} className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="text-[11px] font-mono uppercase text-slate-500">Total Grid Health</div>
              <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
                {totalGridHealthPct}%
              </div>
              <div className="text-xs text-slate-500 mt-0.5">{scopedAssets.length} monitored assets</div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="text-[11px] font-mono uppercase text-slate-500">Overall Network Risk</div>
              <div
                className={`text-2xl font-bold font-mono mt-1 ${
                  activeFaultsCount >= 2
                    ? 'text-rose-600 dark:text-rose-400'
                    : activeFaultsCount === 1
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {activeFaultsCount >= 2 ? 'HIGH' : activeFaultsCount === 1 ? 'MEDIUM' : 'LOW'}
              </div>
              <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
                {activeFaultsCount} active lockouts · {scopedAiSnapshot.recommendations.length} AI recs
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="text-[11px] font-mono uppercase text-slate-500">Asset Reliability</div>
              <div className="text-2xl font-bold font-mono text-cyan-600 dark:text-cyan-400 mt-1 tabular-nums">
                {currentScopeKpi?.gridReliabilityPct ?? 98.4}%
              </div>
              <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
                Target {dashboardCustomization.customKpiTargets.reliabilityTargetPct}% · MTTR {currentScopeKpi?.mttrHours ?? 2.1}h
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="text-[11px] font-mono uppercase text-slate-500">Governance &amp; Backlog</div>
              <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1 tabular-nums">
                {pendingApprovalsCount} / {scopedAiSnapshot.maintenanceQueue.length}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">Pending approvals / Maint backlog</div>
            </div>
          </div>
        );

      case 'REGIONAL_PERFORMANCE':
        return (
          <div
            key={widgetId}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Regional Performance Analytics (Reliability, MTTR, MTBF &amp; Compliance)
                </h3>
              </div>

              <div className="flex items-center gap-1 flex-wrap">
                {(['ALL', 'NATIONAL', 'STATE', 'DISTRICT', 'AREA', 'SUBSTATION'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setScopeTab(lvl)}
                    className={`px-2.5 py-1 rounded text-[11px] font-mono whitespace-nowrap shrink-0 cursor-pointer ${
                      scopeTab === lvl
                        ? 'bg-cyan-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-mono border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">REGION / SUBSTATION</th>
                    <th className="py-2.5 px-3">SCOPE</th>
                    <th className="py-2.5 px-3 text-right">RELIABILITY</th>
                    <th className="py-2.5 px-3 text-right">AVAILABILITY</th>
                    <th className="py-2.5 px-3 text-right">FAULT FREQ</th>
                    <th className="py-2.5 px-3 text-right">MTTR (H)</th>
                    <th className="py-2.5 px-3 text-right">MTBF (H)</th>
                    <th className="py-2.5 px-3 text-right">COMPLIANCE</th>
                    <th className="py-2.5 px-3 text-right">RESPONSE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono tabular-nums">
                  {filteredKpis.map((k) => {
                    const meetsRel = k.gridReliabilityPct >= dashboardCustomization.customKpiTargets.reliabilityTargetPct;
                    const meetsMttr = k.mttrHours <= dashboardCustomization.customKpiTargets.mttrMaxHours;
                    return (
                      <tr key={k.regionId} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="py-2.5 px-3 font-sans font-semibold text-slate-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              aria-label={`Favorite ${k.regionName}`}
                              onClick={() => toggleFavoriteRegion(k.regionName)}
                              className="text-slate-400 hover:text-amber-500 cursor-pointer"
                            >
                              <Star
                                className={`w-3.5 h-3.5 ${
                                  dashboardCustomization.favoriteRegions.includes(k.regionName)
                                    ? 'fill-amber-400 text-amber-400'
                                    : ''
                                }`}
                              />
                            </button>
                            <span>{k.regionName}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-slate-500">{k.scopeLevel}</td>
                        <td className={`py-2.5 px-3 text-right font-bold ${meetsRel ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                          {k.gridReliabilityPct}%
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-200">
                          {k.assetAvailabilityPct}%
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-200">
                          {k.faultFrequencyPer100Km}/100km
                        </td>
                        <td className={`py-2.5 px-3 text-right ${meetsMttr ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {k.mttrHours}h
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-200">
                          {k.mtbfHours}h
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-200">
                          {k.maintenanceCompliancePct}%
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-200">
                          {k.avgResponseTimeMin} min
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'AI_INSIGHTS':
        return (
          <div
            key={widgetId}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <BrainCircuit className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Explainable AI Operational Insights
                </h3>
              </div>
              <button
                type="button"
                onClick={() => exportReport('AI_RECOMMENDATIONS', 'PDF')}
                className="text-xs font-mono text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
              >
                Export Summary PDF
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {aiOperationalInsights.map((ins) => (
                <div
                  key={ins.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                      <span className="text-slate-500">{ins.category.replace('_', ' ')}</span>
                      <span
                        className={`font-bold ${
                          ins.priority === 'CRITICAL'
                            ? 'text-rose-600 dark:text-rose-400'
                            : ins.priority === 'HIGH'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-cyan-600 dark:text-cyan-400'
                        }`}
                      >
                        {ins.priority}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      {ins.title}
                    </h4>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                      {ins.summary}
                    </p>
                    <ul className="space-y-0.5 text-[11px] font-mono text-slate-500 dark:text-slate-400 pt-1">
                      {ins.supportingMetrics.map((m) => (
                        <li key={m}>· {m}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 truncate">{ins.impactedRegion}</span>
                    {ins.relatedAssetIds[0] && (
                      <button
                        type="button"
                        onClick={() => focusAssetOnMap(ins.relatedAssetIds[0])}
                        className="text-cyan-600 dark:text-cyan-400 font-semibold hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Inspect {ins.relatedAssetIds[0]}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'SCENARIO_COMPARISON':
        return (
          <div
            key={widgetId}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Scenario Comparison Matrix (Current Network vs Alternatives)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveView('simulator')}
                className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
              >
                Open What-If Simulator
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-mono border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">CONFIGURATION</th>
                    <th className="py-2.5 px-3 text-right">CUSTOMER IMPACT</th>
                    <th className="py-2.5 px-3">RISK LEVEL</th>
                    <th className="py-2.5 px-3 text-right">EST. RESTORATION</th>
                    <th className="py-2.5 px-3 text-right">UTILIZATION</th>
                    <th className="py-2.5 px-3 text-right">MIN VOLTAGE</th>
                    <th className="py-2.5 px-3 text-right">EST. COST (INR LAKHS)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono tabular-nums">
                  {enterpriseScenarioComparison.map((row) => (
                    <tr
                      key={row.scenarioId}
                      className={row.isBaseline ? 'bg-rose-500/5' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'}
                    >
                      <td className="py-2.5 px-3 font-sans font-semibold text-slate-900 dark:text-white">
                        {row.label}
                      </td>
                      <td className="py-2.5 px-3 text-right">{row.customerImpactCount.toLocaleString()}</td>
                      <td
                        className={`py-2.5 px-3 font-bold ${
                          row.riskLevel === 'HIGH'
                            ? 'text-rose-600 dark:text-rose-400'
                            : row.riskLevel === 'MEDIUM'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {row.riskLevel}
                      </td>
                      <td className="py-2.5 px-3 text-right">{row.estimatedRestorationMin} min</td>
                      <td className="py-2.5 px-3 text-right">{row.resourceUtilizationPct}%</td>
                      <td className="py-2.5 px-3 text-right">{row.minVoltagePu} p.u.</td>
                      <td className="py-2.5 px-3 text-right">INR {row.estimatedCostInrLakhs}L</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'INCIDENT_TRENDS':
        return (
          <div
            key={widgetId}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
          >
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <TrendingUp className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Incident &amp; Preventive Mitigation Trends
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 pt-1">
              {scopedAiSnapshot.monthlyFailureTrends.map((t) => (
                <div
                  key={t.month}
                  className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2 text-xs font-mono tabular-nums"
                >
                  <div className="font-bold text-slate-800 dark:text-slate-100">{t.month}</div>
                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Actual</span>
                      <span className="text-rose-600 dark:text-rose-400 font-bold">{t.actualFaults}</span>
                    </div>
                    <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded overflow-hidden">
                      <div
                        className="h-full bg-rose-500"
                        style={{ width: `${Math.min(100, t.actualFaults * 14)}%` }}
                      />
                    </div>
                    <div className="flex justify-between pt-1">
                      <span className="text-slate-500">Prevented</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                        {t.preventiveActions}
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded overflow-hidden">
                      <div
                        className="h-full bg-emerald-500"
                        style={{ width: `${Math.min(100, t.preventiveActions * 14)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'LIFECYCLE_WATCH':
        return (
          <div
            key={widgetId}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Asset Lifecycle Milestone Watch
              </h3>
              <button
                type="button"
                onClick={() => setActiveView('graph')}
                className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
              >
                Inspect in Knowledge Graph
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {assetLifecycleRecords.slice(0, 6).map((rec) => (
                <div
                  key={rec.assetId}
                  className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className="text-cyan-600 dark:text-cyan-400 font-bold">{rec.assetId}</span>
                    <span className="text-slate-500">{rec.currentStage}</span>
                  </div>
                  <div className="font-semibold text-slate-900 dark:text-white truncate">{rec.assetName}</div>
                  <div className="text-[11px] font-mono text-slate-500 tabular-nums">
                    Installed {rec.installationDate} · Replace {rec.expectedReplacementDate}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
    }
  };

  return (
    <div className={embedded ? 'space-y-6' : 'space-y-6 max-w-7xl mx-auto'}>
      {/* Header & Enterprise Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Executive Command Center &amp; Performance Analytics
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Enterprise KPIs, geographic drill-down ({geoScopeLabel}), scenario trade-offs, and customizable layout controls.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowCustomize((v) => !v)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              showCustomize
                ? 'bg-cyan-600 text-white border-cyan-500'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Customize Dashboard</span>
          </button>
          <button
            type="button"
            onClick={() => exportReport('REGIONAL_PERFORMANCE', 'EXCEL')}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Performance Excel</span>
          </button>
        </div>
      </div>

      {/* National -> State -> District -> Area Drill-down & Saved Filter Presets */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-mono text-[11px] uppercase text-slate-500 mr-1">Drill-Down:</span>
          <button
            type="button"
            onClick={resetGeoFilter}
            className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap shrink-0 cursor-pointer ${
              !geoFilter.state
                ? 'bg-cyan-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
            }`}
          >
            National (India)
          </button>
          <select
            aria-label="Filter State"
            value={geoFilter.state}
            onChange={(e) => updateGeoFilterLevel('state', e.target.value)}
            className="px-2.5 py-1 rounded-md bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
          >
            <option value="">All States</option>
            {stateOptions.map((st) => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
          <select
            aria-label="Filter District"
            value={geoFilter.district}
            onChange={(e) => updateGeoFilterLevel('district', e.target.value)}
            className="px-2.5 py-1 rounded-md bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
          >
            <option value="">All Districts</option>
            {districtOptions.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select
            aria-label="Filter Area"
            value={geoFilter.area}
            onChange={(e) => updateGeoFilterLevel('area', e.target.value)}
            className="px-2.5 py-1 rounded-md bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
          >
            <option value="">All Areas</option>
            {areaOptions.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Bookmark className="w-3.5 h-3.5 text-slate-400" />
          {dashboardCustomization.savedFilterPresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyMapFilterPreset(preset)}
              className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Dashboard Customization Drawer */}
      {showCustomize && (
        <div className="bg-white dark:bg-slate-900 border border-cyan-500/40 rounded-xl p-5 grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
          <div className="space-y-2.5">
            <div className="font-bold text-slate-900 dark:text-white">
              Rearrange &amp; Toggle Widgets
            </div>
            <div className="space-y-1.5">
              {dashboardCustomization.widgetOrder.map((wId, idx) => {
                const isHidden = dashboardCustomization.hiddenWidgets.includes(wId);
                return (
                  <div
                    key={wId}
                    className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800"
                  >
                    <span className={isHidden ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-200'}>
                      {WIDGET_LABELS[wId]}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveDashboardWidget(wId, 'UP')}
                        className="p-1 text-slate-500 hover:text-cyan-600 disabled:opacity-30 cursor-pointer"
                        aria-label={`Move ${WIDGET_LABELS[wId]} up`}
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === dashboardCustomization.widgetOrder.length - 1}
                        onClick={() => moveDashboardWidget(wId, 'DOWN')}
                        className="p-1 text-slate-500 hover:text-cyan-600 disabled:opacity-30 cursor-pointer"
                        aria-label={`Move ${WIDGET_LABELS[wId]} down`}
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleDashboardWidget(wId)}
                        className="p-1 text-slate-500 hover:text-cyan-600 cursor-pointer"
                        aria-label={`Toggle ${WIDGET_LABELS[wId]}`}
                      >
                        {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="font-bold text-slate-900 dark:text-white">
              Custom Executive KPI Targets
            </div>
            <label className="block space-y-1">
              <span className="text-slate-500">Reliability Target (%)</span>
              <input
                type="number"
                step="0.1"
                value={dashboardCustomization.customKpiTargets.reliabilityTargetPct}
                onChange={(e) =>
                  updateCustomKpiTargets({
                    ...dashboardCustomization.customKpiTargets,
                    reliabilityTargetPct: Number(e.target.value) || 99
                  })
                }
                className="w-full px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-slate-500">Max MTTR SLA (Hours)</span>
              <input
                type="number"
                step="0.1"
                value={dashboardCustomization.customKpiTargets.mttrMaxHours}
                onChange={(e) =>
                  updateCustomKpiTargets({
                    ...dashboardCustomization.customKpiTargets,
                    mttrMaxHours: Number(e.target.value) || 2
                  })
                }
                className="w-full px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono"
              />
            </label>
          </div>

          <div className="space-y-2.5">
            <div className="font-bold text-slate-900 dark:text-white">
              Save Current Map Filter Preset &amp; Favorites
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="Preset name (e.g. Madhapur 11kV)"
                className="flex-1 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              />
              <button
                type="button"
                onClick={() => {
                  saveMapFilterPreset(presetName || geoScopeLabel);
                  setPresetName('');
                }}
                className="px-3 py-1.5 bg-cyan-600 text-white font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
              >
                Save Preset
              </button>
            </div>
            <div className="text-slate-500">
              Pinned Favorite Regions:{' '}
              <span className="font-mono text-slate-800 dark:text-slate-200">
                {dashboardCustomization.favoriteRegions.join(', ') || 'None'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Render Customized Widgets in User-Defined Order */}
      <div className="space-y-6">
        {dashboardCustomization.widgetOrder.map((widgetId) => renderWidget(widgetId))}
      </div>
    </div>
  );
};
