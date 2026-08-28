'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lock, Shield, ArrowLeft, AlertTriangle } from 'lucide-react';
import { Header } from '@/components/ui/Header';
import { getTranslations, Language } from '@/lib/i18n';
import { supabaseBrowser } from '@/lib/supabase/browser';

export default function ResponderLoginPage() {
  const [lang, setLang] = useState<Language>('en');
  const t = getTranslations(lang);
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const { data, error } = await supabaseBrowser.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error || !data.session) {
        throw new Error(error?.message || 'Invalid email or password.');
      }

      // Check if user has an authorized profile in profiles table
      let { data: profile } = await supabaseBrowser
        .from('profiles')
        .select('id, full_name, role')
        .eq('id', data.user.id)
        .maybeSingle();

      // If profile is not yet in public.profiles, auto-initialize via verified responder profile route
      if (!profile) {
        try {
          const profileRes = await fetch('/api/responder/profile', {
            headers: {
              Authorization: `Bearer ${data.session.access_token}`,
            },
          });
          if (profileRes.ok) {
            profile = await profileRes.json();
          }
        } catch {
          // fallback continues below
        }
      }

      if (!profile) {
        // Sign out unauthorized user immediately
        await supabaseBrowser.auth.signOut();
        throw new Error('Access denied: No authorized Search & Rescue profile found for this account.');
      }

      // Save token in localStorage for API requests
      localStorage.setItem('nepal_sar_auth_token', data.session.access_token);
      localStorage.setItem('nepal_sar_user_role', profile.role);

      router.push('/responder/operations');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed. Please verify credentials.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 text-slate-900">
      <div>
        <Header currentLang={lang} onLanguageChange={setLang} />

        <main className="max-w-md mx-auto px-4 py-12 sm:py-16">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 mb-6 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t.actions.backToHome}</span>
          </Link>

          <div className="bg-white border border-slate-200 p-6 sm:p-8 rounded-xl shadow-xs space-y-6">
            <div className="text-center space-y-2">
              <div className="inline-flex p-3 bg-red-50 border border-red-200 rounded-xl text-red-700">
                <Shield className="w-8 h-8" />
              </div>
              <h1 className="text-xl font-extrabold text-slate-900">Authority Control Portal</h1>
              <p className="text-xs text-slate-600">
                Restricted access for authorized Search &amp; Rescue command centers, dispatchers, and field units.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">Official Agency Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="commander@agency.gov.np"
                  className="w-full p-3.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-red-600 focus:border-red-600 focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full p-3.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-red-600 focus:border-red-600 focus:outline-none"
                  required
                />
              </div>

              {errorMessage && (
                <div className="p-3.5 bg-red-50 border border-red-300 text-red-900 text-xs rounded-xl flex items-center gap-2 font-medium">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-700" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-red-700 hover:bg-red-800 active:bg-red-900 disabled:bg-slate-300 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-sm shadow-xs transition-colors cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>{isLoading ? 'Authenticating Official...' : 'Sign In to Operations'}</span>
              </button>
            </form>

            {/* Official Access Policy */}
            <div className="pt-4 border-t border-slate-200 space-y-2">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1.5">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-600" />
                  <span>Restricted Authority Clearance</span>
                </div>
                <p className="leading-relaxed">
                  Accounts are provisioned directly by the Central Emergency Operations Center (CEOC) administrator for verified commanders (Nepal Police, Nepal Army, APF, Red Cross).
                </p>
                <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                  Self-registration is disabled for security. Contact Central SAR Admin to request agency desk credentials.
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
