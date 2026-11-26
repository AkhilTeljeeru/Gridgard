import React, { useEffect, useState } from 'react';
import { useGrid } from '../context/GridContext';
import type { ExportFormat, ExportReportType } from '../types/grid';
import { MobileRecordCardList, MobileRecordItem } from '../components/ui/MobileRecordCard';
import {
  Activity,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  Radio,
  RefreshCw,
  RotateCcw,
  Server,
  ShieldCheck,
  Zap
} from 'lucide-react';

interface MonitoringLogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  category: string;
  message: string;
  statusCode?: number;
  latencyMs?: number;
}

export const ReportsAndHealthView: React.FC = () => {
  const {
    scopedFaults,
    scopedAssets,
    scopedMaintenanceZones,
    scopedScenarios,
    scopedAuditLogs,
    scopedAiSnapshot,
    scopedDecisions,
    regionalKpis,
    assetLifecycleRecords,
    executiveReportsHistory,
    geoScopeLabel,
    exportReport,
    systemHealth,
    refreshSystemHealth,
    wsState,
    lastWsMessageAt,
    isDemoMode,
    toggleDemoMode,
    triggerLiveDemoIncident,
    resetToSevereWeatherCascade
  } = useGrid();

  const [monitoringLogs, setMonitoringLogs] = useState<MonitoringLogEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadMonitoring = async () => {
    setRefreshing(true);
    await refreshSystemHealth();
    try {
      const res = await fetch('/api/monitoring/metrics');
      if (res.ok) {
        const body = (await res.json()) as { recentLogs?: MonitoringLogEntry[] };
        if (Array.isArray(body.recentLogs)) {
          setMonitoringLogs(body.recentLogs);
        }
      }
    } catch {
      // Non-blocking
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadMonitoring();
  }, []);

  const reportCards: Array<{
    type: ExportReportType;
    title: string;
    description: string;
    count: number;
  }> = [
    {
      type: 'INCIDENTS',
      title: 'Incident & Outage Faults Report',
      description: 'Active lockouts, faulted substations/feeders, customers interrupted, and status.',
      count: scopedFaults.length
    },
    {
      type: 'ASSETS',
      title: 'Utility Asset & Health Inventory',
      description: 'Canonical & OSM electricity assets merged with AI Health Scores and voltages.',
      count: scopedAssets.length
    },
    {
      type: 'MAINTENANCE',
      title: 'Preventive Maintenance Priority Report',
      description: 'AI prioritized inspection queue paired with scheduled feeder work zones.',
      count: scopedAiSnapshot.maintenanceQueue.length + scopedMaintenanceZones.length
    },
    {
      type: 'SIMULATIONS',
      title: 'What-If Simulation Analysis Report',
      description: 'Feeder transfer MVA, thermal utilization, voltage drop, and risk levels.',
      count: scopedScenarios.length
    },
    {
      type: 'AUDIT_LOGS',
      title: 'Cryptographic Governance Audit Log',
      description: 'Immutable operator, manager approval, field evidence, and export trail.',
      count: scopedAuditLogs.length
    },
    {
      type: 'AI_RECOMMENDATIONS',
      title: 'AI Predictions & Explainable Actions',
      description: 'Failure forecasts, confidence scores, expected risk reduction, and reasoning.',
      count: scopedAiSnapshot.recommendations.length
    },
    {
      type: 'GRID_HEALTH',
      title: 'Enterprise Grid Health Summary',
      description: 'Unified digital twin health, risk classifications, active incidents, and lifecycle status.',
      count: scopedAssets.length
    },
    {
      type: 'REGIONAL_PERFORMANCE',
      title: 'Regional Performance Benchmarks',
      description: 'Reliability %, availability %, fault frequency/100km, MTTR, MTBF, and compliance.',
      count: regionalKpis.length
    },
    {
      type: 'ASSET_RELIABILITY',
      title: 'Asset Reliability & Lifecycle Ledger',
      description: '7-stage commissioning to replacement progression, inspections, and failure risk.',
      count: assetLifecycleRecords.length
    },
    {
      type: 'DECISION_GOVERNANCE',
      title: 'Decision Governance & Approvals',
      description: 'Engineering recommendation approvals, escalation reviews, and field verification.',
      count: scopedDecisions.length
    }
  ];

  const handleExport = (type: ExportReportType, format: ExportFormat) => {
    exportReport(type, format);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Reports Export Center &amp; System Health
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Generate regulatory PDF, multi-sheet Excel (.xlsx), and sanitized CSV exports scoped to {geoScopeLabel}.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={toggleDemoMode}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              isDemoMode
                ? 'bg-cyan-600 text-white border-cyan-500'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
            }`}
          >
            Demo Mode: {isDemoMode ? 'ON' : 'OFF'}
          </button>
          {isDemoMode && (
            <>
              <button
                type="button"
                onClick={() => triggerLiveDemoIncident()}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Simulate Live Fault</span>
              </button>
              <button
                type="button"
                onClick={resetToSevereWeatherCascade}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Demo Data</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Multi-Format Export Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportCards.map((card) => (
          <div
            key={card.type}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between gap-4"
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {card.title}
                </h3>
                <span className="text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400 tabular-nums shrink-0">
                  {card.count} rows
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {card.description}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleExport(card.type, 'PDF')}
                className="flex-1 min-h-[44px] lg:min-h-0 px-2.5 py-2 lg:py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 rounded-lg inline-flex items-center justify-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>PDF</span>
              </button>
              <button
                type="button"
                onClick={() => handleExport(card.type, 'EXCEL')}
                className="flex-1 min-h-[44px] lg:min-h-0 px-2.5 py-2 lg:py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 rounded-lg inline-flex items-center justify-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Excel</span>
              </button>
              <button
                type="button"
                onClick={() => handleExport(card.type, 'CSV')}
                className="flex-1 min-h-[44px] lg:min-h-0 px-2.5 py-2 lg:py-1.5 text-xs font-semibold text-cyan-700 dark:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/25 rounded-lg inline-flex items-center justify-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Executive Report Generation History */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-900 dark:text-white">
              Enterprise Report Generation Ledger ({executiveReportsHistory.length})
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            Synchronized with /api/reports
          </span>
        </div>

        <div className="md:hidden">
          <MobileRecordCardList
            emptyText="No reports generated yet."
            detailTitle="Export Ledger Details"
            items={executiveReportsHistory.slice(0, 10).map((rep): MobileRecordItem => ({
              id: rep.reportId,
              assetName: rep.reportType.replace(/_/g, ' '),
              assetId: rep.reportId,
              status: rep.format,
              statusTone: 'info',
              health: `${rep.rowCount} rows`,
              location: rep.scopeLabel,
              lastUpdated: `${rep.generatedAt.replace('T', ' ').slice(0, 19)} UTC`,
              detailFields: [
                { label: 'Generated By', value: rep.generatedBy },
                { label: 'Scope', value: rep.scopeLabel },
                { label: 'Rows Exported', value: rep.rowCount }
              ]
            }))}
          />
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 font-mono border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-2 px-3">REPORT ID</th>
                <th className="py-2 px-3">TYPE</th>
                <th className="py-2 px-3">FORMAT</th>
                <th className="py-2 px-3">SCOPE</th>
                <th className="py-2 px-3">GENERATED BY</th>
                <th className="py-2 px-3 text-right">ROWS</th>
                <th className="py-2 px-3 text-right">GENERATED AT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono tabular-nums">
              {executiveReportsHistory.slice(0, 10).map((rep) => (
                <tr key={rep.reportId} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="py-2 px-3 font-semibold text-cyan-600 dark:text-cyan-400">{rep.reportId}</td>
                  <td className="py-2 px-3 text-slate-900 dark:text-slate-100">{rep.reportType}</td>
                  <td className="py-2 px-3 text-slate-600 dark:text-slate-300">{rep.format}</td>
                  <td className="py-2 px-3 font-sans text-slate-600 dark:text-slate-300">{rep.scopeLabel}</td>
                  <td className="py-2 px-3 font-sans text-slate-500">{rep.generatedBy}</td>
                  <td className="py-2 px-3 text-right">{rep.rowCount}</td>
                  <td className="py-2 px-3 text-right text-slate-500">
                    {rep.generatedAt.replace('T', ' ').slice(0, 19)} UTC
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live /api/health & Telemetry Monitoring Panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-900 dark:text-white">
              Live Platform Health &amp; Monitoring (/api/health)
            </h3>
          </div>
          <button
            type="button"
            onClick={loadMonitoring}
            className="px-2.5 py-1 text-xs font-mono text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh Health</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="font-mono text-[10px] uppercase">API Gateway</span>
              <Server className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
              {systemHealth?.apiStatus || 'HEALTHY'}
            </div>
            <div className="text-[11px] font-mono text-slate-500 mt-0.5 tabular-nums">
              {systemHealth?.avgLatencyMs ?? 0} ms avg · {systemHealth?.totalRequests ?? 0} reqs
            </div>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="font-mono text-[10px] uppercase">Database / GIS</span>
              <Database className="w-3.5 h-3.5 text-cyan-500" />
            </div>
            <div className="font-mono font-bold text-sm text-slate-900 dark:text-white truncate">
              {systemHealth?.databaseStatus || 'CONFIGURED_READY'}
            </div>
            <div className="text-[11px] font-mono text-slate-500 mt-0.5 tabular-nums">
              {systemHealth?.assetCount ?? scopedAssets.length} canonical assets
            </div>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="font-mono text-[10px] uppercase">WebSocket Stream</span>
              <Radio className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
              {wsState}
            </div>
            <div className="text-[11px] font-mono text-slate-500 mt-0.5 tabular-nums">
              {systemHealth?.webSocketStatus.connectedClients ?? 1} WS ·{' '}
              {lastWsMessageAt ? lastWsMessageAt.slice(11, 19) : 'Syncing'}
            </div>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="font-mono text-[10px] uppercase">AI &amp; Security</span>
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
            </div>
            <div className="font-mono font-bold text-sm text-indigo-600 dark:text-indigo-400">
              {systemHealth?.aiServiceStatus || 'HEALTHY'}
            </div>
            <div className="text-[11px] font-mono text-slate-500 mt-0.5 tabular-nums">
              Errors: {systemHealth?.errorCount ?? 0} · Failed Logins:{' '}
              {systemHealth?.failedLoginAttempts ?? 0}
            </div>
          </div>
        </div>

        {monitoringLogs.length > 0 && (
          <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
            <div className="text-[11px] font-mono uppercase text-slate-500 mb-2">
              Recent Operational Telemetry &amp; Security Events
            </div>
            <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-xs font-mono">
              {monitoringLogs.slice(0, 12).map((log) => (
                <div key={log.id} className="py-1.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`text-[10px] font-bold shrink-0 ${
                        log.level === 'ERROR'
                          ? 'text-rose-500'
                          : log.level === 'WARN'
                            ? 'text-amber-500'
                            : 'text-emerald-500'
                      }`}
                    >
                      [{log.level}]
                    </span>
                    <span className="text-[10px] text-cyan-600 dark:text-cyan-400 shrink-0">
                      {log.category}
                    </span>
                    <span className="font-sans text-slate-700 dark:text-slate-300 truncate">
                      {log.message}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0 tabular-nums">
                    {log.timestamp.slice(11, 19)} UTC
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
