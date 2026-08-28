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
              <h1 className="text-xl font-extrabold text-slate-900">Responder Operations Portal</h1>
              <p className="text-xs text-slate-600">
                Restricted access for verified Search &amp; Rescue personnel and dispatchers only.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">Official Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="responder@sar-agency.org"
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
                className="w-full py-3.5 bg-red-700 hover:bg-red-800 active:bg-red-900 disabled:bg-slate-300 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-sm shadow-xs transition-colors"
              >
                <Lock className="w-4 h-4" />
                <span>{isLoading ? 'Authenticating...' : 'Sign In to Operations'}</span>
              </button>
            </form>

            {/* Official Personnel Credentials */}
            <div className="pt-4 border-t border-slate-200 space-y-2.5">
              <span className="text-[11px] font-mono font-bold uppercase text-slate-500 block">
                Official Agency Personnel Credentials:
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEmail('dispatcher@nepal-sar.org');
                    setPassword('NepalSar2026!');
                  }}
                  className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg text-left text-xs text-slate-800 transition-colors"
                >
                  <strong className="block font-bold text-red-700">Dispatcher</strong>
                  <span className="text-[10px] text-slate-500 font-mono">dispatcher@nepal-sar.org</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmail('responder@nepal-sar.org');
                    setPassword('NepalSar2026!');
                  }}
                  className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg text-left text-xs text-slate-800 transition-colors"
                >
                  <strong className="block font-bold text-blue-700">Field Responder</strong>
                  <span className="text-[10px] text-slate-500 font-mono">responder@nepal-sar.org</span>
                </button>
              </div>
              <div className="text-[10px] text-slate-500 font-mono text-center">
                Password: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800 font-bold">NepalSar2026!</code>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 text-center font-medium">
              Restricted portal. Responders and dispatchers have real-time access to the national search &amp; rescue queue.
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
