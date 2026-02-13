'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'next/navigation';

// ============================================
// CHANNEL CONFIG
// ============================================
const CHANNELS = {
  ooh: { name: 'Out of Home', icon: '📍', gradient: 'from-blue-500 to-blue-600' },
  tv: { name: 'Television', icon: '📺', gradient: 'from-purple-500 to-purple-600' },
  radio: { name: 'Radio', icon: '📻', gradient: 'from-amber-500 to-amber-600' },
  digital: { name: 'Digital', icon: '💻', gradient: 'from-green-500 to-green-600' },
};

// ============================================
// HELPER FUNCTIONS
// ============================================
function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    const day = date.getDate();
    const month = date.toLocaleDateString('en-AU', { month: 'short' });
    return `${day} ${month}`;
  } catch {
    return dateStr;
  }
}

function formatDateFull(dateStr) {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
}

function getDaysUntil(dateStr) {
  if (!dateStr) return null;
  const days = Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
  return days;
}

function calculateDueDate(flightStart, bufferDays) {
  if (!flightStart) return null;
  try {
    const date = new Date(flightStart);
    date.setDate(date.getDate() - bufferDays);
    return date.toISOString().split('T')[0];
  } catch {
    return null;
  }
}

// ============================================
// DIMENSION PREVIEW
// ============================================
function DimensionPreview({ dimensions, channel }) {
  if (channel === 'radio' || channel === 'tv') {
    const seconds = parseInt(dimensions) || 30;
    const bars = Math.min(Math.ceil(seconds / 5), 12);
    return (
      <div className="w-14 h-10 flex items-end justify-center gap-0.5">
        {Array.from({ length: bars }).map((_, i) => (
          <div key={i} className="w-1 bg-gradient-to-t from-amber-500 to-amber-300 rounded-full"
            style={{ height: `${30 + Math.sin(i * 0.8) * 20 + Math.random() * 20}%`, opacity: 0.6 + (i / bars) * 0.4 }} />
        ))}
      </div>
    );
  }
  
  if (!dimensions) return <div className="w-14 h-10 rounded bg-white/10 flex items-center justify-center"><span className="text-white/30 text-xs">?</span></div>;
  
  const match = dimensions.match(/(\d+)\s*[x×]\s*(\d+)/i);
  if (!match) return <div className="w-14 h-10 rounded bg-white/10 flex items-center justify-center"><span className="text-white/30 text-xs">?</span></div>;
  
  const [, w, h] = match;
  const aspectRatio = parseInt(w) / parseInt(h);
  const containerW = 56, containerH = 40;
  let rectW, rectH;
  if (aspectRatio > containerW / containerH) { rectW = containerW; rectH = containerW / aspectRatio; }
  else { rectH = containerH; rectW = containerH * aspectRatio; }
  
  return (
    <div className="w-14 h-10 flex items-center justify-center">
      <div className="bg-gradient-to-br from-blue-400 to-blue-600 rounded-sm shadow-lg shadow-blue-500/20" style={{ width: `${rectW}px`, height: `${rectH}px` }} />
    </div>
  );
}

// ============================================
// UPLOAD PROGRESS CIRCLE
// ============================================
function UploadProgressCircle({ uploaded, total }) {
  const percentage = total > 0 ? (uploaded / total) * 100 : 0;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
  return (
    <div className="relative w-24 h-24">
      <svg className="w-24 h-24 transform -rotate-90">
        <circle cx="48" cy="48" r={radius} stroke="rgba(255,255,255,0.1)" strokeWidth="6" fill="none" />
        <circle cx="48" cy="48" r={radius} stroke="#FACC15" strokeWidth="6" fill="none"
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
          className="transition-all duration-500" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold">{uploaded}/{total}</span>
        <span className="text-xs text-white/50">uploaded</span>
      </div>
    </div>
  );
}

// ============================================
// SPEC CARD FOR CLIENT
// ============================================
function ClientSpecCard({ spec, channel, onExpand, isExpanded, uploads, onUpload, attachments }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  
  const daysUntil = spec.earliestDue ? getDaysUntil(spec.earliestDue) : null;
  
  let urgencyClass = '', urgencyGlow = '';
  if (daysUntil !== null) {
    if (daysUntil < 0) { urgencyClass = 'border-red-500/50'; urgencyGlow = 'shadow-red-500/20 shadow-lg'; }
    else if (daysUntil <= 3) { urgencyClass = 'border-red-500/30'; urgencyGlow = 'shadow-red-500/10 shadow-md'; }
    else if (daysUntil <= 7) { urgencyClass = 'border-amber-500/30'; urgencyGlow = 'shadow-amber-500/10 shadow-md'; }
  }
  
  const firstPlacement = spec.placements[0];
  const fileSpecs = firstPlacement?.specs || {};
  const restrictions = firstPlacement?.restrictions || [];
  const currentUpload = uploads[spec.id];
  
  // Get matching attachments for this publisher
  const publisherAttachments = useMemo(() => {
    if (!attachments || !spec.publisher) return [];
    return attachments.filter(a => a.publisher?.toLowerCase() === spec.publisher?.toLowerCase());
  }, [attachments, spec.publisher]);
  
  const siteFlights = useMemo(() => {
    const sites = {};
    spec.placements.forEach(p => {
      const name = p.placementName || 'Unknown';
      sites[name] = (sites[name] || 0) + 1;
    });
    return Object.entries(sites).map(([name, count]) => ({ name, count }));
  }, [spec.placements]);

  async function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.url) {
        onUpload(spec.id, { url: data.url, filename: file.name });
      }
    } catch (err) {
      console.error('Upload failed:', err);
    }
    setUploading(false);
    e.target.value = '';
  }
  
  return (
    <div className={`bg-white/5 rounded-2xl border border-white/10 overflow-hidden transition-all hover:bg-white/[0.07] ${urgencyClass} ${urgencyGlow}`}>
      {/* Card Header */}
      <div className="p-4 cursor-pointer" onClick={() => onExpand(spec.id)}>
        <div className="flex items-start gap-4">
          <DimensionPreview dimensions={spec.label} channel={channel} />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-white">{spec.label}</div>
            <div className="text-sm text-white/50 mt-0.5">
              {spec.publisher && <span>{spec.publisher} • </span>}
              {spec.placements.length} placement{spec.placements.length !== 1 ? 's' : ''}
            </div>
            {spec.minStart && spec.maxEnd && (
              <div className="text-xs text-white/40 mt-1">{formatDate(spec.minStart)} → {formatDate(spec.maxEnd)}</div>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            {currentUpload ? (
              <div className="text-green-400 text-sm font-medium">✓ Uploaded</div>
            ) : spec.earliestDue ? (
              <div className={`text-sm font-medium ${daysUntil !== null && daysUntil < 0 ? 'text-red-400' : daysUntil !== null && daysUntil <= 3 ? 'text-red-400' : daysUntil !== null && daysUntil <= 7 ? 'text-amber-400' : 'text-white/70'}`}>
                {daysUntil !== null && daysUntil < 0 ? 'Overdue' : daysUntil === 0 ? 'Due today' : `Due ${formatDateFull(spec.earliestDue)}`}
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex items-center justify-end mt-3 pt-3 border-t border-white/5">
          <span className={`text-white/30 text-sm transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
        </div>
      </div>
      
      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-white/10">
          {/* File Specs */}
          <div className="p-4 bg-black/20">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><div className="text-xs text-white/40 mb-1">Dimensions</div><div className="text-white/80 font-medium">{spec.label}</div></div>
              {fileSpecs.fileFormat && <div><div className="text-xs text-white/40 mb-1">File Format</div><div className="text-white/80">{fileSpecs.fileFormat}</div></div>}
              {fileSpecs.maxFileSize && <div><div className="text-xs text-white/40 mb-1">Max Size</div><div className="text-white/80">{fileSpecs.maxFileSize}</div></div>}
              {fileSpecs.dpi && <div><div className="text-xs text-white/40 mb-1">DPI</div><div className="text-white/80">{fileSpecs.dpi}</div></div>}
              {(fileSpecs.adLength || fileSpecs.spotLength || fileSpecs.slotLength) && (
                <div><div className="text-xs text-white/40 mb-1">Duration</div><div className="text-white/80">{fileSpecs.adLength || (fileSpecs.spotLength ? `${fileSpecs.spotLength}s` : `${fileSpecs.slotLength}s`)}</div></div>
              )}
              {fileSpecs.leadTime && <div><div className="text-xs text-white/40 mb-1">Lead Time</div><div className="text-white/80">{fileSpecs.leadTime}</div></div>}
              {spec.minStart && spec.maxEnd && (
                <div><div className="text-xs text-white/40 mb-1">Flight Dates</div><div className="text-white/80">{formatDate(spec.minStart)} → {formatDate(spec.maxEnd)}</div></div>
              )}
            </div>
            {fileSpecs.videoSpecs && <div className="mt-3 pt-3 border-t border-white/10"><div className="text-xs text-white/40 mb-1">Video Specs</div><div className="text-white/80 text-sm">{fileSpecs.videoSpecs}</div></div>}
            {fileSpecs.deliveryEmail && <div className="mt-3 pt-3 border-t border-white/10"><div className="text-xs text-white/40 mb-1">Submit Artwork To</div><div className="text-sunny-yellow text-sm">{fileSpecs.deliveryEmail}</div></div>}
          </div>
          
          {/* Publisher Attachments */}
          {publisherAttachments.length > 0 && (
            <div className="px-4 py-3 bg-blue-500/10 border-t border-blue-500/20">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-blue-400">📎</span>
                <span className="text-blue-400 font-medium">Publisher Docs:</span>
                {publisherAttachments.map((att, i) => (
                  <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" className="text-blue-300 hover:text-blue-200 underline">
                    {att.name}
                  </a>
                ))}
              </div>
            </div>
          )}
          
          {/* Notes & Restrictions */}
          {(restrictions.length > 0 || firstPlacement?.notes) && (
            <div className="px-4 py-3 bg-amber-500/10 border-t border-amber-500/20">
              <div className="flex items-start gap-2">
                <span className="text-amber-400">⚠️</span>
                <div>
                  <div className="text-xs font-medium text-amber-400 mb-1">Notes & Restrictions</div>
                  <div className="text-xs text-amber-300/80">
                    {firstPlacement?.notes && <div className="mb-1">{firstPlacement.notes}</div>}
                    {Array.isArray(restrictions) && restrictions.length > 0 && restrictions.join(' • ')}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Upload Area */}
          <div className="p-4 border-t border-white/5">
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,video/*,.pdf" />
            {currentUpload ? (
              <div className="border-2 border-green-500/30 bg-green-500/10 rounded-xl p-4 text-center">
                <div className="text-green-400 text-lg mb-1">✓</div>
                <div className="text-sm text-green-400 font-medium">Uploaded</div>
                <div className="text-xs text-white/50 mt-1 truncate">{currentUpload.filename}</div>
                <button onClick={() => fileInputRef.current?.click()} className="text-xs text-white/40 hover:text-white mt-2">Replace</button>
              </div>
            ) : (
              <div onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-white/20 rounded-xl p-5 text-center hover:border-sunny-yellow/50 hover:bg-sunny-yellow/5 transition-all cursor-pointer group">
                {uploading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin w-5 h-5 border-2 border-sunny-yellow border-t-transparent rounded-full" />
                    <span>Uploading...</span>
                  </div>
                ) : (
                  <>
                    <div className="text-xl mb-1 group-hover:scale-110 transition-transform">📁</div>
                    <div className="text-sm text-white/70">Upload creative</div>
                    <div className="text-xs text-white/40 mt-1">for all {spec.placements.length} placements</div>
                  </>
                )}
              </div>
            )}
          </div>
          
          {/* Placements List */}
          <div className="border-t border-white/5">
            <div className="max-h-64 overflow-y-auto">
              {siteFlights.length < spec.placements.length ? (
                // Grouped by site
                siteFlights.map(({ name, count }) => {
                  const sitePlacements = spec.placements.filter(p => p.placementName === name);
                  return (
                    <div key={name} className="border-b border-white/5 last:border-0">
                      <div className="px-4 py-2.5 flex items-center gap-3 bg-white/[0.02]">
                        <div className="w-5 h-5 rounded bg-white/10 flex items-center justify-center text-xs">📍</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{name}</div>
                          <div className="text-xs text-white/40">{count > 1 ? `× ${count} flights` : '1 flight'}</div>
                        </div>
                      </div>
                      {sitePlacements.map((p, i) => (
                        <div key={p.id || i} className="px-4 py-2 pl-12 flex items-center gap-3 text-xs text-white/50">
                          <span>{formatDate(p.flightStart)} → {formatDate(p.flightEnd)}</span>
                          {p.dueDate && <span className="ml-auto">Due: {formatDateFull(p.dueDate)}</span>}
                        </div>
                      ))}
                    </div>
                  );
                })
              ) : (
                // Flat list
                spec.placements.map((p, idx) => (
                  <div key={p.id || idx} className="px-4 py-2.5 flex items-center gap-3 border-b border-white/5 last:border-0">
                    <div className="w-5 h-5 rounded bg-white/10 flex items-center justify-center text-xs text-white/40">{idx + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{p.placementName}</div>
                      <div className="text-xs text-white/40 truncate">
                        {[p.location, p.flightStart && `${formatDate(p.flightStart)} → ${formatDate(p.flightEnd)}`].filter(Boolean).join(' • ')}
                      </div>
                    </div>
                    {p.dueDate && <div className="text-xs text-white/50">Due: {formatDateFull(p.dueDate)}</div>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// MAIN CLIENT PAGE
// ============================================
export default function ClientBriefPage() {
  const params = useParams();
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedSpecs, setExpandedSpecs] = useState(new Set());
  const [uploads, setUploads] = useState({});

  const briefId = params.briefId || params.id;
  const dueDateBuffer = brief?.dueDateBuffer || 5;

  useEffect(() => {
    async function loadBrief() {
      try {
        const res = await fetch(`/api/brief/${briefId}`);
        if (!res.ok) throw new Error('Brief not found');
        const data = await res.json();
        setBrief(data);
      } catch (err) {
        console.error('Failed to load brief:', err);
      }
      setLoading(false);
    }
    loadBrief();
  }, [briefId]);

  const channelData = useMemo(() => {
    if (!brief?.items) return {};
    const channels = {};
    
    brief.items.forEach(item => {
      const channel = item.channel || 'ooh';
      let specKey, specLabel;
      if (channel === 'radio' || channel === 'tv') {
        specKey = item.specs?.adLength || item.specs?.spotLength || 'unknown';
        specLabel = specKey.includes('second') ? specKey : `${specKey} seconds`;
      } else {
        specKey = item.specs?.dimensions || 'unknown';
        specLabel = specKey;
      }
      const specId = `${channel}-${specKey}`;
      
      if (!channels[channel]) channels[channel] = { specs: {}, totalPlacements: 0, totalCreatives: 0 };
      if (!channels[channel].specs[specKey]) {
        channels[channel].specs[specKey] = {
          id: specId, key: specKey, label: specLabel, publisher: item.publisherName,
          placements: [], minStart: null, maxEnd: null, earliestDue: null,
        };
        channels[channel].totalCreatives++;
      }
      
      const spec = channels[channel].specs[specKey];
      const calculatedDueDate = item.dueDate || calculateDueDate(item.flightStart, dueDateBuffer);
      spec.placements.push({ ...item, dueDate: calculatedDueDate });
      channels[channel].totalPlacements++;
      
      if (item.flightStart && (!spec.minStart || item.flightStart < spec.minStart)) spec.minStart = item.flightStart;
      if (item.flightEnd && (!spec.maxEnd || item.flightEnd > spec.maxEnd)) spec.maxEnd = item.flightEnd;
      if (calculatedDueDate && (!spec.earliestDue || calculatedDueDate < spec.earliestDue)) spec.earliestDue = calculatedDueDate;
    });
    
    return channels;
  }, [brief, dueDateBuffer]);

  const stats = useMemo(() => {
    let totalCreatives = 0, uploaded = 0;
    Object.values(channelData).forEach(channel => {
      Object.values(channel.specs).forEach(spec => {
        totalCreatives++;
        if (uploads[spec.id]) uploaded++;
      });
    });
    return { totalCreatives, uploaded };
  }, [channelData, uploads]);

  function toggleSpecExpanded(specId) {
    setExpandedSpecs(prev => {
      const next = new Set(prev);
      if (next.has(specId)) next.delete(specId);
      else next.add(specId);
      return next;
    });
  }

  function handleUpload(specId, uploadData) {
    setUploads(prev => ({ ...prev, [specId]: uploadData }));
  }

  if (loading) {
    return <div className="min-h-screen bg-sunny-dark flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-sunny-yellow border-t-transparent rounded-full" />
    </div>;
  }

  if (!brief) {
    return <div className="min-h-screen bg-sunny-dark flex items-center justify-center text-white">
      <div className="text-center">
        <h1 className="text-2xl font-semibold mb-4">Brief not found</h1>
        <p className="text-white/50">This link may have expired or the brief may have been removed.</p>
      </div>
    </div>;
  }

  return (
    <div className="min-h-screen bg-sunny-dark text-white">
      {/* Header */}
      <header className="border-b border-white/10">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <img src="/sunny-logo-white.png" alt="Sunny" className="h-6" />
              <div className="border-l border-white/20 pl-4">
                <p className="text-sm text-white/50">Creative Brief</p>
                <h1 className="text-2xl font-bold">{brief.campaignName}</h1>
                <p className="text-white/60">{brief.clientName}</p>
              </div>
            </div>
            <UploadProgressCircle uploaded={stats.uploaded} total={stats.totalCreatives} />
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* How to Upload Helper */}
        <div className="bg-sunny-yellow/10 border border-sunny-yellow/20 rounded-xl p-4 mb-8">
          <div className="flex items-start gap-3">
            <span className="text-sunny-yellow">💡</span>
            <div>
              <h3 className="font-medium text-sunny-yellow">How to upload</h3>
              <p className="text-sm text-white/70 mt-1">
                Upload one creative file per card below. Each file will be used for all placements in that group.
                Click a card to see the individual placements and specifications.
              </p>
            </div>
          </div>
        </div>

        {/* Reference Docs Banner */}
        {brief.attachments?.length > 0 && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-8">
            <div className="flex items-center gap-2 text-sm flex-wrap">
              <span className="text-blue-400">📎</span>
              <span className="text-blue-400 font-medium">Reference Documents:</span>
              {brief.attachments.map((att, i) => (
                <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" className="text-blue-300 hover:text-blue-200 underline">
                  {att.name}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Creative Requirements by Channel */}
        <div className="space-y-10">
          {Object.entries(channelData).map(([channelKey, channel]) => {
            const config = CHANNELS[channelKey] || CHANNELS.ooh;
            const specs = Object.values(channel.specs);
            return (
              <div key={channelKey}>
                <div className="flex items-center gap-3 mb-5">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center text-xl shadow-lg`}>{config.icon}</div>
                  <div>
                    <h2 className="text-lg font-semibold">{config.name}</h2>
                    <p className="text-sm text-white/50">{specs.length} creative{specs.length !== 1 ? 's' : ''} needed</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {specs.map(spec => (
                    <ClientSpecCard key={spec.id} spec={spec} channel={channelKey}
                      onExpand={toggleSpecExpanded} isExpanded={expandedSpecs.has(spec.id)}
                      uploads={uploads} onUpload={handleUpload} attachments={brief.attachments} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {Object.keys(channelData).length === 0 && (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">📋</div>
            <p className="text-white/50 text-lg">No placements in this brief yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
