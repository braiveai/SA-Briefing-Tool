'use client';

import { useEffect } from 'react';

export default function BriefError({ error, reset }) {
  useEffect(() => { console.error('Brief page error:', error); }, [error]);

  return (
    <div className="min-h-screen bg-sunny-dark flex items-center justify-center text-white">
      <div className="text-center max-w-md">
        <div className="text-5xl mb-4">⚠️</div>
        <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
        <p className="text-white/50 mb-6">
          This brief encountered an error. The data may be corrupted or incomplete.
        </p>
        <div className="flex items-center justify-center gap-4">
          <button onClick={reset}
            className="px-6 py-3 bg-sunny-yellow text-black rounded-lg font-semibold hover:bg-yellow-300">
            Try Again
          </button>
          <a href="/"
            className="px-6 py-3 bg-white/10 border border-white/20 rounded-lg hover:bg-white/20">
            ← Back to Briefs
          </a>
        </div>
        <details className="mt-6 text-left">
          <summary className="text-white/30 text-xs cursor-pointer hover:text-white/50">Error details</summary>
          <pre className="mt-2 text-xs text-red-400/70 bg-black/30 rounded-lg p-4 overflow-auto max-h-40">{error?.message || 'Unknown error'}</pre>
        </details>
      </div>
    </div>
  );
}
