import React, { useEffect, useMemo, useState } from 'react';
import { useGrid } from '../context/GridContext';
import { GridMapComponent } from '../components/map/GridMapComponent';
import { validateEvidenceFile } from '../services/governanceHelpers';
import { SourceBadge } from '../components/ui/SourceBadge';
import type {
  FieldEngineer,
  FieldEngineerStatus,
  FieldEvidence,
  FieldTaskStatus,
  GeoFenceEventType,
  PriorityLevel
} from '../types/grid';
import {
  Activity,
  AlertTriangle,
  BatteryCharging,
  Camera,
  CheckCircle2,
  Clock,
  Compass,
  FileCheck2,
  FileText,
  Gauge,
  Mail,
  MapPin,
  Mic,
  Monitor,
  Navigation,
  Network,
  Pause,
  Phone,
  Play,
  Radar,
  Route,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  Video,
  Wifi,
  WifiOff,
  Wrench
} from 'lucide-react';

const STATUS_BADGE_CLASS: Record<FieldTaskStatus, string> = {
  ASSIGNED: 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30',
  ACCEPTED: 'text-sky-700 dark:text-sky-300 bg-sky-500/10 border border-sky-500/30',
  TRAVELING: 'text-blue-700 dark:text-blue-300 bg-blue-500/10 border border-blue-500/30',
  ON_SITE: 'text-orange-700 dark:text-orange-300 bg-orange-500/10 border border-orange-500/30',
  INSPECTION: 'text-violet-700 dark:text-violet-300 bg-violet-500/10 border border-violet-500/30',
  REPAIR: 'text-fuchsia-700 dark:text-fuchsia-300 bg-fuchsia-500/10 border border-fuchsia-500/30',
  VERIFICATION: 'text-teal-700 dark:text-teal-300 bg-teal-500/10 border border-teal-500/30',
  IN_PROGRESS: 'text-cyan-700 dark:text-cyan-300 bg-cyan-500/10 border border-cyan-500/30',
  PAUSED: 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30',
  COMPLETED: 'text-indigo-700 dark:text-indigo-300 bg-indigo-500/10 border border-indigo-500/30',
  VERIFIED: 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/30'
};

const ENGINEER_STATUS_BADGE: Record<FieldEngineerStatus, string> = {
  AVAILABLE: 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/30',
  TRAVELING: 'text-blue-700 dark:text-blue-300 bg-blue-500/10 border border-blue-500/30',
  WORKING: 'text-orange-700 dark:text-orange-300 bg-orange-500/10 border border-orange-500/30',
  ON_BREAK: 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30',
  OFFLINE: 'text-slate-600 dark:text-slate-400 bg-slate-500/10 border border-slate-500/30'
};

const ENGINEER_DOT_CLASS: Record<FieldEngineerStatus, string> = {
  AVAILABLE: 'bg-emerald-500',
  TRAVELING: 'bg-blue-500',
  WORKING: 'bg-orange-500',
  ON_BREAK: 'bg-amber-500',
  OFFLINE: 'bg-slate-400'
};

const PRIORITY_BADGE_CLASS: Record<PriorityLevel, string> = {
  CRITICAL: 'text-rose-700 dark:text-rose-300 bg-rose-500/10 border border-rose-500/30',
  HIGH: 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30',
  MEDIUM: 'text-cyan-700 dark:text-cyan-300 bg-cyan-500/10 border border-cyan-500/30',
  LOW: 'text-slate-600 dark:text-slate-300 bg-slate-500/10 border border-slate-500/30'
};

const GEOFENCE_EVENT_BADGE: Record<GeoFenceEventType, string> = {
  ENTER_WORK_ZONE: 'text-cyan-700 dark:text-cyan-300 bg-cyan-500/10 border border-cyan-500/30',
  LEAVE_WORK_ZONE: 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30',
  REACHED_ASSET: 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/30',
  COMPLETED_WORK: 'text-indigo-700 dark:text-indigo-300 bg-indigo-500/10 border border-indigo-500/30'
};

const WORKFLOW_STAGE_ORDER: FieldTaskStatus[] = [
  'ASSIGNED',
  'ACCEPTED',
  'TRAVELING',
  'ON_SITE',
  'INSPECTION',
  'REPAIR',
  'VERIFICATION',
  'COMPLETED'
];

export const FieldOperationsView: React.FC = () => {
  const {
    assets,
    faults,
    fieldTasks,
    fieldEvidence,
    decisions,
    activeTaskId,
    setActiveTaskId,
    rolePermissions,
    currentRole,
    focusAssetOnMap,
    openKnowledgeGraphForAsset,
    openKnowledgeGraphForEngineer,
    setActiveView,
    createFieldTask,
    assignOrReassignFieldTask,
    updateFieldTaskStatus,
    submitFieldEvidence,
    // Phase 11 Live Workforce Context
    fieldEngineers,
    selectedEngineerId,
    setSelectedEngineerId,
    engineerRoutes,
    geoFences,
    geoFenceEvents,
    fieldDashboardMetrics,
    getRecommendedEngineersForAsset,
    getLiveIncidentTimeline,
    assignEngineerToTask,
    acceptFieldTask,
    completeFieldTask,
    updateEngineerLocation,
    simulateEngineerStepTowardTarget
  } = useGrid();

  const [leftTab, setLeftTab] = useState<'engineers' | 'dispatch' | 'tasks'>('engineers');
  const [mobileSection, setMobileSection] = useState<'map' | 'crew' | 'task'>('map');
  const [centerSubTab, setCenterSubTab] = useState<'timeline' | 'geofences'>('timeline');
  const [engineerStatusFilter, setEngineerStatusFilter] = useState<'ALL' | FieldEngineerStatus>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | FieldTaskStatus>('ALL');
  const [myTeamOnly, setMyTeamOnly] = useState<boolean>(false);
  const [mobilePreview, setMobilePreview] = useState<boolean>(false);
  const [focusEngineerNonce, setFocusEngineerNonce] = useState<number>(0);

  const [actionMessage, setActionMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [statusNotes, setStatusNotes] = useState<string>('');
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const [steppingRoute, setSteppingRoute] = useState<boolean>(false);

  // Intelligent Dispatch Target Asset
  const dispatchCandidates = useMemo(() => {
    const faultAssetIds = new Set(faults.filter((f) => f.status !== 'RESTORED').map((f) => f.affectedAssetId));
    const prioritized = assets.filter(
      (a) =>
        faultAssetIds.has(a.canonicalId) ||
        a.assetType === 'TRANSFORMER' ||
        a.assetType === 'SUBSTATION' ||
        a.assetType === 'FEEDER'
    );
    return prioritized.sort((a, b) => {
      const aFault = faultAssetIds.has(a.canonicalId) ? 0 : 1;
      const bFault = faultAssetIds.has(b.canonicalId) ? 0 : 1;
      return aFault - bFault;
    });
  }, [assets, faults]);

  const [dispatchAssetId, setDispatchAssetId] = useState<string>(
    dispatchCandidates[0]?.canonicalId || 'DTR-TG-06U-104'
  );
  const [dispatchPriority, setDispatchPriority] = useState<PriorityLevel>('HIGH');

  useEffect(() => {
    if (!dispatchCandidates.some((a) => a.canonicalId === dispatchAssetId) && dispatchCandidates[0]) {
      setDispatchAssetId(dispatchCandidates[0].canonicalId);
    }
  }, [dispatchCandidates, dispatchAssetId]);

  const engineerRecommendations = useMemo(() => {
    if (!dispatchAssetId) return [];
    return getRecommendedEngineersForAsset(dispatchAssetId);
  }, [dispatchAssetId, getRecommendedEngineersForAsset]);

  // Filtered Engineers
  const filteredEngineers = useMemo(() => {
    return fieldEngineers.filter((eng) => {
      if (engineerStatusFilter !== 'ALL' && eng.status !== engineerStatusFilter) return false;
      return true;
    });
  }, [fieldEngineers, engineerStatusFilter]);

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    return fieldTasks.filter((t) => {
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
      if (myTeamOnly && currentRole === 'FIELD_ENGINEER') {
        return (
          t.assignedEngineerEmail === rolePermissions.actorEmail ||
          t.assignedEngineer.toLowerCase().includes('rohan') ||
          t.assignedEngineer.toLowerCase().includes('rahul')
        );
      }
      return true;
    });
  }, [fieldTasks, statusFilter, myTeamOnly, currentRole, rolePermissions.actorEmail]);

  const activeTask = useMemo(() => {
    return (
      filteredTasks.find((t) => t.id === activeTaskId) ||
      fieldTasks.find((t) => t.id === activeTaskId) ||
      filteredTasks[0] ||
      fieldTasks[0] ||
      null
    );
  }, [filteredTasks, fieldTasks, activeTaskId]);

  const selectedEngineer: FieldEngineer | null = useMemo(() => {
    if (selectedEngineerId) {
      const found = fieldEngineers.find((e) => e.engineerId === selectedEngineerId);
      if (found) return found;
    }
    if (activeTask) {
      const byTask = fieldEngineers.find(
        (e) =>
          e.engineerId === activeTask.engineerId ||
          e.currentTaskId === activeTask.id ||
          e.email.toLowerCase() === activeTask.assignedEngineerEmail.toLowerCase()
      );
      if (byTask) return byTask;
    }
    return fieldEngineers[0] || null;
  }, [selectedEngineerId, fieldEngineers, activeTask]);

  const activeRoute = useMemo(() => {
    if (selectedEngineer) {
      const byEng = engineerRoutes.find((r) => r.engineerId === selectedEngineer.engineerId);
      if (byEng) return byEng;
    }
    if (activeTask) {
      return engineerRoutes.find((r) => r.taskId === activeTask.id) || null;
    }
    return null;
  }, [engineerRoutes, selectedEngineer, activeTask]);

  const liveIncidentTimeline = useMemo(() => {
    return getLiveIncidentTimeline(activeTask?.id);
  }, [getLiveIncidentTimeline, activeTask]);

  // Reassign state
  const [showReassign, setShowReassign] = useState<boolean>(false);
  const [reassignEngineerId, setReassignEngineerId] = useState<string>(fieldEngineers[0]?.engineerId || 'ENG-HYD-01');
  const [reassignTeam, setReassignTeam] = useState<string>(fieldEngineers[0]?.team || '');
  const [reassignPriority, setReassignPriority] = useState<PriorityLevel>('HIGH');
  const [reassignDueDate, setReassignDueDate] = useState<string>('2026-11-21T18:00');

  // Create new task modal
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newTaskDecisionId, setNewTaskDecisionId] = useState<string>(decisions[0]?.id || '');
  const [newTaskEngineerId, setNewTaskEngineerId] = useState<string>(fieldEngineers[0]?.engineerId || 'ENG-HYD-01');
  const [newTaskTeam, setNewTaskTeam] = useState<string>(fieldEngineers[0]?.team || '');
  const [newTaskPriority, setNewTaskPriority] = useState<PriorityLevel>('CRITICAL');
  const [newTaskDueDate, setNewTaskDueDate] = useState<string>('2026-11-21T16:30');
  const [newTaskSafety, setNewTaskSafety] = useState<string>('');

  // Evidence upload state
  const [evFileName, setEvFileName] = useState<string>('');
  const [evMimeType, setEvMimeType] = useState<string>('');
  const [evFileSize, setEvFileSize] = useState<number>(0);
  const [evPreviewUrl, setEvPreviewUrl] = useState<string | undefined>(undefined);
  const [evVideoFileName, setEvVideoFileName] = useState<string>('');
  const [evVoiceSummary, setEvVoiceSummary] = useState<string>('');
  const [evLat, setEvLat] = useState<string>('');
  const [evLon, setEvLon] = useState<string>('');
  const [evNotes, setEvNotes] = useState<string>('');
  const [evResult, setEvResult] = useState<FieldEvidence['inspectionResult']>('REPAIR_COMPLETED');
  const [evCondition, setEvCondition] = useState<FieldEvidence['equipmentCondition']>('GOOD');
  const [evVoltageKv, setEvVoltageKv] = useState<string>('11.02');
  const [evLoadAmps, setEvLoadAmps] = useState<string>('178');
  const [evInsulationMohm, setEvInsulationMohm] = useState<string>('850');
  const [evTemperatureC, setEvTemperatureC] = useState<string>('41.5');

  useEffect(() => {
    if (activeTask) {
      setEvLat(activeTask.gpsLat.toFixed(5));
      setEvLon(activeTask.gpsLon.toFixed(5));
      const matched = fieldEngineers.find(
        (e) =>
          e.engineerId === activeTask.engineerId ||
          e.email.toLowerCase() === activeTask.assignedEngineerEmail.toLowerCase()
      );
      if (matched) {
        setReassignEngineerId(matched.engineerId);
        setReassignTeam(matched.team);
      } else {
        setReassignTeam(activeTask.assignedTeam);
      }
      setReassignPriority(activeTask.priority);
      setReassignDueDate(activeTask.dueDate.slice(0, 16));
    }
  }, [activeTask, fieldEngineers]);

  const activeTaskEvidence = useMemo(() => {
    if (!activeTask) return [];
    return fieldEvidence.filter((e) => e.taskId === activeTask.id);
  }, [fieldEvidence, activeTask]);

  const linkedDecision = useMemo(() => {
    if (!activeTask) return null;
    return decisions.find((d) => d.id === activeTask.decisionId) || null;
  }, [decisions, activeTask]);

  const handleSelectEngineer = (eng: FieldEngineer) => {
    setSelectedEngineerId(eng.engineerId);
    if (eng.currentTaskId) {
      setActiveTaskId(eng.currentTaskId);
    }
    setFocusEngineerNonce((n) => n + 1);
    setActionMessage(null);
  };

  const handleIntelligentDispatch = async (engineerId: string) => {
    if (!dispatchAssetId) return;
    setActionMessage(null);
    setDispatchingId(engineerId);
    const fault = faults.find((f) => f.affectedAssetId === dispatchAssetId && f.status !== 'RESTORED');
    const res = await assignEngineerToTask({
      assetId: dispatchAssetId,
      engineerId,
      incidentId: fault?.id || null,
      priority: dispatchPriority
    });
    setDispatchingId(null);
    if (!res.success) {
      setActionMessage({ type: 'error', text: res.error || 'Dispatch failed.' });
    } else {
      setSelectedEngineerId(engineerId);
      setFocusEngineerNonce((n) => n + 1);
      setActionMessage({
        type: 'success',
        text: `Dispatched ${res.task?.assignedEngineer} to ${dispatchAssetId} (${res.task?.taskCode}). Live GPS route active.`
      });
    }
  };

  const handleTaskStatusChange = async (nextStatus: FieldTaskStatus) => {
    if (!activeTask) return;
    setActionMessage(null);
    if (nextStatus === 'ACCEPTED') {
      const res = await acceptFieldTask(activeTask.id);
      if (!res.success) {
        setActionMessage({ type: 'error', text: res.error || 'Unable to accept task.' });
      } else {
        setActionMessage({
          type: 'success',
          text: `Task ${activeTask.taskCode} accepted. Navigation ready.`
        });
      }
      return;
    }
    if (nextStatus === 'COMPLETED') {
      const res = await completeFieldTask(activeTask.id, statusNotes || undefined);
      if (!res.success) {
        setActionMessage({ type: 'error', text: res.error || 'Unable to complete task.' });
      } else {
        setActionMessage({
          type: 'success',
          text: `Field task ${activeTask.taskCode} marked COMPLETED and synced to governance.`
        });
        setStatusNotes('');
      }
      return;
    }

    const res = updateFieldTaskStatus(activeTask.id, nextStatus, statusNotes || undefined);
    if (!res.success) {
      setActionMessage({ type: 'error', text: res.error || 'Unable to update task status.' });
    } else {
      setActionMessage({
        type: 'success',
        text: `Field task ${activeTask.taskCode} transitioned to ${nextStatus}.`
      });
      setStatusNotes('');
    }
  };

  const handleStepGpsRoute = async () => {
    if (!selectedEngineer) return;
    setSteppingRoute(true);
    await simulateEngineerStepTowardTarget(selectedEngineer.engineerId);
    setFocusEngineerNonce((n) => n + 1);
    setSteppingRoute(false);
  };

  const handleToggleEngineerOffline = async (eng: FieldEngineer) => {
    const nextStatus: FieldEngineerStatus =
      eng.status === 'OFFLINE' ? (eng.currentTaskId ? 'TRAVELING' : 'AVAILABLE') : 'OFFLINE';
    const res = await updateEngineerLocation({
      engineerId: eng.engineerId,
      latitude: eng.latitude,
      longitude: eng.longitude,
      speedKmh: nextStatus === 'OFFLINE' ? 0 : eng.speedKmh,
      status: nextStatus
    });
    if (res.success) {
      setActionMessage({
        type: 'success',
        text: `${eng.name} telemetry status set to ${nextStatus}.`
      });
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setActionMessage(null);
    const check = validateEvidenceFile({
      fileName: file.name,
      mimeType: file.type,
      fileSizeBytes: file.size
    });
    if (!check.valid) {
      setActionMessage({ type: 'error', text: check.error || 'Invalid evidence file.' });
      return;
    }
    setEvFileName(file.name);
    setEvMimeType(file.type);
    setEvFileSize(file.size);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') setEvPreviewUrl(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      setEvPreviewUrl(undefined);
    }
  };

  const handleAttachSamplePhoto = () => {
    if (!activeTask) return;
    setActionMessage(null);
    setEvFileName(`field-inspection-${activeTask.assetId.toLowerCase()}.jpg`);
    setEvMimeType('image/jpeg');
    setEvFileSize(312400);
    setEvPreviewUrl(undefined);
    setEvVideoFileName(`thermal-pan-${activeTask.assetId.toLowerCase()}.mp4`);
    setEvVoiceSummary(`Crew check-in: bushings inspected, oil level nominal, torque verified.`);
    if (!evNotes.trim()) {
      setEvNotes(
        `Visual inspection & thermal scan verified at ${activeTask.assetId}. Connections torqued and clear of tracking.`
      );
    }
  };

  const handleEvidenceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTask) return;
    setActionMessage(null);
    const combinedNotes = [
      evNotes.trim(),
      evVoiceSummary.trim() ? `[Voice Note: ${evVoiceSummary.trim()}]` : '',
      evVideoFileName.trim() ? `[Video Clip: ${evVideoFileName.trim()}]` : ''
    ]
      .filter(Boolean)
      .join(' ');

    const res = submitFieldEvidence({
      taskId: activeTask.id,
      fileName: evFileName,
      mimeType: evMimeType,
      fileSizeBytes: evFileSize,
      filePreviewUrl: evPreviewUrl,
      gpsLat: Number(evLat) || activeTask.gpsLat,
      gpsLon: Number(evLon) || activeTask.gpsLon,
      notes: combinedNotes || evNotes,
      inspectionResult: evResult,
      equipmentCondition: evCondition,
      meterReadings: {
        voltageKv: evVoltageKv.trim() || undefined,
        loadAmps: evLoadAmps.trim() || undefined,
        insulationMohm: evInsulationMohm.trim() || undefined,
        temperatureC: evTemperatureC.trim() || undefined
      }
    });
    if (!res.success) {
      setActionMessage({ type: 'error', text: res.error || 'Evidence submission failed.' });
    } else {
      setActionMessage({
        type: 'success',
        text: `Field evidence ${res.evidence?.fileName} uploaded and logged to audit trail.`
      });
      setEvFileName('');
      setEvMimeType('');
      setEvFileSize(0);
      setEvPreviewUrl(undefined);
      setEvVideoFileName('');
      setEvVoiceSummary('');
      setEvNotes('');
    }
  };

  const handleReassignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTask) return;
    const eng = fieldEngineers.find((p) => p.engineerId === reassignEngineerId);
    if (!eng) return;
    const res = assignOrReassignFieldTask(activeTask.id, {
      assignedEngineer: eng.name,
      assignedEngineerEmail: eng.email,
      assignedTeam: reassignTeam || eng.team,
      priority: reassignPriority,
      dueDate: new Date(reassignDueDate).toISOString()
    });
    if (!res.success) {
      setActionMessage({ type: 'error', text: res.error || 'Reassignment failed.' });
    } else {
      setSelectedEngineerId(eng.engineerId);
      setActionMessage({
        type: 'success',
        text: `Reassigned ${activeTask.taskCode} to ${eng.name}.`
      });
      setShowReassign(false);
    }
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskDecisionId) return;
    const eng = fieldEngineers.find((p) => p.engineerId === newTaskEngineerId);
    if (!eng) return;
    const res = createFieldTask({
      decisionId: newTaskDecisionId,
      assignedEngineer: eng.name,
      assignedEngineerEmail: eng.email,
      assignedTeam: newTaskTeam || eng.team,
      priority: newTaskPriority,
      dueDate: new Date(newTaskDueDate).toISOString(),
      safetyNotes: newTaskSafety || undefined
    });
    if (!res.success) {
      setActionMessage({ type: 'error', text: res.error || 'Task creation failed.' });
    } else {
      setShowCreateModal(false);
      setSelectedEngineerId(eng.engineerId);
      setActionMessage({
        type: 'success',
        text: `Dispatched Field Task ${res.task?.taskCode} to ${eng.name}.`
      });
    }
  };

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Radar className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Live Field Operations &amp; Workforce Tracking
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Real-time GPS tracking, intelligent engineer dispatch, Mapbox route navigation, geofencing, and field evidence collection.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-lg bg-slate-200/70 dark:bg-slate-800 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setMobilePreview(false)}
              className={`px-2.5 py-1.5 rounded-md font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                !mobilePreview
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Command Center</span>
            </button>
            <button
              type="button"
              onClick={() => setMobilePreview(true)}
              className={`px-2.5 py-1.5 rounded-md font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                mobilePreview
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Mobile Engineer App</span>
            </button>
          </div>

          {rolePermissions.canAssignFieldTask && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-sm cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Assign Field Task</span>
            </button>
          )}
        </div>
      </div>

      {/* Manager Operations Dashboard KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-2.5">
        <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400">
            Engineers Online
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-lg font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
              {fieldDashboardMetrics.engineersOnline}
            </span>
            <span className="text-[11px] font-mono text-slate-400 tabular-nums">
              / {fieldEngineers.length}
            </span>
          </div>
        </div>

        <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400">
            Traveling
          </div>
          <div className="mt-1 text-lg font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400">
            {fieldDashboardMetrics.engineersTraveling}
          </div>
        </div>

        <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400">
            On Site Working
          </div>
          <div className="mt-1 text-lg font-bold font-mono tabular-nums text-orange-600 dark:text-orange-400">
            {fieldDashboardMetrics.engineersOnSite}
          </div>
        </div>

        <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400">
            Open Tasks
          </div>
          <div className="mt-1 text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {fieldDashboardMetrics.openTasks}
          </div>
        </div>

        <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400">
            High-Priority Faults
          </div>
          <div className="mt-1 text-lg font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400">
            {fieldDashboardMetrics.highPriorityIncidents}
          </div>
        </div>

        <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400">
            Avg Response ETA
          </div>
          <div className="mt-1 text-lg font-bold font-mono tabular-nums text-cyan-600 dark:text-cyan-400">
            {fieldDashboardMetrics.avgResponseTimeMin} min
          </div>
        </div>

        <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400">
            Avg Repair Time
          </div>
          <div className="mt-1 text-lg font-bold font-mono tabular-nums text-indigo-600 dark:text-indigo-400">
            {fieldDashboardMetrics.avgRepairTimeMin} min
          </div>
        </div>

        <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400">
            Active Routes / Geo
          </div>
          <div className="mt-1 flex items-baseline gap-1.5 font-mono tabular-nums">
            <span className="text-lg font-bold text-cyan-600 dark:text-cyan-400">
              {fieldDashboardMetrics.activeRoutesCount}
            </span>
            <span className="text-[11px] text-slate-400">
              · {geoFenceEvents.length} ev
            </span>
          </div>
        </div>
      </div>

      {/* Role & Governance Strip */}
      <div className="px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
          <Users className="w-4 h-4 text-cyan-500 shrink-0" />
          <span>
            Operator: <strong>{rolePermissions.label}</strong> ({rolePermissions.actorName})
          </span>
          <span className="text-slate-400">|</span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Manager approval &amp; dispatch control preserved
          </span>
        </div>

        <div className="flex items-center gap-3 font-mono text-[11px] tabular-nums">
          <span className="text-slate-500 dark:text-slate-400">
            Completed: <strong className="text-emerald-600 dark:text-emerald-400">{fieldDashboardMetrics.completedTasksToday}</strong>
          </span>
          <span className="text-slate-500 dark:text-slate-400">
            Geo-Fences: <strong className="text-slate-900 dark:text-white">{geoFences.length}</strong>
          </span>
          <span className="text-slate-500 dark:text-slate-400">
            Evidence: <strong className="text-cyan-600 dark:text-cyan-400">{fieldEvidence.length}</strong>
          </span>
        </div>
      </div>

      {actionMessage && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
            actionMessage.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
              : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
          }`}
        >
          {actionMessage.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Main Content: Mobile Engineer Frame OR 3-Panel Command Center */}
      {mobilePreview ? (
        <div className="max-w-md mx-auto border-4 border-slate-800 dark:border-slate-700 rounded-3xl p-4 bg-slate-50 dark:bg-slate-950 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
            <div>
              <div className="text-[10px] font-mono uppercase text-cyan-600 dark:text-cyan-400 font-bold">
                GridGuard Field App
              </div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                {selectedEngineer?.name || 'Field Engineer'}
              </div>
            </div>
            {selectedEngineer && (
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                  ENGINEER_STATUS_BADGE[selectedEngineer.status]
                }`}
              >
                {selectedEngineer.status}
              </span>
            )}
          </div>

          {activeTask && (
            <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">
                  {activeTask.taskCode}
                </span>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${STATUS_BADGE_CLASS[activeTask.status]}`}>
                  {activeTask.status}
                </span>
              </div>
              <div className="font-semibold text-slate-900 dark:text-white">{activeTask.title}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {activeTask.assetId} · {activeTask.faultLocation}
              </div>
              {activeRoute && (
                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 flex items-center justify-between text-[11px] font-mono tabular-nums">
                  <span className="text-blue-700 dark:text-blue-300">
                    ETA {activeRoute.etaMinutes} min · {activeRoute.remainingDistanceKm.toFixed(2)} km
                  </span>
                  <button
                    type="button"
                    onClick={handleStepGpsRoute}
                    disabled={steppingRoute}
                    className="px-2 py-0.5 rounded bg-blue-600 text-white font-semibold cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Step GPS
                  </button>
                </div>
              )}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {activeTask.status === 'ASSIGNED' && (
                  <button
                    type="button"
                    onClick={() => handleTaskStatusChange('ACCEPTED')}
                    className="flex-1 py-1.5 px-2.5 rounded-lg bg-cyan-600 text-white font-semibold cursor-pointer"
                  >
                    Accept Assignment
                  </button>
                )}
                {(activeTask.status === 'ACCEPTED' || activeTask.status === 'ASSIGNED') && (
                  <button
                    type="button"
                    onClick={() => handleTaskStatusChange('TRAVELING')}
                    className="flex-1 py-1.5 px-2.5 rounded-lg bg-blue-600 text-white font-semibold cursor-pointer"
                  >
                    Start Navigation
                  </button>
                )}
                {activeTask.status === 'TRAVELING' && (
                  <button
                    type="button"
                    onClick={() => handleTaskStatusChange('ON_SITE')}
                    className="flex-1 py-1.5 px-2.5 rounded-lg bg-orange-600 text-white font-semibold cursor-pointer"
                  >
                    Check-In On Site
                  </button>
                )}
                {(activeTask.status === 'ON_SITE' ||
                  activeTask.status === 'INSPECTION' ||
                  activeTask.status === 'REPAIR' ||
                  activeTask.status === 'IN_PROGRESS') && (
                  <button
                    type="button"
                    onClick={() => handleTaskStatusChange('COMPLETED')}
                    className="flex-1 py-1.5 px-2.5 rounded-lg bg-emerald-600 text-white font-semibold cursor-pointer"
                  >
                    Complete Repair
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Compact Mobile Evidence Capture */}
          {activeTask && (
            <form
              onSubmit={handleEvidenceSubmit}
              className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2.5 text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-cyan-500" />
                  <span>Quick Evidence Capture</span>
                </span>
                <button
                  type="button"
                  onClick={handleAttachSamplePhoto}
                  className="text-[11px] font-mono text-cyan-600 dark:text-cyan-400 cursor-pointer"
                >
                  + Stage Capture
                </button>
              </div>
              <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                {evFileName || 'No photo staged'}
              </div>
              <textarea
                rows={2}
                value={evNotes}
                onChange={(e) => setEvNotes(e.target.value)}
                placeholder="Field repair notes..."
                className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              />
              <button
                type="submit"
                className="w-full py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold cursor-pointer"
              >
                Upload Geo-Tagged Evidence
              </button>
            </form>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Mobile / Tablet Section Switcher (Map First on Mobile, Preserves 3-col on lg+) */}
          <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/70 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileSection('map')}
              className={`min-h-[44px] px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                mobileSection === 'map'
                  ? 'bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Live Map
            </button>
            <button
              type="button"
              onClick={() => setMobileSection('crew')}
              className={`min-h-[44px] px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                mobileSection === 'crew'
                  ? 'bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Crew &amp; Dispatch
            </button>
            <button
              type="button"
              onClick={() => setMobileSection('task')}
              className={`min-h-[44px] px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                mobileSection === 'task'
                  ? 'bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Task &amp; Evidence
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* LEFT PANEL (25% -> col-span-3): Engineers Roster + Intelligent Dispatch + Task Queue */}
          <div className={`${mobileSection === 'crew' ? 'block' : 'hidden'} lg:block lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-3`}>
            {/* Left Tabs */}
            <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setLeftTab('engineers')}
                className={`py-1.5 px-1 rounded-md text-center whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  leftTab === 'engineers'
                    ? 'bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Crew ({fieldEngineers.length})
              </button>
              <button
                type="button"
                onClick={() => setLeftTab('dispatch')}
                className={`py-1.5 px-1 rounded-md text-center whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  leftTab === 'dispatch'
                    ? 'bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                AI Dispatch
              </button>
              <button
                type="button"
                onClick={() => setLeftTab('tasks')}
                className={`py-1.5 px-1 rounded-md text-center whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  leftTab === 'tasks'
                    ? 'bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Tasks ({fieldTasks.length})
              </button>
            </div>

            {leftTab === 'engineers' && (
              <div className="space-y-2.5">
                {/* Status Filter */}
                <div className="flex flex-wrap gap-1">
                  {(['ALL', 'AVAILABLE', 'TRAVELING', 'WORKING', 'ON_BREAK', 'OFFLINE'] as const).map(
                    (st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setEngineerStatusFilter(st)}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                          engineerStatusFilter === st
                            ? 'bg-cyan-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {st}
                      </button>
                    )
                  )}
                </div>

                <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
                  {filteredEngineers.map((eng) => {
                    const isSelected = selectedEngineer?.engineerId === eng.engineerId;
                    const route = engineerRoutes.find((r) => r.engineerId === eng.engineerId);
                    return (
                      <button
                        key={eng.engineerId}
                        type="button"
                        onClick={() => handleSelectEngineer(eng)}
                        className={`w-full text-left p-2.5 rounded-lg border transition-all cursor-pointer space-y-1.5 ${
                          isSelected
                            ? 'border-cyan-500 bg-cyan-50/40 dark:bg-cyan-950/20 ring-1 ring-cyan-500'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${ENGINEER_DOT_CLASS[eng.status]}`}
                            />
                            <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {eng.name.replace(' (Field Engineer)', '')}
                            </span>
                          </div>
                          <span
                            className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold whitespace-nowrap shrink-0 ${
                              ENGINEER_STATUS_BADGE[eng.status]
                            }`}
                          >
                            {eng.status}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400">
                          <span>{eng.employeeId}</span>
                          <span className="flex items-center gap-1 tabular-nums">
                            <BatteryCharging className="w-3 h-3 text-emerald-500" />
                            <span>{eng.batteryPct}%</span>
                            <span>·</span>
                            {eng.networkStatus === 'OFFLINE' ? (
                              <WifiOff className="w-3 h-3 text-slate-400" />
                            ) : (
                              <Wifi className="w-3 h-3 text-cyan-500" />
                            )}
                            <span>{eng.networkStatus}</span>
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                          {eng.assignedArea} · {eng.state}
                        </div>

                        {eng.currentTaskCode ? (
                          <div className="flex items-center justify-between text-[10px] font-mono bg-slate-50 dark:bg-slate-800/60 px-2 py-1 rounded border border-slate-200 dark:border-slate-700/70 tabular-nums">
                            <span className="text-cyan-600 dark:text-cyan-400 font-semibold truncate">
                              {eng.currentTaskCode} → {eng.currentAssetId}
                            </span>
                            {route && (
                              <span className="text-blue-600 dark:text-blue-400 shrink-0 ml-1">
                                {route.etaMinutes}m
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="text-[10px] font-mono text-slate-400">
                            Idle · Ready for intelligent assignment
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {leftTab === 'dispatch' && (
              <div className="space-y-3 text-xs">
                <div className="p-2.5 rounded-lg bg-cyan-50/50 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-900/60 space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-cyan-800 dark:text-cyan-300">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Intelligent Engineer Recommendation</span>
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-slate-500 dark:text-slate-400 block mb-1">
                      Target Fault / Asset
                    </label>
                    <select
                      value={dispatchAssetId}
                      onChange={(e) => setDispatchAssetId(e.target.value)}
                      className="w-full p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                    >
                      {dispatchCandidates.slice(0, 20).map((asset) => {
                        const hasFault = faults.some(
                          (f) => f.affectedAssetId === asset.canonicalId && f.status !== 'RESTORED'
                        );
                        return (
                          <option key={asset.canonicalId} value={asset.canonicalId}>
                            {hasFault ? '[FAULT] ' : ''}
                            {asset.canonicalId} · {asset.area}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-slate-500 dark:text-slate-400 block mb-1">
                      Dispatch Priority
                    </label>
                    <select
                      value={dispatchPriority}
                      onChange={(e) => setDispatchPriority(e.target.value as PriorityLevel)}
                      className="w-full p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                    >
                      <option value="CRITICAL">CRITICAL</option>
                      <option value="HIGH">HIGH</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="LOW">LOW</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                  {engineerRecommendations.map((rec) => (
                    <div
                      key={rec.engineerId}
                      className={`p-2.5 rounded-lg border space-y-1.5 ${
                        rec.recommended
                          ? 'border-emerald-500/60 bg-emerald-50/40 dark:bg-emerald-950/20'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="font-bold text-slate-900 dark:text-white truncate">
                          {rec.name.replace(' (Field Engineer)', '')}
                        </span>
                        {rec.recommended ? (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-600 text-white font-bold whitespace-nowrap shrink-0">
                            BEST MATCH
                          </span>
                        ) : (
                          <span
                            className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold whitespace-nowrap shrink-0 ${
                              ENGINEER_STATUS_BADGE[rec.status]
                            }`}
                          >
                            {rec.status}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-1 text-[10px] font-mono tabular-nums text-slate-600 dark:text-slate-300">
                        <span>{rec.distanceKm.toFixed(1)} km</span>
                        <span>~{rec.etaMinutes} min ETA</span>
                        <span className="text-right font-bold text-cyan-600 dark:text-cyan-400">
                          {rec.skillMatchPct}% skill
                        </span>
                      </div>

                      <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
                        {rec.reason}
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <span className="text-[10px] font-mono text-slate-400 tabular-nums">
                          Score: {rec.compositeScore}/100 · Load: {rec.workloadCount}
                        </span>
                        {rolePermissions.canAssignFieldTask && (
                          <button
                            type="button"
                            disabled={dispatchingId === rec.engineerId || rec.status === 'OFFLINE'}
                            onClick={() => handleIntelligentDispatch(rec.engineerId)}
                            className="px-2.5 py-1 text-[11px] font-semibold rounded-md bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            {dispatchingId === rec.engineerId ? 'Dispatching...' : 'Dispatch'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {leftTab === 'tasks' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-1.5">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as 'ALL' | FieldTaskStatus)}
                    className="w-full p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-mono"
                  >
                    <option value="ALL">ALL STATUSES ({fieldTasks.length})</option>
                    {(['ASSIGNED', 'ACCEPTED', 'TRAVELING', 'ON_SITE', 'INSPECTION', 'REPAIR', 'VERIFICATION', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'VERIFIED'] as const).map(
                      (st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      )
                    )}
                  </select>
                </div>

                {currentRole === 'FIELD_ENGINEER' && (
                  <button
                    type="button"
                    onClick={() => setMyTeamOnly((v) => !v)}
                    className={`w-full px-2.5 py-1 rounded-lg text-[11px] font-mono border cursor-pointer ${
                      myTeamOnly
                        ? 'bg-cyan-600 text-white border-cyan-500'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {myTeamOnly ? 'Showing: My Assigned Tasks' : 'Filter: My Assigned Tasks'}
                  </button>
                )}

                <div className="space-y-2 max-h-[590px] overflow-y-auto pr-1">
                  {filteredTasks.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                      No field tasks match the active filter.
                    </div>
                  ) : (
                    filteredTasks.map((task) => {
                      const isSelected = activeTask?.id === task.id;
                      return (
                        <button
                          key={task.id}
                          type="button"
                          onClick={() => {
                            setActiveTaskId(task.id);
                            if (task.engineerId) {
                              setSelectedEngineerId(task.engineerId);
                              setFocusEngineerNonce((n) => n + 1);
                            }
                            setActionMessage(null);
                          }}
                          className={`w-full text-left p-2.5 rounded-lg border transition-all cursor-pointer ${
                            isSelected
                              ? 'border-cyan-500 bg-cyan-50/40 dark:bg-cyan-950/20 ring-1 ring-cyan-500'
                              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5 mb-1">
                            <div className="flex items-center gap-1 min-w-0">
                              <span className="font-mono text-[11px] font-bold text-slate-900 dark:text-white truncate">
                                {task.taskCode}
                              </span>
                              <SourceBadge source={task.source} compact />
                            </div>
                            <span
                              className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold whitespace-nowrap shrink-0 ${
                                STATUS_BADGE_CLASS[task.status]
                              }`}
                            >
                              {task.status}
                            </span>
                          </div>
                          <div className="text-xs font-medium text-slate-800 dark:text-slate-200 line-clamp-2">
                            {task.title}
                          </div>
                          <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400 gap-2">
                            <span className="truncate">{task.assetId}</span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-semibold whitespace-nowrap shrink-0 ${
                                PRIORITY_BADGE_CLASS[task.priority]
                              }`}
                            >
                              {task.priority}
                            </span>
                          </div>
                          <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400 truncate">
                            {task.assignedEngineer.replace(' (Field Engineer)', '')} · {task.area}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* CENTER PANEL (55% -> col-span-6): Live Mapbox Map + Incident Timeline + Geo-Fence Feed */}
          <div className={`${mobileSection === 'map' ? 'block' : 'hidden'} lg:block lg:col-span-6 space-y-4`}>
            <GridMapComponent
              heightClass="h-[340px] sm:h-[440px] lg:h-[500px]"
              showFieldWorkforce
              focusEngineerNonce={focusEngineerNonce}
              onSelectEngineer={(eng) => handleSelectEngineer(eng)}
            />

            {/* Bottom Sync Panel: Live Incident Timeline & Geo-Fence Events */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCenterSubTab('timeline')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                      centerSubTab === 'timeline'
                        ? 'bg-cyan-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span>Live Incident Timeline</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCenterSubTab('geofences')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                      centerSubTab === 'geofences'
                        ? 'bg-cyan-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <Compass className="w-3.5 h-3.5" />
                    <span>Geo-Fence Events ({geoFenceEvents.length})</span>
                  </button>
                </div>

                {activeTask && (
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    Tracking: <strong className="text-cyan-600 dark:text-cyan-400">{activeTask.taskCode}</strong> · {activeTask.assetId}
                  </span>
                )}
              </div>

              {centerSubTab === 'timeline' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[260px] overflow-y-auto pr-1">
                  {liveIncidentTimeline.map((step, idx) => (
                    <div
                      key={step.id}
                      className={`p-2.5 rounded-lg border text-xs space-y-1 ${
                        step.status === 'COMPLETED'
                          ? 'bg-emerald-50/40 dark:bg-emerald-950/15 border-emerald-200 dark:border-emerald-900/50'
                          : step.status === 'ACTIVE'
                            ? 'bg-cyan-50/50 dark:bg-cyan-950/20 border-cyan-300 dark:border-cyan-800'
                            : 'bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 opacity-75'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span className="font-mono text-[10px] text-slate-400 tabular-nums">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <span>{step.label}</span>
                        </span>
                        <span
                          className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold whitespace-nowrap shrink-0 ${
                            step.status === 'COMPLETED'
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                              : step.status === 'ACTIVE'
                                ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {step.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
                        {step.detail}
                      </p>
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 tabular-nums">
                        <span className="truncate">{step.actor}</span>
                        <span>{step.timestamp ? step.timestamp.slice(11, 19) + ' UTC' : 'Pending'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                  {geoFenceEvents.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400 py-6 text-center">
                      No geo-fence transitions recorded yet. Step an active engineer route to trigger automatic arrival alerts.
                    </p>
                  ) : (
                    geoFenceEvents.map((ev) => (
                      <div
                        key={ev.id}
                        className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold whitespace-nowrap shrink-0 ${
                                GEOFENCE_EVENT_BADGE[ev.eventType]
                              }`}
                            >
                              {ev.eventType}
                            </span>
                            <span className="font-semibold text-slate-900 dark:text-white truncate">
                              {ev.engineerName.replace(' (Field Engineer)', '')}
                            </span>
                            <span className="font-mono text-[11px] text-cyan-600 dark:text-cyan-400">
                              {ev.assetId}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-300">{ev.summary}</p>
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 tabular-nums shrink-0 text-right">
                          <div>{ev.distanceToCenterMeters}m from center</div>
                          <div>{ev.timestamp.slice(11, 19)} UTC</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT PANEL (20% -> col-span-3): Engineer Details, Route ETA, Task Lifecycle & Evidence */}
          <div className={`${mobileSection === 'task' ? 'block' : 'hidden'} lg:block lg:col-span-3 space-y-4`}>
            {/* Selected Engineer Telemetry Card */}
            {selectedEngineer && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3 text-xs">
                <div className="flex items-start justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
                  <div className="min-w-0">
                    <div className="text-[10px] font-mono uppercase text-slate-400">
                      {selectedEngineer.employeeId} · {selectedEngineer.engineerId}
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {selectedEngineer.name.replace(' (Field Engineer)', '')}
                    </h3>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {selectedEngineer.team}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold whitespace-nowrap shrink-0 ${
                      ENGINEER_STATUS_BADGE[selectedEngineer.status]
                    }`}
                  >
                    {selectedEngineer.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono tabular-nums">
                  <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                    <span className="text-[9px] text-slate-400 block">GPS LOCK</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {selectedEngineer.latitude.toFixed(4)}, {selectedEngineer.longitude.toFixed(4)}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                    <span className="text-[9px] text-slate-400 block">SPEED / NET / BAT</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {Math.round(selectedEngineer.speedKmh)} km/h · {selectedEngineer.networkStatus} · {selectedEngineer.batteryPct}%
                    </span>
                  </div>
                </div>

                <div className="space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-1.5 truncate">
                    <Phone className="w-3 h-3 text-cyan-500 shrink-0" />
                    <span className="font-mono tabular-nums">{selectedEngineer.phone}</span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate">
                    <Mail className="w-3 h-3 text-cyan-500 shrink-0" />
                    <span className="truncate">{selectedEngineer.email}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 tabular-nums">
                    <Clock className="w-3 h-3 shrink-0" />
                    <span>Updated {selectedEngineer.lastLocationUpdate.slice(11, 19)} UTC</span>
                  </div>
                </div>

                {/* Active Route Card */}
                {activeRoute && (
                  <div className="p-2.5 rounded-lg bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-blue-800 dark:text-blue-300">
                      <span className="flex items-center gap-1">
                        <Route className="w-3.5 h-3.5" />
                        <span>Live Navigation Route</span>
                      </span>
                      <span className="font-mono tabular-nums">{activeRoute.etaMinutes} min ETA</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-blue-200 dark:bg-blue-900 overflow-hidden">
                      <div
                        className="h-full bg-blue-600 dark:bg-blue-400 transition-all"
                        style={{ width: `${activeRoute.progressPct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-600 dark:text-slate-300 tabular-nums">
                      <span>{activeRoute.remainingDistanceKm.toFixed(2)} km left</span>
                      <span>{activeRoute.progressPct}% · {activeRoute.provider === 'MAPBOX_DIRECTIONS' ? 'Mapbox' : 'Corridor'}</span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={handleStepGpsRoute}
                    disabled={steppingRoute || !activeRoute}
                    className="py-1.5 px-2 text-[11px] font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white inline-flex items-center justify-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Navigation className="w-3 h-3" />
                    <span>{steppingRoute ? 'Stepping...' : 'Step GPS'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openKnowledgeGraphForEngineer(selectedEngineer.engineerId)}
                    className="py-1.5 px-2 text-[11px] font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 inline-flex items-center justify-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Network className="w-3 h-3 text-cyan-500" />
                    <span>Graph Chain</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleEngineerOffline(selectedEngineer)}
                    className="col-span-2 py-1 px-2 text-[10px] font-mono rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-cyan-500 cursor-pointer"
                  >
                    {selectedEngineer.status === 'OFFLINE' ? 'Restore Telemetry Online' : 'Simulate Connection Loss (Offline)'}
                  </button>
                </div>
              </div>
            )}

            {/* Active Task Execution & Lifecycle Stepper */}
            {activeTask && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3 text-xs">
                <div className="flex items-start justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">
                        {activeTask.taskCode}
                      </span>
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${STATUS_BADGE_CLASS[activeTask.status]}`}>
                        {activeTask.status}
                      </span>
                    </div>
                    <h4 className="font-bold text-slate-900 dark:text-white mt-0.5 line-clamp-2">
                      {activeTask.title}
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => focusAssetOnMap(activeTask.assetId)}
                    className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/20 shrink-0 cursor-pointer"
                    title="Fly Map to Asset"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Safety Box */}
                <div className="p-2.5 rounded-lg bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 space-y-1">
                  <div className="font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1 text-[11px]">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Safety &amp; LOTO</span>
                  </div>
                  <p className="text-[11px] text-amber-800 dark:text-amber-200 leading-snug">
                    {activeTask.safetyNotes}
                  </p>
                </div>

                {/* Manager Reassign */}
                {rolePermissions.canAssignFieldTask && activeTask.status !== 'VERIFIED' && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowReassign((v) => !v)}
                      className="text-[11px] font-medium text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                    >
                      {showReassign ? 'Hide Reassignment' : 'Reassign Engineer / Priority'}
                    </button>
                    {showReassign && (
                      <form onSubmit={handleReassignSubmit} className="mt-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
                        <select
                          value={reassignEngineerId}
                          onChange={(e) => {
                            setReassignEngineerId(e.target.value);
                            const eng = fieldEngineers.find((p) => p.engineerId === e.target.value);
                            if (eng) setReassignTeam(eng.team);
                          }}
                          className="w-full p-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px]"
                        >
                          {fieldEngineers.map((eng) => (
                            <option key={eng.engineerId} value={eng.engineerId}>
                              {eng.name} ({eng.status})
                            </option>
                          ))}
                        </select>
                        <div className="grid grid-cols-2 gap-1.5">
                          <select
                            value={reassignPriority}
                            onChange={(e) => setReassignPriority(e.target.value as PriorityLevel)}
                            className="p-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px]"
                          >
                            <option value="CRITICAL">CRITICAL</option>
                            <option value="HIGH">HIGH</option>
                            <option value="MEDIUM">MEDIUM</option>
                            <option value="LOW">LOW</option>
                          </select>
                          <button
                            type="submit"
                            className="px-2.5 py-1 rounded bg-cyan-600 text-white font-semibold text-[11px] cursor-pointer"
                          >
                            Save
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}

                {/* Lifecycle Stepper Controls */}
                {activeTask.status !== 'VERIFIED' && (
                  <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <input
                      type="text"
                      value={statusNotes}
                      onChange={(e) => setStatusNotes(e.target.value)}
                      placeholder="Stage transition / repair note..."
                      className="w-full text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {activeTask.status === 'ASSIGNED' && (
                        <button
                          type="button"
                          onClick={() => handleTaskStatusChange('ACCEPTED')}
                          className="px-2.5 py-1 text-[11px] font-semibold rounded-md bg-sky-600 hover:bg-sky-500 text-white inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <UserCheck className="w-3 h-3" />
                          <span>Accept</span>
                        </button>
                      )}
                      {(['ASSIGNED', 'ACCEPTED', 'PAUSED'] as const).includes(activeTask.status as 'ASSIGNED' | 'ACCEPTED' | 'PAUSED') && (
                        <button
                          type="button"
                          onClick={() => handleTaskStatusChange('TRAVELING')}
                          className="px-2.5 py-1 text-[11px] font-semibold rounded-md bg-blue-600 hover:bg-blue-500 text-white inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Play className="w-3 h-3" />
                          <span>Travel</span>
                        </button>
                      )}
                      {WORKFLOW_STAGE_ORDER.includes(activeTask.status) &&
                        activeTask.status !== 'COMPLETED' && (
                          <>
                            {activeTask.status === 'TRAVELING' && (
                              <button
                                type="button"
                                onClick={() => handleTaskStatusChange('ON_SITE')}
                                className="px-2.5 py-1 text-[11px] font-semibold rounded-md bg-orange-600 hover:bg-orange-500 text-white whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                Arrived On Site
                              </button>
                            )}
                            {(activeTask.status === 'ON_SITE' || activeTask.status === 'IN_PROGRESS') && (
                              <button
                                type="button"
                                onClick={() => handleTaskStatusChange('INSPECTION')}
                                className="px-2.5 py-1 text-[11px] font-semibold rounded-md bg-violet-600 hover:bg-violet-500 text-white whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                Start Inspection
                              </button>
                            )}
                            {activeTask.status === 'INSPECTION' && (
                              <button
                                type="button"
                                onClick={() => handleTaskStatusChange('REPAIR')}
                                className="px-2.5 py-1 text-[11px] font-semibold rounded-md bg-fuchsia-600 hover:bg-fuchsia-500 text-white whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                Begin Repair
                              </button>
                            )}
                            {activeTask.status === 'REPAIR' && (
                              <button
                                type="button"
                                onClick={() => handleTaskStatusChange('VERIFICATION')}
                                className="px-2.5 py-1 text-[11px] font-semibold rounded-md bg-teal-600 hover:bg-teal-500 text-white whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                Final Check
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleTaskStatusChange('PAUSED')}
                              className="px-2 py-1 text-[11px] font-semibold rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <Pause className="w-3 h-3" />
                              <span>Pause</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleTaskStatusChange('COMPLETED')}
                              className="px-2.5 py-1 text-[11px] font-semibold rounded-md bg-emerald-600 hover:bg-emerald-500 text-white inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Complete</span>
                            </button>
                          </>
                        )}
                    </div>
                  </div>
                )}

                {linkedDecision && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveView('decisions')}
                      className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <FileCheck2 className="w-3.5 h-3.5" />
                      <span>Decision: {linkedDecision.decisionCode}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openKnowledgeGraphForAsset(activeTask.assetId)}
                      className="text-[11px] font-mono text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                    >
                      Asset Graph
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Compact Field Evidence Upload & Log */}
            {activeTask && (
              <form
                onSubmit={handleEvidenceSubmit}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3 text-xs"
              >
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-cyan-500" />
                    <span>Evidence Capture</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleAttachSamplePhoto}
                    className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    + Stage Capture
                  </button>
                </div>

                <label className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 cursor-pointer hover:border-cyan-500">
                  <div className="flex items-center gap-2 min-w-0">
                    <Upload className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                    <span className="truncate text-slate-700 dark:text-slate-200 font-mono text-[10px]">
                      {evFileName
                        ? `${evFileName} (${Math.round(evFileSize / 1024)} KB)`
                        : 'Select PNG, JPG, WEBP, PDF...'}
                    </span>
                  </div>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,application/pdf"
                    onChange={handleFileSelected}
                    className="hidden"
                  />
                </label>

                {evPreviewUrl && (
                  <img
                    src={evPreviewUrl}
                    alt="Evidence preview"
                    className="h-20 w-full object-cover rounded-lg border border-slate-200 dark:border-slate-700"
                  />
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-mono text-slate-500 block mb-0.5">GPS Lat</label>
                    <input
                      type="number"
                      step="0.00001"
                      value={evLat}
                      onChange={(e) => setEvLat(e.target.value)}
                      className="w-full p-1.5 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[11px] tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-slate-500 block mb-0.5">GPS Lon</label>
                    <input
                      type="number"
                      step="0.00001"
                      value={evLon}
                      onChange={(e) => setEvLon(e.target.value)}
                      className="w-full p-1.5 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[11px] tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-slate-500 block mb-0.5">Result</label>
                    <select
                      value={evResult}
                      onChange={(e) => setEvResult(e.target.value as FieldEvidence['inspectionResult'])}
                      className="w-full p-1.5 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px]"
                    >
                      <option value="PASS">PASS</option>
                      <option value="REPAIR_COMPLETED">REPAIR_COMPLETED</option>
                      <option value="FURTHER_WORK_REQUIRED">FURTHER_WORK_REQUIRED</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-slate-500 block mb-0.5">Condition</label>
                    <select
                      value={evCondition}
                      onChange={(e) => setEvCondition(e.target.value as FieldEvidence['equipmentCondition'])}
                      className="w-full p-1.5 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px]"
                    >
                      <option value="GOOD">GOOD</option>
                      <option value="DEGRADED">DEGRADED</option>
                      <option value="REPLACED">REPLACED</option>
                      <option value="FAULTED">FAULTED</option>
                    </select>
                  </div>
                </div>

                {/* Meter Readings */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <div>
                    <label className="text-[9px] font-mono text-slate-400 block">kV</label>
                    <input
                      type="number"
                      step="0.01"
                      value={evVoltageKv}
                      onChange={(e) => setEvVoltageKv(e.target.value)}
                      className="w-full min-h-[44px] lg:min-h-0 p-1.5 lg:p-1 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[11px] tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-mono text-slate-400 block">Amps</label>
                    <input
                      type="number"
                      value={evLoadAmps}
                      onChange={(e) => setEvLoadAmps(e.target.value)}
                      className="w-full min-h-[44px] lg:min-h-0 p-1.5 lg:p-1 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[11px] tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-mono text-slate-400 block">MΩ</label>
                    <input
                      type="number"
                      value={evInsulationMohm}
                      onChange={(e) => setEvInsulationMohm(e.target.value)}
                      className="w-full min-h-[44px] lg:min-h-0 p-1.5 lg:p-1 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[11px] tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-mono text-slate-400 block">°C</label>
                    <input
                      type="number"
                      step="0.1"
                      value={evTemperatureC}
                      onChange={(e) => setEvTemperatureC(e.target.value)}
                      className="w-full min-h-[44px] lg:min-h-0 p-1.5 lg:p-1 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[11px] tabular-nums"
                    />
                  </div>
                </div>

                {/* Optional Video / Voice Note Metadata */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  <div className="relative">
                    <Video className="w-3 h-3 text-slate-400 absolute left-2 top-2" />
                    <input
                      type="text"
                      value={evVideoFileName}
                      onChange={(e) => setEvVideoFileName(e.target.value)}
                      placeholder="Video clip (optional)"
                      className="w-full pl-6 pr-2 py-1 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px]"
                    />
                  </div>
                  <div className="relative">
                    <Mic className="w-3 h-3 text-slate-400 absolute left-2 top-2" />
                    <input
                      type="text"
                      value={evVoiceSummary}
                      onChange={(e) => setEvVoiceSummary(e.target.value)}
                      placeholder="Voice note (optional)"
                      className="w-full pl-6 pr-2 py-1 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px]"
                    />
                  </div>
                </div>

                <textarea
                  rows={2}
                  value={evNotes}
                  onChange={(e) => setEvNotes(e.target.value)}
                  placeholder="Inspection findings & repair notes..."
                  className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px]"
                />

                <button
                  type="submit"
                  className="w-full py-1.5 text-xs font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Evidence ({activeTaskEvidence.length} logged)</span>
                </button>

                {activeTaskEvidence.length > 0 && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2 max-h-[200px] overflow-y-auto pr-1">
                    <div className="text-[10px] font-mono uppercase text-slate-400 flex items-center gap-1">
                      <FileText className="w-3 h-3 text-cyan-500" />
                      <span>Submitted Evidence</span>
                    </div>
                    {activeTaskEvidence.map((ev) => (
                      <div
                        key={ev.id}
                        className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1 text-[11px]"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono font-bold text-slate-900 dark:text-white truncate">
                            {ev.fileName}
                          </span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                            {ev.inspectionResult}
                          </span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 line-clamp-2">{ev.notes}</p>
                        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 tabular-nums">
                          <span className="flex items-center gap-1">
                            <Gauge className="w-3 h-3 text-cyan-500" />
                            {ev.meterReadings.voltageKv ?? 'N/A'}kV / {ev.meterReadings.loadAmps ?? 'N/A'}A
                          </span>
                          <span>{ev.uploadedAt.slice(11, 19)} UTC</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </form>
            )}
          </div>
          </div>
        </div>
      )}

      {/* Create Field Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <form
            onSubmit={handleCreateTask}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-[calc(100vw-1.5rem)] sm:w-full max-h-[90dvh] overflow-y-auto p-4 sm:p-6 space-y-4 shadow-2xl text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Assign New Field Inspection &amp; Execution Task
              </h3>
              <button
                type="button"
                aria-label="Close modal"
                onClick={() => setShowCreateModal(false)}
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="font-semibold text-slate-800 dark:text-slate-200 block mb-1">
                  Linked Decision Proposal
                </label>
                <select
                  value={newTaskDecisionId}
                  onChange={(e) => setNewTaskDecisionId(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                >
                  {decisions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.decisionCode} · {d.targetAssetId} ({d.status})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-semibold text-slate-800 dark:text-slate-200 block mb-1">
                  Assigned Field Engineer
                </label>
                <select
                  value={newTaskEngineerId}
                  onChange={(e) => {
                    setNewTaskEngineerId(e.target.value);
                    const eng = fieldEngineers.find((p) => p.engineerId === e.target.value);
                    if (eng) setNewTaskTeam(eng.team);
                  }}
                  className="w-full p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                >
                  {fieldEngineers.map((eng) => (
                    <option key={eng.engineerId} value={eng.engineerId}>
                      {eng.name} ({eng.status})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-semibold text-slate-800 dark:text-slate-200 block mb-1">
                  Assigned Crew / Team
                </label>
                <input
                  type="text"
                  value={newTaskTeam}
                  onChange={(e) => setNewTaskTeam(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-800 dark:text-slate-200 block mb-1">
                    Priority
                  </label>
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value as PriorityLevel)}
                    className="w-full min-h-[44px] lg:min-h-0 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  >
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-800 dark:text-slate-200 block mb-1">
                    Due Date &amp; Time
                  </label>
                  <input
                    type="datetime-local"
                    value={newTaskDueDate}
                    onChange={(e) => setNewTaskDueDate(e.target.value)}
                    className="w-full min-h-[44px] lg:min-h-0 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>
              </div>
              <div>
                <label className="font-semibold text-slate-800 dark:text-slate-200 block mb-1">
                  Safety Notes
                </label>
                <textarea
                  rows={2}
                  value={newTaskSafety}
                  onChange={(e) => setNewTaskSafety(e.target.value)}
                  placeholder="Optional lockout/tagout & PPE requirements..."
                  className="w-full p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="w-full sm:w-auto min-h-[44px] lg:min-h-0 px-4 py-2 text-slate-600 dark:text-slate-300 cursor-pointer rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="w-full sm:w-auto min-h-[44px] lg:min-h-0 px-4 py-2 font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg cursor-pointer"
              >
                Dispatch Field Task
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
