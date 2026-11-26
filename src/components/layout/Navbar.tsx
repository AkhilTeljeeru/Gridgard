import React, { useState, useEffect, useRef } from 'react';
import { useGrid } from '../../context/GridContext';
import { AuthSessionModal } from '../ui/AuthSessionModal';
import {
  Sun,
  Moon,
  ShieldCheck,
  RotateCcw,
  Radio,
  Bell,
  CheckCheck,
  KeyRound,
  Menu,
  UserCircle2,
  ChevronDown
} from 'lucide-react';

interface NavbarProps {
  onOpenMobileMenu?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenMobileMenu }) => {
  const {
    rolePermissions,
    isDark,
    toggleTheme,
    geoScopeLabel,
    resetToSevereWeatherCascade,
    activeView,
    setActiveView,
    notifications,
    unreadNotificationsCount,
    markNotificationRead,
    markAllNotificationsRead,
    selectAsset,
    wsState,
    isDemoMode,
    authSession,
    overviewMode,
    simulatorTab,
    adminTab
  } = useGrid();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideOrEsc = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) {
        if (e.key === 'Escape') {
          setShowNotifications(false);
          setShowUserMenu(false);
        }
        return;
      }
      const target = e.target as Node;
      if (notifRef.current && !notifRef.current.contains(target)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setShowUserMenu(false);
      }
    };
    window.addEventListener('mousedown', handleOutsideOrEsc);
    window.addEventListener('keydown', handleOutsideOrEsc);
    return () => {
      window.removeEventListener('mousedown', handleOutsideOrEsc);
      window.removeEventListener('keydown', handleOutsideOrEsc);
    };
  }, []);

  const getViewTitle = (view: string) => {
    switch (view) {
      case 'overview':
        return overviewMode === 'EXECUTIVE'
          ? 'Executive Command & Operations Overview'
          : 'Executive Grid Operations';
      case 'integrity': return 'GridData Integrity Engine';
      case 'events': return 'GridEvent Reconstruction Engine';
      case 'graph': return 'Network Knowledge Graph & Digital Twin';
      case 'map': return 'Grid Geographic Intelligence';
      case 'simulator':
        return simulatorTab === 'governance'
          ? 'What-If Simulator · Decision Approvals'
          : 'Operational What-If Simulator';
      case 'field': return 'Field Operations & Inspection';
      case 'alerts': return 'Centralized Grid Alert Center';
      case 'reports': return 'Reports Export & System Health';
      case 'admin':
        return adminTab === 'logs'
          ? 'System Admin · Cryptographic Audit Logs'
          : 'Enterprise System Administration';
      default: return 'GridGuard AI';
    }
  };

  const getShortMobileTitle = (view: string) => {
    switch (view) {
      case 'overview': return 'Overview';
      case 'integrity': return 'Data Integrity';
      case 'events': return 'Event Timeline';
      case 'graph': return 'Knowledge Graph';
      case 'map': return 'Grid Map';
      case 'simulator': return 'What-If Simulator';
      case 'field': return 'Field Ops';
      case 'alerts': return 'Alert Center';
      case 'reports': return 'Reports & Health';
      case 'admin': return 'System Admin';
      default: return 'GridGuard AI';
    }
  };

  return (
    <>
      <header className="h-14 md:h-16 border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/90 backdrop-blur px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-4 shrink-0 z-30 transition-colors relative">
        {/* Zone 1: Hamburger (Mobile), Brand & Page Title */}
        <div className="flex items-center gap-2 sm:gap-3.5 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Open navigation menu"
            className="md:hidden min-h-[44px] min-w-[44px] -ml-1.5 flex items-center justify-center rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-cyan-600 dark:bg-cyan-500 text-white flex items-center justify-center font-bold font-mono text-sm shadow-sm shrink-0">
              GG
            </div>
            <div className="min-w-0">
              <span className="font-bold text-sm sm:text-base tracking-tight text-slate-900 dark:text-white whitespace-nowrap block leading-tight">
                GridGuard AI
              </span>
              <span className="md:hidden text-[11px] font-medium text-cyan-700 dark:text-cyan-400 truncate block leading-tight">
                {getShortMobileTitle(activeView)}
              </span>
            </div>
          </div>

          <span className="text-slate-300 dark:text-slate-700 hidden md:inline" aria-hidden="true">/</span>

          <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 truncate">
            <span className="truncate max-w-[200px] lg:max-w-[240px]" title={geoScopeLabel}>
              {geoScopeLabel}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
              {getViewTitle(activeView)}
            </span>
          </div>
        </div>

        {/* Zone 2: Live WebSocket Telemetry & Demo Mode Indicator (Desktop) */}
        <div className="hidden lg:flex items-center gap-4 text-xs font-mono">
          <button
            type="button"
            onClick={() => setActiveView('reports')}
            className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title="View WebSocket stream and API health diagnostics"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                wsState === 'CONNECTED'
                  ? 'bg-emerald-500 animate-pulse'
                  : wsState === 'RECONNECTING' || wsState === 'CONNECTING'
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
              }`}
            />
            <Radio className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            <span>WS: {wsState === 'CONNECTED' ? 'LIVE' : wsState}</span>
          </button>

          {isDemoMode && (
            <>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                DEMO DATA ACTIVE
              </span>
            </>
          )}
        </div>

        {/* Zone 3: Actions, Notifications, Auth/RBAC & Theme */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {isDemoMode && (
            <button
              type="button"
              onClick={resetToSevereWeatherCascade}
              title="Reset Demo scenario and WebSocket alerts to baseline"
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 min-h-[40px] lg:min-h-0 text-xs text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Demo</span>
            </button>
          )}

          {/* Notifications Bell & Popover */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              aria-label="Open operational notifications"
              onClick={() => {
                setShowUserMenu(false);
                setShowNotifications((v) => !v);
              }}
              className="relative min-h-[44px] min-w-[44px] lg:min-h-0 lg:min-w-0 p-2 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <Bell className="w-4 h-4" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute top-1 right-1 lg:-top-1 lg:-right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-mono font-bold flex items-center justify-center tabular-nums">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="fixed inset-x-3 top-[60px] sm:inset-x-auto sm:absolute sm:right-0 sm:top-full sm:mt-2 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Notifications ({unreadNotificationsCount} unread)
                  </span>
                  <button
                    type="button"
                    onClick={markAllNotificationsRead}
                    className="min-h-[36px] px-2 text-[11px] text-cyan-600 dark:text-cyan-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCheck className="w-3 h-3" />
                    <span>Mark all read</span>
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500">
                      No notifications recorded.
                    </div>
                  ) : (
                    notifications.map((ntf) => (
                      <button
                        key={ntf.id}
                        type="button"
                        onClick={() => {
                          markNotificationRead(ntf.id);
                          if (ntf.relatedAssetId) {
                            selectAsset(ntf.relatedAssetId, 'notifications', { openPopup: false });
                          }
                          if (ntf.targetView) {
                            setActiveView(ntf.targetView);
                          }
                          setShowNotifications(false);
                        }}
                        className={`w-full text-left px-4 py-3 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer ${
                          !ntf.read ? 'bg-cyan-500/5' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span
                            className={`font-semibold truncate ${
                              ntf.severity === 'CRITICAL'
                                ? 'text-rose-600 dark:text-rose-400'
                                : ntf.severity === 'WARNING'
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-cyan-600 dark:text-cyan-400'
                            }`}
                          >
                            {ntf.title}
                          </span>
                          {!ntf.read && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-600 text-white shrink-0">
                              NEW
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2">
                          {ntf.message}
                        </p>
                        <div className="mt-1 text-[10px] font-mono text-slate-400 tabular-nums">
                          {ntf.timestamp.replace('T', ' ').slice(0, 16)} UTC
                          {ntf.relatedAssetId ? ` · ${ntf.relatedAssetId}` : ''}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Mobile Collapsed User Profile Dropdown (< md) */}
          <div className="relative md:hidden" ref={userMenuRef}>
            <button
              type="button"
              aria-label="Open operator profile and session menu"
              onClick={() => {
                setShowNotifications(false);
                setShowUserMenu((v) => !v);
              }}
              className="min-h-[44px] px-2.5 flex items-center gap-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <UserCircle2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showUserMenu && (
              <div className="fixed right-3 top-[60px] w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 p-3 space-y-2">
                <div className="pb-2 border-b border-slate-200 dark:border-slate-800">
                  <div className="text-[10px] font-mono uppercase text-slate-400">
                    Active Operator Role
                  </div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                    {rolePermissions.label}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {geoScopeLabel}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowUserMenu(false);
                    setShowAuthModal(true);
                  }}
                  className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium text-slate-800 dark:text-slate-100 flex items-center gap-2 cursor-pointer"
                >
                  {authSession?.authenticated ? (
                    <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : (
                    <KeyRound className="w-4 h-4 text-amber-500 shrink-0" />
                  )}
                  <span>Role &amp; JWT Session</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowUserMenu(false);
                    setActiveView('reports');
                  }}
                  className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-mono text-slate-700 dark:text-slate-200 flex items-center justify-between cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-cyan-500" />
                    <span>WS Telemetry</span>
                  </span>
                  <span className={wsState === 'CONNECTED' ? 'text-emerald-500 font-bold' : 'text-amber-500'}>
                    {wsState === 'CONNECTED' ? 'LIVE' : wsState}
                  </span>
                </button>

                {isDemoMode && (
                  <button
                    type="button"
                    onClick={() => {
                      resetToSevereWeatherCascade();
                      setShowUserMenu(false);
                    }}
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-2 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4 shrink-0" />
                    <span>Reset Demo Scenario</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Desktop/Tablet Auth Session & RBAC Modal Button */}
          <button
            type="button"
            onClick={() => setShowAuthModal(true)}
            className="hidden md:flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 px-2.5 py-1.5 min-h-[40px] lg:min-h-0 rounded-lg border border-slate-200 dark:border-slate-700/60 text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title="Inspect JWT Token Session, Switch RBAC Role, or Sign In"
          >
            {authSession?.authenticated ? (
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <KeyRound className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            )}
            <span className="font-medium text-slate-800 dark:text-slate-100">
              {rolePermissions.label}
            </span>
          </button>

          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle visual theme"
            className="min-h-[44px] min-w-[44px] lg:min-h-0 lg:min-w-0 p-2 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>
        </div>
      </header>

      <AuthSessionModal open={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </>
  );
};

