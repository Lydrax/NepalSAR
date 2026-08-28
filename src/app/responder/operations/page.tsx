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
  Archive,
  Search,
  CheckCircle,
  Calendar,
  Activity,
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
    <div className="w-full h-full min-h-[300px] flex items-center justify-center bg-slate-100 text-slate-600 font-mono text-xs rounded-xl border border-slate-300">
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
  description?: string | null;
  phone_number?: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
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
  const detailPanelRef = React.useRef<HTMLDivElement | null>(null);
  const directoryDossierRef = React.useRef<HTMLDivElement | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [currentProfile, setCurrentProfile] = useState<{
    id: string;
    fullName: string;
    role: ResponderRole;
    organization: string | null;
  } | null>(null);

  // Top-level Section Navigation: Active Operations vs. Closed Cases Directory
  const [activeSection, setActiveSection] = useState<'OPERATIONS' | 'CLOSED_DIRECTORY'>('OPERATIONS');
  const [activeCount, setActiveCount] = useState<number>(0);
  const [closedCount, setClosedCount] = useState<number>(0);

  // Operational State
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedCaseDetail, setSelectedCaseDetail] = useState<CaseDetailFull | null>(null);

  // Active Queue Filters
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ACTIVE');
  const [mobileTab, setMobileTab] = useState<'queue' | 'map' | 'detail'>('queue');

  // Closed Directory Filters & Search
  const [directorySearch, setDirectorySearch] = useState<string>('');
  const [closedStatusFilter, setClosedStatusFilter] = useState<'CLOSED_DIRECTORY' | 'CLOSED' | 'CANCELLED'>('CLOSED_DIRECTORY');

  // Loading & Action states
  const [isLoadingQueue, setIsLoadingQueue] = useState<boolean>(true);
  const [queueSyncError, setQueueSyncError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Cancellation Modal State
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [cancelReasonType, setCancelReasonType] = useState<string>('duplicate');
  const [cancelReasonDetails, setCancelReasonDetails] = useState<string>('');

  // Rescue Confirmation Modal State
  const [showRescueModal, setShowRescueModal] = useState<boolean>(false);
  const [rescueNotes, setRescueNotes] = useState<string>('');

  // Case Close Modal State
  const [showCloseModal, setShowCloseModal] = useState<boolean>(false);
  const [closeNotes, setCloseNotes] = useState<string>('');

  // 1. Initial Authentication & Profile Retrieval with reactive session listener
  useEffect(() => {
    let isMounted = true;

    async function checkAuth() {
      // 1. Check current Supabase session
      const {
        data: { session },
      } = await supabaseBrowser.auth.getSession();

      if (!isMounted) return;

      const activeToken =
        session?.access_token ||
        (typeof window !== 'undefined' ? localStorage.getItem('nepal_sar_auth_token') : null);

      if (!session && !activeToken) {
        router.push('/responder/login');
        return;
      }

      if (activeToken) {
        setAuthToken(activeToken);
      }

      const userId = session?.user?.id;
      if (!userId) {
        return;
      }

      const { data: profile } = await supabaseBrowser
        .from('profiles')
        .select('id, full_name, role, organization')
        .eq('id', userId)
        .maybeSingle();

      let profileData = profile;

      if (!profileData && activeToken) {
        try {
          const res = await fetch('/api/responder/profile', {
            headers: { Authorization: `Bearer ${activeToken}` },
          });
          if (res.ok) {
            profileData = await res.json();
          }
        } catch {
          // fallback continues
        }
      }

      if (!isMounted) return;

      if (!profileData) {
        await supabaseBrowser.auth.signOut();
        router.push('/responder/login');
        return;
      }

      setCurrentProfile({
        id: profileData.id,
        fullName: profileData.full_name,
        role: profileData.role as ResponderRole,
        organization: profileData.organization,
      });
    }

    checkAuth();

    // Subscribe to auth state updates (e.g. automatic token refresh)
    const { data: authListener } = supabaseBrowser.auth.onAuthStateChange(async (event, newSession) => {
      if (!isMounted) return;
      if (event === 'SIGNED_OUT' || (!newSession && event === 'USER_UPDATED')) {
        setAuthToken(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('nepal_sar_auth_token');
          localStorage.removeItem('nepal_sar_user_role');
        }
        router.push('/responder/login');
      } else if (newSession?.access_token) {
        setAuthToken(newSession.access_token);
        if (typeof window !== 'undefined') {
          localStorage.setItem('nepal_sar_auth_token', newSession.access_token);
        }
      }
    });

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, [router]);

  // 2. Fetch Queue / Directory Cases with auto-retry and token refresh recovery
  const fetchQueue = useCallback(
    async (isSilent = false) => {
      const token =
        authToken ||
        (typeof window !== 'undefined' ? localStorage.getItem('nepal_sar_auth_token') : null);

      if (!token) return;
      if (!isSilent) setIsLoadingQueue(true);

      const queryParams = new URLSearchParams();

      if (activeSection === 'OPERATIONS') {
        if (priorityFilter !== 'ALL') queryParams.set('priority', priorityFilter);
        if (statusFilter !== 'ALL') queryParams.set('status', statusFilter);
      } else {
        queryParams.set('status', closedStatusFilter);
        if (directorySearch.trim()) {
          queryParams.set('search', directorySearch.trim());
        }
      }

      const url = `/api/responder/cases?${queryParams.toString()}`;

      const executeFetch = async (bearerToken: string, attempt = 1): Promise<boolean> => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 12000);

          const res = await fetch(url, {
            headers: {
              Authorization: `Bearer ${bearerToken}`,
            },
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (res.status === 401) {
            // Attempt automatic token refresh
            const { data: refreshData } = await supabaseBrowser.auth.refreshSession();
            if (refreshData.session?.access_token) {
              const freshToken = refreshData.session.access_token;
              setAuthToken(freshToken);
              if (typeof window !== 'undefined') {
                localStorage.setItem('nepal_sar_auth_token', freshToken);
              }
              if (attempt < 2) {
                return await executeFetch(freshToken, attempt + 1);
              }
            }
            router.push('/responder/login');
            return false;
          }

          if (res.status === 403) {
            router.push('/responder/login');
            return false;
          }

          if (!res.ok) {
            setQueueSyncError(`Server response code: ${res.status}`);
            return false;
          }

          const data = await res.json();
          if (data.success && Array.isArray(data.cases)) {
            setCases(data.cases);
            if (typeof data.activeCount === 'number') setActiveCount(data.activeCount);
            if (typeof data.closedCount === 'number') setClosedCount(data.closedCount);
            setQueueSyncError(null);
            return true;
          }
          return false;
        } catch (err: unknown) {
          // If transient network interruption, retry once after a short delay
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 1200));
            return await executeFetch(bearerToken, attempt + 1);
          }
          // Do not log raw console.error to avoid unhandled alarm triggers
          console.warn('Notice: Responder queue temporarily unable to sync (will auto-reconnect):', err);
          setQueueSyncError('Connecting to live dispatch queue...');
          return false;
        }
      };

      try {
        await executeFetch(token);
      } finally {
        setIsLoadingQueue(false);
      }
    },
    [authToken, activeSection, priorityFilter, statusFilter, closedStatusFilter, directorySearch, router]
  );

  // 3. Fetch Single Case Detail
  const fetchCaseDetail = useCallback(
    async (caseId: string) => {
      const token =
        authToken ||
        (typeof window !== 'undefined' ? localStorage.getItem('nepal_sar_auth_token') : null);

      if (!token) return;
      setActionError(null);

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        const res = await fetch(`/api/responder/cases/${caseId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.case) {
            setSelectedCaseDetail(data.case);
          } else {
            setActionError(data.error || 'Unable to load case details.');
          }
        } else {
          setActionError('Unable to retrieve case record from server.');
        }
      } catch (err) {
        console.warn('Notice: Case detail fetch temporary issue:', err);
        setActionError('Network interruption while loading case details.');
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

  // When a case is selected from queue or map or directory
  const handleSelectCase = (id: string) => {
    setSelectedCaseId(id);
    fetchCaseDetail(id);
    setMobileTab('detail');

    // Auto-scroll the detail panel container to the very top so details are immediately visible
    setTimeout(() => {
      if (detailPanelRef.current) {
        detailPanelRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
      if (directoryDossierRef.current && window.innerWidth < 1024) {
        directoryDossierRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
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

  const handleStatusChange = async (targetStatus: RescueCaseStatus, customNotes?: string) => {
    if (!selectedCaseId || !authToken) return;

    setActionInProgress(targetStatus);
    setActionError(null);
    setActionSuccessMessage(null);

    try {
      const res = await fetch('/api/responder/case/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          caseId: selectedCaseId,
          targetStatus,
          notes: customNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Status change failed.');

      setActionSuccessMessage(`Status updated to ${targetStatus}`);
      await fetchCaseDetail(selectedCaseId);
      await fetchQueue(true);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Status update failed.');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRescueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleStatusChange('RESCUED', rescueNotes);
    setShowRescueModal(false);
    setRescueNotes('');
  };

  const handleCloseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const caseIdToClose = selectedCaseId;
    await handleStatusChange('CLOSED', closeNotes);
    setShowCloseModal(false);
    setCloseNotes('');
    if (activeSection === 'OPERATIONS' && caseIdToClose) {
      setCases((prev) => prev.filter((c) => c.id !== caseIdToClose));
      setSelectedCaseId(null);
      setSelectedCaseDetail(null);
      setActiveCount((prev) => Math.max(0, prev - 1));
      setClosedCount((prev) => prev + 1);
    }
  };

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCaseId || !authToken) return;
    const caseIdToCancel = selectedCaseId;
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
      setActionSuccessMessage('Rescue request has been cancelled and moved to Closed Directory.');
      if (activeSection === 'OPERATIONS') {
        setCases((prev) => prev.filter((c) => c.id !== caseIdToCancel));
        setSelectedCaseId(null);
        setSelectedCaseDetail(null);
        setActiveCount((prev) => Math.max(0, prev - 1));
        setClosedCount((prev) => prev + 1);
      } else {
        await fetchCaseDetail(caseIdToCancel);
      }
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

  // Convert active cases to Map markers format (strictly active only)
  const mapCases: MapCaseItem[] = useMemo(() => {
    return cases
      .filter((c) => !['CLOSED', 'CANCELLED'].includes(c.status))
      .map((c) => ({
        id: c.id,
        caseNumber: c.case_number,
        latitude: c.latitude,
        longitude: c.longitude,
        priority: c.priority,
        status: c.status,
        peopleCount: c.people_count,
        disasterType: c.disaster_type,
        locationDescription: c.manual_location_description,
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

  // Directory Stats for Closed Cases
  const closedStats = useMemo(() => {
    const resolvedCount = cases.filter((c) => c.status === 'CLOSED').length;
    const cancelledCount = cases.filter((c) => c.status === 'CANCELLED').length;
    const totalLives = cases.reduce((acc, c) => acc + (c.people_count || 0), 0);
    return {
      total: cases.length,
      resolvedCount,
      cancelledCount,
      totalLives,
    };
  }, [cases]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans">
      {/* Top Operations Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-30 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-red-700 text-white p-2.5 rounded-xl flex items-center justify-center shadow-xs">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base tracking-wider uppercase text-slate-900">
                  Nepal SAR Operations & Command
                </span>
                <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                  LIVE PORTAL
                </span>
              </div>
              <span className="text-xs text-slate-600 block font-mono">
                {currentProfile?.fullName} &bull; <strong className="text-slate-900">{currentProfile?.role}</strong>{' '}
                {currentProfile?.organization ? `(${currentProfile.organization})` : ''}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Top Navigation Tabs: Active Operations vs Closed Cases Directory */}
            <div className="bg-slate-100 p-1 rounded-xl border border-slate-200 flex items-center gap-1 shadow-2xs">
              <button
                onClick={() => {
                  setActiveSection('OPERATIONS');
                  setSelectedCaseId(null);
                  setSelectedCaseDetail(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeSection === 'OPERATIONS'
                    ? 'bg-red-700 text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Active Ops</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                    activeSection === 'OPERATIONS' ? 'bg-white text-red-700 font-black' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {activeCount}
                </span>
              </button>

              <button
                onClick={() => {
                  setActiveSection('CLOSED_DIRECTORY');
                  setSelectedCaseId(null);
                  setSelectedCaseDetail(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeSection === 'CLOSED_DIRECTORY'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Archive className="w-3.5 h-3.5" />
                <span>Closed Directory</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                    activeSection === 'CLOSED_DIRECTORY'
                      ? 'bg-emerald-400 text-slate-950 font-black'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {closedCount}
                </span>
              </button>
            </div>

            <button
              onClick={() => fetchQueue(false)}
              className="p-2 bg-white hover:bg-slate-50 text-slate-700 rounded-lg border border-slate-300 text-xs font-semibold flex items-center gap-1 transition-colors shadow-xs"
              title="Refresh queue"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingQueue ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sync</span>
            </button>
            <button
              onClick={handleSignOut}
              className="p-2 bg-white hover:bg-red-50 hover:text-red-700 text-slate-700 rounded-lg border border-slate-300 text-xs font-semibold flex items-center gap-1 transition-colors shadow-xs"
              title="Sign out of operations"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Exit</span>
            </button>
          </div>
        </div>
      </header>

      {/* SECTION 1: ACTIVE OPERATIONS VIEW */}
      {activeSection === 'OPERATIONS' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile View Selector */}
          <div className="lg:hidden flex border-b border-slate-200 bg-white text-xs font-bold shadow-xs">
            <button
              onClick={() => setMobileTab('queue')}
              className={`flex-1 py-3 text-center border-b-2 flex items-center justify-center gap-1.5 ${
                mobileTab === 'queue' ? 'border-red-700 text-red-950 bg-red-50/50' : 'border-transparent text-slate-600'
              }`}
            >
              <span>Active Queue</span>
              <span className="bg-slate-100 px-2 py-0.5 rounded-full text-[10px] text-slate-700 font-mono">
                {cases.length}
              </span>
            </button>
            <button
              onClick={() => setMobileTab('map')}
              className={`flex-1 py-3 text-center border-b-2 ${
                mobileTab === 'map' ? 'border-red-700 text-red-950 bg-red-50/50' : 'border-transparent text-slate-600'
              }`}
            >
              Map View
            </button>
            <button
              onClick={() => setMobileTab('detail')}
              className={`flex-1 py-3 text-center border-b-2 ${
                mobileTab === 'detail' ? 'border-red-700 text-red-950 bg-red-50/50' : 'border-transparent text-slate-600'
              }`}
            >
              Case Details
            </button>
          </div>

          {/* Main 3-Column Operations Layout */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden h-[calc(100vh-115px)]">
            {/* COLUMN 1: CASE QUEUE (Desktop: col-span-4, Mobile: tab controlled) */}
            <section
              className={`lg:col-span-4 border-r border-slate-200 flex flex-col bg-slate-50 overflow-hidden ${
                mobileTab === 'queue' ? 'flex' : 'hidden lg:flex'
              }`}
            >
              {/* Filters Bar */}
              <div className="p-3.5 bg-white border-b border-slate-200 space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between text-xs text-slate-600 font-mono">
                  <span className="flex items-center gap-1.5 font-bold text-slate-900 text-xs sm:text-sm">
                    <Filter className="w-4 h-4 text-slate-700" /> ACTIVE DISPATCH QUEUE ({cases.length})
                  </span>
                  <span className="text-xs text-slate-500 font-medium">Auto-poll 20s</span>
                </div>

                {/* Priority Filters */}
                <div className="flex items-center gap-1 text-xs font-semibold">
                  {(['ALL', 'CRITICAL', 'HIGH', 'NORMAL'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPriorityFilter(p)}
                      className={`px-3 py-1.5 rounded-lg border transition-colors ${
                        priorityFilter === p
                          ? 'bg-slate-900 text-white border-slate-900 font-bold'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                {/* Status Filters */}
                <div className="flex items-center gap-1.5 text-xs font-semibold overflow-x-auto pb-1">
                  {(
                    [
                      { id: 'ACTIVE', label: 'All Active' },
                      { id: 'SUBMITTED', label: 'Submitted' },
                      { id: 'VERIFIED', label: 'Verified' },
                      { id: 'ASSIGNED', label: 'Assigned' },
                      { id: 'RESCUER_EN_ROUTE', label: 'En Route' },
                      { id: 'RESCUED', label: 'Rescued' },
                    ] as const
                  ).map((st) => (
                    <button
                      key={st.id}
                      onClick={() => setStatusFilter(st.id)}
                      className={`px-3 py-1.5 rounded-lg border shrink-0 transition-colors ${
                        statusFilter === st.id
                          ? 'bg-red-100 text-red-950 border-red-300 font-bold'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Connection / Sync Notification Banner */}
              {queueSyncError && (
                <div className="bg-amber-50 border-b border-amber-200 px-3 py-2 text-xs text-amber-900 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>{queueSyncError}</span>
                  </div>
                  <button
                    onClick={() => fetchQueue(false)}
                    className="text-amber-950 font-bold underline hover:text-amber-800 text-[11px] cursor-pointer"
                  >
                    Retry Now
                  </button>
                </div>
              )}

              {/* Queue List */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-200">
                {cases.filter((c) => !['CLOSED', 'CANCELLED'].includes(c.status)).length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-sm font-mono space-y-2">
                    <CheckCircle2 className="w-8 h-8 mx-auto text-slate-400" />
                    <p>No active cases matching current filter.</p>
                  </div>
                ) : (
                  cases
                    .filter((c) => !['CLOSED', 'CANCELLED'].includes(c.status))
                    .map((c) => {
                    const isSelected = c.id === selectedCaseId;
                    const statusInfo = STATUS_DESCRIPTIONS[c.status];

                    return (
                      <div
                        key={c.id}
                        onClick={() => handleSelectCase(c.id)}
                        className={`p-4 cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-red-50/70 border-l-4 border-red-700 shadow-xs'
                            : 'bg-white hover:bg-slate-50/90'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-xs font-mono font-black px-2 py-0.5 rounded border ${
                                c.priority === 'CRITICAL'
                                  ? 'bg-red-100 text-red-900 border-red-300'
                                  : c.priority === 'HIGH'
                                  ? 'bg-orange-100 text-orange-900 border-orange-300'
                                  : 'bg-blue-100 text-blue-900 border-blue-300'
                              }`}
                            >
                              {c.priority}
                            </span>
                            <span className="font-mono font-bold text-base text-slate-900">{c.case_number}</span>
                          </div>
                          <span className="text-xs font-mono text-slate-500 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {formatTimeAgo(c.created_at)}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5 text-sm text-slate-800 mb-2.5">
                          <span className="flex items-center gap-1.5">
                            <Users className="w-4 h-4 text-slate-500" />
                            <strong>{c.people_count}</strong> {c.people_count === 1 ? 'person' : 'people'}
                          </span>
                          <span className="flex items-center gap-1.5 uppercase font-mono text-xs text-amber-900 font-semibold">
                            <AlertTriangle className="w-4 h-4 text-amber-600" />
                            {c.trapped_status}
                          </span>
                          <span className="flex items-center gap-1.5 font-mono text-xs text-slate-700">
                            <Flame className="w-4 h-4 text-orange-600" />
                            {c.disaster_type}
                          </span>
                          <span className="flex items-center gap-1.5 font-mono text-xs text-red-900 font-medium">
                            <HeartPulse className="w-4 h-4 text-red-600" />
                            {c.injury_level}
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                          <span className={`px-2.5 py-1 rounded text-xs font-bold ${statusInfo.color}`}>
                            {statusInfo.title}
                          </span>
                          <span className="text-slate-600 text-xs font-mono flex items-center font-bold">
                            Details <ChevronRight className="w-3.5 h-3.5 ml-0.5 text-slate-400" />
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
              className={`lg:col-span-4 p-3 bg-slate-100 border-r border-slate-200 flex flex-col ${
                mobileTab === 'map' ? 'flex h-[calc(100vh-170px)]' : 'hidden lg:flex'
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
              ref={detailPanelRef}
              className={`lg:col-span-4 bg-slate-50 flex flex-col overflow-y-auto scroll-smooth ${
                mobileTab === 'detail' ? 'flex' : 'hidden lg:flex'
              }`}
            >
              {!selectedCaseDetail ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 text-sm font-mono space-y-3">
                  <Navigation className="w-12 h-12 text-slate-400 stroke-1" />
                  <p>Select a case from the queue or map to inspect operational details and initiate response actions.</p>
                </div>
              ) : (
                <div className="p-4 sm:p-5 space-y-5">
                  {/* Header Details */}
                  <div className="bg-white border border-slate-200 p-5 rounded-xl space-y-3 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-mono font-black px-2.5 py-1 rounded border ${
                          selectedCaseDetail.priority === 'CRITICAL'
                            ? 'bg-red-100 text-red-900 border-red-300'
                            : selectedCaseDetail.priority === 'HIGH'
                            ? 'bg-orange-100 text-orange-900 border-orange-300'
                            : 'bg-blue-100 text-blue-900 border-blue-300'
                        }`}
                      >
                        {selectedCaseDetail.priority}
                      </span>
                      <span className="font-mono text-xs text-slate-500 font-semibold">
                        {formatTimeAgo(selectedCaseDetail.created_at)}
                      </span>
                    </div>

                    <div>
                      <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900 tracking-wider">
                        {selectedCaseDetail.case_number}
                      </div>
                      <div className="text-sm text-slate-700 mt-1 flex items-center gap-1.5 font-mono font-semibold">
                        <span>Status:</span>
                        <strong className="text-slate-950">
                          {STATUS_DESCRIPTIONS[selectedCaseDetail.status].title}
                        </strong>
                      </div>
                    </div>

                    {/* Assignment Info */}
                    {selectedCaseDetail.assignedResponderInfo && (
                      <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-sm space-y-1">
                        <span className="text-slate-500 block text-xs uppercase font-mono font-bold">
                          Assigned Personnel
                        </span>
                        <div className="font-bold text-slate-900 text-base">
                          {selectedCaseDetail.assignedResponderInfo.full_name}
                        </div>
                        <div className="text-slate-600 text-xs">
                          {selectedCaseDetail.assignedResponderInfo.organization || 'SAR Agency'} &bull;{' '}
                          {selectedCaseDetail.assignedResponderInfo.role}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons Based on Exact State Machine Transitions */}
                  <div className="bg-white border border-slate-200 p-5 rounded-xl space-y-3 shadow-xs">
                    <h3 className="text-xs font-mono uppercase tracking-wider text-slate-700 font-bold">
                      Operational Actions
                    </h3>

                    {actionError && (
                      <div className="p-3.5 bg-red-50 border border-red-300 text-red-900 text-sm rounded-lg flex items-center gap-2 font-medium">
                        <AlertTriangle className="w-5 h-5 shrink-0 text-red-700" />
                        <span>{actionError}</span>
                      </div>
                    )}

                    {actionSuccessMessage && (
                      <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-950 text-sm rounded-lg flex items-center gap-2 font-medium">
                        <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-700" />
                        <span>{actionSuccessMessage}</span>
                      </div>
                    )}

                    <div className="space-y-2.5">
                      {/* Action 1: Verify (SUBMITTED -> VERIFIED) */}
                      {selectedCaseDetail.status === 'SUBMITTED' && (
                        <button
                          onClick={handleVerify}
                          disabled={!!actionInProgress}
                          className="w-full py-3.5 px-4 bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-sm shadow-xs transition-colors"
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
                          className="w-full py-3.5 px-4 bg-indigo-700 hover:bg-indigo-800 active:bg-indigo-900 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-sm shadow-xs transition-colors"
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
                          className="w-full py-3.5 px-4 bg-purple-700 hover:bg-purple-800 active:bg-purple-900 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-sm shadow-xs transition-colors"
                        >
                          <Send className="w-4 h-4" />
                          <span>{actionInProgress === 'RESCUER_EN_ROUTE' ? 'Updating...' : 'MARK EN ROUTE'}</span>
                        </button>
                      )}

                      {/* Action 4: Mark Rescued (ASSIGNED or RESCUER_EN_ROUTE -> RESCUED) */}
                      {['ASSIGNED', 'RESCUER_EN_ROUTE'].includes(selectedCaseDetail.status) && (
                        <button
                          onClick={() => setShowRescueModal(true)}
                          disabled={!!actionInProgress}
                          className="w-full py-3.5 px-4 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-sm shadow-xs transition-colors"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>MARK RESCUED</span>
                        </button>
                      )}

                      {/* Action 5: Close Case (RESCUED -> CLOSED) - Dispatcher/Admin */}
                      {selectedCaseDetail.status === 'RESCUED' && (
                        <button
                          onClick={() => setShowCloseModal(true)}
                          disabled={!!actionInProgress || currentProfile?.role === 'RESPONDER'}
                          className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-sm transition-colors shadow-xs"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>{currentProfile?.role === 'RESPONDER' ? 'CASE RESCUED (PENDING DISPATCHER CLOSE)' : 'CLOSE & ARCHIVE CASE'}</span>
                        </button>
                      )}

                      {/* Controlled Cancellation Button */}
                      {['SUBMITTED', 'VERIFIED', 'ASSIGNED', 'RESCUER_EN_ROUTE'].includes(
                        selectedCaseDetail.status
                      ) && (
                        <button
                          type="button"
                          onClick={() => setShowCancelModal(true)}
                          className="w-full py-2.5 px-3 text-red-700 hover:text-red-900 hover:bg-red-50 rounded-lg text-xs font-bold border border-red-300 flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>Cancel Request</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Requester Contact Phone Box */}
                  {selectedCaseDetail.phone_number ? (
                    <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2 shadow-xs">
                      <span className="text-xs text-slate-500 uppercase font-mono font-bold block">
                        Requester Contact Phone
                      </span>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-base font-bold text-slate-900 tracking-wider">
                          {selectedCaseDetail.phone_number}
                        </span>
                        <a
                          href={`tel:${selectedCaseDetail.phone_number}`}
                          className="py-2 px-4 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>CALL</span>
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-500 font-mono shadow-xs">
                      No phone number was provided with this request.
                    </div>
                  )}

                  {/* Exact Location & Coordinates Box */}
                  <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2 text-sm shadow-xs">
                    <span className="text-xs text-slate-700 uppercase font-mono font-bold flex items-center gap-1">
                      <MapPin className="w-4 h-4 text-red-700" /> Operational Coordinates
                    </span>
                    {selectedCaseDetail.latitude !== null && selectedCaseDetail.longitude !== null ? (
                      <div className="space-y-2">
                        <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg font-mono text-slate-900 grid grid-cols-2 gap-2 text-xs font-semibold">
                          <div>Lat: <span className="font-bold text-slate-950">{selectedCaseDetail.latitude}</span></div>
                          <div>Lng: <span className="font-bold text-slate-950">{selectedCaseDetail.longitude}</span></div>
                        </div>
                        <div className="flex items-center justify-between text-slate-600 text-xs">
                          <span>Accuracy: approx {selectedCaseDetail.location_accuracy}m</span>
                          <span className="uppercase bg-slate-100 text-slate-800 font-bold px-2 py-0.5 rounded text-[11px] border border-slate-200">
                            {selectedCaseDetail.location_source}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-slate-500 text-xs">GPS coordinates unavailable.</p>
                    )}

                    {selectedCaseDetail.manual_location_description && (
                      <div className="pt-2 border-t border-slate-100">
                        <span className="text-xs text-slate-500 block uppercase font-bold">Manual Location Text:</span>
                        <p className="text-slate-900 font-medium text-sm mt-0.5">
                          {selectedCaseDetail.manual_location_description}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Requester Description */}
                  {selectedCaseDetail.description && (
                    <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2 text-sm shadow-xs">
                      <span className="text-xs text-slate-700 uppercase font-mono font-bold flex items-center gap-1">
                        <FileText className="w-4 h-4 text-slate-500" /> Emergency Situation Description
                      </span>
                      <p className="text-slate-900 leading-relaxed bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-sm">
                        {selectedCaseDetail.description}
                      </p>
                    </div>
                  )}

                  {/* Chronological Immutable Audit Trail */}
                  <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 text-sm shadow-xs">
                    <span className="text-xs text-slate-700 uppercase font-mono font-bold block">
                      Immutable Operational Timeline
                    </span>
                    <div className="space-y-3 border-l-2 border-slate-300 pl-3.5 ml-1 font-mono text-xs">
                      {(selectedCaseDetail.auditHistory || []).map((ev) => (
                        <div key={ev.id} className="relative space-y-1">
                          <div className="flex items-center justify-between text-slate-600 text-xs">
                            <span className="font-bold text-slate-900">{ev.event_type}</span>
                            <span>{new Date(ev.created_at).toLocaleTimeString()}</span>
                          </div>
                          {ev.notes && <p className="text-slate-800 font-sans text-xs bg-slate-50 p-2 rounded border border-slate-200">{ev.notes}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* SECTION 2: CLOSED & RESOLVED CASES DIRECTORY */}
      {activeSection === 'CLOSED_DIRECTORY' && (
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto max-w-7xl w-full mx-auto space-y-6">
          {/* Header Directory Metrics Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs space-y-1">
              <span className="text-[11px] font-mono text-slate-500 font-semibold uppercase block flex items-center gap-1.5">
                <Archive className="w-3.5 h-3.5 text-slate-700" /> Total Archived
              </span>
              <div className="text-2xl font-black font-mono text-slate-900">{closedStats.total}</div>
            </div>

            <div className="bg-white border border-emerald-200 p-4 rounded-xl shadow-xs space-y-1">
              <span className="text-[11px] font-mono text-emerald-800 font-semibold uppercase block flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Rescued & Completed
              </span>
              <div className="text-2xl font-black font-mono text-emerald-900">{closedStats.resolvedCount}</div>
            </div>

            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs space-y-1">
              <span className="text-[11px] font-mono text-slate-600 font-semibold uppercase block flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-500" /> Lives Secured
              </span>
              <div className="text-2xl font-black font-mono text-slate-900">{closedStats.totalLives}</div>
            </div>

            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs space-y-1">
              <span className="text-[11px] font-mono text-slate-500 font-semibold uppercase block flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5 text-slate-400" /> Cancelled / False
              </span>
              <div className="text-2xl font-black font-mono text-slate-700">{closedStats.cancelledCount}</div>
            </div>
          </div>

          {/* Directory Search & Sub-filters Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-96">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={directorySearch}
                onChange={(e) => setDirectorySearch(e.target.value)}
                placeholder="Search by Case ID, location, or notes..."
                className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              {directorySearch && (
                <button
                  onClick={() => setDirectorySearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-sm font-bold"
                >
                  &times;
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
              {(
                [
                  { id: 'CLOSED_DIRECTORY', label: 'All Closed & Cancelled' },
                  { id: 'CLOSED', label: 'Completed (CLOSED)' },
                  { id: 'CANCELLED', label: 'Cancelled Requests' },
                ] as const
              ).map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => setClosedStatusFilter(pill.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors whitespace-nowrap ${
                    closedStatusFilter === pill.id
                      ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                      : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {/* Split Layout: Directory Grid/List (Left) and Case Dossier (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Directory Record Cards */}
            <div className="lg:col-span-7 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-600 uppercase px-1">
                <span>Archived Incident Records ({cases.length})</span>
                <span>Sorted by Recent Resolution</span>
              </div>

              {cases.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500 font-mono text-xs space-y-2 shadow-xs">
                  <Archive className="w-10 h-10 text-slate-300 mx-auto" />
                  <p>No closed cases found matching your search criteria.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {cases.map((c) => {
                    const isSelected = c.id === selectedCaseId;
                    const isClosed = c.status === 'CLOSED';

                    return (
                      <div
                        key={c.id}
                        onClick={() => handleSelectCase(c.id)}
                        className={`p-4 rounded-xl border transition-all cursor-pointer shadow-xs ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900 ring-2 ring-slate-900'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/90'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-mono font-black px-2 py-0.5 rounded border uppercase ${
                                isClosed
                                  ? isSelected
                                    ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                                    : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                  : isSelected
                                  ? 'bg-slate-700 text-slate-200 border-slate-600'
                                  : 'bg-slate-100 text-slate-700 border-slate-300'
                              }`}
                            >
                              {c.status}
                            </span>
                            <span className={`font-mono font-extrabold text-base tracking-wider ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                              {c.case_number}
                            </span>
                          </div>

                          <span className={`text-[11px] font-mono flex items-center gap-1 ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                            <Calendar className="w-3 h-3" />
                            {new Date(c.updated_at || c.created_at).toLocaleDateString()} &bull; {new Date(c.updated_at || c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <div className={`grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs mb-2 ${isSelected ? 'text-slate-200' : 'text-slate-700'}`}>
                          <div className="flex items-center gap-1 font-mono">
                            <Flame className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                            <span className="capitalize">{c.disaster_type}</span>
                          </div>

                          <div className="flex items-center gap-1 font-mono">
                            <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <strong>{c.people_count}</strong> {c.people_count === 1 ? 'victim' : 'victims'}
                          </div>

                          <div className="flex items-center gap-1 font-mono col-span-2 sm:col-span-1">
                            <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                            <span className="truncate">{c.manual_location_description || 'GPS Recorded'}</span>
                          </div>
                        </div>

                        <div className={`pt-2 border-t flex items-center justify-between text-xs ${isSelected ? 'border-slate-800 text-slate-300' : 'border-slate-100 text-slate-500'}`}>
                          <span className="font-mono text-[11px]">
                            Initial Priority: <strong className={isSelected ? 'text-white' : 'text-slate-900'}>{c.priority}</strong>
                          </span>
                          <span className="flex items-center gap-1 font-bold text-xs">
                            Inspect Case Dossier <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right: Selected Case Dossier & Full Audit Inspection */}
            <div ref={directoryDossierRef} className="lg:col-span-5 sticky top-24 space-y-4">
              {!selectedCaseDetail ? (
                <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-500 font-mono text-sm space-y-3 shadow-xs">
                  <Archive className="w-12 h-12 text-slate-300 mx-auto stroke-1" />
                  <p className="font-semibold text-slate-700 text-base">No Record Selected</p>
                  <p className="text-xs">Click any archived incident from the directory list on the left to inspect its complete post-operation audit log, responder notes, and final disposition.</p>
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-xs space-y-5">
                  {/* Top Dossier Header */}
                  <div className="space-y-2 border-b border-slate-100 pb-4">
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-mono font-bold px-2.5 py-1 rounded border uppercase ${
                          selectedCaseDetail.status === 'CLOSED'
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                            : 'bg-slate-100 text-slate-800 border-slate-300'
                        }`}
                      >
                        {selectedCaseDetail.status === 'CLOSED' ? 'RESOLVED & ARCHIVED' : 'CANCELLED & ARCHIVED'}
                      </span>
                      <span className="text-xs font-mono text-slate-500 font-semibold">
                        {new Date(selectedCaseDetail.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900 tracking-wider">
                      {selectedCaseDetail.case_number}
                    </div>

                    <p className="text-sm text-slate-700">
                      Disaster: <strong className="text-slate-950 capitalize">{selectedCaseDetail.disaster_type}</strong> &bull;{' '}
                      Victims Secured: <strong className="text-slate-950">{selectedCaseDetail.people_count}</strong>
                    </p>
                  </div>

                  {/* Assigned Responder Info */}
                  {selectedCaseDetail.assignedResponderInfo && (
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-sm space-y-1">
                      <span className="text-slate-500 uppercase font-mono font-bold text-xs block">
                        Lead Responding Personnel
                      </span>
                      <div className="font-bold text-slate-900 text-base">
                        {selectedCaseDetail.assignedResponderInfo.full_name}
                      </div>
                      <div className="text-slate-600 text-xs">
                        {selectedCaseDetail.assignedResponderInfo.organization || 'SAR Dispatch'} &bull;{' '}
                        {selectedCaseDetail.assignedResponderInfo.role}
                      </div>
                    </div>
                  )}

                  {/* Location Information */}
                  <div className="space-y-1.5 text-sm">
                    <span className="font-mono uppercase font-bold text-slate-700 text-xs flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-red-700" /> Recorded Coordinates & Location
                    </span>
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5 font-mono text-xs">
                      {selectedCaseDetail.latitude && selectedCaseDetail.longitude ? (
                        <div>
                          Lat: <strong className="text-slate-900">{selectedCaseDetail.latitude}</strong>, Lng:{' '}
                          <strong className="text-slate-900">{selectedCaseDetail.longitude}</strong>
                        </div>
                      ) : (
                        <div className="text-slate-500">No GPS coordinates recorded.</div>
                      )}
                      {selectedCaseDetail.manual_location_description && (
                        <div className="pt-2 border-t border-slate-200 text-slate-800 font-sans text-sm">
                          {selectedCaseDetail.manual_location_description}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Requester Contact Phone */}
                  {selectedCaseDetail.phone_number && (
                    <div className="space-y-1.5 text-sm">
                      <span className="font-mono uppercase font-bold text-slate-700 text-xs">Requester Phone</span>
                      <div className="font-mono font-bold text-slate-900 p-3 bg-slate-50 border border-slate-200 rounded-lg text-base">
                        {selectedCaseDetail.phone_number}
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  {selectedCaseDetail.description && (
                    <div className="space-y-1.5 text-sm">
                      <span className="font-mono uppercase font-bold text-slate-700 text-xs">Original Report</span>
                      <p className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 leading-relaxed font-sans text-sm">
                        {selectedCaseDetail.description}
                      </p>
                    </div>
                  )}

                  {/* Chronological Immutable Audit Trail */}
                  <div className="space-y-2 text-sm pt-2 border-t border-slate-100">
                    <span className="font-mono uppercase font-bold text-slate-700 text-xs block">
                      Chronological Post-Op Audit Trail
                    </span>
                    <div className="space-y-3 border-l-2 border-slate-300 pl-3.5 ml-1 font-mono text-xs">
                      {(selectedCaseDetail.auditHistory || []).map((ev) => (
                        <div key={ev.id} className="relative space-y-1">
                          <div className="flex items-center justify-between text-slate-600 text-xs">
                            <span className="font-bold text-slate-900">{ev.event_type}</span>
                            <span>{new Date(ev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                          </div>
                          {ev.notes && (
                            <p className="text-slate-700 font-sans text-xs bg-slate-50 p-2.5 rounded border border-slate-200 mt-1">
                              {ev.notes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Controlled Cancellation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-700" /> Cancel Rescue Request
              </h3>
              <button
                onClick={() => setShowCancelModal(false)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCancelSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">Cancellation Reason</label>
                <select
                  value={cancelReasonType}
                  onChange={(e) => setCancelReasonType(e.target.value)}
                  className="w-full p-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-red-600 focus:border-red-600"
                >
                  <option value="duplicate">Duplicate Request</option>
                  <option value="false_report">False or Unverified Report</option>
                  <option value="no_longer_needed">Requester No Longer Requires Assistance</option>
                  <option value="other">Other Operational Reason</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">Operational Notes</label>
                <textarea
                  value={cancelReasonDetails}
                  onChange={(e) => setCancelReasonDetails(e.target.value)}
                  placeholder="Provide context for audit record..."
                  rows={3}
                  className="w-full p-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-red-600 focus:border-red-600"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={actionInProgress === 'cancel'}
                  className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
                >
                  {actionInProgress === 'cancel' ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Field Rescue Confirmation Modal */}
      {showRescueModal && selectedCaseDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-700" /> Confirm Rescue Completion
              </h3>
              <button
                onClick={() => setShowRescueModal(false)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 space-y-1 text-xs text-emerald-950 font-mono">
              <div className="font-bold text-emerald-900 text-sm">
                Case: {selectedCaseDetail.case_number}
              </div>
              <div>People to secure: {selectedCaseDetail.people_count}</div>
              <div>Incident: {selectedCaseDetail.disaster_type} &bull; {selectedCaseDetail.trapped_status}</div>
            </div>

            <p className="text-xs text-slate-700 font-medium">
              Please verify that all victims / stranded individuals have been safely reached, secured, and immediate triage or evacuation is complete.
            </p>

            <form onSubmit={handleRescueSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Field Completion Notes (Optional)
                </label>
                <textarea
                  value={rescueNotes}
                  onChange={(e) => setRescueNotes(e.target.value)}
                  placeholder="e.g. All 3 individuals secured, no critical trauma, transferred to Pokhara triage station."
                  rows={3}
                  className="w-full p-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRescueModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={actionInProgress === 'RESCUED'}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{actionInProgress === 'RESCUED' ? 'Updating...' : 'Confirm & Mark Rescued'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Case Close & Archive Modal (Dispatcher / Admin) */}
      {showCloseModal && selectedCaseDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-slate-800" /> Close & Archive Rescue Case
              </h3>
              <button
                onClick={() => setShowCloseModal(false)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <div className="bg-slate-100 border border-slate-200 rounded-xl p-3.5 space-y-1 text-xs text-slate-800 font-mono">
              <div className="font-bold text-slate-900 text-sm">
                Case: {selectedCaseDetail.case_number}
              </div>
              <div>Status: RESCUED &bull; Priority: {selectedCaseDetail.priority}</div>
            </div>

            <p className="text-xs text-slate-700 font-medium">
              Closing this case will conclude all SAR operational tracking and archive the incident record.
            </p>

            <form onSubmit={handleCloseSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Closing Summary / Debrief Notes
                </label>
                <textarea
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  placeholder="e.g. Operation officially closed after medical transfer confirmation."
                  rows={3}
                  className="w-full p-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-slate-800 focus:border-slate-800"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCloseModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionInProgress === 'CLOSED'}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
                >
                  {actionInProgress === 'CLOSED' ? 'Closing...' : 'Close & Archive'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

