'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';

const CHANNELS = {
  ooh: { name: 'Out of Home', icon: '📍' },
  tv: { name: 'Television', icon: '📺' },
  radio: { name: 'Radio', icon: '📻' },
  digital: { name: 'Digital', icon: '💻' },
  press: { name: 'Press', icon: '📰' },
  transit: { name: 'Transit', icon: '🚌' },
  programmatic: { name: 'Programmatic', icon: '🎯' },
};

const STATUS_LABELS = { briefed: 'Briefed', in_progress: 'In Progress', review: 'Review', approved: 'Approved', delivered: 'Delivered' };

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try { const d = new Date(dateStr); return `${d.getDate()} ${d.toLocaleDateString('en-AU', { month: 'short' })} ${d.getFullYear()}`; } catch { return dateStr; }
}

function calculateDueDate(flightStart, bufferDays) {
  if (!flightStart) return null;
  try { const d = new Date(flightStart); d.setDate(d.getDate() - bufferDays); return d.toISOString().split('T')[0]; } catch { return null; }
}

export default function PrintBriefPage() {
  const params = useParams();
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(true);
  const briefId = params.briefId || params.id;

  useEffect(() => {
    async function loadBrief() {
      try {
        const res = await fetch(`/api/brief/${briefId}`);
        if (!res.ok) throw new Error('Brief not found');
        setBrief(await res.json());
      } catch (err) { console.error('Failed to load:', err); }
      setLoading(false);
    }
    loadBrief();
  }, [briefId]);

  // Trigger print after render
  useEffect(() => {
    if (brief && !loading) {
      setTimeout(() => window.print(), 500);
    }
  }, [brief, loading]);

  const channelData = useMemo(() => {
    if (!brief?.items) return {};
    const channels = {};
    const dueDateBuffer = brief.dueDateBuffer || 5;
    const publisherLeadTimes = brief.publisherLeadTimes || {};
    brief.items.forEach(item => {
      const channel = item.channel || 'ooh';
      const nameLC = (item.placementName || '').toLowerCase();
      if (nameLC.includes('bonus') || nameLC.includes('value add') || nameLC.includes('value-add')) return;
      let specKey, specLabel;
      if (channel === 'radio' || channel === 'tv') {
        const duration = item.specs?.adLength || (item.specs?.spotLength ? `${item.specs.spotLength} seconds` : null);
        specKey = duration || 'duration-tbc';
        specLabel = specKey === 'duration-tbc' ? 'Duration TBC' : specKey;
      } else {
        specKey = item.specs?.dimensions || 'dimensions-tbc';
        specLabel = specKey === 'dimensions-tbc' ? 'Dimensions TBC' : specKey;
      }
      const publisherKey = item.publisherName || 'unknown';
      const specId = `${channel}-${publisherKey}-${specKey}`;
      if (!channels[channel]) channels[channel] = { specs: {} };
      if (!channels[channel].specs[specId]) {
        channels[channel].specs[specId] = { id: specId, label: specLabel, publisher: item.publisherName, placements: [], minStart: null, maxEnd: null, earliestDue: null, status: 'briefed' };
      }
      const spec = channels[channel].specs[specId];
      const pubKey = (item.publisherName || '').toLowerCase();
      const buffer = publisherLeadTimes[pubKey] ?? dueDateBuffer;
      const calculatedDue = calculateDueDate(item.flightStart, buffer);
      spec.placements.push({ ...item, dueDate: calculatedDue });
      if (item.flightStart && (!spec.minStart || item.flightStart < spec.minStart)) spec.minStart = item.flightStart;
      if (item.flightEnd && (!spec.maxEnd || item.flightEnd > spec.maxEnd)) spec.maxEnd = item.flightEnd;
      if (calculatedDue && (!spec.earliestDue || calculatedDue < spec.earliestDue)) spec.earliestDue = calculatedDue;
      const storedStatus = brief.groups?.flatMap(g => g.specs || []).find(s => s.id === specId)?.status;
      if (storedStatus) spec.status = storedStatus;
    });
    return channels;
  }, [brief]);

  const specNotes = brief?.specNotes || {};

  if (loading) return <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>Loading...</div>;
  if (!brief) return <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>Brief not found</div>;

  const totalSpecs = Object.values(channelData).reduce((sum, ch) => sum + Object.keys(ch.specs).length, 0);
  const totalPlacements = brief.items?.length || 0;

  return (
    <>
      <style jsx global>{`
        @media print {
          body { margin: 0; }
          .no-print { display: none !important; }
          @page { margin: 1.5cm; size: A4; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
        }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; max-width: 800px; margin: 0 auto; padding: 2rem; }
        h1 { margin: 0; font-size: 1.5rem; }
        h2 { margin: 1.5rem 0 0.5rem; font-size: 1.1rem; border-bottom: 2px solid #FACC15; padding-bottom: 0.25rem; }
        table { width: 100%; border-collapse: collapse; font-size: 0.85rem; margin-bottom: 1rem; }
        th { text-align: left; font-weight: 600; padding: 0.5rem; border-bottom: 2px solid #ddd; font-size: 0.75rem; color: #666; text-transform: uppercase; }
        td { padding: 0.5rem; border-bottom: 1px solid #eee; vertical-align: top; }
        .spec-card { border: 1px solid #e5e5e5; border-radius: 8px; padding: 1rem; margin-bottom: 0.75rem; break-inside: avoid; }
        .spec-title { font-weight: 700; font-size: 1rem; margin-bottom: 0.25rem; }
        .spec-meta { color: #666; font-size: 0.8rem; }
        .spec-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem; margin-top: 0.75rem; }
        .spec-field { font-size: 0.8rem; }
        .spec-field-label { color: #999; font-size: 0.7rem; text-transform: uppercase; }
        .note { background: #FEF9C3; padding: 0.5rem 0.75rem; border-radius: 4px; font-size: 0.8rem; margin-top: 0.5rem; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 3px solid #FACC15; }
        .stats { display: flex; gap: 2rem; margin-top: 0.5rem; }
        .stat { font-size: 0.8rem; color: #666; }
        .stat strong { font-size: 1.2rem; color: #1a1a1a; }
        .status-badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.7rem; font-weight: 600; }
        .print-btn { position: fixed; bottom: 2rem; right: 2rem; background: #FACC15; color: #000; border: none; padding: 0.75rem 1.5rem; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 0.9rem; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
      `}</style>

      <button className="no-print print-btn" onClick={() => window.print()}>🖨 Print / Save PDF</button>

      <div className="header">
        <div>
          <div style={{ fontSize: '0.8rem', color: '#999', marginBottom: '0.25rem' }}>Creative Brief</div>
          <h1>{brief.clientName}</h1>
          <div style={{ color: '#666', marginTop: '0.25rem' }}>{brief.campaignName}</div>
          <div className="stats">
            <div className="stat"><strong>{totalSpecs}</strong> creatives</div>
            <div className="stat"><strong>{totalPlacements}</strong> placements</div>
            <div className="stat"><strong>{Object.keys(channelData).length}</strong> channels</div>
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#999' }}>
          <div>Generated {new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
          <img src="/sunny-logo-white.png" alt="" style={{ height: '20px', marginTop: '0.5rem', filter: 'invert(1)' }} />
        </div>
      </div>

      {brief.bestPractices && (
        <div className="note" style={{ marginBottom: '1.5rem', background: '#F0F9FF', border: '1px solid #BAE6FD' }}>
          <div style={{ fontWeight: 600, fontSize: '0.75rem', color: '#0369A1', marginBottom: '0.25rem' }}>Creative Recommendations</div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{brief.bestPractices}</div>
        </div>
      )}

      {Object.entries(channelData).map(([channelKey, channel]) => {
        const config = CHANNELS[channelKey] || CHANNELS.ooh;
        const specs = Object.values(channel.specs);
        return (
          <div key={channelKey}>
            <h2>{config.icon} {config.name} — {specs.length} creative{specs.length !== 1 ? 's' : ''}</h2>
            {specs.map(spec => {
              const fs = spec.placements[0]?.specs || {};
              return (
                <div key={spec.id} className="spec-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div className="spec-title">{spec.label}</div>
                      <div className="spec-meta">
                        {spec.publisher && <span>{spec.publisher} · </span>}
                        {spec.placements.length} placement{spec.placements.length !== 1 ? 's' : ''}
                        {spec.minStart && spec.maxEnd && <span> · {formatDate(spec.minStart)} → {formatDate(spec.maxEnd)}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="status-badge" style={{ background: spec.status === 'delivered' || spec.status === 'approved' ? '#D1FAE5' : '#F3F4F6', color: spec.status === 'delivered' || spec.status === 'approved' ? '#065F46' : '#374151' }}>
                        {STATUS_LABELS[spec.status] || 'Briefed'}
                      </span>
                      {spec.earliestDue && <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.25rem' }}>Due: {formatDate(spec.earliestDue)}</div>}
                    </div>
                  </div>
                  <div className="spec-grid">
                    <div className="spec-field"><div className="spec-field-label">Dimensions</div>{spec.label}</div>
                    {fs.fileFormat && <div className="spec-field"><div className="spec-field-label">Format</div>{fs.fileFormat}</div>}
                    {fs.maxFileSize && <div className="spec-field"><div className="spec-field-label">Max Size</div>{fs.maxFileSize}</div>}
                    {fs.dpi && <div className="spec-field"><div className="spec-field-label">DPI</div>{fs.dpi}</div>}
                    {(fs.adLength || fs.spotLength) && <div className="spec-field"><div className="spec-field-label">Duration</div>{fs.adLength || `${fs.spotLength}s`}</div>}
                    {fs.direction && <div className="spec-field"><div className="spec-field-label">Direction</div>{fs.direction}</div>}
                  </div>
                  {specNotes[spec.id] && <div className="note">📝 {specNotes[spec.id]}</div>}
                  {spec.placements.length <= 8 && (
                    <table style={{ marginTop: '0.75rem' }}>
                      <thead><tr><th>Placement</th><th>Location</th><th>Flight</th><th>Due</th></tr></thead>
                      <tbody>
                        {spec.placements.map((p, i) => (
                          <tr key={i}>
                            <td>{p.placementName || '—'}</td>
                            <td style={{ color: '#666' }}>{p.location || '—'}</td>
                            <td style={{ color: '#666' }}>{formatDate(p.flightStart)} → {formatDate(p.flightEnd)}</td>
                            <td style={{ color: '#666' }}>{p.dueDate ? formatDate(p.dueDate) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {spec.placements.length > 8 && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#999' }}>
                      {spec.placements.length} placements — see full brief for details
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #eee', fontSize: '0.7rem', color: '#999', textAlign: 'center' }}>
        Generated by Sunny Advertising Creative Briefing Tool · {new Date().toLocaleDateString('en-AU')}
      </div>
    </>
  );
}
