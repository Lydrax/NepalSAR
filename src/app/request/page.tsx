'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  MapPin,
  Users,
  AlertTriangle,
  HeartPulse,
  Flame,
  FileText,
  Phone,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Navigation,
  Copy,
  Check,
  WifiOff,
  RefreshCw,
  Compass,
  RotateCcw,
  BookOpen,
  Smartphone,
  ShieldCheck,
  X,
  Download,
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { getTranslations, Language } from '@/lib/i18n';
import {
  LocationData,
  ImmediateDangerSituation,
  InjuryLevel,
  DisasterType,
  RescueRequestFormData,
  RescueCaseStatus,
} from '@/lib/types/emergency';
import {
  SITUATION_OPTIONS,
  INJURY_OPTIONS,
  DISASTER_OPTIONS,
  calculatePriority,
} from '@/lib/constants/emergency';
import { Header } from '@/components/ui/Header';
import { DisclaimerBanner } from '@/components/ui/DisclaimerBanner';
import CaseTrackingProgressBar from '@/components/track/CaseTrackingProgressBar';
import {
  getRescueCredentialsByClientRequestId,
  saveRescueCredentials,
} from '@/lib/client/rescueCredentials';

const RequestLocationMap = dynamic(() => import('@/components/request/RequestLocationMap'), {
  ssr: false,
  loading: () => (
    <div className="min-h-[280px] rounded-xl border border-slate-200 bg-slate-100 flex items-center justify-center text-slate-500 text-xs font-mono">
      Loading map engine...
    </div>
  ),
});

export default function RequestRescuePage() {
  const [lang, setLang] = useState<Language>('en');
  const t = getTranslations(lang);

  // Form Step State (1 through 7, or 8 for Success/Status)
  const [currentStep, setCurrentStep] = useState<number>(1);
  const totalSteps = 7;

  // Form Field States
  const [clientRequestId, setClientRequestId] = useState<string>('');
  const [location, setLocation] = useState<LocationData>({
    latitude: null,
    longitude: null,
    accuracy: null,
    timestamp: null,
    source: 'GPS',
    manualDescription: '',
  });
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [locatingStatusText, setLocatingStatusText] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showGpsInstructions, setShowGpsInstructions] = useState<boolean>(true);
  const isLocatingCancelledRef = useRef<boolean>(false);

  const [peopleCount, setPeopleCount] = useState<number>(1);
  const [situation, setSituation] = useState<ImmediateDangerSituation>('trapped');
  const [situationOther, setSituationOther] = useState<string>('');
  const [injuryLevel, setInjuryLevel] = useState<InjuryLevel>('none');
  const [disasterType, setDisasterType] = useState<DisasterType>('flood');
  const [disasterOther, setDisasterOther] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');

  // Submission & Network State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<{
    caseNumber: string;
    accessToken: string;
    status: RescueCaseStatus;
    submittedAt: string;
    isExisting?: boolean;
    tokenRecovered?: boolean;
    tokenUnavailable?: boolean;
  } | null>(null);
  const [copiedToken, setCopiedToken] = useState<boolean>(false);
  const [copiedCase, setCopiedCase] = useState<boolean>(false);
  const [isDownloadingImage, setIsDownloadingImage] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);
  const confirmationCardRef = useRef<HTMLDivElement | null>(null);

  const handleDownloadImage = async () => {
    if (!confirmationCardRef.current || !submissionResult) return;
    try {
      setIsDownloadingImage(true);
      const dataUrl = await toPng(confirmationCardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });
      const link = document.createElement('a');
      link.download = `Nepal_Rescue_Case_${submissionResult.caseNumber}.png`;
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

  // Initialize and persist clientRequestId across retries
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storageKey = 'nepal_rescue_active_draft_req_id';
      let id = sessionStorage.getItem(storageKey);
      if (!id) {
        id =
          typeof window.crypto?.randomUUID === 'function'
            ? window.crypto.randomUUID()
            : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
                (
                  Number(c) ^
                  (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(c) / 4)))
                ).toString(16)
              );
        sessionStorage.setItem(storageKey, id);
      }
      setClientRequestId(id);
    }
  }, []);

  // Cancel GPS Acquisition
  const handleCancelLocating = useCallback(() => {
    isLocatingCancelledRef.current = true;
    setIsLocating(false);
    setLocatingStatusText(null);
  }, []);

  // Standard Direct GPS Acquisition Handler with Guaranteed 1.5-Second Animation
  const handleAcquireLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError(
        lang === 'ne'
          ? 'यो ब्राउजर वा यन्त्रमा जीपीएस समर्थित छैन। कृपया तलको नक्सामा थिचेर वा स्थानको विवरण लेखेर दर्ता गर्नुहोस्।'
          : 'Geolocation is not supported on this browser or device. Please select your location on the map or enter a description manually.'
      );
      return;
    }

    isLocatingCancelledRef.current = false;
    setIsLocating(true);
    setLocationError(null);
    setLocatingStatusText(
      lang === 'ne'
        ? 'जीपीएस स्थान खोजी भइरहेको छ... कृपया अनुमति दिनुहोस्।'
        : 'Acquiring GPS coordinates... Please grant permission if prompted.'
    );

    const startTime = Date.now();
    const completeWithAnimation = (action: () => void) => {
      const elapsed = Date.now() - startTime;
      const minDuration = 1500; // Guaranteed 1.5s smooth animation feedback
      if (elapsed < minDuration) {
        setTimeout(() => {
          if (!isLocatingCancelledRef.current) {
            action();
          }
        }, minDuration - elapsed);
      } else {
        action();
      }
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (isLocatingCancelledRef.current) return;
        completeWithAnimation(() => {
          setLocation((prev) => ({
            ...prev,
            latitude: Number(pos.coords.latitude.toFixed(6)),
            longitude: Number(pos.coords.longitude.toFixed(6)),
            accuracy: Math.round(pos.coords.accuracy),
            timestamp: new Date(pos.timestamp).toISOString(),
            source: 'GPS',
          }));
          setIsLocating(false);
          setLocatingStatusText(null);
          setLocationError(null);
        });
      },
      (err) => {
        if (isLocatingCancelledRef.current) return;
        completeWithAnimation(() => {
          setIsLocating(false);
          setLocatingStatusText(null);

          if (err.code === err.PERMISSION_DENIED) {
            setLocationError(
              lang === 'ne'
                ? 'स्थान अनुमति अस्वीकार गरिएको छ। कृपया ब्राउजरमा स्थान अनुमति दिनुहोस्, वा तलको नक्सामा सीधै आफ्नो स्थान छान्नुहोस्।'
                : 'Location permission was denied. Please enable location permissions in your browser or select your location directly on the map below.'
            );
          } else if (err.code === err.TIMEOUT) {
            setLocationError(
              lang === 'ne'
                ? 'जीपीएस संकेत फेला पार्न समय लाग्यो। कृपया पुनः प्रयास गर्नुहोस् वा तलको नक्सामा स्थान छान्नुहोस्।'
                : 'GPS signal request timed out. Please retry or pick your location directly on the map below.'
            );
          } else {
            setLocationError(
              lang === 'ne'
                ? 'जीपीएस स्थान प्राप्त हुन सकेन। कृपया तलको नक्सामा थिचेर स्थान छान्नुहोस्।'
                : 'Unable to acquire GPS coordinates. Please select your location directly on the map below.'
            );
          }
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000,
      }
    );
  }, [lang]);

  const handleMapLocationSelect = useCallback(
    (coords: {
      latitude: number;
      longitude: number;
      source: 'MAP';
      accuracy: number | null;
      timestamp: string;
    }) => {
      setLocation((current) => ({
        ...current,
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        timestamp: coords.timestamp,
        source: coords.source,
      }));
      setLocationError(null);
    },
    []
  );

  // Submission Handler
  const handleSubmit = async () => {
    setIsSubmitting(true);
    setNetworkError(null);

    const formData: RescueRequestFormData = {
      clientRequestId,
      location,
      peopleCount,
      situation,
      situationOther: situation === 'other' ? situationOther : undefined,
      injuryLevel,
      disasterType,
      disasterOther: disasterType === 'other' ? disasterOther : undefined,
      description: description.trim(),
      phoneNumber: phoneNumber.trim() || undefined,
    };

    try {
      const response = await fetch('/api/rescue/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const resData = await response.json();

      if (!response.ok) {
        throw new Error(resData.error || resData.details?.join(', ') || 'Failed to submit request.');
      }

      // Clear draft ID upon successful submission
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('nepal_rescue_active_draft_req_id');
      }

      if (resData.isExisting) {
        const storedCredentials = getRescueCredentialsByClientRequestId(clientRequestId);

        if (storedCredentials?.verificationToken) {
          setSubmissionResult({
            caseNumber: resData.caseNumber,
            accessToken: storedCredentials.verificationToken,
            status: resData.status || 'SUBMITTED',
            submittedAt: resData.createdAt || storedCredentials.savedAt,
            isExisting: true,
            tokenRecovered: true,
          });
        } else {
          setSubmissionResult({
            caseNumber: resData.caseNumber,
            accessToken: '',
            status: resData.status || 'SUBMITTED',
            submittedAt: resData.createdAt || new Date().toISOString(),
            isExisting: true,
            tokenUnavailable: true,
          });
        }
      } else if (resData.verificationToken) {
        saveRescueCredentials(clientRequestId, resData.caseNumber, resData.verificationToken);

        setSubmissionResult({
          caseNumber: resData.caseNumber,
          accessToken: resData.verificationToken,
          status: resData.status || 'SUBMITTED',
          submittedAt: resData.createdAt || new Date().toISOString(),
        });
      } else {
        throw new Error('Submission succeeded but no verification credential was returned.');
      }

      // Notify any active Command Panels / Dispatch operations tabs for instant queue update
      if (typeof window !== 'undefined') {
        try {
          if ('BroadcastChannel' in window) {
            const bc = new BroadcastChannel('nepal_sar_dispatch_sync');
            bc.postMessage({
              type: 'NEW_RESCUE_SUBMITTED',
              caseNumber: resData.caseNumber,
              timestamp: Date.now(),
            });
            bc.close();
          }
          localStorage.setItem('nepal_sar_last_dispatch_event', JSON.stringify({
            type: 'NEW_RESCUE_SUBMITTED',
            caseNumber: resData.caseNumber,
            timestamp: Date.now(),
          }));
          window.dispatchEvent(new CustomEvent('nepal_sar_dispatch_update', {
            detail: { type: 'NEW_RESCUE_SUBMITTED', caseNumber: resData.caseNumber },
          }));
        } catch {
          // Non-blocking notification
        }
      }

      setCurrentStep(8); // Success step
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Connection unavailable. Your request has not yet reached the rescue coordination server.';
      setNetworkError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToken = () => {
    if (submissionResult?.accessToken) {
      navigator.clipboard.writeText(submissionResult.accessToken);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 3000);
    }
  };

  const copyCaseId = () => {
    if (submissionResult?.caseNumber) {
      navigator.clipboard.writeText(submissionResult.caseNumber);
      setCopiedCase(true);
      setTimeout(() => setCopiedCase(false), 3000);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 text-slate-900">
      <div>
        <Header currentLang={lang} onLanguageChange={setLang} />
        <DisclaimerBanner t={t} lang={lang} />

        <main className="max-w-2xl mx-auto px-4 py-6 sm:py-8">
          {currentStep <= totalSteps && (
            <div className="mb-6 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-600 mb-2 font-mono font-semibold">
                <span className="uppercase tracking-wider">Step {currentStep} of {totalSteps}</span>
                <span>{Math.round((currentStep / totalSteps) * 100)}% Completed</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200">
                <div
                  className="bg-red-700 h-2.5 transition-all duration-300 ease-out"
                  style={{ width: `${(currentStep / totalSteps) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* STEP 1: LOCATION */}
          {currentStep === 1 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-7 shadow-xs space-y-6">
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="space-y-1">
                  <h2 className="text-xl sm:text-2xl font-extrabold flex items-center gap-2.5 text-slate-900">
                    <MapPin className="w-6 h-6 text-red-700 shrink-0" />
                    {t.steps.step1Title}
                  </h2>
                  <p className="text-slate-600 text-sm">{t.steps.step1Prompt}</p>
                </div>
                {!showGpsInstructions && (
                  <button
                    type="button"
                    onClick={() => setShowGpsInstructions(true)}
                    className="shrink-0 text-xs font-bold text-red-700 hover:text-red-900 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                    title={t.gpsGuide.viewInstructionsBtn}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>{t.gpsGuide.viewInstructionsBtn}</span>
                  </button>
                )}
              </div>

              {/* Red-Themed GPS Instructions Card */}
              {showGpsInstructions && (
                <div className="bg-gradient-to-br from-rose-50/90 via-red-50/40 to-slate-50 border-2 border-red-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="flex items-start justify-between gap-3 border-b border-red-200/70 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-red-700 text-white flex items-center justify-center shadow-xs shrink-0">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-tight">
                          {t.gpsGuide.title}
                        </h3>
                        <p className="text-xs text-red-900/80 font-medium mt-0.5">
                          {t.gpsGuide.subtitle}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowGpsInstructions(false)}
                      className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-red-100/80 transition-colors cursor-pointer"
                      title={t.gpsGuide.hideInstructionsBtn}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Step 1 */}
                    <div className="bg-white p-3 rounded-xl border border-red-100 shadow-2xs space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-red-700 text-white text-[11px] font-bold flex items-center justify-center shrink-0">1</span>
                        <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                          <Smartphone className="w-3.5 h-3.5 text-red-700" />
                          {t.gpsGuide.step1Title}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 pl-7 leading-relaxed">
                        {t.gpsGuide.step1Desc}
                      </p>
                    </div>

                    {/* Step 2 */}
                    <div className="bg-white p-3 rounded-xl border border-red-100 shadow-2xs space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-red-700 text-white text-[11px] font-bold flex items-center justify-center shrink-0">2</span>
                        <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                          <Navigation className="w-3.5 h-3.5 text-red-600" />
                          {t.gpsGuide.step2Title}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 pl-7 leading-relaxed">
                        {t.gpsGuide.step2Desc}
                      </p>
                    </div>

                    {/* Step 3 */}
                    <div className="bg-white p-3 rounded-xl border border-red-100 shadow-2xs space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-red-700 text-white text-[11px] font-bold flex items-center justify-center shrink-0">3</span>
                        <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          {t.gpsGuide.step3Title}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 pl-7 leading-relaxed">
                        {t.gpsGuide.step3Desc}
                      </p>
                    </div>

                    {/* Step 4 */}
                    <div className="bg-white p-3 rounded-xl border border-red-100 shadow-2xs space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-red-700 text-white text-[11px] font-bold flex items-center justify-center shrink-0">4</span>
                        <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                          <Compass className="w-3.5 h-3.5 text-amber-600" />
                          {t.gpsGuide.step4Title}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 pl-7 leading-relaxed">
                        {t.gpsGuide.step4Desc}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-red-200/60">
                    <span className="text-[11px] text-red-950 font-medium">
                      💡 {lang === 'ne' ? 'निर्देशन जुनसुकै बेला फेरि हेर्न सकिन्छ' : 'You can refer back to these steps at any time'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowGpsInstructions(false)}
                      className="px-4 py-2 bg-red-700 hover:bg-red-800 active:bg-red-900 text-white text-xs font-bold rounded-lg flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>{t.gpsGuide.understoodBtn}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Active Locating Status or Primary GPS Trigger Button */}
              {isLocating ? (
                <div className="p-4 bg-slate-900 text-white rounded-xl space-y-3 shadow-md border border-slate-800 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-2.5">
                    <div className="flex items-center gap-2.5 font-bold text-sm text-red-400">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                      </span>
                      <Navigation className="w-5 h-5 text-red-500 animate-spin shrink-0" />
                      <span>{lang === 'ne' ? 'स्थान खोजी भइरहेको छ...' : 'Locking GPS Coordinates...'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCancelLocating}
                      className="text-xs font-bold text-slate-300 hover:text-white px-2.5 py-1 rounded-lg hover:bg-slate-800 border border-slate-700 transition-colors cursor-pointer"
                    >
                      {t.actions.cancelLocating}
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-slate-100 flex items-center gap-2">
                      <span>{locatingStatusText || (lang === 'ne' ? 'जीपीएस संकेत खोज्दै...' : 'Searching for device GPS signal...')}</span>
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {lang === 'ne'
                        ? 'कृपया आफ्नो स्क्रिनमा स्थान अनुमति दिने पप-अप आएको छ कि हेर्नुहोस्।'
                        : 'Please check your screen for a browser prompt asking to allow location access.'}
                    </p>
                  </div>

                  {/* Animated pulse progress bar */}
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-red-500 h-1.5 w-full animate-pulse" />
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={handleAcquireLocation}
                    className="w-full py-4 px-4 bg-red-700 hover:bg-red-800 active:bg-red-900 text-white font-bold rounded-xl flex items-center justify-center gap-2.5 shadow-xs transition-colors cursor-pointer"
                  >
                    <Navigation className="w-5 h-5" />
                    <span>{t.actions.useMyLocation}</span>
                  </button>
                  <p className="text-[11px] text-slate-500 text-center">
                    {lang === 'ne'
                      ? 'तपाईंको यन्त्रको जीपीएसबाट स्वतः सटीक अक्षांश र देशान्तर लिइनेछ'
                      : 'Automatically locks accurate latitude & longitude from your device'}
                  </p>
                </div>
              )}

              {/* GPS Result Indicator */}
              {location.latitude !== null && location.longitude !== null && !isLocating && (
                <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl space-y-2.5 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-emerald-900 font-bold">
                      <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
                      <span>{t.status.locationDetected}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleAcquireLocation}
                      disabled={isLocating}
                      className="text-xs font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-100 hover:bg-emerald-200 px-2.5 py-1 rounded-lg border border-emerald-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Re-run GPS signal lock"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
                      <span>{isLocating ? 'Acquiring...' : 'Re-check GPS'}</span>
                    </button>
                  </div>

                  <div className="font-mono text-xs text-slate-900 grid grid-cols-2 gap-2 bg-white p-3 rounded-lg border border-emerald-200 shadow-xs">
                    <div><span className="text-slate-500 font-semibold">LATITUDE:</span> {location.latitude}</div>
                    <div><span className="text-slate-500 font-semibold">LONGITUDE:</span> {location.longitude}</div>
                  </div>

                  <div className="text-xs text-slate-700 flex items-center justify-between flex-wrap gap-2">
                    <span>
                      Accuracy: approximately <strong className="text-slate-900">{location.accuracy ?? 'N/A'} {t.status.meters}</strong>
                    </span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-900 font-bold px-2 py-0.5 rounded border border-emerald-300 uppercase">
                      SOURCE: {location.source}
                    </span>
                  </div>

                  {location.accuracy && location.accuracy > 100 && (
                    <div className="text-xs text-amber-900 bg-amber-50 p-3 rounded-lg border border-amber-300 space-y-1">
                      <p className="font-bold">GPS Accuracy is Approximate</p>
                      <p className="text-amber-800">
                        You can drag the pin on the satellite map below to mark your exact rooftop or landmark.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Location Error / Fallback message */}
              {locationError && !isLocating && (
                <div className="p-4 bg-red-50 border border-red-300 text-red-900 text-xs rounded-xl space-y-2.5">
                  <div className="flex items-start gap-2 font-medium">
                    <AlertTriangle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                    <span>{locationError}</span>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleAcquireLocation}
                      disabled={isLocating}
                      className="px-3.5 py-2 bg-red-700 hover:bg-red-800 text-white font-bold rounded-lg text-xs flex items-center gap-2 transition-colors cursor-pointer shadow-xs active:bg-red-900"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
                      <span>{isLocating ? (lang === 'ne' ? 'खोज्दैछ...' : 'Searching...') : t.actions.retryGps}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Interactive Leaflet map fallback */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="block text-sm font-bold text-slate-800">
                    {t.actions.selectOnMap}
                  </label>
                  <span className="text-[11px] text-slate-500 font-mono font-semibold uppercase">
                    {location.latitude !== null && location.longitude !== null
                      ? `PIN SET VIA ${location.source}`
                      : 'NO PIN SELECTED'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Tap or click the high-resolution satellite map below to place or refine the incident marker.
                </p>
                <div className="h-[320px]">
                  <RequestLocationMap
                    latitude={location.latitude}
                    longitude={location.longitude}
                    onLocationSelect={handleMapLocationSelect}
                  />
                </div>
              </div>

              {/* Manual Location Fallback Input */}
              <div className="space-y-2 pt-2">
                <label className="block text-sm font-bold text-slate-800">
                  {t.actions.enterDescription} <span className="text-xs text-slate-500 font-normal">(Required if GPS coordinates fail)</span>
                </label>
                <textarea
                  value={location.manualDescription}
                  onChange={(e) => {
                    const text = e.target.value;
                    setLocation((prev) => ({
                      ...prev,
                      manualDescription: text,
                      source:
                        prev.latitude !== null && prev.longitude !== null
                          ? prev.source
                          : 'MANUAL',
                    }));
                  }}
                  placeholder="e.g. Near Timure checkpoint, beside the bridge, red house on 2nd floor"
                  rows={3}
                  className="w-full p-3 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-red-600 focus:border-red-600 focus:outline-none text-sm"
                />
              </div>
            </div>
          )}

          {/* STEP 2: PEOPLE COUNT */}
          {currentStep === 2 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-7 shadow-xs space-y-6">
              <div className="space-y-1.5 border-b border-slate-100 pb-4">
                <h2 className="text-xl sm:text-2xl font-extrabold flex items-center gap-2.5 text-slate-900">
                  <Users className="w-6 h-6 text-red-700 shrink-0" />
                  {t.steps.step2Title}
                </h2>
                <p className="text-slate-600 text-sm">{t.steps.step2Prompt}</p>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-6 rounded-xl text-center space-y-6">
                <div className="text-6xl font-black text-slate-900 font-mono">{peopleCount}</div>
                <div className="flex items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => setPeopleCount(Math.max(1, peopleCount - 1))}
                    className="w-14 h-14 rounded-xl bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-900 text-2xl font-black border border-slate-300 flex items-center justify-center shadow-xs transition-colors"
                  >
                    -
                  </button>
                  <button
                    type="button"
                    onClick={() => setPeopleCount(Math.min(100, peopleCount + 1))}
                    className="w-14 h-14 rounded-xl bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-900 text-2xl font-black border border-slate-300 flex items-center justify-center shadow-xs transition-colors"
                  >
                    +
                  </button>
                </div>

                <div className="flex flex-wrap justify-center gap-2">
                  {[1, 2, 4, 8, 15, 25].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setPeopleCount(count)}
                      className={`px-3 py-1.5 text-xs rounded-lg font-bold border transition-colors ${
                        peopleCount === count
                          ? 'bg-red-700 border-red-700 text-white'
                          : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {count} {count === 1 ? 'Person' : 'People'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: IMMEDIATE DANGER */}
          {currentStep === 3 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-7 shadow-xs space-y-6">
              <div className="space-y-1.5 border-b border-slate-100 pb-4">
                <h2 className="text-xl sm:text-2xl font-extrabold flex items-center gap-2.5 text-slate-900">
                  <AlertTriangle className="w-6 h-6 text-red-700 shrink-0" />
                  {t.steps.step3Title}
                </h2>
                <p className="text-slate-600 text-sm">{t.steps.step3Prompt}</p>
              </div>

              <div className="grid gap-3">
                {SITUATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSituation(opt.id)}
                    className={`p-4 rounded-xl text-left border transition-all flex items-center justify-between ${
                      situation === opt.id
                        ? 'bg-red-50/70 border-red-600 text-red-950 ring-1 ring-red-600'
                        : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-base text-slate-900">{opt.label}</div>
                      <div className="text-xs text-slate-600 mt-0.5">{opt.description}</div>
                    </div>
                    {situation === opt.id && <CheckCircle2 className="w-5 h-5 text-red-700 shrink-0 ml-2" />}
                  </button>
                ))}
              </div>

              {situation === 'other' && (
                <div className="space-y-1 pt-2">
                  <label className="text-xs font-bold text-slate-800">Specify situation:</label>
                  <input
                    type="text"
                    value={situationOther}
                    onChange={(e) => setSituationOther(e.target.value)}
                    placeholder="Describe emergency danger..."
                    className="w-full p-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-red-600 focus:border-red-600"
                  />
                </div>
              )}
            </div>
          )}

          {/* STEP 4: INJURY STATUS */}
          {currentStep === 4 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-7 shadow-xs space-y-6">
              <div className="space-y-1.5 border-b border-slate-100 pb-4">
                <h2 className="text-xl sm:text-2xl font-extrabold flex items-center gap-2.5 text-slate-900">
                  <HeartPulse className="w-6 h-6 text-red-700 shrink-0" />
                  {t.steps.step4Title}
                </h2>
                <p className="text-slate-600 text-sm">{t.steps.step4Prompt}</p>
              </div>

              <div className="grid gap-3">
                {INJURY_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setInjuryLevel(opt.id)}
                    className={`p-4 rounded-xl text-left border transition-all flex items-center justify-between ${
                      injuryLevel === opt.id
                        ? 'bg-red-50/70 border-red-600 text-red-950 ring-1 ring-red-600'
                        : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-slate-900 text-sm">{opt.label}</span>
                    </div>
                    {injuryLevel === opt.id && <CheckCircle2 className="w-5 h-5 text-red-700 shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 5: DISASTER TYPE */}
          {currentStep === 5 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-7 shadow-xs space-y-6">
              <div className="space-y-1.5 border-b border-slate-100 pb-4">
                <h2 className="text-xl sm:text-2xl font-extrabold flex items-center gap-2.5 text-slate-900">
                  <Flame className="w-6 h-6 text-red-700 shrink-0" />
                  {t.steps.step5Title}
                </h2>
                <p className="text-slate-600 text-sm">{t.steps.step5Prompt}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {DISASTER_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setDisasterType(opt.id)}
                    className={`p-4 rounded-xl text-left border transition-all ${
                      disasterType === opt.id
                        ? 'bg-red-50/70 border-red-600 text-red-950 ring-1 ring-red-600 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100 font-medium'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {disasterType === 'other' && (
                <div className="space-y-1 pt-2">
                  <label className="text-xs font-bold text-slate-800">Specify hazard type:</label>
                  <input
                    type="text"
                    value={disasterOther}
                    onChange={(e) => setDisasterOther(e.target.value)}
                    placeholder="Specify hazard..."
                    className="w-full p-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-red-600 focus:border-red-600"
                  />
                </div>
              )}
            </div>
          )}

          {/* STEP 6: ADDITIONAL INFORMATION */}
          {currentStep === 6 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-7 shadow-xs space-y-6">
              <div className="space-y-1.5 border-b border-slate-100 pb-4">
                <h2 className="text-xl sm:text-2xl font-extrabold flex items-center gap-2.5 text-slate-900">
                  <FileText className="w-6 h-6 text-red-700 shrink-0" />
                  {t.steps.step6Title}
                </h2>
                <p className="text-slate-600 text-sm">{t.steps.step6Prompt}</p>
              </div>

              <div className="space-y-2">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
                  placeholder="e.g. We are trapped on the second floor. Water is entering the building rapidly. Two elderly persons with us."
                  rows={5}
                  maxLength={1000}
                  className="w-full p-3.5 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-red-600 focus:border-red-600 focus:outline-none text-sm"
                />
                <div className="text-right text-xs text-slate-500 font-mono">
                  {description.length} / 1000 characters
                </div>
              </div>
            </div>
          )}

          {/* STEP 7: CONTACT INFORMATION */}
          {currentStep === 7 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-7 shadow-xs space-y-6">
              <div className="space-y-1.5 border-b border-slate-100 pb-4">
                <h2 className="text-xl sm:text-2xl font-extrabold flex items-center gap-2.5 text-slate-900">
                  <Phone className="w-6 h-6 text-red-700 shrink-0" />
                  {t.steps.step7Title}
                </h2>
                <p className="text-slate-600 text-sm">{t.steps.step7Prompt}</p>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="e.g. 98XXXXXXXX"
                    className="w-full p-4 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 text-lg font-mono tracking-wider focus:ring-2 focus:ring-red-600 focus:border-red-600 focus:outline-none shadow-xs"
                  />
                  <p className="text-xs text-slate-500">
                    Phone numbers are kept strictly confidential and only visible to authorized response personnel.
                  </p>
                </div>

                {/* Priority Preview based on deterministic rules */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="text-xs text-slate-600 font-bold uppercase tracking-wider">
                    Operational Triage Preview
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-700 font-medium">Calculated Priority:</span>
                    <span
                      className={`text-xs font-mono font-bold px-2.5 py-1 rounded border ${
                        calculatePriority(situation, injuryLevel) === 'CRITICAL'
                          ? 'bg-red-100 text-red-900 border-red-300'
                          : calculatePriority(situation, injuryLevel) === 'HIGH'
                          ? 'bg-orange-100 text-orange-900 border-orange-300'
                          : 'bg-blue-100 text-blue-900 border-blue-300'
                      }`}
                    >
                      {calculatePriority(situation, injuryLevel)}
                    </span>
                  </div>
                </div>

                {/* Network Error / Failure notification */}
                {networkError && (
                  <div className="p-4 bg-red-50 border border-red-300 rounded-xl text-red-900 text-xs space-y-2">
                    <div className="flex items-center gap-2 font-bold text-red-950">
                      <WifiOff className="w-4 h-4 text-red-700" />
                      <span>Connection Unavailable</span>
                    </div>
                    <p className="leading-relaxed">
                      Your request has not yet reached the rescue coordination server. Please verify your connection and tap retry. Your data has been preserved.
                    </p>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="mt-2 py-2 px-3 bg-red-700 hover:bg-red-800 text-white font-semibold rounded-lg flex items-center gap-1.5 text-xs transition-colors"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSubmitting ? 'animate-spin' : ''}`} />
                      <span>{isSubmitting ? 'Retrying...' : 'Retry Submission'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 8: SUBMISSION SUCCESS & CASE TRACKING CODE */}
          {currentStep === 8 && submissionResult && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-xs space-y-6">
              <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center p-3 bg-emerald-50 border border-emerald-200 rounded-full text-emerald-700 mb-2">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                  {submissionResult.isExisting
                    ? 'Existing Request Found'
                    : t.status.requestReceived}
                </h1>
                {submissionResult.isExisting && (
                  <p className="text-xs text-slate-600">
                    This request was already submitted. No duplicate case was created.
                  </p>
                )}
              </div>

              {/* Numeric Credentials Box (No confusing hyphens or symbols) */}
              <div ref={confirmationCardRef} className="bg-slate-50 border border-slate-200 p-5 rounded-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
                    <span className="font-bold text-xs text-slate-800 uppercase tracking-wider">Nepal Rescue Tracking Pass</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">Official Coordination Token</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Case ID Number */}
                  <div className="bg-white border border-slate-200 p-4 rounded-xl text-center space-y-1.5 shadow-xs">
                    <div className="text-[11px] text-slate-500 uppercase font-mono font-bold tracking-wider">
                      {t.status.caseIdLabel}
                    </div>
                    <div className="text-2xl sm:text-3xl font-mono font-black text-slate-900 tracking-widest select-all">
                      {submissionResult.caseNumber}
                    </div>
                    <button
                      onClick={copyCaseId}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-md border border-slate-300 shadow-xs transition-colors"
                    >
                      {copiedCase ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-600" />}
                      <span>{copiedCase ? 'Case ID Copied' : 'Copy Case ID'}</span>
                    </button>
                  </div>

                  {/* 6-Digit Verification PIN */}
                  {!submissionResult.tokenUnavailable ? (
                    <div className="bg-amber-50/70 border border-amber-300 p-4 rounded-xl text-center space-y-1.5 shadow-xs">
                      <div className="text-[11px] text-amber-950 uppercase font-mono font-bold tracking-wider">
                        {t.status.caseTokenLabel}
                      </div>
                      <div className="text-2xl sm:text-3xl font-mono font-black text-amber-950 tracking-widest select-all">
                        {submissionResult.accessToken}
                      </div>
                      <button
                        onClick={copyToken}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-white hover:bg-amber-100 text-amber-950 text-xs font-semibold rounded-md border border-amber-300 shadow-xs transition-colors"
                      >
                        {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-amber-800" />}
                        <span>{copiedToken ? 'PIN Copied' : 'Copy PIN'}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-300 p-4 rounded-xl text-left space-y-1">
                      <div className="text-xs text-amber-900 font-bold uppercase">
                        PIN Unavailable
                      </div>
                      <p className="text-xs text-amber-800 leading-relaxed">
                        Use your saved PIN to track or contact dispatch with your Case ID.
                      </p>
                    </div>
                  )}
                </div>

                <div className="text-center text-xs text-slate-600">
                  <p>
                    <span className="font-semibold text-slate-800">Save both numbers.</span> You will use your numeric Case ID and 6-digit PIN to check status.
                  </p>
                </div>

                {/* Real-time Case Progress Loading Bar with Circles */}
                <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
                  <CaseTrackingProgressBar
                    status={submissionResult.status}
                    submittedAt={submissionResult.submittedAt}
                    isCompact={false}
                  />
                </div>

                <div className="pt-2 text-[10px] text-slate-400 text-center font-mono border-t border-slate-200/60">
                  Nepal Rescue • National Emergency Coordination Network
                </div>
              </div>

              {/* Download Details as Image Button */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleDownloadImage}
                  disabled={isDownloadingImage}
                  className="w-full py-3 bg-red-50 hover:bg-red-100 active:bg-red-200 text-red-800 font-bold rounded-xl border border-red-200 flex items-center justify-center gap-2 text-sm transition-colors shadow-2xs cursor-pointer"
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


              {/* MANDATORY DISTINCTION NOTICE */}
              <div className="p-4 bg-amber-50 border-l-4 border-amber-600 rounded-r-xl space-y-1.5 text-sm text-amber-950">
                <p className="font-bold text-amber-900">Important Operational Notice:</p>
                <p className="leading-relaxed text-xs sm:text-sm">
                  Your request has been received by this system. This does not mean that a rescue team has accepted or been dispatched to the request. If possible, contact official emergency hotlines directly.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <Link
                  href="/track"
                  className="w-full flex items-center justify-center py-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-center transition-colors shadow-xs"
                >
                  Go to Case Tracking
                </Link>
                <Link
                  href="/"
                  className="w-full flex items-center justify-center py-3 text-slate-600 hover:text-slate-900 text-xs font-medium text-center"
                >
                  {t.actions.backToHome}
                </Link>
              </div>
            </div>
          )}

          {/* Navigation Controls (Previous / Next / Submit) */}
          {currentStep <= totalSteps && (
            <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep(currentStep - 1)}
                  className="py-3 px-5 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-xl border border-slate-300 flex items-center gap-1.5 text-sm shadow-xs transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>{t.actions.previous}</span>
                </button>
              ) : (
                <Link
                  href="/"
                  className="py-3 px-5 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-xl border border-slate-300 flex items-center gap-1.5 text-sm shadow-xs transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Home</span>
                </Link>
              )}

              {currentStep < totalSteps ? (
                <button
                  type="button"
                  onClick={() => {
                    // Validation: step 1 requires GPS coordinates or manual location description
                    if (
                      currentStep === 1 &&
                      (location.latitude === null || location.longitude === null) &&
                      !location.manualDescription?.trim()
                    ) {
                      setLocationError('Please either acquire your GPS coordinates or enter a location description.');
                      return;
                    }
                    setLocationError(null);
                    setCurrentStep(currentStep + 1);
                  }}
                  className="py-3 px-6 bg-red-700 hover:bg-red-800 text-white font-bold rounded-xl flex items-center gap-1.5 text-sm ml-auto shadow-xs transition-colors"
                >
                  <span>{t.actions.next}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="py-3.5 px-6 bg-red-700 hover:bg-red-800 active:bg-red-900 disabled:bg-slate-300 disabled:text-slate-500 text-white font-black rounded-xl flex items-center gap-2 text-base ml-auto shadow-sm transition-all"
                >
                  <span>{isSubmitting ? 'Submitting request...' : t.actions.submit}</span>
                </button>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
