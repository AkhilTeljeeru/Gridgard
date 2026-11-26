import React, { useState } from 'react';
import { useGrid } from '../../context/GridContext';
import { ROLE_DIRECTORY } from '../../services/governanceHelpers';
import type { UserRole } from '../../types/grid';
import { KeyRound, LogOut, ShieldCheck, UserPlus, X } from 'lucide-react';

export const AuthSessionModal: React.FC<{
  open: boolean;
  onClose: () => void;
}> = ({ open, onClose }) => {
  const {
    authSession,
    currentRole,
    setCurrentRole,
    rolePermissions,
    isDemoMode,
    loginWithCredentials,
    registerAccount,
    logoutAuthSession
  } = useGrid();

  const [tab, setTab] = useState<'session' | 'login' | 'register'>('session');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regFullName, setRegFullName] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('GRID_ENGINEER');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const remainingMin = authSession
    ? Math.max(0, Math.round((authSession.expiresAtMs - Date.now()) / 60000))
    : 0;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setSubmitting(true);
    const res = await loginWithCredentials(identifier, password);
    setSubmitting(false);
    if (!res.ok) {
      setFeedback(res.error || 'Authentication failed.');
      return;
    }
    setPassword('');
    setTab('session');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setSubmitting(true);
    const res = await registerAccount({
      username: regUsername,
      email: regEmail,
      fullName: regFullName,
      password: regPassword,
      role: regRole
    });
    setSubmitting(false);
    if (!res.ok) {
      setFeedback(res.error || 'Registration failed.');
      return;
    }
    setRegPassword('');
    setTab('session');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl max-w-lg w-[calc(100vw-1.5rem)] sm:w-full max-h-[90dvh] flex flex-col shadow-2xl overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldCheck className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
              JWT Identity &amp; RBAC Session Security
            </h3>
          </div>
          <button
            type="button"
            aria-label="Close security modal"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="px-4 sm:px-5 pt-2 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar shrink-0">
          {(['session', 'login', 'register'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setFeedback(null);
                setTab(t);
              }}
              className={`min-h-[44px] lg:min-h-0 px-3 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                tab === t
                  ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {t === 'session'
                ? 'Active Session & RBAC'
                : t === 'login'
                  ? 'Credential Sign In'
                  : 'Register Operator'}
            </button>
          ))}
        </div>

        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {feedback && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-400">
              {feedback}
            </div>
          )}

          {tab === 'session' && (
            <>
              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Operator</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {authSession?.fullName || rolePermissions.actorName}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Email</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    {authSession?.email || rolePermissions.actorEmail}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Active Role</span>
                  <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">
                    {rolePermissions.label}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">JWT Status</span>
                  <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                    {authSession?.authenticated
                      ? `In-Memory Bearer (${authSession.mode}) · ${remainingMin}m TTL`
                      : 'Local Fallback'}
                  </span>
                </div>
              </div>

              {isDemoMode && (
                <div className="space-y-2">
                  <div className="text-[11px] font-mono uppercase text-slate-500">
                    Demo Mode RBAC Role Switcher (Issues Fresh Server JWT)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(Object.keys(ROLE_DIRECTORY) as UserRole[]).map((roleKey) => {
                      const entry = ROLE_DIRECTORY[roleKey];
                      const active = currentRole === roleKey;
                      return (
                        <button
                          key={roleKey}
                          type="button"
                          onClick={() => setCurrentRole(roleKey)}
                          className={`px-3 py-2 rounded-lg border text-left text-xs transition-colors cursor-pointer ${
                            active
                              ? 'bg-cyan-600/10 border-cyan-500 text-cyan-700 dark:text-cyan-300 font-semibold'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-cyan-500/40'
                          }`}
                        >
                          <div>{entry.label}</div>
                          <div className="text-[10px] font-mono text-slate-400 truncate">
                            {entry.actorEmail}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
                <span className="text-[11px] text-slate-500">
                  Tokens reside strictly in memory with auto-refresh rotation.
                </span>
                {authSession && (
                  <button
                    type="button"
                    onClick={logoutAuthSession}
                    className="px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Revoke &amp; Sign Out</span>
                  </button>
                )}
              </div>
            </>
          )}

          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-mono text-slate-500 mb-1">
                  Username or Email
                </label>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="operator@utilitygrid.org"
                  className="w-full min-h-[44px] lg:min-h-0 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono text-slate-500 mb-1">
                  Password (verified via salted scrypt)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full min-h-[44px] lg:min-h-0 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full min-h-[44px] py-2 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>{submitting ? 'Verifying...' : 'Sign In & Issue JWT'}</span>
              </button>
            </form>
          )}

          {tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-slate-500 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="a.sharma"
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-slate-500 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    placeholder="Ananya Sharma, PE"
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-slate-500 mb-1">
                    Utility Email
                  </label>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="a.sharma@utilitygrid.org"
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-slate-500 mb-1">
                    RBAC Role
                  </label>
                  <select
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    {(Object.keys(ROLE_DIRECTORY) as UserRole[]).map((roleKey) => (
                      <option key={roleKey} value={roleKey}>
                        {ROLE_DIRECTORY[roleKey].label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-mono text-slate-500 mb-1">
                  Password (min 8 characters)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full min-h-[44px] py-2 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{submitting ? 'Creating Account...' : 'Create Operator Account'}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
