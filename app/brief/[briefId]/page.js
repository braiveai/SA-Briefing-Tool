'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { STATUSES } from '@/lib/specs';

export default function BriefManage() {
  const params = useParams();
  const router = useRouter();
  const briefId = params.briefId;
  
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadBrief();
  }, [briefId]);

  async function loadBrief() {
    try {
      const res = await fetch(`/api/brief/${briefId}`);
      const data = await res.json();
      setBrief(data);
    } catch (err) {
      console.error('Failed to load brief:', err);
    }
    setLoading(false);
  }

  async function updateStatus(itemId, newStatus) {
    setSaving(true);
    const updatedItems = brief.items.map(i => 
      i.id === itemId ? { ...i, status: newStatus } : i
    );
    setBrief({ ...brief, items: updatedItems });
    
    try {
      await fetch(`/api/brief/${briefId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: updatedItems }),
      });
    } catch (err) {
      console.error('Failed to update:', err);
    }
    setSaving(false);
  }

  function copyClientLink() {
    const link = `${window.location.origin}/b/${briefId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-sunny-dark flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-sunny-yellow border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!brief) {
    return (
      <div className="min-h-screen bg-sunny-dark flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="text-2xl font-semibold mb-2">Brief not found</h2>
          <button onClick={() => router.push('/')} className="text-sunny-yellow hover:underline">
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  // Group items by channel
  const groupedItems = brief.items.reduce((acc, item) => {
    const channel = item.channelName || 'Other';
    if (!acc[channel]) acc[channel] = [];
    acc[channel].push(item);
    return acc;
  }, {});

  const progress = {
    total: brief.items.length,
    received: brief.items.filter(i => i.status !== 'briefed').length,
    approved: brief.items.filter(i => i.status === 'approved' || i.status === 'live').length,
  };

  return (
    <div className="min-h-screen bg-sunny-dark">
      {/* Header */}
      <header className="border-b border-gray-800 bg-sunny-gray sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => router.push('/')}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ← Back
              </button>
              <div>
                <h1 className="text-xl font-semibold">{brief.clientName}</h1>
                <p className="text-gray-400 text-sm">{brief.campaignName}</p>
              </div>
            </div>
            <button
              onClick={copyClientLink}
              className="bg-sunny-yellow text-black font-semibold px-5 py-2.5 rounded-lg hover:bg-yellow-400 transition-colors flex items-center gap-2"
            >
              {copied ? '✓ Copied!' : '🔗 Copy Client Link'}
            </button>
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-sunny-yellow transition-all duration-500"
                style={{ width: `${(progress.received / progress.total) * 100}%` }}
              />
            </div>
            <div className="text-sm text-gray-400">
              {progress.received} / {progress.total} received
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {Object.entries(groupedItems).map(([channel, items]) => (
          <div key={channel} className="mb-8 animate-fade-in">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              {channel === 'TV' && '📺'}
              {channel === 'Radio' && '📻'}
              {channel === 'Out of Home' && '🏙️'}
              {channel === 'Digital' && '💻'}
              {channel}
              <span className="text-sm font-normal text-gray-400">({items.length} items)</span>
            </h2>

            <div className="bg-sunny-gray border border-gray-700 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700 text-left text-sm text-gray-400">
                    <th className="px-4 py-3 font-medium">Placement</th>
                    <th className="px-4 py-3 font-medium">Publisher</th>
                    <th className="px-4 py-3 font-medium">Format</th>
                    <th className="px-4 py-3 font-medium">Due Date</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Creative</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const status = STATUSES.find(s => s.id === item.status) || STATUSES[0];
                    return (
                      <tr key={item.id} className="border-b border-gray-700/50 hover:bg-gray-800/30">
                        <td className="px-4 py-3">
                          <div className="font-medium">{item.placementName}</div>
                          {/* OOH-specific */}
                          {item.specs?.dimensions && (
                            <div className="text-xs text-gray-400">{item.specs.dimensions}</div>
                          )}
                          {/* TV/Radio-specific */}
                          {item.specs?.adLength && (
                            <div className="text-xs text-gray-400">{item.specs.adLength}</div>
                          )}
                          {item.specs?.dayPart && (
                            <div className="text-xs text-gray-400">{item.specs.dayPart}</div>
                          )}
                          {item.specs?.spotCount && (
                            <div className="text-xs text-gray-400">{item.specs.spotCount} spots</div>
                          )}
                          {/* Flight dates */}
                          {item.flightStart && (
                            <div className="text-xs text-blue-400">
                              📅 {item.flightStart} → {item.flightEnd}
                            </div>
                          )}
                          {/* Restrictions warning */}
                          {item.restrictions && item.restrictions.length > 0 && (
                            <div className="text-xs text-amber-400" title={Array.isArray(item.restrictions) ? item.restrictions.join(', ') : item.restrictions}>
                              ⚠️ Has restrictions
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">{item.publisherName}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-1 bg-gray-700 rounded-full">
                            {item.format}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {item.dueDate ? new Date(item.dueDate).toLocaleDateString('en-AU', {
                            day: 'numeric',
                            month: 'short'
                          }) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={item.status}
                            onChange={(e) => updateStatus(item.id, e.target.value)}
                            className="text-xs px-2 py-1 rounded-full font-medium bg-transparent border border-gray-600 focus:outline-none focus:border-sunny-yellow"
                            style={{ color: status.color }}
                          >
                            {STATUSES.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          {item.uploadedFile ? (
                            <a 
                              href={item.uploadedFile.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sunny-yellow hover:underline text-sm flex items-center gap-1"
                            >
                              📎 View
                            </a>
                          ) : (
                            <span className="text-gray-500 text-sm">Awaiting</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {/* Client Link Card */}
        <div className="mt-8 bg-sunny-gray border border-gray-700 rounded-xl p-6">
          <h3 className="font-semibold mb-2">Share with Client</h3>
          <p className="text-sm text-gray-400 mb-4">
            Send this link to your client so they can view the brief and upload their creative files.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="text"
              readOnly
              value={`${typeof window !== 'undefined' ? window.location.origin : ''}/b/${briefId}`}
              className="flex-1 bg-sunny-dark border border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-300"
            />
            <button
              onClick={copyClientLink}
              className="bg-sunny-yellow text-black font-semibold px-4 py-2 rounded-lg hover:bg-yellow-400 transition-colors"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
