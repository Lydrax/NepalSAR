'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ShieldAlert, Search, Phone, Lock } from 'lucide-react';
import { getTranslations, Language } from '@/lib/i18n';
import { Header } from '@/components/ui/Header';
import { DisclaimerBanner } from '@/components/ui/DisclaimerBanner';
import { getVerifiedEmergencyContacts } from '@/lib/constants/emergencyContacts';

export default function LandingPage() {
  const [lang, setLang] = useState<Language>('en');
  const t = getTranslations(lang);
  const verifiedContacts = getVerifiedEmergencyContacts();

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-950 text-slate-100">
      <div>
        <Header currentLang={lang} onLanguageChange={setLang} />
        <DisclaimerBanner t={t} lang={lang} />

        <main className="max-w-xl mx-auto px-4 py-8 sm:py-12">
          {/* Calm, serious operational introduction */}
          <div className="text-center space-y-3 mb-8">
            <div className="inline-flex items-center justify-center p-3 bg-red-950/60 border border-red-800/80 rounded-2xl text-red-500 shadow-inner">
              <ShieldAlert className="w-12 h-12" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              {t.appName}
            </h1>
            <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
              {t.appTagline}
            </p>
          </div>

          {/* Primary & Secondary Operational Actions */}
          <div className="space-y-4">
            {/* Primary Action: REQUEST RESCUE */}
            <Link
              href="/request"
              className="w-full flex items-center justify-center gap-3 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-extrabold text-lg sm:text-xl py-5 px-6 rounded-xl shadow-lg shadow-red-950/50 border border-red-500 transition-all text-center focus:ring-4 focus:ring-red-400 focus:outline-none"
              role="button"
            >
              <span className="text-2xl">🆘</span>
              <span>{t.actions.requestRescue}</span>
            </Link>

            {/* Secondary Action: CHECK EXISTING REQUEST */}
            <Link
              href="/track"
              className="w-full flex items-center justify-center gap-2.5 bg-slate-900 hover:bg-slate-800 active:bg-slate-700 text-slate-200 font-semibold text-base py-4 px-6 rounded-xl border border-slate-700 transition-colors text-center focus:ring-2 focus:ring-slate-400 focus:outline-none"
              role="button"
            >
              <Search className="w-5 h-5 text-slate-400" />
              <span>{t.actions.checkExisting}</span>
            </Link>
          </div>

          {/* Direct verified emergency hotlines box */}
          <div className="mt-10 p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-3">
            <h2 className="text-xs uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-emerald-400" />
              {t.officialNumbersHeading}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              {verifiedContacts.map((contact) => (
                <a
                  key={contact.id}
                  href={contact.dialUrl}
                  className="flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-750 rounded-lg border border-slate-700 text-slate-200 transition-colors"
                >
                  <div className="text-left">
                    <span className="font-medium block text-xs sm:text-sm">
                      {lang === 'ne' ? contact.nameNe : contact.nameEn}
                    </span>
                    <span className="text-[10px] text-slate-400 block truncate max-w-[170px]">
                      {lang === 'ne' ? contact.descriptionNe : contact.descriptionEn}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-emerald-400 text-sm ml-2 shrink-0">
                    {contact.number}
                  </span>
                </a>
              ))}
            </div>
          </div>
        </main>
      </div>

      {/* Footer with Operational Rules and Responder Access */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-6 px-4 text-xs text-slate-500">
        <div className="max-w-xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <p>
            Nepal Rescue Coordination Platform &bull; Prototype for Disaster Response
          </p>
          <Link
            href="/responder/login"
            className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-200 underline font-medium"
          >
            <Lock className="w-3.5 h-3.5" />
            Responder Portal
          </Link>
        </div>
      </footer>
    </div>
  );
}
