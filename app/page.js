'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function Dashboard() {
  const [briefs, setBriefs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBriefs();
  }, []);

  async function loadBriefs() {
    try {
      const res = await fetch('/api/briefs');
      const data = await res.json();
      setBriefs(data.briefs || []);
    } catch (err) {
      console.error('Failed to load briefs:', err);
    }
    setLoading(false);
  }

  function getProgress(brief) {
    if (!brief.items || brief.items.length === 0) return { received: 0, total: 0 };
    const received = brief.items.filter(i => i.status !== 'briefed').length;
    return { received, total: brief.items.length };
  }

  return (
    <div className="min-h-screen bg-sunny-dark">
      {/* Header */}
      <header className="border-b border-gray-800 bg-sunny-gray">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src="/sunny-logo.png" alt="Sunny" className="h-8" />
            <h1 className="text-xl font-semibold">Creative Brief Builder</h1>
          </div>
          <Link 
            href="/new"
            className="bg-sunny-yellow text-black font-semibold px-5 py-2.5 rounded-lg hover:bg-yellow-400 transition-colors"
          >
            + New Brief
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin w-8 h-8 border-2 border-sunny-yellow border-t-transparent rounded-full" />
          </div>
        ) : briefs.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📋</div>
            <h2 className="text-2xl font-semibold mb-2">No briefs yet</h2>
            <p className="text-gray-400 mb-6">Create your first creative brief to get started</p>
            <Link 
              href="/new"
              className="inline-block bg-sunny-yellow text-black font-semibold px-6 py-3 rounded-lg hover:bg-yellow-400 transition-colors"
            >
              Create Brief
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {briefs.map((brief) => {
              const progress = getProgress(brief);
              const progressPercent = progress.total > 0 ? (progress.received / progress.total) * 100 : 0;
              
              return (
                <Link
                  key={brief.id}
                  href={`/brief/${brief.id}`}
                  className="block bg-sunny-gray border border-gray-700 rounded-xl p-6 hover:border-sunny-yellow transition-colors animate-fade-in"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold mb-1">{brief.clientName}</h3>
                      <p className="text-gray-400">{brief.campaignName}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-400 mb-1">
                        {progress.received} / {progress.total} received
                      </div>
                      <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-sunny-yellow transition-all duration-500"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 flex items-center gap-4 text-sm text-gray-400">
                    <span>
                      Created {new Date(brief.createdAt).toLocaleDateString('en-AU', { 
                        day: 'numeric', 
                        month: 'short',
                        year: 'numeric'
                      })}
                    </span>
                    {brief.items && brief.items.length > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-gray-500" />
                        {brief.items.length} deliverables
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
