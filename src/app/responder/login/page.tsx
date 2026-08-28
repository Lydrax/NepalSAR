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
      const { data: profile, error: profileError } = await supabaseBrowser
        .from('profiles')
        .select('id, full_name, role')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileError || !profile) {
        // Sign out unauthorized user immediately
        await supabaseBrowser.auth.signOut();
        throw new Error('Access denied: No authorized Search & Rescue profile found for this user.');
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
    <div className="min-h-screen flex flex-col justify-between bg-slate-950 text-slate-100">
      <div>
        <Header currentLang={lang} onLanguageChange={setLang} />

        <main className="max-w-md mx-auto px-4 py-12">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 mb-6"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t.actions.backToHome}</span>
          </Link>

          <div className="bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-2xl space-y-6">
            <div className="text-center space-y-2">
              <div className="inline-flex p-3 bg-slate-800 border border-slate-700 rounded-xl text-red-500">
                <Shield className="w-8 h-8" />
              </div>
              <h1 className="text-xl font-bold text-white">Responder Operations Portal</h1>
              <p className="text-xs text-slate-400">
                Restricted access for verified Search &amp; Rescue personnel and dispatchers only.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">Official Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="responder@sar-agency.org"
                  className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
                  required
                />
              </div>

              {errorMessage && (
                <div className="p-3 bg-red-950/60 border border-red-800 text-red-200 text-xs rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:bg-slate-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-sm shadow transition-colors"
              >
                <Lock className="w-4 h-4" />
                <span>{isLoading ? 'Authenticating...' : 'Sign In to Operations'}</span>
              </button>
            </form>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-500 text-center">
              No public registration. Accounts are provisioned directly by the emergency response coordinator.
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
