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
    <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 sticky top-0 z-40">
      <div className="max-w-3xl mx-auto flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 text-white hover:text-red-400 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 rounded"
        >
          <div className="bg-red-600 text-white p-1.5 rounded flex items-center justify-center">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <span className="font-extrabold tracking-wide text-base sm:text-lg block leading-none">
              NEPAL RESCUE
            </span>
            <span className="text-[10px] text-slate-400 font-mono block tracking-wider uppercase">
              SAR Coordination Platform
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Online / Offline status badge */}
          <div
            className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-mono ${
              isOnline
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                : 'bg-red-950/80 text-red-300 border-red-700/60 animate-pulse'
            }`}
            role="status"
            aria-live="polite"
          >
            {isOnline ? (
              <>
                <Wifi className="w-3 h-3 text-emerald-400" />
                <span className="hidden sm:inline">ONLINE</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-red-400" />
                <span>OFFLINE</span>
              </>
            )}
          </div>

          {/* Language toggle */}
          <div className="flex items-center bg-slate-800 rounded border border-slate-700 p-0.5 text-xs font-semibold">
            <button
              onClick={() => onLanguageChange('en')}
              className={`px-2 py-1 rounded transition-colors min-h-[32px] ${
                currentLang === 'en'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              aria-label="Switch to English"
            >
              EN
            </button>
            <button
              onClick={() => onLanguageChange('ne')}
              className={`px-2 py-1 rounded transition-colors min-h-[32px] ${
                currentLang === 'ne'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              aria-label="Switch to Nepali (नेपाली)"
            >
              नेपा
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
