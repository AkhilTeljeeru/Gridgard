import React, { useMemo, useState } from 'react';
import { useGrid } from '../context/GridContext';
import {
  ScrollText,
  Search,
  Filter,
  ShieldCheck,
  MapPin,
  Network,
  Crosshair,
  Download
} from 'lucide-react';

interface AuditLogsViewProps {
  embedded?: boolean;
}

export const AuditLogsView: React.FC<AuditLogsViewProps> = ({ embedded = false }) => {
  const {
    scopedAuditLogs,
    decisions,
    assets,
    geoScopeLabel,
    hasRegionSelection,
    resetGeoFilter,
    selectedAssetId,
    activeRootCauseAnalysis,
    focusAssetOnMap,
    openKnowledgeGraphForAsset,
    exportReport
  } = useGrid();
  const [filterAction, setFilterAction] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [threadOnly, setThreadOnly] = useState<boolean>(false);

  const decisionTargetById = useMemo(() => {
    const map = new Map<string, string>();
    decisions.forEach((d) => {
      map.set(d.id, d.targetAssetId);
    });
    return map;
  }, [decisions]);

  const assetIdSet = useMemo(() => {
    return new Set(assets.map((a) => a.canonicalId));
  }, [assets]);

  const resolveAuditAssetId = (targetEntity: string, summary: string): string | null => {
    if (assetIdSet.has(targetEntity)) return targetEntity;
    const fromDecision = decisionTargetById.get(targetEntity);
    if (fromDecision && assetIdSet.has(fromDecision)) return fromDecision;
    for (const assetId of assetIdSet) {
      if (targetEntity.includes(assetId) || summary.includes(assetId)) {
        return assetId;
      }
    }
    return null;
  };

  const activeThreadIds = useMemo(() => {
    const ids = new Set<string>();
    if (selectedAssetId) ids.add(selectedAssetId);
    if (activeRootCauseAnalysis.canonicalAssetId) ids.add(activeRootCauseAnalysis.canonicalAssetId);
    if (activeRootCauseAnalysis.faultId) ids.add(activeRootCauseAnalysis.faultId);
    if (activeRootCauseAnalysis.incidentId) ids.add(activeRootCauseAnalysis.incidentId);
    if (selectedAssetId) {
      decisions
        .filter((d) => d.targetAssetId === selectedAssetId)
        .forEach((d) => ids.add(d.id));
    }
    return ids;
  }, [selectedAssetId, activeRootCauseAnalysis, decisions]);

  const logMatchesActiveThread = (targetEntity: string, summary: string, resolvedAssetId: string | null) => {
    if (activeThreadIds.size === 0) return false;
    if (resolvedAssetId && selectedAssetId && resolvedAssetId === selectedAssetId) return true;
    for (const token of activeThreadIds) {
      if (targetEntity.includes(token) || summary.includes(token)) return true;
    }
    return false;
  };

  const filteredLogs = scopedAuditLogs.filter((log) => {
    const matchesFilter = filterAction === 'ALL' || log.actionType === filterAction;
    const matchesSearch =
      log.actorEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.targetEntity.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesFilter || !matchesSearch) return false;
    if (threadOnly && selectedAssetId) {
      const resolvedId = resolveAuditAssetId(log.targetEntity, log.summary);
      return logMatchesActiveThread(log.targetEntity, log.summary, resolvedId);
    }
    return true;
  });

  return (
    <div className={embedded ? 'space-y-4' : 'space-y-6 max-w-7xl mx-auto'}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            <h2 className={embedded ? 'text-sm font-bold text-slate-900 dark:text-white' : 'text-lg font-bold text-slate-900 dark:text-white'}>
              Cryptographic Audit Logs &amp; Provenance Trail
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Immutable record of all operator actions, simulations, field dispatches, edits, and engineering decision approvals.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
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
            onClick={() => exportReport('AUDIT_LOGS', 'CSV')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
          <button
            type="button"
            onClick={() => exportReport('AUDIT_LOGS', 'EXCEL')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Excel</span>
          </button>
          <div className="flex items-center gap-2 text-xs font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 whitespace-nowrap shrink-0">
            <ShieldCheck className="w-4 h-4" />
            <span>Cryptographic Hash Sealed</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden space-y-3">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search actor, action, or summary..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500 w-64"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="bg-transparent text-slate-700 dark:text-slate-200 pr-2 py-1 text-xs focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Actions</option>
                <option value="USER_LOGIN">User Login / Role Switch</option>
                <option value="ASSET_SELECTED">Asset Selected</option>
                <option value="DATA_RECONCILED">Data Reconciled</option>
                <option value="SCENARIO_SIMULATED">Scenario Simulated</option>
                <option value="DECISION_SUBMITTED">Decision Submitted</option>
                <option value="DECISION_APPROVED">Decision Approved</option>
                <option value="DECISION_REJECTED">Decision Rejected</option>
                <option value="DECISION_CLOSED">Decision Closed</option>
                <option value="FIELD_TASK_ASSIGNED">Field Task Assigned</option>
                <option value="FIELD_TASK_UPDATED">Field Task Updated</option>
                <option value="EVIDENCE_UPLOADED">Evidence Uploaded</option>
                <option value="CASE_VERIFIED">Case Verified</option>
                <option value="INCIDENT_CLOSED">Incident Closed</option>
                <option value="REPORT_EXPORTED">Report Exported</option>
                <option value="AI_RECALCULATED">AI Models Recalculated</option>
                <option value="AI_RECOMMENDATION_GENERATED">AI Recommendation Generated</option>
              </select>
            </div>

            {selectedAssetId && (
              <button
                type="button"
                onClick={() => setThreadOnly((prev) => !prev)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono border transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  threadOnly
                    ? 'bg-cyan-600 text-white border-cyan-500'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-cyan-500/50'
                }`}
              >
                <Crosshair className="w-3 h-3" />
                <span>
                  {threadOnly
                    ? `Active Thread Only: ${selectedAssetId}`
                    : `Filter Thread (${selectedAssetId})`}
                </span>
              </button>
            )}
          </div>

          <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
            {filteredLogs.length} audit records
          </span>
        </div>

        {/* Audit Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 font-mono border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-2.5 px-4 font-semibold">TIMESTAMP (UTC)</th>
                <th className="py-2.5 px-4 font-semibold">ACTOR &amp; ROLE</th>
                <th className="py-2.5 px-4 font-semibold">ACTION &amp; MODULE</th>
                <th className="py-2.5 px-4 font-semibold">TARGET ENTITY</th>
                <th className="py-2.5 px-4 font-semibold">CHANGE SUMMARY</th>
                <th className="py-2.5 px-4 font-semibold text-right">TRACE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 px-4 text-center font-sans text-xs text-slate-500 dark:text-slate-400">
                    {threadOnly && selectedAssetId
                      ? `No audit provenance records tied directly to ${selectedAssetId}.`
                      : `No audit provenance records match ${geoScopeLabel}.`}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const resolvedAssetId = resolveAuditAssetId(log.targetEntity, log.summary);
                  const isThreadMatch = logMatchesActiveThread(
                    log.targetEntity,
                    log.summary,
                    resolvedAssetId
                  );
                  return (
                    <tr
                      key={log.id}
                      className={`transition-colors ${
                        isThreadMatch
                          ? 'bg-cyan-500/5 hover:bg-cyan-500/10'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                      }`}
                    >
                      <td className="py-3 px-4 text-slate-500 text-[11px] whitespace-nowrap">
                        {log.timestamp.replace('T', ' ').slice(0, 19)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-900 dark:text-white text-[11px]">
                          {log.actorEmail}
                        </div>
                        <div className="text-[10px] text-slate-400">{log.actorRole}</div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 border border-slate-200 dark:border-slate-700">
                          {log.actionType}
                        </span>
                        {log.module && (
                          <div className="text-[10px] text-slate-400 mt-0.5">{log.module}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-200 text-[11px] whitespace-nowrap">
                        <div>{log.targetEntity}</div>
                        {(resolvedAssetId || log.relatedIncidentId) && (
                          <div className="text-[10px] text-cyan-600 dark:text-cyan-400">
                            {log.relatedAssetId || resolvedAssetId || ''}
                            {log.relatedIncidentId ? ` · ${log.relatedIncidentId}` : ''}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-sans text-xs text-slate-700 dark:text-slate-300">
                        {log.summary}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {resolvedAssetId ? (
                          <div className="inline-flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => focusAssetOnMap(resolvedAssetId)}
                              className="text-[11px] font-sans text-cyan-600 dark:text-cyan-400 hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                            >
                              <MapPin className="w-3 h-3" />
                              <span>Map</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openKnowledgeGraphForAsset(resolvedAssetId)}
                              className="text-[11px] font-sans text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                            >
                              <Network className="w-3 h-3" />
                              <span>Graph</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">{log.ipAddress}</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
