import React, { useEffect } from 'react';
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
  Settings2,
  X
} from 'lucide-react';

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  mobileOpen = false,
  onCloseMobile
}) => {
  const {
    activeView,
    setActiveView,
    scopedStats,
    scopedFaults,
    fieldTasks,
    unacknowledgedAlertsCount
  } = useGrid();

  useEffect(() => {
    if (!mobileOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseMobile?.();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [mobileOpen, onCloseMobile]);

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

  const handleSelectView = (viewId: string) => {
    setActiveView(viewId);
    onCloseMobile?.();
  };

  const renderSidebarBody = (isMobileDrawer: boolean) => (
    <>
      <div className={`${isMobileDrawer ? 'p-4 space-y-5' : 'p-2.5 lg:p-4 space-y-6'} flex-1 overflow-y-auto`}>
        {isMobileDrawer && (
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-cyan-600 dark:bg-cyan-500 text-white flex items-center justify-center font-bold font-mono text-sm">
                GG
              </div>
              <div>
                <div className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
                  GridGuard AI
                </div>
                <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                  Control Room Ops
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close navigation menu"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        <div>
          <div
            className={`${
              isMobileDrawer ? 'block px-3' : 'hidden lg:block px-3'
            } text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2 font-mono`}
          >
            Navigation
          </div>
          <nav className="space-y-1" aria-label="Primary GridGuard Navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectView(item.id)}
                  title={item.label}
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                  className={`group relative w-full flex items-center ${
                    isMobileDrawer
                      ? 'justify-between px-3 py-2.5 min-h-[44px]'
                      : 'justify-center lg:justify-between px-2 lg:px-3 py-2.5 lg:py-2 min-h-[44px] lg:min-h-0'
                  } text-xs font-medium rounded-lg transition-colors text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                    isActive
                      ? 'bg-cyan-600/15 text-cyan-700 dark:text-cyan-400 font-semibold border border-cyan-500/25 lg:border-transparent'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400 dark:text-slate-500'
                      }`}
                    />
                    <span className={`${isMobileDrawer ? 'inline' : 'hidden lg:inline'} truncate`}>
                      {item.label}
                    </span>
                  </div>

                  {item.badge !== undefined && (
                    <>
                      <span
                        className={`${
                          isMobileDrawer ? 'inline-flex' : 'hidden lg:inline-flex'
                        } text-[11px] font-mono px-1.5 py-0.5 rounded ${item.badgeColor}`}
                      >
                        {item.badge}
                      </span>
                      {!isMobileDrawer && (
                        <span
                          className="lg:hidden absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500"
                          aria-hidden="true"
                        />
                      )}
                    </>
                  )}

                  {/* Tablet Icon-Only Hover / Focus Tooltip */}
                  {!isMobileDrawer && (
                    <span
                      role="tooltip"
                      className="hidden md:block lg:hidden pointer-events-none opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity absolute left-full top-1/2 -translate-y-1/2 ml-2.5 px-2.5 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-800 text-white text-xs font-medium whitespace-nowrap shadow-xl border border-slate-700 z-50"
                    >
                      {item.label}
                      {item.badge !== undefined ? ` (${item.badge})` : ''}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Operational Context Engine (GOCE) Widget */}
        <div
          className={`${
            isMobileDrawer ? 'p-3' : 'p-2 lg:p-3'
          } bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-xl space-y-2`}
          title={`GOCE Context Engine · Data Health ${scopedStats.dataQualityScore}%`}
        >
          <div
            className={`flex items-center ${
              isMobileDrawer ? 'justify-start gap-1.5' : 'justify-center lg:justify-start gap-1.5'
            } text-xs font-semibold text-slate-900 dark:text-slate-100`}
          >
            <Activity className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
            <span className={isMobileDrawer ? 'inline' : 'hidden lg:inline'}>
              GOCE Context Engine
            </span>
          </div>
          <p
            className={`${
              isMobileDrawer ? 'block' : 'hidden lg:block'
            } text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed`}
          >
            Reconciles GIS, SCADA, and OMS telemetry before feeding What-If simulation.
          </p>
          <div
            className={`pt-1 flex items-center ${
              isMobileDrawer ? 'justify-between' : 'justify-center lg:justify-between'
            } text-[11px] font-mono text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-700/40`}
          >
            <span className={isMobileDrawer ? 'inline' : 'hidden lg:inline'}>Data Health</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold tabular-nums">
              {scopedStats.dataQualityScore}%
            </span>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div
        className={`${
          isMobileDrawer ? 'flex' : 'hidden lg:flex'
        } p-4 border-t border-slate-200 dark:border-slate-800/80 text-[11px] text-slate-400 dark:text-slate-500 items-center justify-between shrink-0`}
      >
        <span>GridGuard AI v1.0.0</span>
        <span className="font-mono">Control Room Ops</span>
      </div>
    </>
  );

  return (
    <>
      {/* Tablet (icon rail) & Desktop (full sidebar) */}
      <aside className="hidden md:flex md:w-[72px] lg:w-64 border-r border-slate-200 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/60 backdrop-blur flex-col justify-between shrink-0 transition-[width] duration-200 relative z-30">
        {renderSidebarBody(false)}
      </aside>

      {/* Mobile Slide-In Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Mobile Navigation">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-[2px]"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col justify-between transition-transform duration-200">
            {renderSidebarBody(true)}
          </aside>
        </div>
      )}
    </>
  );
};

