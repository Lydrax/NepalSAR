'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { Search, ArrowLeft, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { getTranslations, Language } from '@/lib/i18n';
import { STATUS_DESCRIPTIONS } from '@/lib/constants/emergency';
import { RescueCaseStatus } from '@/lib/types/emergency';
import { Header } from '@/components/ui/Header';
import { DisclaimerBanner } from '@/components/ui/DisclaimerBanner';
import CaseTrackingProgressBar from '@/components/track/CaseTrackingProgressBar';

function TrackRequestContent() {
  const [lang, setLang] = useState<Language>('en');
  const t = getTranslations(lang);

  const [caseNumber, setCaseNumber] = useState<string>('');
  const [token, setToken] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [caseStatusData, setCaseStatusData] = useState<{
    caseNumber: string;
    status: RescueCaseStatus;
    submittedAt: string;
    lastUpdatedAt: string;
  } | null>(null);

  // Core lookup function
  const fetchStatus = useCallback(
    async (targetCase: string, targetToken: string, isSilent = false) => {
      const cleanCase = targetCase.trim().toUpperCase();
      const cleanToken = targetToken.trim();

      if (!cleanCase || !cleanToken) {
        setSearchError('Please provide both your Case ID and Verification Token.');
        return;
      }

      if (!isSilent) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setSearchError(null);

      try {
        const response = await fetch('/api/rescue/status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            caseNumber: cleanCase,
            verificationToken: cleanToken,
          }),
        });

        const resData = await response.json();

        if (!response.ok) {
          throw new Error(
            resData.error || 'Unable to verify this request. Please check your Case ID and Verification Token.'
          );
        }

        setCaseStatusData({
          caseNumber: resData.caseNumber,
          status: resData.status,
          submittedAt: resData.submittedAt,
          lastUpdatedAt: resData.lastUpdatedAt,
        });
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Unable to verify this request. Please check your Case ID and Verification Token.';
        if (!isSilent) {
          setSearchError(msg);
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    []
  );

  const handleLookupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStatus(caseNumber, token, false);
  };

  // 15-30 second polling while the case is in an active non-terminal state
  useEffect(() => {
    if (!caseStatusData || !caseNumber || !token) return;

    // Terminal statuses that do not require continued polling
    const terminalStatuses: RescueCaseStatus[] = ['RESCUED', 'CLOSED', 'CANCELLED'];
    if (terminalStatuses.includes(caseStatusData.status)) {
      return;
    }

    const intervalId = setInterval(() => {
      fetchStatus(caseNumber, token, true);
    }, 20000); // 20-second interval

    return () => clearInterval(intervalId);
  }, [caseStatusData, caseNumber, token, fetchStatus]);

  const statusInfo = caseStatusData ? STATUS_DESCRIPTIONS[caseStatusData.status] : null;

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 text-slate-900">
      <div>
        <Header currentLang={lang} onLanguageChange={setLang} />
        <DisclaimerBanner t={t} lang={lang} />

        <main className="max-w-xl mx-auto px-4 py-8 sm:py-10">
          <div className="mb-6">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 mb-4 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{t.actions.backToHome}</span>
            </Link>
            <h1 className="text-2xl font-extrabold text-slate-900">{t.tracking.title}</h1>
            <p className="text-slate-600 text-sm mt-1">
              Enter your numeric Case ID and 6-digit Verification PIN to view real-time rescue status.
            </p>
          </div>

          <form
            onSubmit={handleLookupSubmit}
            className="space-y-4 bg-white border border-slate-200 p-6 rounded-xl shadow-xs"
          >
            <div className="space-y-1.5">
              <label
                htmlFor="case-number-input"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700"
              >
                {t.tracking.enterCaseId}
              </label>
              <input
                id="case-number-input"
                type="text"
                inputMode="numeric"
                value={caseNumber}
                onChange={(e) => setCaseNumber(e.target.value)}
                placeholder="e.g. 2026104829"
                className="w-full p-3.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono text-sm focus:ring-2 focus:ring-red-600 focus:border-red-600 focus:outline-none tracking-wider"
                required
              />
              <p className="text-[11px] text-slate-500">
                Simple numeric ID without hyphens or special symbols.
              </p>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="token-input"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700"
              >
                {t.tracking.enterToken}
              </label>
              <input
                id="token-input"
                type="text"
                inputMode="numeric"
                value={token}
                onChange={(e) => setToken(e.target.value.trim())}
                placeholder="e.g. 583921"
                className="w-full p-3.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono text-sm focus:ring-2 focus:ring-red-600 focus:border-red-600 focus:outline-none tracking-widest"
                required
              />
              <p className="text-[11px] text-slate-500">
                Easy 6-digit numeric PIN provided upon request submission.
              </p>
            </div>

            {searchError && (
              <div
                className="p-3.5 bg-red-50 border border-red-300 text-red-900 text-xs rounded-xl flex items-center gap-2 font-medium"
                role="alert"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-700" />
                <span>{searchError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-sm shadow-xs transition-colors"
            >
              <Search className="w-4 h-4 text-slate-300" />
              <span>{isLoading ? 'Checking Status...' : t.tracking.checkStatus}</span>
            </button>

            {/* Quick Sample Lookup for Testing */}
            <div className="pt-3 border-t border-slate-200 space-y-2">
              <span className="text-[11px] font-mono font-bold uppercase text-slate-500 block">
                Quick Sample Cases (In Supabase):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  {
                    num: '2026100001',
                    tok: '112233',
                    label: 'Flood (Kathmandu)',
                    badge: 'En Route',
                    badgeColor: 'bg-indigo-100 text-indigo-900 border-indigo-200',
                  },
                  {
                    num: '2026100002',
                    tok: '223344',
                    label: 'Landslide (Melamchi)',
                    badge: 'Assigned',
                    badgeColor: 'bg-amber-100 text-amber-900 border-amber-200',
                  },
                  {
                    num: '2026100003',
                    tok: '334455',
                    label: 'Avalanche (Mustang)',
                    badge: 'Verified',
                    badgeColor: 'bg-blue-100 text-blue-900 border-blue-200',
                  },
                  {
                    num: '2026100004',
                    tok: '445566',
                    label: 'Collapse (Gongabu)',
                    badge: 'Submitted',
                    badgeColor: 'bg-red-100 text-red-900 border-red-200',
                  },
                  {
                    num: '2026100006',
                    tok: '667788',
                    label: 'Medical Evac (Namche)',
                    badge: 'Rescued',
                    badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-200',
                  },
                ].map((sample) => (
                  <button
                    key={sample.num}
                    type="button"
                    onClick={() => {
                      setCaseNumber(sample.num);
                      setToken(sample.tok);
                      fetchStatus(sample.num, sample.tok, false);
                    }}
                    className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg text-xs text-slate-800 font-mono transition-colors text-left flex items-center justify-between gap-2 shadow-xs group"
                  >
                    <div>
                      <div className="font-bold text-slate-900 group-hover:text-red-700 tracking-wider">
                        {sample.num}
                      </div>
                      <div className="text-[11px] text-slate-500 font-sans">
                        {sample.label} &bull; PIN: <span className="font-mono font-semibold text-slate-700">{sample.tok}</span>
                      </div>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${sample.badgeColor} uppercase tracking-wider shrink-0`}>
                      {sample.badge}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </form>


          {caseStatusData && statusInfo && (
            <div className="mt-6 bg-white border border-slate-200 p-6 rounded-xl shadow-xs space-y-6 animate-in fade-in">
              <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-500 font-mono font-bold uppercase">Case Reference</div>
                  <div className="text-2xl font-black font-mono text-slate-900 mt-0.5">
                    {caseStatusData.caseNumber}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => fetchStatus(caseNumber, token, true)}
                  disabled={isRefreshing}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 flex items-center gap-1.5 transition-colors shadow-xs"
                  title="Refresh status now"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
                </button>
              </div>

              {/* Loading Bar with Event Circles */}
              <div className="py-2 border-b border-slate-100">
                <CaseTrackingProgressBar
                  status={caseStatusData.status}
                  submittedAt={caseStatusData.submittedAt}
                  lastUpdatedAt={caseStatusData.lastUpdatedAt}
                />
              </div>

              {/* Current Status Highlight Banner */}
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  {t.tracking.currentStatus}
                </div>
                <div className={`p-4 rounded-xl ${statusInfo.color} font-bold text-base flex items-center gap-2 shadow-xs`}>
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <span>{statusInfo.title}</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed pt-1">
                  {statusInfo.explanation}
                </p>
              </div>

              {/* Timestamp Log */}
              <div className="grid grid-cols-2 gap-3 pt-2 text-xs border-t border-slate-100 font-mono text-slate-600">
                <div>
                  <span className="block text-slate-400 font-bold uppercase text-[10px]">Submitted:</span>
                  <span className="text-slate-800 font-medium">{new Date(caseStatusData.submittedAt).toLocaleTimeString()}</span>
                </div>
                <div>
                  <span className="block text-slate-400 font-bold uppercase text-[10px]">Last Update:</span>
                  <span className="text-slate-800 font-medium">{new Date(caseStatusData.lastUpdatedAt).toLocaleTimeString()}</span>
                </div>
              </div>

              {/* Mandatory operational distinction */}
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-950 text-xs">
                Your request has been recorded. Submitting a request does not guarantee rescue. If possible, contact official emergency hotlines directly.
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default function TrackRequestPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600 font-mono text-xs">
          Loading tracking interface...
        </div>
      }
    >
      <TrackRequestContent />
    </Suspense>
  );
}
