import Link from 'next/link';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-6 text-center font-sans">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 space-y-5 shadow-xs">
        <div className="w-12 h-12 bg-red-100 text-red-700 rounded-full flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-bold font-mono tracking-tight text-slate-900">404 - Page Not Found</h1>
          <p className="text-xs text-slate-600">
            The requested operational rescue record or operational page does not exist or has been relocated.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors w-full"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Emergency Dashboard</span>
        </Link>
      </div>
    </div>
  );
}
