import React, { useMemo, useState } from 'react';
import { useGrid } from '../context/GridContext';
import { KnowledgeGraphCanvas } from '../components/graph/KnowledgeGraphCanvas';
import { GridMapComponent } from '../components/map/GridMapComponent';
import { SourceBadge } from '../components/ui/SourceBadge';
import { AssetHealthGauge } from '../components/ai/AssetHealthGauge';
import { AssetAiTimelinePanel } from '../components/ai/AssetAiTimelinePanel';
import { formatMissingValue } from '../services/syntheticData';
import { formatAssetGeographicLocation } from '../services/intelligenceService';
import { traceDigitalTwinDependencies } from '../services/digitalTwinEngine';
import type { GraphNodeData } from '../types/grid';
import {
  Network,
  Code,
  AlertTriangle,
  BrainCircuit,
  Zap,
  MapPin,
  Columns2,
  Clock,
  Cpu,
  SearchCheck,
  FileCheck2,
  Wrench
} from 'lucide-react';

export const KnowledgeGraphView: React.FC = () => {
  const {
    assets,
    scopedAssets,
    telemetryByAssetId,
    hasRegionSelection,
    geoScopeLabel,
    resetGeoFilter,
    focusAssetOnMap,
    selectedAssetId,
    connectedPath,
    activeRootCauseAnalysis,
    decisions,
    fieldTasks,
    selectAsset,
    openRootCauseForAsset,
    openFieldTaskForAsset,
    launchSimulationFromRca,
    setActiveView,
    getAssetHealth,
    getAssetTimeline,
    scopedAiSnapshot,
    digitalTwinNetwork,
    getAssetLifecycle,
    fieldEngineers,
    setSelectedEngineerId
  } = useGrid();

  const [showCypherCode, setShowCypherCode] = useState<boolean>(false);
  const [splitMapOpen, setSplitMapOpen] = useState<boolean>(false);
  const [inspectedGraphNode, setInspectedGraphNode] = useState<GraphNodeData | null>(null);

  const selectedAsset = useMemo(() => {
    const pool = scopedAssets.length > 0 ? scopedAssets : assets;
    const lookupId = inspectedGraphNode?.targetAssetId || selectedAssetId;
    if (!lookupId) return null;
    return (
      pool.find((a) => a.canonicalId === lookupId || a.id === lookupId) ||
      assets.find((a) => a.canonicalId === lookupId || a.id === lookupId) ||
      null
    );
  }, [scopedAssets, assets, selectedAssetId, inspectedGraphNode]);

  const selectedTelemetry = selectedAsset
    ? telemetryByAssetId[selectedAsset.canonicalId]
    : undefined;

  const connectedPathNodes = useMemo(() => {
    if (connectedPath.nodeIds.size === 0) return [];
    const order: Record<string, number> = {
      SUBSTATION: 0,
      PLANT: 0,
      FEEDER: 1,
      CIRCUIT_BREAKER: 2,
      SECTIONALIZER: 2,
      RECLOSER: 2,
      TRANSFORMER: 3
    };
    return assets
      .filter((a) => connectedPath.nodeIds.has(a.canonicalId))
      .sort((a, b) => (order[a.assetType] ?? 9) - (order[b.assetType] ?? 9));
  }, [assets, connectedPath.nodeIds]);

  const displayId = inspectedGraphNode?.canonicalId || selectedAsset?.canonicalId || 'Not available';
  const displayName =
    inspectedGraphNode?.assetName ||
    (selectedAsset ? formatMissingValue(selectedAsset.rawName ?? selectedAsset.name) : 'Not available');
  const displayType = inspectedGraphNode?.type || selectedAsset?.assetType || 'Not available';
  const displayStatus =
    inspectedGraphNode?.status || selectedAsset?.status || 'UNKNOWN';
  const displayVoltage = formatMissingValue(
    inspectedGraphNode?.voltage ?? selectedAsset?.voltage
  );
  const displayLocation =
    inspectedGraphNode?.geographicLocation ||
    (selectedAsset ? formatAssetGeographicLocation(selectedAsset) : 'Not available');
  const displaySource = inspectedGraphNode?.source || selectedAsset?.source || 'DEMO';

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Network className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Module 3: Hierarchical Grid Knowledge Graph
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            7-tier topology (State &rarr; District &rarr; Substation &rarr; Feeder &rarr; Transformer &rarr; Switch &rarr; Consumer Cluster) synchronized with Grid Map &amp; RCA.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasRegionSelection && (
            <button
              type="button"
              onClick={resetGeoFilter}
              className="px-2.5 py-1.5 text-[11px] font-mono text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/20 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Scope: {geoScopeLabel} (Clear)
            </button>
          )}
          <button
            type="button"
            onClick={() => setSplitMapOpen((prev) => !prev)}
            className={`px-3 py-1.5 text-xs font-mono font-semibold rounded-lg border transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              splitMapOpen
                ? 'bg-cyan-600 text-white border-cyan-500'
                : 'text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700'
            }`}
          >
            <Columns2 className="w-3.5 h-3.5" />
            <span>{splitMapOpen ? 'Hide Split Map' : 'Split Sync: Graph + Map'}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowCypherCode(!showCypherCode)}
            className="px-3 py-1.5 text-xs font-mono font-medium text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Code className="w-3.5 h-3.5" />
            <span>{showCypherCode ? 'Hide Cypher Query' : 'View Canonical Cypher'}</span>
          </button>
        </div>
      </div>

      {showCypherCode && (
        <div className="p-4 bg-slate-900 text-slate-200 rounded-xl border border-slate-800 font-mono text-xs space-y-2">
          <div className="text-slate-400 flex items-center justify-between">
            <span>CANONICAL NEO4J CYPHER QUERY (docs/NEO4J_GRAPH_MODEL.cypher):</span>
            <span className="text-[10px] text-cyan-400">7-TIER HIERARCHY · SINGLE CANONICAL ID</span>
          </div>
          <pre className="overflow-x-auto text-emerald-400">
{`MATCH (st:State)-[:CONTAINS_DISTRICT]->(d:District)-[:SERVES_SUBSTATION]->(s:Substation {id: "SUB-TG-06U"})
      -[:FEEDS]->(f:Feeder)-[:FEEDS_DTR]->(t:Transformer)-[:SECTIONALIZED_BY]->(sw:Switch)-[:SUPPLIES_CLUSTER]->(c:ConsumerCluster)
RETURN st.name, d.name, s.id, f.id, t.id, sw.id, c.id;`}
          </pre>
        </div>
      )}

      {/* Main Graph Viewport */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3">
          {assets.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl h-[540px] flex flex-col items-center justify-center p-6 text-center space-y-3">
              <Network className="w-10 h-10 text-slate-300 dark:text-slate-700" />
              <div className="space-y-1 max-w-md">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  No Power Assets Loaded Yet
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Open the Grid Map to explore canonical assets and synchronized OpenStreetMap elements.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveView('map')}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors"
              >
                Open Grid Map
              </button>
            </div>
          ) : splitMapOpen ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 h-[540px]">
              <KnowledgeGraphCanvas
                heightClass="h-full min-h-[400px]"
                onSelectGraphNodeInspector={setInspectedGraphNode}
              />
              <GridMapComponent heightClass="h-full min-h-[400px]" />
            </div>
          ) : (
            <KnowledgeGraphCanvas
              heightClass="h-[540px]"
              onSelectGraphNodeInspector={setInspectedGraphNode}
            />
          )}
        </div>

        {/* Selected Node Details & Intelligence Inspector */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-400">
              Graph Node &amp; RCA Inspector
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Clicking any node centers Graph &amp; Map, highlights connected paths, and syncs RCA.
            </p>
          </div>

          {selectedAsset || inspectedGraphNode ? (
            <div className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <SourceBadge source={displaySource} />
                  <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400 uppercase font-semibold">
                    {displayType}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white font-mono break-all">
                  {displayId}
                </h4>
                <div className="text-slate-700 dark:text-slate-300 font-medium">
                  {displayName}
                </div>
              </div>

              {selectedAsset?.hasConflict && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-800 dark:text-amber-300 space-y-1">
                  <div className="font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Integrity / Alias Discrepancy</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Cross-system identifier or missing attribute detected for {selectedAsset.canonicalId}.
                  </p>
                </div>
              )}

              {/* Required 6 Node Attributes */}
              <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800 font-mono">
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800 gap-2">
                  <span className="text-slate-500">Asset ID:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-right break-all">
                    {displayId}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800 gap-2">
                  <span className="text-slate-500">Asset Type:</span>
                  <span className="font-bold text-cyan-600 dark:text-cyan-400 text-right">
                    {displayType}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800 gap-2">
                  <span className="text-slate-500">Status:</span>
                  <span
                    className={`font-bold ${
                      displayStatus === 'FAULTED'
                        ? 'text-rose-500'
                        : displayStatus === 'WARNING'
                          ? 'text-amber-500'
                          : displayStatus === 'ACTIVE'
                            ? 'text-emerald-500'
                            : 'text-slate-400'
                    }`}
                  >
                    {displayStatus}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800 gap-2">
                  <span className="text-slate-500">Voltage:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {displayVoltage}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800 gap-2">
                  <span className="text-slate-500">Location:</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300 text-right">
                    {displayLocation}
                  </span>
                </div>
                {inspectedGraphNode?.type === 'CONSUMER_CLUSTER' && (
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800 gap-2">
                    <span className="text-slate-500">Consumers:</span>
                    <span className="font-bold text-cyan-600 dark:text-cyan-400 tabular-nums">
                      {formatMissingValue(inspectedGraphNode.consumersCount)}
                    </span>
                  </div>
                )}
                {inspectedGraphNode?.type === 'FIELD_ENGINEER' && (
                  <div className="p-2.5 rounded-lg bg-cyan-50/50 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-900/50 space-y-1.5 font-sans">
                    <div className="text-[10px] font-mono font-bold uppercase text-cyan-700 dark:text-cyan-300">
                      Live Field Workforce Node
                    </div>
                    {(() => {
                      const eng = fieldEngineers.find(
                        (e) => e.engineerId === inspectedGraphNode.canonicalId
                      );
                      if (!eng) return null;
                      return (
                        <div className="space-y-1 text-[11px] text-slate-700 dark:text-slate-300">
                          <div>Team: <strong>{eng.team}</strong></div>
                          <div className="font-mono text-[10px] tabular-nums">
                            {eng.employeeId} · {eng.networkStatus} · {eng.batteryPct}% Battery
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedEngineerId(eng.engineerId);
                              if (eng.currentTaskId) {
                                openFieldTaskForAsset(eng.currentAssetId || displayId);
                              } else {
                                setActiveView('field');
                              }
                            }}
                            className="w-full mt-1 py-1.5 px-2 text-[11px] font-semibold rounded-md bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer"
                          >
                            Open Live Field Operations
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                )}
                {selectedAsset && (
                  <>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800 gap-2">
                      <span className="text-slate-500">Substation:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {formatMissingValue(selectedAsset.substationId)}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800 gap-2">
                      <span className="text-slate-500">Feeder:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {formatMissingValue(selectedAsset.feederId)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {connectedPathNodes.length > 0 && (
                <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/25 space-y-1.5">
                  <div className="text-[10px] font-mono font-bold uppercase text-cyan-700 dark:text-cyan-300">
                    Connected Chain ({connectedPathNodes.length})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {connectedPathNodes.map((n) => (
                      <button
                        type="button"
                        key={n.canonicalId}
                        onClick={() => selectAsset(n.canonicalId, 'graph', { zoom: 15, openPopup: true })}
                        className={`px-1.5 py-0.5 rounded font-mono text-[10px] border cursor-pointer transition-colors ${
                          n.canonicalId === selectedAsset?.canonicalId
                            ? 'bg-cyan-600 text-white border-cyan-500 font-bold'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-cyan-500'
                        }`}
                      >
                        {n.canonicalId}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Synchronized Root Cause Summary */}
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-mono uppercase text-cyan-600 dark:text-cyan-400 font-bold">
                  <span className="flex items-center gap-1">
                    <SearchCheck className="w-3.5 h-3.5" />
                    <span>Root Cause Intelligence</span>
                  </span>
                  <span>{activeRootCauseAnalysis.confidencePct}% Conf.</span>
                </div>
                <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                  {activeRootCauseAnalysis.rootCauseSummary}
                </p>
              </div>

              {/* Phase 7 & 9: AI Predictive Health + Digital Twin Dependency & Lifecycle Model */}
              {(() => {
                const lookupId = selectedAsset?.canonicalId || inspectedGraphNode?.targetAssetId || displayId;
                const health = getAssetHealth(lookupId);
                const prediction = scopedAiSnapshot.predictions.find((p) => p.assetId === lookupId);
                const timeline = getAssetTimeline(lookupId);
                const lifecycle = getAssetLifecycle(lookupId);
                const twinTrace = traceDigitalTwinDependencies(digitalTwinNetwork.flatNodes, lookupId);
                if (!health && timeline.length === 0 && !lifecycle) return null;
                return (
                  <div className="p-3 rounded-lg bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/70 space-y-2.5">
                    <div className="flex items-center justify-between text-[10px] font-mono uppercase text-indigo-700 dark:text-indigo-300 font-bold">
                      <span className="flex items-center gap-1">
                        <BrainCircuit className="w-3.5 h-3.5" />
                        <span>AI Health &amp; Digital Twin</span>
                      </span>
                      {health && <span className="tabular-nums">{health.healthScore}/100</span>}
                    </div>
                    {health && <AssetHealthGauge health={health} compact />}
                    {prediction && (
                      <div className="text-[11px] text-slate-700 dark:text-slate-300 border-t border-indigo-200/70 dark:border-indigo-800/50 pt-2">
                        <span className="font-semibold text-rose-600 dark:text-rose-400">
                          {prediction.failureType.replace(/_/g, ' ')} ({prediction.probabilityPct}% prob.)
                        </span>
                        <span className="text-slate-500 dark:text-slate-400">
                          {' '}
                          · Window: {prediction.estimatedFailureWindow}
                        </span>
                      </div>
                    )}
                    {(lifecycle || twinTrace.upstreamIds.length > 0 || twinTrace.downstreamIds.length > 0) && (
                      <div className="pt-2 border-t border-indigo-200/70 dark:border-indigo-800/50 space-y-1 text-[11px] font-mono">
                        <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                          <span>Twin Trace:</span>
                          <span className="tabular-nums">
                            {twinTrace.upstreamIds.length} up · {twinTrace.downstreamIds.length} down
                          </span>
                        </div>
                        {lifecycle && (
                          <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                            <span>Lifecycle ({lifecycle.currentStage.replace('_', ' ')}):</span>
                            <span className="tabular-nums">Comm. {lifecycle.commissioningDate}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {timeline.length > 0 && (
                      <div className="pt-2 border-t border-indigo-200/70 dark:border-indigo-800/50">
                        <AssetAiTimelinePanel
                          assetLabel={lookupId}
                          stages={timeline.slice(-3)}
                          compact
                        />
                      </div>
                    )}
                  </div>
                );
              })()}

              {selectedTelemetry && (
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-1 font-mono text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-sans font-semibold">Live Telemetry</span>
                    <SourceBadge source={selectedTelemetry.source} compact />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans">Load:</span>
                    <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                      {selectedTelemetry.loadKw !== null
                        ? `${selectedTelemetry.loadKw.toLocaleString()} kW`
                        : 'Not available'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans">Voltage:</span>
                    <span className="text-slate-800 dark:text-slate-200">
                      {formatMissingValue(selectedTelemetry.voltage)}
                    </span>
                  </div>
                </div>
              )}

              {/* Governance & Field Operations History */}
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between text-[10px] font-mono uppercase text-indigo-600 dark:text-indigo-400 font-bold">
                  <span className="flex items-center gap-1">
                    <FileCheck2 className="w-3.5 h-3.5" />
                    <span>Governance &amp; Field History</span>
                  </span>
                </div>
                {(() => {
                  const assetIdForLookup = selectedAsset?.canonicalId || displayId;
                  const relDecisions = decisions.filter(
                    (d) =>
                      d.targetAssetId === assetIdForLookup ||
                      (selectedAsset?.substationId && d.targetAssetId === selectedAsset.substationId)
                  );
                  const relTasks = fieldTasks.filter((t) => t.assetId === assetIdForLookup);
                  if (relDecisions.length === 0 && relTasks.length === 0) {
                    return (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        No decisions or field dispatches linked directly to {assetIdForLookup}.
                      </p>
                    );
                  }
                  return (
                    <div className="space-y-1.5 text-[11px] font-mono">
                      {relDecisions.slice(0, 2).map((d) => (
                        <div key={d.id} className="flex items-center justify-between gap-2">
                          <span className="truncate text-slate-700 dark:text-slate-200">
                            {d.decisionCode}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-[10px] shrink-0">
                            {d.status}
                          </span>
                        </div>
                      ))}
                      {relTasks.slice(0, 2).map((t) => (
                        <div key={t.id} className="flex items-center justify-between gap-2">
                          <span className="truncate text-slate-700 dark:text-slate-200">
                            {t.taskCode}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] shrink-0">
                            {t.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveView('decisions')}
                    className="py-1 px-2 text-[10px] font-semibold rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-cyan-500 cursor-pointer"
                  >
                    Approvals (Sim)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      openFieldTaskForAsset(selectedAsset?.canonicalId || displayId)
                    }
                    className="py-1 px-2 text-[10px] font-semibold rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 hover:border-indigo-500 inline-flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Wrench className="w-3 h-3" />
                    <span>Field Task</span>
                  </button>
                </div>
              </div>

              <div className="pt-1 space-y-2">
                {selectedAsset && (
                  <button
                    type="button"
                    onClick={() => focusAssetOnMap(selectedAsset.canonicalId)}
                    className="w-full py-2 px-3 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm font-sans cursor-pointer"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Fly Map to Asset (Zoom 15+)</span>
                  </button>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => openRootCauseForAsset(selectedAsset?.canonicalId)}
                    className="py-1.5 px-2 text-[11px] font-medium text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Clock className="w-3 h-3 text-cyan-500" />
                    <span>Timeline &amp; RCA</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => launchSimulationFromRca()}
                    className="py-1.5 px-2 text-[11px] font-medium text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Cpu className="w-3 h-3 text-cyan-500" />
                    <span>What-If Sim</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <Zap className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700" />
              <p className="text-xs">Select any State, District, Substation, Feeder, DTR, Switch, or Consumer Cluster node.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

