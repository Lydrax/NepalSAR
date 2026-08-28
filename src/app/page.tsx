'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ShieldAlert, Search, Phone, Lock, ArrowRight, Radio, LifeBuoy } from 'lucide-react';
import { getTranslations, Language } from '@/lib/i18n';
import { Header } from '@/components/ui/Header';
import { DisclaimerBanner } from '@/components/ui/DisclaimerBanner';
import { getVerifiedEmergencyContacts } from '@/lib/constants/emergencyContacts';

export default function LandingPage() {
  const [lang, setLang] = useState<Language>('en');
  const t = getTranslations(lang);
  const verifiedContacts = getVerifiedEmergencyContacts();

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 text-slate-900">
      <div>
        <Header currentLang={lang} onLanguageChange={setLang} />
        <DisclaimerBanner t={t} lang={lang} />

        <main className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
          {/* Institutional Header Banner */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-xs mb-6 text-center sm:text-left flex flex-col sm:flex-row items-center sm:items-start gap-5">
            <div className="w-14 h-14 bg-red-700 text-white rounded-xl flex items-center justify-center shrink-0 shadow-xs">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div className="space-y-1.5 flex-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-800 border border-red-200">
                <Radio className="w-3 h-3 text-red-600 animate-pulse" />
                National Disaster SAR Response
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                {t.appName}
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed max-w-xl">
                {t.appTagline}
              </p>
            </div>
          </div>

          {/* Primary Action Panel */}
          <div className="space-y-3.5 mb-8">
            {/* Primary Action: REQUEST RESCUE */}
            <Link
              href="/request"
              className="w-full flex items-center justify-between p-5 bg-red-700 hover:bg-red-800 active:bg-red-900 text-white font-bold text-lg sm:text-xl rounded-xl shadow-sm border border-red-800 transition-colors focus:ring-4 focus:ring-red-300 focus:outline-none group"
              role="button"
            >
              <div className="flex items-center gap-3.5">
                <div className="bg-red-800/80 p-2 rounded-lg text-white">
                  <LifeBuoy className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <div className="font-extrabold">{t.actions.requestRescue}</div>
                  <div className="text-xs text-red-100 font-normal">
                    Report emergency location, immediate danger, and casualties
                  </div>
                </div>
              </div>
              <ArrowRight className="w-6 h-6 text-red-200 group-hover:translate-x-1 transition-transform" />
            </Link>

            {/* Secondary Action: CHECK EXISTING REQUEST */}
            <Link
              href="/track"
              className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 font-semibold text-base rounded-xl border border-slate-300 shadow-xs transition-colors focus:ring-2 focus:ring-slate-400 focus:outline-none group"
              role="button"
            >
              <div className="flex items-center gap-3">
                <div className="bg-slate-100 p-2 rounded-lg text-slate-700 border border-slate-200">
                  <Search className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="font-bold text-slate-900">{t.actions.checkExisting}</div>
                  <div className="text-xs text-slate-500 font-normal">
                    Lookup active case dispatch status with Case ID &amp; Token
                  </div>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-400 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {/* Direct verified emergency hotlines box */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-xs uppercase tracking-wider text-slate-700 font-bold flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-red-700" />
                {t.officialNumbersHeading}
              </h2>
              <span className="text-[11px] text-slate-500 font-medium">Toll-Free 24/7 Lines</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm">
              {verifiedContacts.map((contact) => (
                <a
                  key={contact.id}
                  href={contact.dialUrl}
                  className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 text-slate-800 transition-colors group"
                >
                  <div className="text-left">
                    <span className="font-semibold block text-xs sm:text-sm text-slate-900">
                      {lang === 'ne' ? contact.nameNe : contact.nameEn}
                    </span>
                    <span className="text-[11px] text-slate-500 block truncate max-w-[170px]">
                      {lang === 'ne' ? contact.descriptionNe : contact.descriptionEn}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-red-700 text-sm ml-2 px-2 py-0.5 bg-red-50 group-hover:bg-red-100 border border-red-200 rounded shrink-0">
                    {contact.number}
                  </span>
                </a>
              ))}
            </div>
          </div>
        </main>
      </div>

      {/* Footer with Operational Rules and Responder Access */}
      <footer className="border-t border-slate-200 bg-white py-6 px-4 text-xs text-slate-600">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <p className="text-slate-500">
            Nepal Emergency Search &amp; Rescue Coordination &bull; Disaster Response Portal
          </p>
          <Link
            href="/responder/login"
            className="inline-flex items-center gap-1.5 text-slate-700 hover:text-red-700 font-semibold px-2.5 py-1 rounded bg-slate-100 border border-slate-200 hover:border-slate-300 transition-colors"
          >
            <Lock className="w-3.5 h-3.5" />
            Responder Portal
          </Link>
        </div>
      </footer>
    </div>
  );
}
