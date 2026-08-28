'use client';

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
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
import {
  getRescueCredentialsByClientRequestId,
  saveRescueCredentials,
} from '@/lib/client/rescueCredentials';

const RequestLocationMap = dynamic(() => import('@/components/request/RequestLocationMap'), {
  ssr: false,
  loading: () => (
    <div className="min-h-[280px] rounded-xl border border-slate-800 bg-slate-900 flex items-center justify-center text-slate-400 text-xs font-mono">
      Loading map...
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
  const [locationError, setLocationError] = useState<string | null>(null);

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

  // GPS Acquisition Handler
  const handleAcquireLocation = () => {
    setIsLocating(true);
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported on this browser. Please enter location description manually.');
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
          accuracy: Math.round(pos.coords.accuracy),
          timestamp: new Date(pos.timestamp).toISOString(),
          source: 'GPS',
          manualDescription: location.manualDescription,
        });
        setIsLocating(false);
      },
      (err) => {
        let msg = 'Unable to retrieve location.';
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'Location permission was denied. Please describe your location in the text field below.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = 'GPS signal is currently unavailable. Please enter your location description manually.';
        } else if (err.code === err.TIMEOUT) {
          msg = 'Location acquisition timed out. Please retry or enter your location manually.';
        }
        setLocationError(msg);
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      }
    );
  };

  const handleMapLocationSelect = (coords: {
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
  };

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
    <div className="min-h-screen flex flex-col justify-between bg-slate-950 text-slate-100">
      <div>
        <Header currentLang={lang} onLanguageChange={setLang} />
        <DisclaimerBanner t={t} lang={lang} />

        <main className="max-w-xl mx-auto px-4 py-6">
          {currentStep <= totalSteps && (
            <div className="mb-6">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-mono">
                <span>STEP {currentStep} OF {totalSteps}</span>
                <span>{Math.round((currentStep / totalSteps) * 100)}% COMPLETED</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-red-600 h-2 transition-all duration-300 ease-out"
                  style={{ width: `${(currentStep / totalSteps) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* STEP 1: LOCATION */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-white">
                  <MapPin className="w-6 h-6 text-red-500" />
                  {t.steps.step1Title}
                </h2>
                <p className="text-slate-300 text-sm">{t.steps.step1Prompt}</p>
              </div>

              {/* Primary GPS button */}
              <button
                type="button"
                onClick={handleAcquireLocation}
                disabled={isLocating}
                className="w-full py-4 px-4 bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:bg-slate-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-md transition-colors"
              >
                <Navigation className={`w-5 h-5 ${isLocating ? 'animate-spin' : ''}`} />
                <span>{isLocating ? 'Acquiring GPS Location...' : t.actions.useMyLocation}</span>
              </button>

              {/* GPS Result Indicator */}
              {location.latitude !== null && location.longitude !== null && (
                <div className="p-4 bg-slate-900 border border-emerald-600/40 rounded-xl space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>{t.status.locationDetected}</span>
                  </div>
                  <div className="font-mono text-xs text-slate-300 grid grid-cols-2 gap-2 bg-slate-950 p-2.5 rounded">
                    <div>Lat: {location.latitude}</div>
                    <div>Lng: {location.longitude}</div>
                  </div>
                  <div className="text-xs text-slate-400 flex items-center justify-between">
                    <span>
                      Location accuracy: approximately <strong className="text-slate-200">{location.accuracy} {t.status.meters}</strong>
                    </span>
                    <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-300 uppercase">
                      SOURCE: {location.source}
                    </span>
                  </div>
                  {location.accuracy && location.accuracy > 100 && (
                    <div className="text-xs text-amber-300 bg-amber-950/60 p-3 rounded-lg border border-amber-800/40 space-y-1">
                      <p className="font-semibold">Your location is approximate.</p>
                      <p className="text-amber-300/90">
                        If possible, move to an open area or describe your location manually below so responders can pinpoint you.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Location Error / Fallback message */}
              {locationError && (
                <div className="p-3 bg-red-950/60 border border-red-800 text-red-200 text-xs rounded-xl">
                  {locationError}
                </div>
              )}

              {/* Interactive Leaflet map fallback */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="block text-sm font-semibold text-slate-200">
                    {t.actions.selectOnMap}
                  </label>
                  <span className="text-[11px] text-slate-500 font-mono uppercase">
                    {location.latitude !== null && location.longitude !== null
                      ? `PIN SET VIA ${location.source}`
                      : 'NO PIN SELECTED'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  If GPS is unavailable or inaccurate, tap the map to choose the best rescue location.
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
                <label className="block text-sm font-semibold text-slate-200">
                  {t.actions.enterDescription} <span className="text-xs text-slate-400 font-normal">(Required if GPS fails)</span>
                </label>
                <textarea
                  value={location.manualDescription}
                  onChange={(e) =>
                    setLocation({
                      ...location,
                      manualDescription: e.target.value,
                      source:
                        location.latitude !== null && location.longitude !== null
                          ? location.source
                          : 'MANUAL',
                    })
                  }
                  placeholder="e.g. Near Timure checkpoint, beside the bridge, red house on 2nd floor"
                  rows={3}
                  className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-red-500 focus:outline-none text-sm"
                />
              </div>
            </div>
          )}

          {/* STEP 2: PEOPLE COUNT */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-white">
                  <Users className="w-6 h-6 text-red-500" />
                  {t.steps.step2Title}
                </h2>
                <p className="text-slate-300 text-sm">{t.steps.step2Prompt}</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl text-center space-y-6">
                <div className="text-5xl font-black text-white font-mono">{peopleCount}</div>
                <div className="flex items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => setPeopleCount(Math.max(1, peopleCount - 1))}
                    className="w-14 h-14 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-2xl font-bold border border-slate-700 flex items-center justify-center transition-colors"
                  >
                    -
                  </button>
                  <button
                    type="button"
                    onClick={() => setPeopleCount(Math.min(100, peopleCount + 1))}
                    className="w-14 h-14 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-2xl font-bold border border-slate-700 flex items-center justify-center transition-colors"
                  >
                    +
                  </button>
                </div>

                <div className="flex justify-center gap-2">
                  {[1, 2, 4, 8, 15].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setPeopleCount(count)}
                      className={`px-3 py-1.5 text-xs rounded font-semibold border ${
                        peopleCount === count
                          ? 'bg-red-600 border-red-500 text-white'
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
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
            <div className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-white">
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                  {t.steps.step3Title}
                </h2>
                <p className="text-slate-300 text-sm">{t.steps.step3Prompt}</p>
              </div>

              <div className="grid gap-3">
                {SITUATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSituation(opt.id)}
                    className={`p-4 rounded-xl text-left border transition-all flex items-center justify-between ${
                      situation === opt.id
                        ? 'bg-red-950/60 border-red-500 text-white ring-2 ring-red-500'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-base text-white">{opt.label}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{opt.description}</div>
                    </div>
                    {situation === opt.id && <CheckCircle2 className="w-5 h-5 text-red-400 shrink-0 ml-2" />}
                  </button>
                ))}
              </div>

              {situation === 'other' && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Specify situation:</label>
                  <input
                    type="text"
                    value={situationOther}
                    onChange={(e) => setSituationOther(e.target.value)}
                    placeholder="Describe emergency situation..."
                    className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:ring-2 focus:ring-red-500"
                  />
                </div>
              )}
            </div>
          )}

          {/* STEP 4: INJURY STATUS */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-white">
                  <HeartPulse className="w-6 h-6 text-red-500" />
                  {t.steps.step4Title}
                </h2>
                <p className="text-slate-300 text-sm">{t.steps.step4Prompt}</p>
              </div>

              <div className="grid gap-3">
                {INJURY_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setInjuryLevel(opt.id)}
                    className={`p-4 rounded-xl text-left border transition-all flex items-center justify-between ${
                      injuryLevel === opt.id
                        ? 'bg-slate-900 border-red-500 text-white ring-2 ring-red-500'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 rounded text-xs uppercase font-mono ${opt.severityBadge}`}>
                        {opt.label}
                      </span>
                    </div>
                    {injuryLevel === opt.id && <CheckCircle2 className="w-5 h-5 text-red-400 shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 5: DISASTER TYPE */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-white">
                  <Flame className="w-6 h-6 text-red-500" />
                  {t.steps.step5Title}
                </h2>
                <p className="text-slate-300 text-sm">{t.steps.step5Prompt}</p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {DISASTER_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setDisasterType(opt.id)}
                    className={`p-3.5 rounded-xl text-left border transition-all ${
                      disasterType === opt.id
                        ? 'bg-red-950/60 border-red-500 text-white ring-2 ring-red-500 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {disasterType === 'other' && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Specify disaster/hazard:</label>
                  <input
                    type="text"
                    value={disasterOther}
                    onChange={(e) => setDisasterOther(e.target.value)}
                    placeholder="Specify hazard..."
                    className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:ring-2 focus:ring-red-500"
                  />
                </div>
              )}
            </div>
          )}

          {/* STEP 6: ADDITIONAL INFORMATION */}
          {currentStep === 6 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-white">
                  <FileText className="w-6 h-6 text-red-500" />
                  {t.steps.step6Title}
                </h2>
                <p className="text-slate-300 text-sm">{t.steps.step6Prompt}</p>
              </div>

              <div className="space-y-2">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
                  placeholder="e.g. We are trapped on the second floor. Water is entering the building rapidly. Two elderly persons with us."
                  rows={5}
                  maxLength={1000}
                  className="w-full p-3.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-red-500 focus:outline-none text-sm"
                />
                <div className="text-right text-xs text-slate-500 font-mono">
                  {description.length} / 1000 characters
                </div>
              </div>
            </div>
          )}

          {/* STEP 7: CONTACT INFORMATION */}
          {currentStep === 7 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-white">
                  <Phone className="w-6 h-6 text-red-500" />
                  {t.steps.step7Title}
                </h2>
                <p className="text-slate-300 text-sm">{t.steps.step7Prompt}</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="e.g. 98XXXXXXXX"
                    className="w-full p-4 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-lg font-mono tracking-wider focus:ring-2 focus:ring-red-500 focus:outline-none"
                  />
                  <p className="text-xs text-slate-400">
                    Phone numbers are kept strictly confidential and only visible to authorized response personnel.
                  </p>
                </div>

                {/* Priority Preview based on deterministic rules */}
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                  <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                    Operational Triage Preview
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">Initial Priority:</span>
                    <span
                      className={`text-xs font-mono font-bold px-2.5 py-1 rounded ${
                        calculatePriority(situation, injuryLevel) === 'CRITICAL'
                          ? 'bg-red-950 text-red-300 border border-red-700'
                          : calculatePriority(situation, injuryLevel) === 'HIGH'
                          ? 'bg-orange-950 text-orange-300 border border-orange-700'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}
                    >
                      {calculatePriority(situation, injuryLevel)}
                    </span>
                  </div>
                </div>

                {/* Network Error / Failure notification */}
                {networkError && (
                  <div className="p-4 bg-red-950/90 border border-red-700 rounded-xl text-red-200 text-xs space-y-2">
                    <div className="flex items-center gap-2 font-bold text-red-300">
                      <WifiOff className="w-4 h-4" />
                      <span>Connection Unavailable</span>
                    </div>
                    <p className="leading-relaxed">
                      Your request has not yet reached the rescue coordination server. Please verify your connection and tap retry. Your data has been preserved.
                    </p>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="mt-2 py-2 px-3 bg-red-800 hover:bg-red-700 text-white font-semibold rounded-lg flex items-center gap-1.5 text-xs transition-colors"
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
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center p-3 bg-emerald-950/60 border border-emerald-800 rounded-full text-emerald-400 mb-2">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h1 className="text-2xl font-black text-white uppercase tracking-wide">
                  {submissionResult.isExisting
                    ? 'Existing Request Found'
                    : t.status.requestReceived}
                </h1>
                {submissionResult.isExisting && (
                  <p className="text-xs text-slate-400">
                    This request was already submitted. No duplicate case was created.
                  </p>
                )}
              </div>

              {/* Case ID Display */}
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
                <div className="text-center space-y-2">
                  <div className="text-xs text-slate-400 uppercase font-mono tracking-widest">
                    {t.status.caseIdLabel}
                  </div>
                  <div className="text-3xl font-mono font-black text-red-500 tracking-wider">
                    {submissionResult.caseNumber}
                  </div>
                  <button
                    onClick={copyCaseId}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs rounded border border-slate-700"
                  >
                    {copiedCase ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCase ? 'Case ID Copied' : 'Copy Case ID'}</span>
                  </button>
                </div>

                {/* Secure Verification Token Box */}
                {submissionResult.tokenUnavailable ? (
                  <div className="p-4 bg-slate-950 rounded-xl border border-amber-800/40 space-y-2.5">
                    <div className="text-xs text-amber-400 font-bold uppercase tracking-wider">
                      Verification Credential Unavailable
                    </div>
                    <p className="text-xs text-amber-200/90 leading-relaxed">
                      Your existing request <strong>{submissionResult.caseNumber}</strong> was found,
                      but the original verification credential cannot be recovered from this device or
                      the server. If you saved it elsewhere, use it on the tracking page. Otherwise,
                      contact official emergency hotlines and reference your Case ID.
                    </p>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-950 rounded-xl border border-amber-800/40 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-amber-400 font-bold uppercase tracking-wider">
                        {t.status.caseTokenLabel}
                      </span>
                      <button
                        onClick={copyToken}
                        className="px-2.5 py-1 bg-amber-950/60 hover:bg-amber-900/80 text-amber-200 rounded border border-amber-700/60 text-xs shrink-0 flex items-center gap-1 font-semibold"
                        aria-label="Copy Verification Token"
                      >
                        {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedToken ? 'Copied' : 'Copy Code'}</span>
                      </button>
                    </div>
                    {submissionResult.tokenRecovered && (
                      <p className="text-[11px] text-emerald-300/90">
                        Your saved verification credential was restored from this device.
                      </p>
                    )}
                    <div className="font-mono text-xs text-amber-200 break-all select-all bg-slate-900/90 p-2.5 rounded border border-slate-800">
                      {submissionResult.accessToken}
                    </div>
                    <p className="text-[11px] text-amber-300/80 leading-relaxed">
                      <strong>Keep this verification code.</strong> You will need it to check your request later. The verification code cannot be recovered if lost.
                    </p>
                  </div>
                )}

                {/* Status Indicator */}
                <div className="flex items-center justify-between p-3 bg-amber-950/40 border border-amber-800/40 rounded-xl text-amber-200 text-sm">
                  <span className="font-semibold">Current Status:</span>
                  <span className="font-mono font-bold bg-amber-700/80 px-2 py-0.5 rounded text-white text-xs">
                    {submissionResult.status}
                  </span>
                </div>
              </div>

              {/* MANDATORY DISTINCTION NOTICE (Section 1 & 12) */}
              <div className="p-4 bg-slate-900 border-l-4 border-amber-500 rounded-r-xl space-y-1.5 text-sm text-slate-300">
                <p className="font-bold text-amber-400">Important Operational Notice:</p>
                <p className="leading-relaxed text-xs sm:text-sm">
                  Your request has been received by this system. This does not mean that a rescue team has accepted or been dispatched to the request. If possible, contact official emergency hotlines directly.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <Link
                  href="/track"
                  className="w-full flex items-center justify-center py-4 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl border border-slate-700 text-center transition-colors"
                >
                  Go to Case Tracking
                </Link>
                <Link
                  href="/"
                  className="w-full flex items-center justify-center py-3 text-slate-400 hover:text-slate-200 text-xs text-center"
                >
                  {t.actions.backToHome}
                </Link>
              </div>
            </div>
          )}

          {/* Navigation Controls (Previous / Next / Submit) */}
          {currentStep <= totalSteps && (
            <div className="mt-8 pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep(currentStep - 1)}
                  className="py-3 px-5 bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold rounded-xl border border-slate-700 flex items-center gap-1.5 text-sm"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>{t.actions.previous}</span>
                </button>
              ) : (
                <Link
                  href="/"
                  className="py-3 px-5 bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold rounded-xl border border-slate-700 flex items-center gap-1.5 text-sm"
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
                  className="py-3 px-6 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl flex items-center gap-1.5 text-sm ml-auto shadow"
                >
                  <span>{t.actions.next}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="py-3.5 px-6 bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:bg-slate-800 text-white font-black rounded-xl flex items-center gap-2 text-base ml-auto shadow-lg shadow-red-950 transition-all"
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
