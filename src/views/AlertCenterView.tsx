import React, { useMemo, useState } from 'react';
import { useGrid } from '../context/GridContext';
import type { AlertSeverity } from '../types/grid';
import {
  AlertTriangle,
  BellRing,
  CheckCheck,
  MapPin,
  Network,
  Search,
  Zap
} from 'lucide-react';

export const AlertCenterView: React.FC = () => {
  const {
    alerts,
    acknowledgeAlert,
    focusAssetOnMap,
    openKnowledgeGraphForAsset,
    setActiveView,
    selectAsset,
    isDemoMode,
    triggerLiveDemoIncident,
    wsState
  } = useGrid();

  const [severityFilter, setSeverityFilter] = useState<'ALL' | AlertSeverity>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyUnacknowledged, setOnlyUnacknowledged] = useState(false);

  const counts = useMemo(
    () => ({
      CRITICAL: alerts.filter((a) => a.severity === 'CRITICAL').length,
      HIGH: alerts.filter((a) => a.severity === 'HIGH').length,
      MEDIUM: alerts.filter((a) => a.severity === 'MEDIUM').length,
      INFO: alerts.filter((a) => a.severity === 'INFO').length
    }),
    [alerts]
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return alerts.filter((a) => {
      if (severityFilter !== 'ALL' && a.severity !== severityFilter) return false;
      if (onlyUnacknowledged && a.acknowledged) return false;
      if (!q) return true;
      return (
        a.title.toLowerCase().includes(q) ||
        a.assetId.toLowerCase().includes(q) ||
        a.assetName.toLowerCase().includes(q) ||
        a.locationLabel.toLowerCase().includes(q)
      );
    });
  }, [alerts, severityFilter, onlyUnacknowledged, searchQuery]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BellRing className="w-5 h-5 text-rose-500" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Centralized Grid Alert Center
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Real-time operational alarms streamed via WebSocket ({wsState}) with severity classification and instant workflow routing.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isDemoMode && (
            <button
              type="button"
              onClick={() => triggerLiveDemoIncident()}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Simulate Live WS Fault</span>
            </button>
          )}
        </div>
      </div>

      {/* Severity Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {(
          [
            { key: 'CRITICAL', label: 'Critical Alerts', tone: 'text-rose-600 dark:text-rose-400' },
            { key: 'HIGH', label: 'High Priority', tone: 'text-amber-600 dark:text-amber-400' },
            { key: 'MEDIUM', label: 'Medium Warnings', tone: 'text-cyan-600 dark:text-cyan-400' },
            { key: 'INFO', label: 'Information', tone: 'text-slate-700 dark:text-slate-300' }
          ] as const
        ).map((bucket) => (
          <button
            key={bucket.key}
            type="button"
            onClick={() =>
              setSeverityFilter((prev) => (prev === bucket.key ? 'ALL' : bucket.key))
            }
            className={`text-left bg-white dark:bg-slate-900 border rounded-xl p-4 transition-colors cursor-pointer ${
              severityFilter === bucket.key
                ? 'border-cyan-500'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="text-[11px] font-mono uppercase text-slate-500">{bucket.label}</div>
            <div className={`text-2xl font-bold font-mono mt-1 tabular-nums ${bucket.tone}`}>
              {counts[bucket.key]}
            </div>
          </button>
        ))}
      </div>

      {/* Filters + Alerts Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search asset, location, or alert..."
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white w-64 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-xs">
              {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'INFO'] as const).map((sev) => (
                <button
                  key={sev}
                  type="button"
                  onClick={() => setSeverityFilter(sev)}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    severityFilter === sev
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>

            <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer px-2">
              <input
                type="checkbox"
                checked={onlyUnacknowledged}
                onChange={(e) => setOnlyUnacknowledged(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-700"
              />
              <span>Unacknowledged only</span>
            </label>
          </div>

          <span className="text-xs font-mono text-slate-500 tabular-nums">
            {filtered.length} alerts displayed
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 font-mono border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-2.5 px-4 font-semibold">SEVERITY</th>
                <th className="py-2.5 px-4 font-semibold">ASSET &amp; LOCATION</th>
                <th className="py-2.5 px-4 font-semibold">ALERT &amp; RECOMMENDED ACTION</th>
                <th className="py-2.5 px-4 font-semibold">TIMESTAMP (UTC)</th>
                <th className="py-2.5 px-4 font-semibold text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 px-4 text-center text-xs text-slate-500">
                    No grid alerts match the selected filters.
                  </td>
                </tr>
              ) : (
                filtered.map((alert) => {
                  const sevText =
                    alert.severity === 'CRITICAL'
                      ? 'text-rose-600 dark:text-rose-400'
                      : alert.severity === 'HIGH'
                        ? 'text-amber-600 dark:text-amber-400'
                        : alert.severity === 'MEDIUM'
                          ? 'text-cyan-600 dark:text-cyan-400'
                          : 'text-slate-500';
                  return (
                    <tr
                      key={alert.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-3 px-4 whitespace-nowrap font-mono font-bold">
                        <div className={`inline-flex items-center gap-1.5 ${sevText}`}>
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>{alert.severity}</span>
                        </div>
                        <div className="text-[10px] font-normal text-slate-400 mt-0.5">
                          {alert.category.replace('_', ' ')}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-mono font-semibold text-slate-900 dark:text-white">
                          {alert.assetId}
                        </div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-300">
                          {alert.assetName}
                        </div>
                        <div className="text-[10px] text-slate-400">{alert.locationLabel}</div>
                      </td>
                      <td className="py-3 px-4 max-w-md">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {alert.title}
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                          {alert.recommendedAction}
                        </p>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap tabular-nums">
                        {alert.timestamp.replace('T', ' ').slice(0, 19)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => focusAssetOnMap(alert.assetId)}
                            className="px-2 py-1 text-[11px] font-medium text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10 rounded inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <MapPin className="w-3 h-3" />
                            <span>Map</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openKnowledgeGraphForAsset(alert.assetId)}
                            className="px-2 py-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 rounded inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Network className="w-3 h-3" />
                            <span>Graph</span>
                          </button>
                          {!alert.acknowledged ? (
                            <button
                              type="button"
                              onClick={() => acknowledgeAlert(alert.id)}
                              className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 rounded inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <CheckCheck className="w-3 h-3" />
                              <span>Acknowledge</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                selectAsset(alert.assetId, 'notifications', { openPopup: false });
                                setActiveView(alert.targetView || 'overview');
                              }}
                              className="px-2 py-1 text-[11px] font-mono text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              Ack&apos;d
                            </button>
                          )}
                        </div>
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
