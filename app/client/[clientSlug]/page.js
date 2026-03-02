'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';

const CHANNELS = {
  ooh: { name: 'Out of Home', icon: '📍', gradient: 'from-blue-500 to-blue-600' },
  tv: { name: 'Television', icon: '📺', gradient: 'from-purple-500 to-purple-600' },
  radio: { name: 'Radio', icon: '📻', gradient: 'from-amber-500 to-amber-600' },
  digital: { name: 'Digital', icon: '💻', gradient: 'from-green-500 to-green-600' },
  press: { name: 'Press', icon: '📰', gradient: 'from-rose-500 to-rose-600' },
  transit: { name: 'Transit', icon: '🚌', gradient: 'from-cyan-500 to-cyan-600' },
  programmatic: { name: 'Programmatic', icon: '🎯', gradient: 'from-indigo-500 to-indigo-600' },
};

function getDaysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / (1000*60*60*24));
}

function calculateDueDate(flightStart, bufferDays) {
  if (!flightStart) return null;
  try { const d = new Date(flightStart); d.setDate(d.getDate() - bufferDays); return d.toISOString().split('T')[0]; } catch { return null; }
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try { const d = new Date(dateStr); return `${d.getDate()} ${d.toLocaleDateString('en-AU', { month: 'short' })}`; } catch { return dateStr; }
}

function slugify(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function getBriefStats(brief) {
  const items = brief?.items || [];
  const buffer = brief?.dueDateBuffer || 5;
  const pubLeadTimes = brief?.publisherLeadTimes || {};
  const channels = new Set();
  let totalPlacements = 0;
  let totalCreatives = 0;
  let dueSoon = 0;
  let overdue = 0;
  let earliestDue = null;
  const specKeys = new Set();
  
  items.forEach(item => {
    const nameLC = (item.placementName || '').toLowerCase();
    if (nameLC.includes('bonus') || nameLC.includes('value add') || nameLC.includes('value-add')) return;
    
    const channel = item.channel || 'ooh';
    channels.add(channel);
    totalPlacements++;
    
    let specKey;
    if (channel === 'radio' || channel === 'tv') {
      specKey = item.specs?.adLength || item.specs?.spotLength || 'tbc';
    } else {
      specKey = item.specs?.dimensions || 'tbc';
    }
    const publisherKey = item.publisherName || 'unknown';
    const fullKey = `${channel}-${publisherKey}-${specKey}`;
    if (!specKeys.has(fullKey)) { specKeys.add(fullKey); totalCreatives++; }
    
    const pubName = (item.publisherName || '').toLowerCase();
    const leadTime = pubLeadTimes[pubName] || buffer;
    const dueDate = item.dueDate || calculateDueDate(item.flightStart, leadTime);
    if (dueDate) {
      const days = getDaysUntil(dueDate);
      if (days !== null && days < 0) overdue++;
      else if (days !== null && days >= 0 && days <= 7) dueSoon++;
      if (!earliestDue || dueDate < earliestDue) earliestDue = dueDate;
    }
  });
  
  return { channels: Array.from(channels), totalPlacements, totalCreatives, dueSoon, overdue, earliestDue };
}

export default function ClientHomePage() {
  const params = useParams();
  const [briefs, setBriefs] = useState([]);
  const [loading, setLoading] = useState(true);
  const clientSlug = params.clientSlug;

  useEffect(() => {
    async function loadBriefs() {
      try {
        const res = await fetch('/api/briefs');
        const data = await res.json();
        setBriefs(data.briefs || []);
      } catch (err) { console.error('Failed to load briefs:', err); }
      setLoading(false);
    }
    loadBriefs();
  }, []);

  const clientBriefs = useMemo(() => {
    return briefs.filter(b => slugify(b.clientName) === clientSlug);
  }, [briefs, clientSlug]);

  const clientName = clientBriefs[0]?.clientName || decodeURIComponent(clientSlug).replace(/-/g, ' ');

  const aggregateStats = useMemo(() => {
    let totalCreatives = 0, totalPlacements = 0, dueSoon = 0, overdue = 0;
    clientBriefs.forEach(brief => {
      const s = getBriefStats(brief);
      totalCreatives += s.totalCreatives;
      totalPlacements += s.totalPlacements;
      dueSoon += s.dueSoon;
      overdue += s.overdue;
    });
    return { totalCreatives, totalPlacements, dueSoon, overdue, totalBriefs: clientBriefs.length };
  }, [clientBriefs]);

  if (loading) return (
    <div className="min-h-screen bg-sunny-dark flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-sunny-yellow border-t-transparent rounded-full" />
    </div>
  );

  if (clientBriefs.length === 0) return (
    <div className="min-h-screen bg-sunny-dark flex items-center justify-center text-white">
      <div className="text-center">
        <h1 className="text-2xl font-semibold mb-4">No briefs found</h1>
        <p className="text-white/50">No creative briefs found for this client.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-sunny-dark text-white">
      <header className="border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4">
            <img src="/sunny-logo-white.png" alt="Sunny" className="h-6" />
            <div className="border-l border-white/20 pl-4">
              <p className="text-sm text-white/50">Creative Briefs</p>
              <h1 className="text-2xl font-bold">{clientName}</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Aggregate Stats */}
        <div className="grid grid-cols-5 gap-4 mb-8">
          <div className="bg-gradient-to-br from-sunny-yellow/20 to-sunny-yellow/5 border border-sunny-yellow/20 rounded-2xl p-5">
            <div className="text-4xl font-bold text-sunny-yellow">{aggregateStats.totalBriefs}</div>
            <div className="text-sm text-white/60 mt-1">Active Briefs</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="text-4xl font-bold">{aggregateStats.totalCreatives}</div>
            <div className="text-sm text-white/60 mt-1">Total Creatives</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="text-4xl font-bold">{aggregateStats.totalPlacements}</div>
            <div className="text-sm text-white/60 mt-1">Total Placements</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 relative group">
            <div className="text-4xl font-bold text-amber-400">{aggregateStats.dueSoon}</div>
            <div className="text-sm text-white/60 mt-1">Due Soon</div>
            <div className="hidden group-hover:block absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black rounded-lg text-xs text-white/80 whitespace-nowrap z-10 border border-white/10">Due within the next 7 days</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="text-4xl font-bold text-red-400">{aggregateStats.overdue}</div>
            <div className="text-sm text-white/60 mt-1">Overdue</div>
          </div>
        </div>

        {/* Brief Cards */}
        <div className="space-y-4">
          {clientBriefs
            .sort((a, b) => {
              const sa = getBriefStats(a); const sb = getBriefStats(b);
              if (sa.overdue !== sb.overdue) return sb.overdue - sa.overdue;
              if (sa.dueSoon !== sb.dueSoon) return sb.dueSoon - sa.dueSoon;
              return new Date(b.createdAt) - new Date(a.createdAt);
            })
            .map(brief => {
              const stats = getBriefStats(brief);
              const hasUrgency = stats.overdue > 0 || stats.dueSoon > 0;
              return (
                <a key={brief.id} href={`/brief/${brief.id}/client`}
                  className={`block bg-white/5 border rounded-2xl p-6 hover:bg-white/[0.07] transition-all ${stats.overdue > 0 ? 'border-red-500/30 shadow-red-500/10 shadow-lg' : stats.dueSoon > 0 ? 'border-amber-500/30 shadow-amber-500/10 shadow-md' : 'border-white/10'}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">{brief.campaignName}</h2>
                      <div className="flex items-center gap-3 mt-2">
                        {stats.channels.map(ch => {
                          const config = CHANNELS[ch] || CHANNELS.ooh;
                          return <span key={ch} className="text-lg" title={config.name}>{config.icon}</span>;
                        })}
                      </div>
                    </div>
                    <div className="text-right">
                      {stats.overdue > 0 && <div className="text-red-400 text-sm font-medium">{stats.overdue} overdue</div>}
                      {stats.dueSoon > 0 && <div className="text-amber-400 text-sm font-medium">{stats.dueSoon} due soon</div>}
                      {stats.earliestDue && !hasUrgency && <div className="text-white/50 text-sm">Next due: {formatDate(stats.earliestDue)}</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-6 mt-4 pt-4 border-t border-white/5 text-sm text-white/50">
                    <span>{stats.totalCreatives} creative{stats.totalCreatives !== 1 ? 's' : ''}</span>
                    <span>{stats.totalPlacements} placement{stats.totalPlacements !== 1 ? 's' : ''}</span>
                    {stats.earliestDue && <span className="ml-auto">Earliest due: {formatDate(stats.earliestDue)}</span>}
                  </div>
                </a>
              );
            })}
        </div>
      </div>
    </div>
  );
}
