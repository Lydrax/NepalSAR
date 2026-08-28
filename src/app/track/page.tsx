'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { Search, ArrowLeft, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { getTranslations, Language } from '@/lib/i18n';
import { STATUS_DESCRIPTIONS } from '@/lib/constants/emergency';
import { RescueCaseStatus } from '@/lib/types/emergency';
import { Header } from '@/components/ui/Header';
import { DisclaimerBanner } from '@/components/ui/DisclaimerBanner';

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
    <div className="min-h-screen flex flex-col justify-between bg-slate-950 text-slate-100">
      <div>
        <Header currentLang={lang} onLanguageChange={setLang} />
        <DisclaimerBanner t={t} lang={lang} />

        <main className="max-w-xl mx-auto px-4 py-8">
          <div className="mb-6">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 mb-4"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{t.actions.backToHome}</span>
            </Link>
            <h1 className="text-2xl font-black text-white">{t.tracking.title}</h1>
            <p className="text-slate-400 text-xs mt-1">
              Enter your unique Case ID and Verification Token to view the current operational status.
            </p>
          </div>

          <form
            onSubmit={handleLookupSubmit}
            className="space-y-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl"
          >
            <div className="space-y-1.5">
              <label
                htmlFor="case-number-input"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300"
              >
                {t.tracking.enterCaseId}
              </label>
              <input
                id="case-number-input"
                type="text"
                value={caseNumber}
                onChange={(e) => setCaseNumber(e.target.value.toUpperCase())}
                placeholder="e.g. NR-2026-000184"
                className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm uppercase focus:ring-2 focus:ring-red-500 focus:outline-none"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="token-input"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300"
              >
                {t.tracking.enterToken}
              </label>
              <input
                id="token-input"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Enter verification code provided at submission"
                className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
                required
              />
              <p className="text-[11px] text-slate-400 pt-0.5">
                The verification code is confidential. It is never transmitted in browser URLs.
              </p>
            </div>

            {searchError && (
              <div
                className="p-3 bg-red-950/60 border border-red-800 text-red-200 text-xs rounded-xl flex items-center gap-2"
                role="alert"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{searchError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-slate-800 hover:bg-slate-750 text-white font-bold rounded-xl border border-slate-700 flex items-center justify-center gap-2 text-sm transition-colors"
            >
              <Search className="w-4 h-4 text-slate-400" />
              <span>{isLoading ? 'Checking Status...' : t.tracking.checkStatus}</span>
            </button>
          </form>

          {caseStatusData && statusInfo && (
            <div className="mt-8 bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-5 animate-in fade-in">
              <div className="border-b border-slate-800 pb-4 flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400 font-mono uppercase">Case ID</div>
                  <div className="text-2xl font-black font-mono text-white mt-0.5">
                    {caseStatusData.caseNumber}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => fetchStatus(caseNumber, token, true)}
                  disabled={isRefreshing}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 flex items-center gap-1.5 transition-colors"
                  title="Refresh status now"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
                </button>
              </div>

              {/* Current Status Banner */}
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {t.tracking.currentStatus}
                </div>
                <div className={`p-4 rounded-xl ${statusInfo.color} font-bold text-base flex items-center gap-2`}>
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <span>{statusInfo.title}</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed pt-1">
                  {statusInfo.explanation}
                </p>
              </div>

              {/* Timestamp Log */}
              <div className="grid grid-cols-2 gap-3 pt-2 text-xs border-t border-slate-800 font-mono text-slate-400">
                <div>
                  <span className="block text-slate-500">Submitted:</span>
                  <span className="text-slate-300">{new Date(caseStatusData.submittedAt).toLocaleTimeString()}</span>
                </div>
                <div>
                  <span className="block text-slate-500">Last Update:</span>
                  <span className="text-slate-300">{new Date(caseStatusData.lastUpdatedAt).toLocaleTimeString()}</span>
                </div>
              </div>

              {/* Mandatory operational distinction */}
              <div className="p-3 bg-amber-950/40 border border-amber-800/40 rounded-xl text-amber-200 text-xs">
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
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300 font-mono text-xs">
          Loading tracking interface...
        </div>
      }
    >
      <TrackRequestContent />
    </Suspense>
  );
}
