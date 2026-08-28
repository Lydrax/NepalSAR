'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldAlert, Wifi, WifiOff } from 'lucide-react';
import { Language } from '@/lib/i18n';

interface HeaderProps {
  currentLang: Language;
  onLanguageChange: (lang: Language) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentLang, onLanguageChange }) => {
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-40 shadow-xs">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-3 text-slate-900 hover:text-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-600 rounded-md"
        >
          <div className="bg-red-700 text-white p-2 rounded-md flex items-center justify-center shadow-xs">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-tight text-base sm:text-lg text-slate-900 leading-none">
                NEPAL RESCUE
              </span>
              <span className="text-[11px] font-semibold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 uppercase tracking-wide">
                Gov / SAR
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium block tracking-normal mt-0.5">
              Emergency Search &amp; Rescue Coordination
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Online / Offline status badge */}
          <div
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border font-mono font-medium ${
              isOnline
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-red-50 text-red-800 border-red-300 animate-pulse'
            }`}
            role="status"
            aria-live="polite"
          >
            {isOnline ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />
                <Wifi className="w-3.5 h-3.5 text-emerald-700" />
                <span className="hidden sm:inline">ONLINE</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-red-600 inline-block" />
                <WifiOff className="w-3.5 h-3.5 text-red-700" />
                <span>OFFLINE</span>
              </>
            )}
          </div>

          {/* Language toggle */}
          <div className="flex items-center bg-slate-100 rounded-md border border-slate-200 p-0.5 text-xs font-semibold">
            <button
              onClick={() => onLanguageChange('en')}
              className={`px-2.5 py-1 rounded transition-colors ${
                currentLang === 'en'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              aria-label="Switch to English"
            >
              English
            </button>
            <button
              onClick={() => onLanguageChange('ne')}
              className={`px-2.5 py-1 rounded transition-colors ${
                currentLang === 'ne'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              aria-label="Switch to Nepali (नेपाली)"
            >
              नेपाली
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
