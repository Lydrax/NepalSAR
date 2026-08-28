'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import Link from 'next/link';
import { Search, ArrowLeft, CheckCircle2, AlertTriangle, RefreshCw, Download, Check } from 'lucide-react';
import { toPng } from 'html-to-image';
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

  const [isDownloadingImage, setIsDownloadingImage] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);
  const trackingDetailsCardRef = useRef<HTMLDivElement | null>(null);

  const handleDownloadImage = async () => {
    if (!trackingDetailsCardRef.current || !caseStatusData) return;
    try {
      setIsDownloadingImage(true);
      const dataUrl = await toPng(trackingDetailsCardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });
      const link = document.createElement('a');
      link.download = `Nepal_Rescue_Status_${caseStatusData.caseNumber}.png`;
      link.href = dataUrl;
      link.click();
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3500);
    } catch (err) {
      console.error('Failed to download image', err);
    } finally {
      setIsDownloadingImage(false);
    }
  };

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
          </form>


          {caseStatusData && statusInfo && (
            <div className="mt-6 space-y-4">
              <div
                ref={trackingDetailsCardRef}
                className="bg-white border border-slate-200 p-6 rounded-xl shadow-xs space-y-6 animate-in fade-in"
              >
                <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
                      <span className="text-xs text-slate-500 font-mono font-bold uppercase">Emergency Rescue Case ID</span>
                    </div>
                    <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900">
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
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-950 text-xs space-y-1">
                  <p className="font-bold text-amber-900">NepalSAR Prototype Notice:</p>
                  <p>
                    NepalSAR is an independent prototype and is <strong>not an official emergency service or government agency</strong>. Submitting a rescue request <strong>does not guarantee a response or rescue</strong>. In an emergency, please contact official emergency services directly.
                  </p>
                </div>

                <div className="text-[10px] text-slate-400 text-center font-mono border-t border-slate-100 pt-2">
                  Nepal Rescue • National Emergency Coordination Network
                </div>
              </div>

              {/* Download As Image Button */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleDownloadImage}
                  disabled={isDownloadingImage}
                  className="w-full py-3.5 bg-red-50 hover:bg-red-100 active:bg-red-200 text-red-800 font-bold rounded-xl border border-red-200 flex items-center justify-center gap-2 text-sm transition-colors shadow-2xs cursor-pointer"
                >
                  <Download className={`w-4 h-4 ${isDownloadingImage ? 'animate-bounce' : ''}`} />
                  <span>
                    {isDownloadingImage
                      ? t.tracking.downloadingImage
                      : t.tracking.downloadImage}
                  </span>
                </button>
                {downloadSuccess && (
                  <p className="text-center text-xs text-emerald-700 font-medium animate-in fade-in flex items-center justify-center gap-1.5">
                    <Check className="w-3.5 h-3.5" />
                    <span>{t.tracking.downloadSuccess}</span>
                  </p>
                )}
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
