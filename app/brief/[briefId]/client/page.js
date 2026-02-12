'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
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
// VISUAL DIMENSION PREVIEW
// ============================================
function DimensionPreview({ dimensions, channel }) {
  // Audio visualization for radio/tv
  if (channel === 'radio' || channel === 'tv') {
    const seconds = parseInt(dimensions) || 30;
    const bars = Math.min(Math.ceil(seconds / 5), 10);
    
    return (
      <div className="w-14 h-10 flex items-end justify-center gap-0.5 bg-white/5 rounded-lg p-1.5">
        {Array.from({ length: bars }).map((_, i) => (
          <div
            key={i}
            className="w-1 bg-amber-400 rounded-full"
            style={{ height: `${40 + Math.sin(i * 0.9) * 25 + Math.random() * 20}%` }}
          />
        ))}
      </div>
    );
  }
  
  // Aspect ratio box for visual
  if (!dimensions) {
    return <div className="w-14 h-10 rounded-lg bg-white/5" />;
  }
  
  const match = dimensions.match(/(\d+)\s*[x×]\s*(\d+)/i);
  if (!match) {
    return <div className="w-14 h-10 rounded-lg bg-white/5" />;
  }
  
  const [, w, h] = match;
  const aspectRatio = parseInt(w) / parseInt(h);
  
  const containerW = 56;
  const containerH = 40;
  
  let rectW, rectH;
  if (aspectRatio > containerW / containerH) {
    rectW = containerW;
    rectH = containerW / aspectRatio;
  } else {
    rectH = containerH;
    rectW = containerH * aspectRatio;
  }
  
  return (
    <div className="w-14 h-10 flex items-center justify-center bg-white/5 rounded-lg">
      <div 
        className="bg-gradient-to-br from-blue-400 to-blue-600 rounded-sm"
        style={{ width: `${rectW}px`, height: `${rectH}px` }}
      />
    </div>
  );
}

// ============================================
// PROGRESS RING
// ============================================
function ProgressRing({ completed, total }) {
  const percentage = total > 0 ? (completed / total) * 100 : 0;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
  return (
    <div className="relative w-28 h-28">
      <svg className="w-full h-full -rotate-90">
        <circle
          cx="56"
          cy="56"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="8"
        />
        <circle
          cx="56"
          cy="56"
          r={radius}
          fill="none"
          stroke="#facc15"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-white">{completed}/{total}</span>
        <span className="text-xs text-white/50">uploaded</span>
      </div>
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
  const [uploads, setUploads] = useState({}); // Track uploaded specs
  const [uploading, setUploading] = useState(null);
  const fileRefs = useRef({});

  const briefId = params.briefId || params.id;

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

  // Build channel → specs structure from items
  const channelData = useMemo(() => {
    if (!brief?.items) return {};
    
    const channels = {};
    
    brief.items.forEach(item => {
      const channel = item.channel || 'ooh';
      
      let specKey;
      if (channel === 'radio' || channel === 'tv') {
        specKey = item.specs?.adLength || item.specs?.spotLength || 'unknown';
      } else {
        specKey = item.specs?.dimensions || 'unknown';
      }
      
      if (!channels[channel]) {
        channels[channel] = { specs: {}, totalPlacements: 0 };
      }
      
      if (!channels[channel].specs[specKey]) {
        channels[channel].specs[specKey] = {
          id: `${channel}-${specKey}`,
          label: specKey,
          publisher: item.publisherName,
          placements: [],
          minStart: null,
          maxEnd: null,
          earliestDue: null,
        };
      }
      
      const spec = channels[channel].specs[specKey];
      spec.placements.push(item);
      channels[channel].totalPlacements++;
      
      if (item.flightStart && (!spec.minStart || item.flightStart < spec.minStart)) {
        spec.minStart = item.flightStart;
      }
      if (item.flightEnd && (!spec.maxEnd || item.flightEnd > spec.maxEnd)) {
        spec.maxEnd = item.flightEnd;
      }
      if (item.dueDate && (!spec.earliestDue || item.dueDate < spec.earliestDue)) {
        spec.earliestDue = item.dueDate;
      }
    });
    
    return channels;
  }, [brief]);

  // Stats
  const stats = useMemo(() => {
    let totalCreatives = 0;
    Object.values(channelData).forEach(ch => {
      totalCreatives += Object.keys(ch.specs).length;
    });
    const uploadedCount = Object.keys(uploads).length;
    return { totalCreatives, uploadedCount };
  }, [channelData, uploads]);

  function toggleExpanded(specId) {
    setExpandedSpecs(prev => {
      const next = new Set(prev);
      if (next.has(specId)) next.delete(specId);
      else next.add(specId);
      return next;
    });
  }

  async function handleUpload(specId, file) {
    if (!file) return;
    
    setUploading(specId);
    
    // Simulate upload
    await new Promise(r => setTimeout(r, 1500));
    
    setUploads(prev => ({ ...prev, [specId]: { name: file.name, uploadedAt: new Date() } }));
    setUploading(null);
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
    } catch {
      return dateStr;
    }
  }

  function getDaysUntil(dateStr) {
    if (!dateStr) return null;
    return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
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
          <h1 className="text-2xl font-semibold text-white mb-2">Brief not found</h1>
          <p className="text-white/50">This link may have expired.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sunny-dark text-white">
      {/* Header */}
      <header className="border-b border-white/10 sticky top-0 z-50 bg-sunny-dark/95 backdrop-blur">
        <div className="max-w-3xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <img src="/sunny-logo-white.png" alt="Sunny Advertising" className="h-5 mb-3" />
              <p className="text-sm text-white/50 mb-1">Creative Brief</p>
              <h1 className="text-2xl font-bold">{brief.clientName}</h1>
              <p className="text-white/60">{brief.campaignName}</p>
            </div>
            <ProgressRing completed={stats.uploadedCount} total={stats.totalCreatives} />
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Instructions */}
        <div className="bg-sunny-yellow/10 border border-sunny-yellow/20 rounded-xl p-4 mb-8">
          <div className="flex gap-3">
            <div className="text-xl">💡</div>
            <div>
              <p className="font-medium text-sunny-yellow">How to upload</p>
              <p className="text-sm text-white/60 mt-1">
                Upload one creative file per card below. Each file will be used for all placements in that group.
                Click a card to see the individual placements and specifications.
              </p>
            </div>
          </div>
        </div>

        {/* Channel Sections */}
        <div className="space-y-10">
          {Object.entries(channelData).map(([channelKey, channel]) => {
            const config = CHANNELS[channelKey] || CHANNELS.ooh;
            const specs = Object.values(channel.specs);
            
            return (
              <div key={channelKey}>
                {/* Channel Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center text-xl`}>
                    {config.icon}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">{config.name}</h2>
                    <p className="text-sm text-white/50">
                      {specs.length} creative{specs.length !== 1 ? 's' : ''} needed
                    </p>
                  </div>
                </div>

                {/* Spec Cards */}
                <div className="space-y-4">
                  {specs.map(spec => {
                    const isExpanded = expandedSpecs.has(spec.id);
                    const isUploaded = uploads[spec.id];
                    const isCurrentlyUploading = uploading === spec.id;
                    const daysLeft = getDaysUntil(spec.earliestDue);
                    
                    // Get file specs from first placement
                    const firstPlacement = spec.placements[0];
                    const fileSpecs = firstPlacement?.specs || {};
                    const restrictions = firstPlacement?.restrictions || [];
                    
                    return (
                      <div
                        key={spec.id}
                        className={`bg-white/5 rounded-2xl border overflow-hidden transition-all ${
                          isUploaded 
                            ? 'border-green-500/30' 
                            : daysLeft !== null && daysLeft <= 3
                              ? 'border-red-500/30'
                              : 'border-white/10'
                        }`}
                      >
                        {/* Card Header */}
                        <div className="p-5">
                          <div className="flex items-center gap-4">
                            {/* Checkmark or Dimension Preview */}
                            {isUploaded ? (
                              <div className="w-14 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                                <span className="text-green-400 text-xl">✓</span>
                              </div>
                            ) : (
                              <DimensionPreview dimensions={spec.label} channel={channelKey} />
                            )}
                            
                            {/* Info */}
                            <div className="flex-1">
                              <div className="font-semibold">{spec.label}</div>
                              <div className="text-sm text-white/50">
                                {spec.publisher && `${spec.publisher} • `}
                                {spec.placements.length} placement{spec.placements.length !== 1 ? 's' : ''}
                              </div>
                            </div>
                            
                            {/* Due Date */}
                            <div className="text-right">
                              {daysLeft !== null && (
                                <div className={`text-sm font-medium ${
                                  daysLeft < 0 ? 'text-red-400' :
                                  daysLeft <= 3 ? 'text-red-400' :
                                  daysLeft <= 7 ? 'text-amber-400' :
                                  'text-white/70'
                                }`}>
                                  {daysLeft < 0 ? 'Overdue' : daysLeft === 0 ? 'Due today' : `${daysLeft}d left`}
                                </div>
                              )}
                              <div className="text-xs text-white/40">
                                {spec.earliestDue ? `Due ${formatDate(spec.earliestDue)}` : ''}
                              </div>
                            </div>
                          </div>
                          
                          {/* Upload Button or Success State */}
                          <div className="mt-4">
                            <input
                              ref={el => fileRefs.current[spec.id] = el}
                              type="file"
                              className="hidden"
                              onChange={e => handleUpload(spec.id, e.target.files?.[0])}
                            />
                            
                            {isUploaded ? (
                              <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                                <div className="flex items-center gap-2">
                                  <span className="text-green-400">📄</span>
                                  <span className="text-sm font-medium text-green-400">{isUploaded.name}</span>
                                </div>
                                <button 
                                  onClick={() => fileRefs.current[spec.id]?.click()}
                                  className="text-sm text-green-400 hover:text-green-300"
                                >
                                  Replace
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => fileRefs.current[spec.id]?.click()}
                                disabled={isCurrentlyUploading}
                                className="w-full p-4 border-2 border-dashed border-white/20 rounded-xl text-center hover:border-sunny-yellow/50 hover:bg-sunny-yellow/5 transition-all disabled:opacity-50"
                              >
                                {isCurrentlyUploading ? (
                                  <div className="flex items-center justify-center gap-2">
                                    <div className="animate-spin w-5 h-5 border-2 border-sunny-yellow border-t-transparent rounded-full" />
                                    <span className="text-white/50">Uploading...</span>
                                  </div>
                                ) : (
                                  <>
                                    <div className="text-xl mb-1">📤</div>
                                    <div className="text-sm font-medium">Upload creative</div>
                                    <div className="text-xs text-white/40 mt-1">for all {spec.placements.length} placements</div>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                          
                          {/* Expand toggle */}
                          <button
                            onClick={() => toggleExpanded(spec.id)}
                            className="w-full mt-4 pt-3 border-t border-white/10 text-sm text-white/40 hover:text-white/60 flex items-center justify-center gap-1"
                          >
                            {isExpanded ? 'Hide' : 'Show'} specs & placements
                            <span className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                          </button>
                        </div>
                        
                        {/* Expanded Content */}
                        {isExpanded && (
                          <div className="border-t border-white/10">
                            {/* File Specs */}
                            <div className="p-4 bg-black/20 grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <div className="text-xs text-white/40 mb-1">Dimensions</div>
                                <div className="text-white/80">{spec.label}</div>
                              </div>
                              {fileSpecs.physicalSize && (
                                <div>
                                  <div className="text-xs text-white/40 mb-1">Physical Size</div>
                                  <div className="text-white/80">{fileSpecs.physicalSize}</div>
                                </div>
                              )}
                              {fileSpecs.fileFormat && (
                                <div>
                                  <div className="text-xs text-white/40 mb-1">File Format</div>
                                  <div className="text-white/80">{fileSpecs.fileFormat}</div>
                                </div>
                              )}
                              {(fileSpecs.adLength || fileSpecs.spotLength) && (
                                <div>
                                  <div className="text-xs text-white/40 mb-1">Duration</div>
                                  <div className="text-white/80">{fileSpecs.adLength || `${fileSpecs.spotLength}s`}</div>
                                </div>
                              )}
                              {fileSpecs.direction && (
                                <div>
                                  <div className="text-xs text-white/40 mb-1">Direction</div>
                                  <div className="text-white/80">{fileSpecs.direction}</div>
                                </div>
                              )}
                              {spec.minStart && spec.maxEnd && (
                                <div>
                                  <div className="text-xs text-white/40 mb-1">Flight Dates</div>
                                  <div className="text-white/80">{formatDate(spec.minStart)} → {formatDate(spec.maxEnd)}</div>
                                </div>
                              )}
                            </div>
                            
                            {/* Restrictions */}
                            {restrictions.length > 0 && (
                              <div className="px-4 py-3 bg-amber-500/10 border-t border-amber-500/20">
                                <div className="flex items-start gap-2">
                                  <span className="text-amber-400">⚠️</span>
                                  <div>
                                    <div className="text-xs font-medium text-amber-400 mb-1">Restrictions</div>
                                    <div className="text-xs text-amber-300/80">
                                      {Array.isArray(restrictions) ? restrictions.join(' • ') : restrictions}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {/* Placements List */}
                            <div className="max-h-60 overflow-y-auto border-t border-white/5">
                              {spec.placements.map((p, idx) => (
                                <div key={p.id || idx} className="px-4 py-3 flex items-center gap-3 border-b border-white/5 last:border-0 hover:bg-white/5">
                                  <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-xs text-white/40">
                                    {idx + 1}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium truncate">{p.placementName}</div>
                                    <div className="text-xs text-white/40">
                                      {[p.location, p.flightStart && `${formatDate(p.flightStart)} → ${formatDate(p.flightEnd)}`]
                                        .filter(Boolean).join(' • ')}
                                    </div>
                                  </div>
                                  <button className="text-xs text-white/40 hover:text-sunny-yellow px-2 py-1 rounded hover:bg-white/10 flex-shrink-0">
                                    Upload ↗
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-white/10 text-center">
          <p className="text-sm text-white/40">Questions? Contact your account manager.</p>
        </div>
      </div>
    </div>
  );
}
