import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center bg-slate-50">
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Page Not Found</h2>
      <p className="text-slate-600 mb-6">The requested emergency resource could not be located.</p>
      <Link
        href="/"
        className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg font-bold text-sm"
      >
        Return to Home
      </Link>
    </div>
  );
}
