import React from 'react';
import { useGrid } from '../../context/GridContext';
import { 
  LayoutDashboard, 
  Database, 
  Clock, 
  Network, 
  MapPin,
  Cpu, 
  Activity,
  Wrench,
  BellRing,
  FileSpreadsheet,
  Settings2
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const {
    activeView,
    setActiveView,
    scopedStats,
    scopedFaults,
    fieldTasks,
    unacknowledgedAlertsCount
  } = useGrid();

  const activeFaultsCount = scopedFaults.filter(f => f.status === 'ACTIVE_LOCKOUT').length;
  const activeTasksCount = fieldTasks.filter(
    t => t.status === 'ASSIGNED' || t.status === 'IN_PROGRESS' || t.status === 'PAUSED'
  ).length;

  const navItems = [
    { id: 'overview', label: '01. Overview', icon: LayoutDashboard },
    { 
      id: 'integrity', 
      label: '02. Data Integrity', 
      icon: Database,
      badge: scopedStats.activeConflictsCount > 0 ? scopedStats.activeConflictsCount : undefined,
      badgeColor: 'text-amber-600 bg-amber-500/10'
    },
    { id: 'events', label: '03. Event Reconstruction', icon: Clock },
    { id: 'graph', label: '04. Knowledge Graph', icon: Network },
    { 
      id: 'map', 
      label: '05. Grid Map', 
      icon: MapPin,
      badge: activeFaultsCount > 0 ? `${activeFaultsCount} Alert` : undefined,
      badgeColor: 'text-rose-600 bg-rose-500/10'
    },
    { 
      id: 'simulator', 
      label: '06. What-If Simulator', 
      icon: Cpu,
      badge: scopedStats.pendingApprovalsCount > 0 ? `${scopedStats.pendingApprovalsCount} Review` : undefined,
      badgeColor: 'text-cyan-600 bg-cyan-500/10'
    },
    {
      id: 'field',
      label: '07. Field Operations',
      icon: Wrench,
      badge: activeTasksCount > 0 ? activeTasksCount : undefined,
      badgeColor: 'text-amber-600 bg-amber-500/10'
    },
    {
      id: 'alerts',
      label: '08. Alert Center',
      icon: BellRing,
      badge: unacknowledgedAlertsCount > 0 ? unacknowledgedAlertsCount : undefined,
      badgeColor: 'text-rose-600 bg-rose-500/10'
    },
    { id: 'reports', label: '09. Reports & Health', icon: FileSpreadsheet },
    { id: 'admin', label: '10. System Admin', icon: Settings2 }
  ];

  return (
    <aside className="w-64 border-r border-slate-200 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/60 backdrop-blur flex flex-col justify-between shrink-0">
      <div className="p-4 space-y-6">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 mb-2 font-mono">
            Navigation
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-colors text-left ${
                    isActive
                      ? 'bg-cyan-600/10 text-cyan-700 dark:text-cyan-400 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400 dark:text-slate-500'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span className={`text-[11px] font-mono px-1.5 py-0.5 rounded ${item.badgeColor}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Operational Context Engine (GOCE) Widget */}
        <div className="p-3 bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-xl space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100">
            <Activity className="w-3.5 h-3.5 text-cyan-500" />
            <span>GOCE Context Engine</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            Reconciles GIS, SCADA, and OMS telemetry before feeding What-If simulation.
          </p>
          <div className="pt-1 flex items-center justify-between text-[11px] font-mono text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-700/40">
            <span>Data Health</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">{scopedStats.dataQualityScore}%</span>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800/80 text-[11px] text-slate-400 dark:text-slate-500 flex items-center justify-between">
        <span>GridGuard AI v1.0.0</span>
        <span className="font-mono">Control Room Ops</span>
      </div>
    </aside>
  );
};
