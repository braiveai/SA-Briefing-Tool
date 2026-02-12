'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'next/navigation';

// ============================================
// CHANNEL CONFIG
// ============================================
const CHANNELS = {
  ooh: { name: 'Out of Home', icon: '📍', color: 'bg-blue-500' },
  tv: { name: 'Television', icon: '📺', color: 'bg-purple-500' },
  radio: { name: 'Radio', icon: '📻', color: 'bg-amber-500' },
  digital: { name: 'Digital', icon: '💻', color: 'bg-green-500' },
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
      <div className="w-14 h-10 flex items-end justify-center gap-0.5 bg-gray-100 rounded-lg p-1.5">
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
    return <div className="w-14 h-10 rounded-lg bg-gray-100" />;
  }
  
  const match = dimensions.match(/(\d+)\s*[x×]\s*(\d+)/i);
  if (!match) {
    return <div className="w-14 h-10 rounded-lg bg-gray-100" />;
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
    <div className="w-14 h-10 flex items-center justify-center bg-gray-50 rounded-lg">
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
          stroke="#e5e7eb"
          strokeWidth="8"
        />
        <circle
          cx="56"
          cy="56"
          r={radius}
          fill="none"
          stroke="#22c55e"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-gray-900">{completed}/{total}</span>
        <span className="text-xs text-gray-500">uploaded</span>
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!brief) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Brief not found</h1>
          <p className="text-gray-500">This link may have expired.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Creative Brief</p>
              <h1 className="text-2xl font-bold text-gray-900">{brief.clientName}</h1>
              <p className="text-gray-600">{brief.campaignName}</p>
            </div>
            <ProgressRing completed={stats.uploadedCount} total={stats.totalCreatives} />
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-8">
          <div className="flex gap-3">
            <div className="text-xl">💡</div>
            <div>
              <p className="font-medium text-blue-900">How to upload</p>
              <p className="text-sm text-blue-700 mt-1">
                Upload one creative file per card. Each file will be used for all placements in that group.
                Expand a card to see individual placements or upload separately.
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
                  <div className={`w-10 h-10 rounded-xl ${config.color} flex items-center justify-center text-xl text-white`}>
                    {config.icon}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{config.name}</h2>
                    <p className="text-sm text-gray-500">
                      {specs.length} creative{specs.length !== 1 ? 's' : ''} needed
                    </p>
                  </div>
                </div>

                {/* Spec Cards */}
                <div className="grid gap-4">
                  {specs.map(spec => {
                    const isExpanded = expandedSpecs.has(spec.id);
                    const isUploaded = uploads[spec.id];
                    const isCurrentlyUploading = uploading === spec.id;
                    const daysLeft = getDaysUntil(spec.earliestDue);
                    
                    return (
                      <div
                        key={spec.id}
                        className={`bg-white rounded-2xl border transition-all ${
                          isUploaded 
                            ? 'border-green-200 bg-green-50/50' 
                            : daysLeft !== null && daysLeft <= 3
                              ? 'border-red-200'
                              : 'border-gray-200'
                        }`}
                      >
                        {/* Card Header */}
                        <div className="p-5">
                          <div className="flex items-center gap-4">
                            {/* Checkmark or Dimension Preview */}
                            {isUploaded ? (
                              <div className="w-14 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                                <span className="text-green-600 text-xl">✓</span>
                              </div>
                            ) : (
                              <DimensionPreview dimensions={spec.label} channel={channelKey} />
                            )}
                            
                            {/* Info */}
                            <div className="flex-1">
                              <div className="font-semibold text-gray-900">{spec.label}</div>
                              <div className="text-sm text-gray-500">
                                {spec.publisher && `${spec.publisher} • `}
                                {spec.placements.length} placement{spec.placements.length !== 1 ? 's' : ''}
                              </div>
                            </div>
                            
                            {/* Due Date */}
                            <div className="text-right">
                              {daysLeft !== null && (
                                <div className={`text-sm font-medium ${
                                  daysLeft < 0 ? 'text-red-600' :
                                  daysLeft <= 3 ? 'text-red-500' :
                                  daysLeft <= 7 ? 'text-amber-500' :
                                  'text-gray-600'
                                }`}>
                                  {daysLeft < 0 ? 'Overdue' : daysLeft === 0 ? 'Due today' : `${daysLeft}d left`}
                                </div>
                              )}
                              <div className="text-xs text-gray-400">
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
                              <div className="flex items-center justify-between p-3 bg-green-100 rounded-xl">
                                <div className="flex items-center gap-2">
                                  <span className="text-green-600">📄</span>
                                  <span className="text-sm font-medium text-green-800">{isUploaded.name}</span>
                                </div>
                                <button 
                                  onClick={() => fileRefs.current[spec.id]?.click()}
                                  className="text-sm text-green-700 hover:text-green-900"
                                >
                                  Replace
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => fileRefs.current[spec.id]?.click()}
                                disabled={isCurrentlyUploading}
                                className="w-full p-4 border-2 border-dashed border-gray-200 rounded-xl text-center hover:border-blue-400 hover:bg-blue-50 transition-all disabled:opacity-50"
                              >
                                {isCurrentlyUploading ? (
                                  <div className="flex items-center justify-center gap-2">
                                    <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />
                                    <span className="text-gray-500">Uploading...</span>
                                  </div>
                                ) : (
                                  <>
                                    <div className="text-xl mb-1">📤</div>
                                    <div className="text-sm font-medium text-gray-700">Upload creative</div>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                          
                          {/* Expand toggle */}
                          <button
                            onClick={() => toggleExpanded(spec.id)}
                            className="w-full mt-3 pt-3 border-t border-gray-100 text-sm text-gray-400 hover:text-gray-600 flex items-center justify-center gap-1"
                          >
                            {isExpanded ? 'Hide' : 'Show'} placements
                            <span className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                          </button>
                        </div>
                        
                        {/* Expanded Placements */}
                        {isExpanded && (
                          <div className="border-t border-gray-100 max-h-60 overflow-y-auto">
                            {spec.placements.map((p, idx) => (
                              <div key={p.id || idx} className="px-5 py-3 flex items-center gap-3 border-b border-gray-50 last:border-0">
                                <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center text-xs text-gray-400">
                                  {idx + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-gray-900 truncate">{p.placementName}</div>
                                  <div className="text-xs text-gray-400">
                                    {[p.location, p.flightStart && `${formatDate(p.flightStart)} → ${formatDate(p.flightEnd)}`]
                                      .filter(Boolean).join(' • ')}
                                  </div>
                                </div>
                              </div>
                            ))}
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
        <div className="mt-12 pt-8 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-500">Questions? Contact your account manager.</p>
          <p className="mt-2 text-xs text-gray-400">Powered by Sunny Advertising</p>
        </div>
      </div>
    </div>
  );
}
