'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  Shield,
  LogOut,
  RefreshCw,
  Phone,
  Clock,
  Users,
  AlertTriangle,
  HeartPulse,
  Flame,
  CheckCircle2,
  Navigation,
  UserCheck,
  ChevronRight,
  Filter,
  XCircle,
  MapPin,
  Send,
  FileText,
} from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/browser';
import {
  PriorityLevel,
  RescueCaseStatus,
  ImmediateDangerSituation,
  InjuryLevel,
  DisasterType,
  ResponderRole,
} from '@/lib/types/emergency';
import { STATUS_DESCRIPTIONS } from '@/lib/constants/emergency';
import type { MapCaseItem } from '@/components/responder/ResponderMap';

// Dynamically import ResponderMap with SSR disabled (Leaflet requirement)
const ResponderMap = dynamic(() => import('@/components/responder/ResponderMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[300px] flex items-center justify-center bg-slate-900 text-slate-400 font-mono text-xs rounded-xl border border-slate-800">
      Loading OpenStreetMap Leaflet Engine...
    </div>
  ),
});

interface CaseSummary {
  id: string;
  case_number: string;
  priority: PriorityLevel;
  status: RescueCaseStatus;
  people_count: number;
  trapped_status: ImmediateDangerSituation;
  injury_level: InjuryLevel;
  disaster_type: DisasterType;
  disaster_other: string | null;
  latitude: number | null;
  longitude: number | null;
  location_accuracy: number | null;
  location_source: string;
  manual_location_description: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

interface CaseDetailFull extends CaseSummary {
  description: string | null;
  phone_number: string | null;
  assignedResponderInfo?: {
    id: string;
    full_name: string;
    organization: string | null;
    role: ResponderRole;
  } | null;
  auditHistory?: Array<{
    id: string;
    created_at: string;
    actor_user_id: string | null;
    event_type: string;
    old_status: string | null;
    new_status: string | null;
    notes: string | null;
  }>;
}

export default function ResponderOperationsPage() {
  const router = useRouter();
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [currentProfile, setCurrentProfile] = useState<{
    id: string;
    fullName: string;
    role: ResponderRole;
    organization: string | null;
  } | null>(null);

  // Operational State
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedCaseDetail, setSelectedCaseDetail] = useState<CaseDetailFull | null>(null);

  // Filters & Views
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ACTIVE');
  const [mobileTab, setMobileTab] = useState<'queue' | 'map' | 'detail'>('queue');

  // Loading & Action states
  const [isLoadingQueue, setIsLoadingQueue] = useState<boolean>(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Cancellation Modal State
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [cancelReasonType, setCancelReasonType] = useState<string>('duplicate');
  const [cancelReasonDetails, setCancelReasonDetails] = useState<string>('');

  // 1. Initial Authentication & Profile Retrieval
  useEffect(() => {
    async function checkAuth() {
      const {
        data: { session },
      } = await supabaseBrowser.auth.getSession();

      if (!session) {
        router.push('/responder/login');
        return;
      }

      setAuthToken(session.access_token);

      const { data: profile } = await supabaseBrowser
        .from('profiles')
        .select('id, full_name, role, organization')
        .eq('id', session.user.id)
        .maybeSingle();

      if (!profile) {
        await supabaseBrowser.auth.signOut();
        router.push('/responder/login');
        return;
      }

      setCurrentProfile({
        id: profile.id,
        fullName: profile.full_name,
        role: profile.role as ResponderRole,
        organization: profile.organization,
      });
    }

    checkAuth();
  }, [router]);

  // 2. Fetch Queue Cases
  const fetchQueue = useCallback(
    async (isSilent = false) => {
      if (!authToken) return;
      if (!isSilent) setIsLoadingQueue(true);

      try {
        const queryParams = new URLSearchParams();
        if (priorityFilter !== 'ALL') queryParams.set('priority', priorityFilter);
        if (statusFilter !== 'ALL') queryParams.set('status', statusFilter);

        const res = await fetch(`/api/responder/cases?${queryParams.toString()}`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });

        if (res.status === 401 || res.status === 403) {
          router.push('/responder/login');
          return;
        }

        const data = await res.json();
        if (data.success && Array.isArray(data.cases)) {
          setCases(data.cases);
        }
      } catch (err) {
        console.error('Failed to fetch case queue:', err);
      } finally {
        setIsLoadingQueue(false);
      }
    },
    [authToken, priorityFilter, statusFilter, router]
  );

  // 3. Fetch Single Case Detail
  const fetchCaseDetail = useCallback(
    async (caseId: string) => {
      if (!authToken) return;
      setActionError(null);

      try {
        const res = await fetch(`/api/responder/cases/${caseId}`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });

        const data = await res.json();
        if (data.success && data.case) {
          setSelectedCaseDetail(data.case);
        } else {
          setActionError(data.error || 'Unable to load case details.');
        }
      } catch (err) {
        console.error('Failed to fetch case detail:', err);
        setActionError('Failed to communicate with server.');
      }
    },
    [authToken]
  );

  // Trigger queue fetch on auth & filter changes
  useEffect(() => {
    if (authToken) {
      fetchQueue(false);
    }
  }, [authToken, fetchQueue]);

  // Polling fallback every 20 seconds
  useEffect(() => {
    if (!authToken) return;
    const interval = setInterval(() => {
      fetchQueue(true);
      if (selectedCaseId) {
        fetchCaseDetail(selectedCaseId);
      }
    }, 20000);

    return () => clearInterval(interval);
  }, [authToken, fetchQueue, fetchCaseDetail, selectedCaseId]);

  // When a case is selected from queue or map
  const handleSelectCase = (id: string) => {
    setSelectedCaseId(id);
    fetchCaseDetail(id);
    setMobileTab('detail');
  };

  // Workflow Actions
  const handleVerify = async () => {
    if (!selectedCaseId || !authToken) return;
    setActionInProgress('verify');
    setActionError(null);

    try {
      const res = await fetch('/api/responder/case/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ caseId: selectedCaseId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed.');

      await fetchCaseDetail(selectedCaseId);
      await fetchQueue(true);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleAssignToMe = async () => {
    if (!selectedCaseId || !authToken) return;
    setActionInProgress('assign');
    setActionError(null);

    try {
      const res = await fetch('/api/responder/case/assign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ caseId: selectedCaseId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Assignment failed.');

      await fetchCaseDetail(selectedCaseId);
      await fetchQueue(true);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleStatusChange = async (targetStatus: RescueCaseStatus) => {
    if (!selectedCaseId || !authToken) return;

    if (targetStatus === 'RESCUED') {
      const confirmed = window.confirm(
        'Confirm that this rescue mission has been completed on the ground and all individuals are secured.'
      );
      if (!confirmed) return;
    }

    setActionInProgress(targetStatus);
    setActionError(null);

    try {
      const res = await fetch('/api/responder/case/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ caseId: selectedCaseId, targetStatus }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Status change failed.');

      await fetchCaseDetail(selectedCaseId);
      await fetchQueue(true);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Status update failed.');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCaseId || !authToken) return;
    setActionInProgress('cancel');
    setActionError(null);

    try {
      const res = await fetch('/api/responder/case/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          caseId: selectedCaseId,
          reasonType: cancelReasonType,
          reasonDetails: cancelReasonDetails,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Cancellation failed.');

      setShowCancelModal(false);
      setCancelReasonDetails('');
      await fetchCaseDetail(selectedCaseId);
      await fetchQueue(true);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Cancellation failed.');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleSignOut = async () => {
    await supabaseBrowser.auth.signOut();
    localStorage.removeItem('nepal_sar_auth_token');
    router.push('/responder/login');
  };

  // Convert cases to Map markers format
  const mapCases: MapCaseItem[] = useMemo(() => {
    return cases.map((c) => ({
      id: c.id,
      caseNumber: c.case_number,
      latitude: c.latitude,
      longitude: c.longitude,
      priority: c.priority,
      status: c.status,
      peopleCount: c.people_count,
    }));
  }, [cases]);

  // Helper for human-readable time ago
  const formatTimeAgo = (isoString: string) => {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Operations Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="bg-red-600 text-white p-1.5 rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <span className="font-extrabold text-sm sm:text-base tracking-wider uppercase flex items-center gap-2">
              NEPAL SAR OPERATIONS
              <span className="bg-emerald-950 text-emerald-300 border border-emerald-700 text-[10px] font-mono px-2 py-0.5 rounded-full hidden sm:inline">
                LIVE
              </span>
            </span>
            <span className="text-xs text-slate-400 block font-mono">
              {currentProfile?.fullName} &bull; <strong className="text-slate-200">{currentProfile?.role}</strong>{' '}
              {currentProfile?.organization ? `(${currentProfile.organization})` : ''}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => fetchQueue(false)}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 text-xs flex items-center gap-1.5 transition-colors"
            title="Refresh active cases"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingQueue ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={handleSignOut}
            className="p-2 bg-slate-800 hover:bg-red-950 hover:text-red-300 text-slate-300 rounded-lg border border-slate-700 text-xs flex items-center gap-1 transition-colors"
            title="Sign out of operations"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Mobile View Selector */}
      <div className="lg:hidden flex border-b border-slate-800 bg-slate-900 text-xs font-semibold">
        <button
          onClick={() => setMobileTab('queue')}
          className={`flex-1 py-3 text-center border-b-2 flex items-center justify-center gap-1.5 ${
            mobileTab === 'queue' ? 'border-red-500 text-white bg-slate-850' : 'border-transparent text-slate-400'
          }`}
        >
          <span>Queue</span>
          <span className="bg-slate-800 px-2 py-0.5 rounded-full text-[10px] text-slate-300 font-mono">
            {cases.length}
          </span>
        </button>
        <button
          onClick={() => setMobileTab('map')}
          className={`flex-1 py-3 text-center border-b-2 ${
            mobileTab === 'map' ? 'border-red-500 text-white bg-slate-850' : 'border-transparent text-slate-400'
          }`}
        >
          Map View
        </button>
        <button
          onClick={() => setMobileTab('detail')}
          className={`flex-1 py-3 text-center border-b-2 ${
            mobileTab === 'detail' ? 'border-red-500 text-white bg-slate-850' : 'border-transparent text-slate-400'
          }`}
        >
          Case Details
        </button>
      </div>

      {/* Main 3-Column Operations Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden h-[calc(100vh-65px)]">
        {/* COLUMN 1: CASE QUEUE (Desktop: col-span-4, Mobile: tab controlled) */}
        <section
          className={`lg:col-span-4 border-r border-slate-800 flex flex-col bg-slate-950 overflow-hidden ${
            mobileTab === 'queue' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {/* Filters Bar */}
          <div className="p-3 bg-slate-900 border-b border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
              <span className="flex items-center gap-1 font-bold text-slate-200">
                <Filter className="w-3.5 h-3.5" /> TRIAGE QUEUE ({cases.length})
              </span>
              <span className="text-[11px] text-slate-500">Auto-poll 20s</span>
            </div>

            {/* Priority Filters */}
            <div className="flex items-center gap-1 text-[11px] font-semibold">
              {(['ALL', 'CRITICAL', 'HIGH', 'NORMAL'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPriorityFilter(p)}
                  className={`px-2 py-1 rounded border transition-colors ${
                    priorityFilter === p
                      ? 'bg-slate-700 text-white border-slate-500'
                      : 'bg-slate-850 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Status Filters */}
            <div className="flex items-center gap-1 text-[11px] font-semibold overflow-x-auto pb-1">
              {(['ACTIVE', 'SUBMITTED', 'VERIFIED', 'ASSIGNED', 'RESCUER_EN_ROUTE', 'ALL'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2 py-1 rounded border shrink-0 transition-colors ${
                    statusFilter === st
                      ? 'bg-red-950 text-red-300 border-red-700 font-bold'
                      : 'bg-slate-850 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Queue List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-850">
            {cases.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs font-mono space-y-2">
                <CheckCircle2 className="w-8 h-8 mx-auto text-slate-600" />
                <p>No active cases matching current filter.</p>
              </div>
            ) : (
              cases.map((c) => {
                const isSelected = c.id === selectedCaseId;
                const statusInfo = STATUS_DESCRIPTIONS[c.status];

                return (
                  <div
                    key={c.id}
                    onClick={() => handleSelectCase(c.id)}
                    className={`p-3.5 cursor-pointer transition-all hover:bg-slate-900/80 ${
                      isSelected ? 'bg-slate-900 border-l-4 border-red-500' : 'bg-slate-950'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-mono font-black px-2 py-0.5 rounded ${
                            c.priority === 'CRITICAL'
                              ? 'bg-red-950 text-red-300 border border-red-700'
                              : c.priority === 'HIGH'
                              ? 'bg-orange-950 text-orange-300 border border-orange-700'
                              : 'bg-blue-950 text-blue-300 border border-blue-700'
                          }`}
                        >
                          {c.priority}
                        </span>
                        <span className="font-mono font-bold text-sm text-white">{c.case_number}</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {formatTimeAgo(c.created_at)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1 text-xs text-slate-300 mb-2">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-slate-500" />
                        <strong>{c.people_count}</strong> {c.people_count === 1 ? 'person' : 'people'}
                      </span>
                      <span className="flex items-center gap-1 uppercase font-mono text-[11px] text-amber-300">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        {c.trapped_status}
                      </span>
                      <span className="flex items-center gap-1 font-mono text-[11px] text-slate-400">
                        <Flame className="w-3.5 h-3.5 text-orange-400" />
                        {c.disaster_type}
                      </span>
                      <span className="flex items-center gap-1 font-mono text-[11px] text-red-300">
                        <HeartPulse className="w-3.5 h-3.5 text-red-400" />
                        {c.injury_level}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-900 text-[11px]">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${statusInfo.color}`}>
                        {statusInfo.title}
                      </span>
                      <span className="text-slate-500 text-[10px] font-mono flex items-center">
                        Details <ChevronRight className="w-3 h-3 ml-0.5" />
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* COLUMN 2: MAP VIEW (Desktop: col-span-4, Mobile: tab controlled) */}
        <section
          className={`lg:col-span-4 p-3 bg-slate-950 border-r border-slate-800 flex flex-col ${
            mobileTab === 'map' ? 'flex h-[calc(100vh-115px)]' : 'hidden lg:flex'
          }`}
        >
          <div className="flex-1 w-full h-full relative">
            <ResponderMap
              cases={mapCases}
              selectedCaseId={selectedCaseId}
              onSelectCase={handleSelectCase}
            />
          </div>
        </section>

        {/* COLUMN 3: SELECTED CASE DETAILS & ACTION PANEL (Desktop: col-span-4, Mobile: tab controlled) */}
        <section
          className={`lg:col-span-4 bg-slate-950 flex flex-col overflow-y-auto ${
            mobileTab === 'detail' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {!selectedCaseDetail ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 text-xs font-mono space-y-3">
              <Navigation className="w-12 h-12 text-slate-700 stroke-1" />
              <p>Select a case from the queue or map to inspect operational details and initiate response actions.</p>
            </div>
          ) : (
            <div className="p-4 space-y-5">
              {/* Header Details */}
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-mono font-black px-2.5 py-1 rounded ${
                      selectedCaseDetail.priority === 'CRITICAL'
                        ? 'bg-red-950 text-red-300 border border-red-700'
                        : selectedCaseDetail.priority === 'HIGH'
                        ? 'bg-orange-950 text-orange-300 border border-orange-700'
                        : 'bg-blue-950 text-blue-300 border border-blue-700'
                    }`}
                  >
                    {selectedCaseDetail.priority}
                  </span>
                  <span className="font-mono text-xs text-slate-400">
                    {formatTimeAgo(selectedCaseDetail.created_at)}
                  </span>
                </div>

                <div>
                  <div className="text-2xl font-black font-mono text-white tracking-wider">
                    {selectedCaseDetail.case_number}
                  </div>
                  <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5 font-mono">
                    <span>Status:</span>
                    <strong className="text-white">
                      {STATUS_DESCRIPTIONS[selectedCaseDetail.status].title}
                    </strong>
                  </div>
                </div>

                {/* Assignment Info */}
                {selectedCaseDetail.assignedResponderInfo && (
                  <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 text-xs space-y-1">
                    <span className="text-slate-400 block text-[10px] uppercase font-mono">
                      Assigned Personnel
                    </span>
                    <div className="font-bold text-slate-200">
                      {selectedCaseDetail.assignedResponderInfo.full_name}
                    </div>
                    <div className="text-slate-400 text-[11px]">
                      {selectedCaseDetail.assignedResponderInfo.organization || 'SAR Agency'} &bull;{' '}
                      {selectedCaseDetail.assignedResponderInfo.role}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons Based on Exact State Machine Transitions */}
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
                <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">
                  Operational Actions
                </h3>

                {actionError && (
                  <div className="p-3 bg-red-950/80 border border-red-800 text-red-200 text-xs rounded-lg flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                    <span>{actionError}</span>
                  </div>
                )}

                <div className="space-y-2">
                  {/* Action 1: Verify (SUBMITTED -> VERIFIED) */}
                  {selectedCaseDetail.status === 'SUBMITTED' && (
                    <button
                      onClick={handleVerify}
                      disabled={!!actionInProgress}
                      className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-sm shadow transition-colors"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>{actionInProgress === 'verify' ? 'Verifying...' : 'VERIFY REQUEST'}</span>
                    </button>
                  )}

                  {/* Action 2: Assign To Me (VERIFIED -> ASSIGNED) */}
                  {selectedCaseDetail.status === 'VERIFIED' && (
                    <button
                      onClick={handleAssignToMe}
                      disabled={!!actionInProgress}
                      className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-sm shadow transition-colors"
                    >
                      <Navigation className="w-4 h-4" />
                      <span>{actionInProgress === 'assign' ? 'Assigning...' : 'ASSIGN TO ME'}</span>
                    </button>
                  )}

                  {/* Action 3: Mark En Route (ASSIGNED -> RESCUER_EN_ROUTE) */}
                  {selectedCaseDetail.status === 'ASSIGNED' && (
                    <button
                      onClick={() => handleStatusChange('RESCUER_EN_ROUTE')}
                      disabled={!!actionInProgress}
                      className="w-full py-3.5 px-4 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-sm shadow transition-colors"
                    >
                      <Send className="w-4 h-4" />
                      <span>{actionInProgress === 'RESCUER_EN_ROUTE' ? 'Updating...' : 'MARK EN ROUTE'}</span>
                    </button>
                  )}

                  {/* Action 4: Mark Rescued (RESCUER_EN_ROUTE -> RESCUED) */}
                  {selectedCaseDetail.status === 'RESCUER_EN_ROUTE' && (
                    <button
                      onClick={() => handleStatusChange('RESCUED')}
                      disabled={!!actionInProgress}
                      className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-sm shadow transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{actionInProgress === 'RESCUED' ? 'Updating...' : 'MARK RESCUED'}</span>
                    </button>
                  )}

                  {/* Action 5: Close Case (RESCUED -> CLOSED) - Dispatcher/Admin */}
                  {selectedCaseDetail.status === 'RESCUED' && (
                    <button
                      onClick={() => handleStatusChange('CLOSED')}
                      disabled={!!actionInProgress || currentProfile?.role === 'RESPONDER'}
                      className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-bold rounded-xl flex items-center justify-center gap-2 text-xs transition-colors border border-slate-700"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>{actionInProgress === 'CLOSED' ? 'Closing...' : 'CLOSE CASE (DISPATCHER)'}</span>
                    </button>
                  )}

                  {/* Controlled Cancellation Button */}
                  {['SUBMITTED', 'VERIFIED', 'ASSIGNED', 'RESCUER_EN_ROUTE'].includes(
                    selectedCaseDetail.status
                  ) && (
                    <button
                      type="button"
                      onClick={() => setShowCancelModal(true)}
                      className="w-full py-2 px-3 text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-lg text-xs font-semibold border border-red-900/50 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Cancel Request</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Requester Contact Phone Box */}
              {selectedCaseDetail.phone_number ? (
                <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                  <span className="text-[11px] text-slate-400 uppercase font-mono font-bold block">
                    Requester Contact Phone
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-base font-bold text-white tracking-wider">
                      {selectedCaseDetail.phone_number}
                    </span>
                    <a
                      href={`tel:${selectedCaseDetail.phone_number}`}
                      className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>CALL</span>
                    </a>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl text-xs text-slate-500 font-mono">
                  No phone number was provided with this request.
                </div>
              )}

              {/* Exact Location & Coordinates Box */}
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2 text-xs">
                <span className="text-[11px] text-slate-400 uppercase font-mono font-bold block flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-red-500" /> Operational Coordinates
                </span>
                {selectedCaseDetail.latitude !== null && selectedCaseDetail.longitude !== null ? (
                  <div className="space-y-1.5">
                    <div className="bg-slate-950 p-2.5 rounded font-mono text-slate-200 grid grid-cols-2 gap-2">
                      <div>Lat: {selectedCaseDetail.latitude}</div>
                      <div>Lng: {selectedCaseDetail.longitude}</div>
                    </div>
                    <div className="flex items-center justify-between text-slate-400 text-[11px]">
                      <span>Accuracy: approx {selectedCaseDetail.location_accuracy}m</span>
                      <span className="uppercase bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">
                        {selectedCaseDetail.location_source}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-400">GPS coordinates unavailable.</p>
                )}

                {selectedCaseDetail.manual_location_description && (
                  <div className="pt-2 border-t border-slate-800">
                    <span className="text-[10px] text-slate-500 block uppercase">Manual Location Text:</span>
                    <p className="text-slate-300 font-medium mt-0.5">
                      {selectedCaseDetail.manual_location_description}
                    </p>
                  </div>
                )}
              </div>

              {/* Requester Description */}
              {selectedCaseDetail.description && (
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1.5 text-xs">
                  <span className="text-[11px] text-slate-400 uppercase font-mono font-bold block flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-slate-400" /> Emergency Situation Description
                  </span>
                  <p className="text-slate-200 leading-relaxed bg-slate-950 p-3 rounded-lg border border-slate-850">
                    {selectedCaseDetail.description}
                  </p>
                </div>
              )}

              {/* Chronological Immutable Audit Trail */}
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3 text-xs">
                <span className="text-[11px] text-slate-400 uppercase font-mono font-bold block">
                  Immutable Operational Timeline
                </span>
                <div className="space-y-2.5 border-l-2 border-slate-700 pl-3 ml-1 font-mono text-[11px]">
                  {(selectedCaseDetail.auditHistory || []).map((ev) => (
                    <div key={ev.id} className="relative space-y-0.5">
                      <div className="flex items-center justify-between text-slate-400">
                        <span className="font-bold text-slate-300">{ev.event_type}</span>
                        <span>{new Date(ev.created_at).toLocaleTimeString()}</span>
                      </div>
                      {ev.notes && <p className="text-slate-400 font-sans text-xs">{ev.notes}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Controlled Cancellation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-500" /> Cancel Rescue Request
              </h3>
              <button
                onClick={() => setShowCancelModal(false)}
                className="text-slate-400 hover:text-white"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCancelSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">Cancellation Reason</label>
                <select
                  value={cancelReasonType}
                  onChange={(e) => setCancelReasonType(e.target.value)}
                  className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:ring-2 focus:ring-red-500"
                >
                  <option value="duplicate">Duplicate Request</option>
                  <option value="false_report">False or Unverified Report</option>
                  <option value="no_longer_needed">Requester No Longer Requires Assistance</option>
                  <option value="other">Other Operational Reason</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">Operational Notes</label>
                <textarea
                  value={cancelReasonDetails}
                  onChange={(e) => setCancelReasonDetails(e.target.value)}
                  placeholder="Provide context for audit record..."
                  rows={3}
                  className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:ring-2 focus:ring-red-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={actionInProgress === 'cancel'}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg"
                >
                  {actionInProgress === 'cancel' ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
