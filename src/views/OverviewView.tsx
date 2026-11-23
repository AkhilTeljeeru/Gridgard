import React from 'react';
import { useGrid } from '../context/GridContext';
import { GridMapComponent } from '../components/map/GridMapComponent';
import { SourceBadge } from '../components/ui/SourceBadge';
import { PredictiveAnalyticsSection } from '../components/ai/PredictiveAnalyticsSection';
import { ExecutiveCommandView } from './ExecutiveCommandView';
import {
  Clock,
  FileCheck2,
  Cpu,
  ArrowRight,
  CheckCircle,
  Network,
  MapPin,
  Maximize2,
  RotateCcw,
  SearchCheck,
  Zap,
  Download,
  Globe,
  LayoutDashboard
} from 'lucide-react';

export const OverviewView: React.FC = () => {
  const {
    scopedStats,
    scopedAssets,
    scopedAssetCounts,
    scopedIssues,
    scopedScenarios,
    scopedDecisions,
    scopedEvents,
    scopedFaults,
    fieldTasks,
    telemetrySourceType,
    hasRegionSelection,
    geoScopeLabel,
    resetGeoFilter,
    setActiveView,
    focusAssetOnMap,
    focusFaultOnMap,
    openRootCauseForAsset,
    launchSimulationFromRca,
    alerts,
    scopedAiSnapshot,
    isDemoMode,
    triggerLiveDemoIncident,
    wsState,
    overviewMode,
    setOverviewMode,
    currentRole,
    rolePermissions
  } = useGrid();

  const activeFaults = scopedFaults.filter((f) => f.status !== 'RESTORED');
  const recentEvents = scopedEvents.slice(0, 5);
  const pendingDecisionsCount = scopedDecisions.filter(
    (d) => d.status === 'SUBMITTED' || d.status === 'PENDING_REVIEW' || d.status === 'UNDER_REVIEW'
  ).length;
  const activeFieldTasksCount = fieldTasks.filter(
    (t) => t.status === 'ASSIGNED' || t.status === 'IN_PROGRESS' || t.status === 'PAUSED'
  ).length;
  const detectedIssuesCount = scopedIssues.filter((i) => i.status === 'DETECTED').length;
  const healthyAssetsCount = scopedAiSnapshot.healthScores.filter(
    (h) => h.category === 'HEALTHY'
  ).length;
  const criticalAlertsCount = alerts.filter(
    (a) => a.severity === 'CRITICAL' && !a.acknowledged
  ).length;
  const resolutionSamples = scopedDecisions
    .map((d) => d.resolutionTimeMinutes)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0);
  const avgResolutionMin =
    resolutionSamples.length > 0
      ? Math.round(resolutionSamples.reduce((sum, n) => sum + n, 0) / resolutionSamples.length)
      : 48;

  const isExecutiveRole = currentRole === 'REVIEWER_APPROVER' || currentRole === 'ADMIN';

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Unified Overview Mode Switcher (Operational vs Executive Dashboard) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Workspace Mode:
          </span>
          <span className="text-xs font-semibold text-slate-900 dark:text-white">
            {overviewMode === 'EXECUTIVE' ? 'Executive Command Dashboard' : 'Control Room Operational Overview'}
          </span>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {rolePermissions.label}
            {isExecutiveRole ? ' · Executive Default' : ''}
          </span>
        </div>

        <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setOverviewMode('OPERATIONAL')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              overviewMode === 'OPERATIONAL'
                ? 'bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-xs font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Operational View</span>
          </button>
          <button
            type="button"
            onClick={() => setOverviewMode('EXECUTIVE')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              overviewMode === 'EXECUTIVE'
                ? 'bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-xs font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Executive Dashboard</span>
          </button>
        </div>
      </div>

      {hasRegionSelection && (
        <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 font-mono text-cyan-700 dark:text-cyan-300">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span>
              Filtered Geographic Scope: <strong>{geoScopeLabel}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={resetGeoFilter}
            className="text-xs font-mono font-semibold text-cyan-700 dark:text-cyan-300 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Clear Geographic Filter</span>
          </button>
        </div>
      )}

      {/* TOP ROW: Incident Summary Banner & Canonical Health + Live Demo Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 rounded-xl p-5 flex flex-col justify-between">
          {activeFaults.length > 0 ? (
            <>
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                    ACTIVE FAULT · {activeFaults[0].faultCode}
                  </span>
                  <SourceBadge source={activeFaults[0].source} compact />
                  <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                    Updated: {activeFaults[0].lastUpdated.replace('T', ' ').slice(0, 19)} UTC
                  </span>
                </div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {activeFaults[0].title}
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {activeFaults[0].description} ({activeFaults[0].affectedAssetId})
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => focusFaultOnMap(activeFaults[0].id)}
                  className="px-3 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5 text-rose-500" />
                  <span>Locate Fault on Map</span>
                </button>
                <button
                  type="button"
                  onClick={() => openRootCauseForAsset(activeFaults[0].affectedAssetId)}
                  className="px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <SearchCheck className="w-3.5 h-3.5" />
                  <span>Investigate RCA &amp; Timeline</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView('integrity')}
                  className="px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>{detectedIssuesCount} Integrity Findings</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => launchSimulationFromRca()}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>Simulate Load Transfer</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    VIEWPORT TELEMETRY NOMINAL
                  </span>
                  <SourceBadge source={telemetrySourceType} compact />
                </div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Zero Active Telemetry Faults in Active Map Scope
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Monitoring {scopedStats.totalAssets} canonical assets with real-time WebSocket &harr; Knowledge Graph synchronization.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setActiveView('map')}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Inspect Viewport on Grid Map</span>
                </button>
              </div>
            </>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-mono uppercase font-semibold">
                Operational Readiness · WS {wsState}
              </span>
              <CheckCircle className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-3xl font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400 mt-1.5 tabular-nums">
              {scopedStats.dataQualityScore}%
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Canonical data integrity across DEMO + live OpenStreetMap power telemetry.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
            {isDemoMode && (
              <button
                type="button"
                onClick={() => triggerLiveDemoIncident()}
                className="px-2.5 py-1.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Zap className="w-3 h-3" />
                <span>Simulate Fault</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveView('reports')}
              className="px-2.5 py-1.5 text-[11px] font-semibold text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 rounded-lg inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer ml-auto"
            >
              <Download className="w-3 h-3" />
              <span>Export Reports</span>
            </button>
          </div>
        </div>
      </div>

      {overviewMode === 'EXECUTIVE' ? (
        <ExecutiveCommandView embedded />
      ) : (
        <>
      {/* Phase 8: Live 8-KPI Operational Strip (All 8 Required Metrics) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => setActiveView('map')}
          className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-cyan-500/40 p-3.5 rounded-xl transition-colors cursor-pointer"
        >
          <span className="text-[10px] font-mono uppercase text-slate-400 block">
            Total Assets
          </span>
          <div className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1 tabular-nums">
            {scopedAssetCounts.totalAssets}
          </div>
          <span className="text-[11px] text-slate-500 tabular-nums">
            {scopedAssetCounts.substations} Sub · {scopedAssetCounts.feeders} Fdr · {scopedAssetCounts.transformers} DTR
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveView('overview')}
          className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/40 p-3.5 rounded-xl transition-colors cursor-pointer"
        >
          <span className="text-[10px] font-mono uppercase text-slate-400 block">
            Healthy Assets
          </span>
          <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
            {healthyAssetsCount} Healthy
          </div>
          <span className="text-[11px] text-slate-500 tabular-nums">
            AI Health Score &ge; 80/100
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveView('map')}
          className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-rose-500/40 p-3.5 rounded-xl transition-colors cursor-pointer"
        >
          <span className="text-[10px] font-mono uppercase text-slate-400 block">
            Active Faults
          </span>
          <div className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-1 tabular-nums">
            {activeFaults.length} Faults
          </div>
          <span className="text-[11px] text-slate-500">
            Telemetry: {telemetrySourceType}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveView('alerts')}
          className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-rose-500/40 p-3.5 rounded-xl transition-colors cursor-pointer"
        >
          <span className="text-[10px] font-mono uppercase text-slate-400 block">
            Critical Alerts
          </span>
          <div className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1 tabular-nums">
            {criticalAlertsCount} Critical
          </div>
          <span className="text-[11px] text-slate-500 tabular-nums">
            {alerts.length} Total in Alert Center
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveView('decisions')}
          className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-cyan-500/40 p-3.5 rounded-xl transition-colors cursor-pointer"
        >
          <span className="text-[10px] font-mono uppercase text-slate-400 block">
            Pending Decisions
          </span>
          <div className="text-xl font-bold font-mono text-cyan-600 dark:text-cyan-400 mt-1 tabular-nums">
            {pendingDecisionsCount} Pending
          </div>
          <span className="text-[11px] text-slate-500 tabular-nums">
            {scopedScenarios.length} What-If Models Ready
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveView('field')}
          className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-500/40 p-3.5 rounded-xl transition-colors cursor-pointer"
        >
          <span className="text-[10px] font-mono uppercase text-slate-400 block">
            Active Field Teams
          </span>
          <div className="text-xl font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-1 tabular-nums">
            {activeFieldTasksCount} Dispatched
          </div>
          <span className="text-[11px] text-slate-500">
            Field Inspection &amp; Evidence
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveView('events')}
          className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-cyan-500/40 p-3.5 rounded-xl transition-colors cursor-pointer"
        >
          <span className="text-[10px] font-mono uppercase text-slate-400 block">
            Open Incidents
          </span>
          <div className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1 tabular-nums">
            {activeFaults.length} Open
          </div>
          <span className="text-[11px] text-slate-500 tabular-nums">
            {scopedEvents.length} Correlated Events
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveView('reports')}
          className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-cyan-500/40 p-3.5 rounded-xl transition-colors cursor-pointer"
        >
          <span className="text-[10px] font-mono uppercase text-slate-400 block">
            Avg Resolution Time
          </span>
          <div className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1 tabular-nums">
            {avgResolutionMin} min
          </div>
          <span className="text-[11px] text-slate-500">
            MTTR Across Closed Cases
          </span>
        </button>
      </div>

      {/* PHASE 7: AI Intelligence Engine & Predictive Analytics */}
      <PredictiveAnalyticsSection />

      {/* MIDDLE SECTION: Interactive Grid Map + Incident Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-cyan-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-900 dark:text-white">
                Interactive Grid Operational Map
              </h3>
            </div>

            <button
              type="button"
              onClick={() => setActiveView('map')}
              className="px-2.5 py-1 text-xs font-mono text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
            >
              <span>Geographic Filters &amp; Split View</span>
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Displays clearly badged DEMO topology &amp; live OpenStreetMap power assets overlaid with telemetry status.
          </p>

          <GridMapComponent heightClass="h-[430px]" />
        </div>

        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyan-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-900 dark:text-white">
                  Operational Event Timeline
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setActiveView('events')}
                className="text-xs font-mono text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
              >
                <span>Full Timeline</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="mt-3 space-y-3">
              {recentEvents.length > 0 ? (
                recentEvents.map((evt) => (
                  <div
                    key={evt.id}
                    onClick={() => focusAssetOnMap(evt.assetCanonicalId)}
                    className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:border-slate-300 cursor-pointer transition-all"
                  >
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 mb-1">
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {evt.timestamp.replace('T', ' ').slice(11, 19)} UTC
                      </span>
                      <div className="flex items-center gap-1">
                        <SourceBadge source={evt.source} compact />
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          {evt.sourceSystem}
                        </span>
                      </div>
                    </div>
                    <h4 className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {evt.eventType.replace(/_/g, ' ')} · {evt.assetCanonicalId}
                    </h4>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 mt-0.5">
                      {evt.summary}
                    </p>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                  Listening for live telemetry events...
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveView('events')}
            className="w-full mt-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center justify-center gap-1.5"
          >
            <span>Reconstruct {scopedEvents.length} Operational Events</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* BOTTOM SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div
          onClick={() => setActiveView('graph')}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3 cursor-pointer hover:border-cyan-500/60 transition-colors group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400">
              MODULE 04
            </span>
            <Network className="w-4 h-4 text-slate-400 group-hover:text-cyan-500 transition-colors" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Network Knowledge Graph
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Cytoscape topology synchronized 1:1 with {scopedAssets.length} canonical power assets.
          </p>
          <div className="flex items-center gap-1.5 text-xs text-cyan-600 dark:text-cyan-400 font-semibold pt-1">
            <span>Explore Topology Canvas</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        <div
          onClick={() => setActiveView('decisions')}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3 cursor-pointer hover:border-cyan-500/60 transition-colors group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400">
              MODULE 06 · APPROVALS
            </span>
            <FileCheck2 className="w-4 h-4 text-slate-400 group-hover:text-cyan-500 transition-colors" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Decision Proposals &amp; Sign-Off
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {scopedDecisions.length} engineering decision proposal(s) managed directly inside What-If Simulator with evidence bundles.
          </p>
          <div className="flex items-center gap-1.5 text-xs text-cyan-600 dark:text-cyan-400 font-semibold pt-1">
            <span>Review {pendingDecisionsCount} Pending Proposal</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        <div
          onClick={() => setActiveView('simulator')}
          className="bg-slate-900 text-white rounded-xl p-5 border border-slate-800 space-y-3 cursor-pointer hover:border-cyan-400 transition-colors group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-cyan-400">MODULE 06</span>
            <Cpu className="w-4 h-4 text-slate-400 group-hover:text-cyan-400 transition-colors" />
          </div>
          <h3 className="text-sm font-bold">Operational What-If Simulator</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Evaluate sectionalizing and backfeed load transfers across canonical 11 kV feeders with OpenDSS checks.
          </p>
          <div className="flex items-center gap-1.5 text-xs text-cyan-400 font-semibold pt-1">
            <span>Launch Load-Transfer Model</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  );
};
