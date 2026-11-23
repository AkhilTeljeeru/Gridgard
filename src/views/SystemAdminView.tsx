import React, { useState } from 'react';
import { useGrid } from '../context/GridContext';
import { AuditLogsView } from './AuditLogsView';
import type { UserRole } from '../types/grid';
import {
  BellRing,
  Cpu,
  DatabaseBackup,
  HardDriveUpload,
  Layers,
  ScrollText,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  UserPlus,
  Users
} from 'lucide-react';

export const SystemAdminView: React.FC = () => {
  const {
    currentRole,
    setCurrentRole,
    isDemoMode,
    adminUsers,
    adminAiSettings,
    adminNotificationSettings,
    adminBackups,
    createAdminUser,
    updateAdminUser,
    updateAdminSettings,
    importAdminAssets,
    createAdminBackup,
    restoreAdminBackup,
    mapLayers,
    setMapLayers,
    auditLogs,
    adminTab: tab,
    setAdminTab: setTab,
    pushToast
  } = useGrid();

  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('GRID_ENGINEER');

  const [importJson, setImportJson] = useState(
    JSON.stringify(
      [
        {
          canonicalId: 'DTR-TG-06U-901',
          name: 'Madhapur Phase-2 500 kVA DTR-901',
          assetType: 'TRANSFORMER',
          state: 'Telangana',
          district: 'Hyderabad',
          area: 'Madhapur',
          latitude: 17.4498,
          longitude: 78.3932,
          voltage: '11/0.433 kV',
          ratedCapacityKva: 500,
          peakLoadPct: 61
        }
      ],
      null,
      2
    )
  );

  const [aiDraft, setAiDraft] = useState(adminAiSettings);
  const [notifDraft, setNotifDraft] = useState(adminNotificationSettings);
  const isAdmin = currentRole === 'ADMIN';

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await createAdminUser({
      username: newUserEmail.split('@')[0] || 'operator',
      email: newUserEmail,
      fullName: newUserName,
      role: newUserRole
    });
    if (res.ok) {
      setNewUserEmail('');
      setNewUserName('');
      pushToast({ title: 'User Created', message: 'RBAC operator added cleanly.', severity: 'INFO' });
    } else {
      pushToast({ title: 'Admin Action Blocked', message: res.error || 'Failed', severity: 'HIGH' });
    }
  };

  const handleImportAssets = async () => {
    try {
      const parsed = JSON.parse(importJson);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      const res = await importAdminAssets(list);
      if (res.ok) {
        pushToast({
          title: 'Assets Imported',
          message: `Added ${res.count} asset(s) to live Digital Twin & Grid Map.`,
          severity: 'INFO',
          targetView: 'graph'
        });
      } else {
        pushToast({ title: 'Import Blocked', message: res.error || 'Import error', severity: 'HIGH' });
      }
    } catch {
      pushToast({ title: 'Invalid JSON', message: 'Provide valid JSON asset array.', severity: 'MEDIUM' });
    }
  };

  const handleSaveSettings = async () => {
    const res = await updateAdminSettings({
      aiSettings: aiDraft,
      notificationSettings: notifDraft
    });
    if (res.ok) {
      pushToast({
        title: 'System Settings Saved',
        message: 'AI thresholds & notification escalation policies updated.',
        severity: 'INFO'
      });
    } else {
      pushToast({ title: 'Settings Blocked', message: res.error || 'Failed', severity: 'HIGH' });
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Enterprise System Administration
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Manage utility RBAC users, bulk GIS asset imports, layer controls, AI parameters, logs, and encrypted backups.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/30">
              <ShieldCheck className="w-4 h-4" />
              <span>ADMIN PRIVILEGES ACTIVE</span>
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30">
                <ShieldAlert className="w-4 h-4" />
                <span>READ-ONLY ({currentRole})</span>
              </span>
              {isDemoMode && (
                <button
                  type="button"
                  onClick={() => setCurrentRole('ADMIN')}
                  className="px-3 py-1.5 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Switch to Admin
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1.5 flex-wrap border-b border-slate-200 dark:border-slate-800 pb-3">
        {(
          [
            { id: 'users', label: 'User & Role Management', icon: Users },
            { id: 'import', label: 'Asset Import & GIS Layers', icon: HardDriveUpload },
            { id: 'settings', label: 'AI & Notification Settings', icon: Cpu },
            { id: 'logs', label: `Audit Logs (${auditLogs.length})`, icon: ScrollText },
            { id: 'backups', label: 'Backup & Restore', icon: DatabaseBackup }
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                active
                  ? 'bg-cyan-600 text-white'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Users & Roles */}
      {tab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white">
              Registered Utility Operators ({adminUsers.length})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 font-mono border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4">OPERATOR</th>
                    <th className="py-2.5 px-4">EMAIL</th>
                    <th className="py-2.5 px-4">RBAC ROLE</th>
                    <th className="py-2.5 px-4">STATUS</th>
                    <th className="py-2.5 px-4 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {adminUsers.map((u) => (
                    <tr key={u.id}>
                      <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white">{u.fullName}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-500">{u.email}</td>
                      <td className="py-2.5 px-4">
                        <select
                          disabled={!isAdmin}
                          value={u.role}
                          onChange={(e) => updateAdminUser(u.id, { role: e.target.value as UserRole })}
                          className="px-2 py-1 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[11px] disabled:opacity-60"
                        >
                          <option value="ADMIN">ADMIN</option>
                          <option value="GRID_ENGINEER">GRID_ENGINEER</option>
                          <option value="REVIEWER_APPROVER">REVIEWER_APPROVER</option>
                          <option value="FIELD_ENGINEER">FIELD_ENGINEER</option>
                          <option value="VIEWER">VIEWER</option>
                        </select>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px]">
                        <span className={u.status === 'ACTIVE' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}>
                          {u.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          type="button"
                          disabled={!isAdmin}
                          onClick={() =>
                            updateAdminUser(u.id, { status: u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' })
                          }
                          className="text-xs font-mono text-cyan-600 dark:text-cyan-400 hover:underline disabled:opacity-40 cursor-pointer"
                        >
                          {u.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <form
            onSubmit={handleCreateUser}
            className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3"
          >
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">
              <UserPlus className="w-4 h-4 text-cyan-500" />
              <span>Provision New Operator</span>
            </div>
            <input
              type="text"
              required
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
              placeholder="Full Name"
              className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
            />
            <input
              type="email"
              required
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              placeholder="operator@utilitygrid.org"
              className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
            />
            <select
              value={newUserRole}
              onChange={(e) => setNewUserRole(e.target.value as UserRole)}
              className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono"
            >
              <option value="GRID_ENGINEER">GRID_ENGINEER (Control Room)</option>
              <option value="REVIEWER_APPROVER">REVIEWER_APPROVER (Manager)</option>
              <option value="FIELD_ENGINEER">FIELD_ENGINEER</option>
              <option value="ADMIN">ADMIN</option>
              <option value="VIEWER">VIEWER</option>
            </select>
            <button
              type="submit"
              disabled={!isAdmin}
              className="w-full py-2 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg disabled:opacity-50 cursor-pointer"
            >
              Add Operator Account
            </button>
          </form>
        </div>
      )}

      {/* Tab 2: Asset Import & GIS Layer Management */}
      {tab === 'import' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Batch GIS Asset Import (JSON Array)
              </span>
              <button
                type="button"
                disabled={!isAdmin}
                onClick={handleImportAssets}
                className="px-3 py-1.5 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg disabled:opacity-50 cursor-pointer"
              >
                Import into Digital Twin
              </button>
            </div>
            <textarea
              rows={12}
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              className="w-full p-3 text-xs font-mono rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">
              <Layers className="w-4 h-4 text-cyan-500" />
              <span>GIS Map Layer Controls</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {(Object.keys(mapLayers) as Array<keyof typeof mapLayers>).map((layerKey) => (
                <label
                  key={layerKey}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 cursor-pointer"
                >
                  <span className="capitalize text-slate-700 dark:text-slate-200">{layerKey}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(mapLayers[layerKey])}
                    onChange={(e) =>
                      setMapLayers((prev) => ({ ...prev, [layerKey]: e.target.checked }))
                    }
                  />
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: AI & Notification Settings */}
      {tab === 'settings' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                <Cpu className="w-4 h-4 text-cyan-500" />
                <span>AI Predictive Model Thresholds</span>
              </div>
              <label className="block space-y-1">
                <span className="text-slate-500">High Risk Probability Threshold (%)</span>
                <input
                  type="number"
                  value={aiDraft.riskThresholdHigh}
                  onChange={(e) => setAiDraft({ ...aiDraft, riskThresholdHigh: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-slate-500">Forecast Horizon (Days)</span>
                <input
                  type="number"
                  value={aiDraft.predictionWindowDays}
                  onChange={(e) => setAiDraft({ ...aiDraft, predictionWindowDays: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono"
                />
              </label>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                <BellRing className="w-4 h-4 text-cyan-500" />
                <span>Notification &amp; Escalation Rules</span>
              </div>
              <label className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <span>Stream Critical Fault Toasts</span>
                <input
                  type="checkbox"
                  checked={notifDraft.notifyCriticalAlerts}
                  onChange={(e) => setNotifDraft({ ...notifDraft, notifyCriticalAlerts: e.target.checked })}
                />
              </label>
              <label className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <span>Notify on AI Recommendations</span>
                <input
                  type="checkbox"
                  checked={notifDraft.notifyAiRecommendations}
                  onChange={(e) => setNotifDraft({ ...notifDraft, notifyAiRecommendations: e.target.checked })}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-slate-500">Unacknowledged Alert Escalation (Minutes)</span>
                <input
                  type="number"
                  value={notifDraft.escalateUnacknowledgedMin}
                  onChange={(e) =>
                    setNotifDraft({ ...notifDraft, escalateUnacknowledgedMin: Number(e.target.value) })
                  }
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono"
                />
              </label>
            </div>
          </div>

          <button
            type="button"
            disabled={!isAdmin}
            onClick={handleSaveSettings}
            className="px-4 py-2 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg disabled:opacity-50 cursor-pointer"
          >
            Save Admin Configuration
          </button>
        </div>
      )}

      {/* Tab 4: Cryptographic Audit Logs */}
      {tab === 'logs' && <AuditLogsView embedded />}

      {/* Tab 5: Backup & Restore */}
      {tab === 'backups' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Encrypted State Backups &amp; Recovery
              </h3>
              <p className="text-xs text-slate-500">
                Create verifiable SHA-256 checkpoints across canonical assets, governance decisions, and audit trails.
              </p>
            </div>
            <button
              type="button"
              disabled={!isAdmin}
              onClick={async () => {
                const res = await createAdminBackup();
                if (res.ok) {
                  pushToast({ title: 'Backup Created', message: 'Snapshot checksum verified.', severity: 'INFO' });
                } else {
                  pushToast({ title: 'Backup Blocked', message: res.error || 'Failed', severity: 'HIGH' });
                }
              }}
              className="px-3 py-1.5 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Create Encrypted Backup
            </button>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs font-mono">
            {adminBackups.map((b) => (
              <div key={b.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">{b.id}</div>
                  <div className="text-[11px] text-slate-500 tabular-nums">
                    {b.createdAt.slice(0, 19)} UTC · {b.assetCount} assets · {b.decisionCount} decisions · {b.checksum}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!isAdmin}
                  onClick={async () => {
                    const res = await restoreAdminBackup(b.id);
                    if (res.ok) {
                      pushToast({ title: 'Backup Restored', message: `Verified restore from ${b.id}.`, severity: 'INFO' });
                    } else {
                      pushToast({ title: 'Restore Blocked', message: res.error || 'Failed', severity: 'HIGH' });
                    }
                  }}
                  className="px-3 py-1 text-xs font-sans font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-md disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Verify &amp; Restore
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
