'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';

// ============================================
// CHANNEL CONFIG
// ============================================
const CHANNELS = {
  ooh: { 
    name: 'Out of Home', 
    icon: '📍',
    gradient: 'from-blue-500 to-blue-600',
  },
  tv: { 
    name: 'Television', 
    icon: '📺',
    gradient: 'from-purple-500 to-purple-600',
  },
  radio: { 
    name: 'Radio', 
    icon: '📻',
    gradient: 'from-amber-500 to-amber-600',
  },
  digital: { 
    name: 'Digital', 
    icon: '💻',
    gradient: 'from-green-500 to-green-600',
  },
};

// ============================================
// STATUS TRACK CONFIG
// ============================================
const STATUS_STEPS = [
  { key: 'briefed', label: 'Briefed' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'review', label: 'Review' },
  { key: 'approved', label: 'Approved' },
  { key: 'delivered', label: 'Delivered' },
];

// ============================================
// VISUAL DIMENSION PREVIEW COMPONENT
// ============================================
function DimensionPreview({ dimensions, channel }) {
  // For radio/tv, show duration visualization instead
  if (channel === 'radio' || channel === 'tv') {
    const seconds = parseInt(dimensions) || 30;
    const bars = Math.min(Math.ceil(seconds / 5), 12); // 1 bar per 5 seconds, max 12
    
    return (
      <div className="w-16 h-12 flex items-end justify-center gap-0.5">
        {Array.from({ length: bars }).map((_, i) => (
          <div
            key={i}
            className="w-1 bg-gradient-to-t from-amber-500 to-amber-300 rounded-full"
            style={{ 
              height: `${30 + Math.sin(i * 0.8) * 20 + Math.random() * 20}%`,
              opacity: 0.6 + (i / bars) * 0.4
            }}
          />
        ))}
      </div>
    );
  }
  
  // For OOH/digital, show proportional rectangle
  if (!dimensions) {
    return (
      <div className="w-16 h-12 rounded bg-white/10 flex items-center justify-center">
        <span className="text-white/30 text-xs">?</span>
      </div>
    );
  }
  
  // Parse dimensions like "952x252 px" or "1080x1920"
  const match = dimensions.match(/(\d+)\s*[x×]\s*(\d+)/i);
  if (!match) {
    return (
      <div className="w-16 h-12 rounded bg-white/10 flex items-center justify-center">
        <span className="text-white/30 text-xs">?</span>
      </div>
    );
  }
  
  const [, w, h] = match;
  const width = parseInt(w);
  const height = parseInt(h);
  const aspectRatio = width / height;
  
  // Container is 64x48 (w-16 h-12)
  // Scale to fit while maintaining aspect ratio
  const containerW = 64;
  const containerH = 48;
  
  let rectW, rectH;
  if (aspectRatio > containerW / containerH) {
    // Width constrained
    rectW = containerW;
    rectH = containerW / aspectRatio;
  } else {
    // Height constrained
    rectH = containerH;
    rectW = containerH * aspectRatio;
  }
  
  return (
    <div className="w-16 h-12 flex items-center justify-center">
      <div 
        className="bg-gradient-to-br from-blue-400 to-blue-600 rounded-sm shadow-lg shadow-blue-500/20"
        style={{ width: `${rectW}px`, height: `${rectH}px` }}
      />
    </div>
  );
}

// ============================================
// STATUS TRACK COMPONENT
// ============================================
function StatusTrack({ currentStatus, onChange, groupId }) {
  const currentIndex = STATUS_STEPS.findIndex(s => s.key === currentStatus);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  
  return (
    <div className="flex items-center gap-1">
      {STATUS_STEPS.map((step, idx) => {
        const isFilled = idx <= currentIndex;
        const isHovered = hoveredIndex !== null && idx <= hoveredIndex;
        const showLabel = hoveredIndex === idx;
        
        return (
          <div key={step.key} className="relative">
            <button
              onClick={() => onChange(groupId, step.key)}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
              className={`w-3 h-3 rounded-full transition-all duration-200 ${
                isFilled 
                  ? 'bg-sunny-yellow' 
                  : isHovered 
                    ? 'bg-sunny-yellow/50' 
                    : 'bg-white/20'
              } ${isHovered ? 'scale-125' : ''}`}
            />
            {showLabel && (
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-black rounded text-xs whitespace-nowrap z-10">
                {step.label}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// SPEC CARD COMPONENT
// ============================================
function SpecCard({ spec, channel, onStatusChange, onExpand, isExpanded }) {
  const daysUntil = spec.earliestDue ? getDaysUntil(spec.earliestDue) : null;
  
  // Urgency styling
  let urgencyClass = '';
  let urgencyGlow = '';
  if (daysUntil !== null) {
    if (daysUntil < 0) {
      urgencyClass = 'border-red-500/50';
      urgencyGlow = 'shadow-red-500/20 shadow-lg';
    } else if (daysUntil <= 3) {
      urgencyClass = 'border-red-500/30';
      urgencyGlow = 'shadow-red-500/10 shadow-md';
    } else if (daysUntil <= 7) {
      urgencyClass = 'border-amber-500/30';
      urgencyGlow = 'shadow-amber-500/10 shadow-md';
    }
  }
  
  return (
    <div 
      className={`bg-white/5 rounded-2xl border border-white/10 overflow-hidden transition-all hover:bg-white/[0.07] ${urgencyClass} ${urgencyGlow}`}
    >
      {/* Card Header */}
      <div 
        className="p-4 cursor-pointer"
        onClick={() => onExpand(spec.id)}
      >
        <div className="flex items-start gap-4">
          {/* Visual Dimension Preview */}
          <DimensionPreview dimensions={spec.label} channel={channel} />
          
          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-white">{spec.label}</div>
            <div className="text-sm text-white/50 mt-0.5">
              {spec.publisher && <span>{spec.publisher} • </span>}
              {spec.placements.length} placement{spec.placements.length !== 1 ? 's' : ''}
            </div>
            
            {/* Flight dates */}
            {spec.minStart && spec.maxEnd && (
              <div className="text-xs text-white/40 mt-1">
                {formatDate(spec.minStart)} → {formatDate(spec.maxEnd)}
              </div>
            )}
          </div>
          
          {/* Right side - Due date & expand */}
          <div className="text-right flex-shrink-0">
            {spec.earliestDue && (
              <div className={`text-sm font-medium ${
                daysUntil !== null && daysUntil < 0 ? 'text-red-400' :
                daysUntil !== null && daysUntil <= 3 ? 'text-red-400' :
                daysUntil !== null && daysUntil <= 7 ? 'text-amber-400' :
                'text-white/70'
              }`}>
                {daysUntil !== null && daysUntil < 0 
                  ? 'Overdue' 
                  : daysUntil === 0 
                    ? 'Due today'
                    : `${daysUntil}d left`}
              </div>
            )}
            <div className="text-xs text-white/40 mt-0.5">
              {spec.earliestDue ? formatDate(spec.earliestDue) : 'No due date'}
            </div>
          </div>
        </div>
        
        {/* Status Track */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
          <StatusTrack 
            currentStatus={spec.status || 'briefed'} 
            onChange={onStatusChange}
            groupId={spec.id}
          />
          
          <span className={`text-white/30 text-sm transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
            ▶
          </span>
        </div>
      </div>
      
      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-white/10">
          {/* File Specs */}
          {(() => {
            const firstPlacement = spec.placements[0];
            const fileSpecs = firstPlacement?.specs || {};
            const restrictions = firstPlacement?.restrictions || [];
            
            return (
              <>
                <div className="p-4 bg-black/20 grid grid-cols-3 gap-4 text-sm">
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
                  {fileSpecs.panelId && (
                    <div>
                      <div className="text-xs text-white/40 mb-1">Panel ID</div>
                      <div className="text-white/80">{fileSpecs.panelId}</div>
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
              </>
            );
          })()}
          
          {/* Upload Area */}
          <div className="p-4 border-t border-white/5">
            <div className="border-2 border-dashed border-white/20 rounded-xl p-5 text-center hover:border-sunny-yellow/50 hover:bg-sunny-yellow/5 transition-all cursor-pointer group">
              <div className="text-xl mb-1 group-hover:scale-110 transition-transform">📁</div>
              <div className="text-sm text-white/70">Upload creative</div>
              <div className="text-xs text-white/40 mt-1">for all {spec.placements.length} placements</div>
            </div>
          </div>
          
          {/* Placements List */}
          <div className="max-h-64 overflow-y-auto border-t border-white/5">
            {spec.placements.map((p, idx) => (
              <div 
                key={p.id || idx} 
                className="px-4 py-2.5 flex items-center gap-3 border-b border-white/5 last:border-0 hover:bg-white/5"
              >
                <div className="w-5 h-5 rounded bg-white/10 flex items-center justify-center text-xs text-white/40 flex-shrink-0">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{p.placementName}</div>
                  <div className="text-xs text-white/40 truncate">
                    {[p.location, p.flightStart && `${formatDate(p.flightStart)} → ${formatDate(p.flightEnd)}`]
                      .filter(Boolean).join(' • ')}
                  </div>
                </div>
                {p.dueDate && (
                  <div className="text-xs text-white/50 mr-2">
                    Due: {formatDate(p.dueDate)}
                  </div>
                )}
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
}

// ============================================
// HELPER FUNCTIONS
// ============================================
function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-AU', { 
      day: 'numeric', 
      month: 'short'
    });
  } catch {
    return dateStr;
  }
}

function getDaysUntil(dateStr) {
  if (!dateStr) return null;
  const days = Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
  return days;
}

// ============================================
// TIMELINE COMPONENT
// ============================================
function FlightTimeline({ channelData }) {
  // Flatten all specs for timeline
  const allSpecs = [];
  Object.entries(channelData).forEach(([channelKey, channel]) => {
    Object.values(channel.specs).forEach(spec => {
      if (spec.minStart && spec.maxEnd) {
        allSpecs.push({ ...spec, channel: channelKey });
      }
    });
  });
  
  if (allSpecs.length === 0) return null;
  
  // Find date range
  let minDate = null;
  let maxDate = null;
  allSpecs.forEach(spec => {
    if (!minDate || spec.minStart < minDate) minDate = spec.minStart;
    if (!maxDate || spec.maxEnd > maxDate) maxDate = spec.maxEnd;
  });
  
  const start = new Date(minDate);
  start.setDate(start.getDate() - 7);
  const end = new Date(maxDate);
  end.setDate(end.getDate() + 7);
  const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  
  // Month markers
  const months = [];
  const current = new Date(start);
  current.setDate(1);
  while (current <= end) {
    const daysFromStart = Math.ceil((current - start) / (1000 * 60 * 60 * 24));
    months.push({
      label: current.toLocaleDateString('en-AU', { month: 'short' }),
      position: Math.max(0, (daysFromStart / totalDays) * 100),
    });
    current.setMonth(current.getMonth() + 1);
  }
  
  const channelColors = {
    ooh: 'bg-blue-500',
    tv: 'bg-purple-500',
    radio: 'bg-amber-500',
    digital: 'bg-green-500',
  };
  
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
      <h3 className="font-semibold mb-4">Flight Plan</h3>
      
      {/* Month labels */}
      <div className="relative h-6 mb-2">
        {months.map((month, i) => (
          <div
            key={i}
            className="absolute text-xs text-white/40"
            style={{ left: `${month.position}%` }}
          >
            {month.label}
          </div>
        ))}
      </div>
      
      {/* Timeline bars */}
      <div className="space-y-2">
        {allSpecs.map((spec) => {
          const specStart = new Date(spec.minStart);
          const specEnd = new Date(spec.maxEnd);
          const startDays = Math.ceil((specStart - start) / (1000 * 60 * 60 * 24));
          const endDays = Math.ceil((specEnd - start) / (1000 * 60 * 60 * 24));
          const left = (startDays / totalDays) * 100;
          const width = Math.max(3, ((endDays - startDays) / totalDays) * 100);
          
          return (
            <div key={spec.id} className="flex items-center gap-3">
              <div className="w-28 text-xs text-white/60 truncate flex-shrink-0">
                {spec.label}
              </div>
              <div className="flex-1 relative h-7 bg-white/5 rounded">
                <div
                  className={`absolute h-full rounded ${channelColors[spec.channel]} flex items-center px-2`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                >
                  <span className="text-xs text-white truncate">{spec.placements.length}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/10">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-blue-500" />
          <span className="text-xs text-white/50">OOH</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-purple-500" />
          <span className="text-xs text-white/50">TV</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-amber-500" />
          <span className="text-xs text-white/50">Radio</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-green-500" />
          <span className="text-xs text-white/50">Digital</span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================
export default function BriefPage() {
  const params = useParams();
  const router = useRouter();
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedSpecs, setExpandedSpecs] = useState(new Set());
  const [copySuccess, setCopySuccess] = useState(false);

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

  // Build lookup of stored group statuses
  const storedStatuses = useMemo(() => {
    const lookup = {};
    if (brief?.groups) {
      brief.groups.forEach(channelGroup => {
        channelGroup.specs?.forEach(spec => {
          if (spec.id) lookup[spec.id] = spec.status || 'briefed';
        });
      });
    }
    return lookup;
  }, [brief?.groups]);

  // Organize data: Channel → Specs → Placements
  const channelData = useMemo(() => {
    if (!brief?.items) return {};
    
    const channels = {};
    
    brief.items.forEach(item => {
      const channel = item.channel || 'ooh';
      
      // Determine spec key based on channel
      let specKey, specLabel;
      if (channel === 'radio' || channel === 'tv') {
        specKey = item.specs?.adLength || item.specs?.spotLength || 'unknown';
        specLabel = specKey.includes('second') ? specKey : `${specKey} seconds`;
      } else {
        specKey = item.specs?.dimensions || 'unknown';
        specLabel = specKey;
      }
      
      const specId = `${channel}-${specKey}`;
      
      if (!channels[channel]) {
        channels[channel] = { specs: {}, totalPlacements: 0, totalCreatives: 0 };
      }
      
      if (!channels[channel].specs[specKey]) {
        channels[channel].specs[specKey] = {
          id: specId,
          key: specKey,
          label: specLabel,
          publisher: item.publisherName,
          placements: [],
          minStart: null,
          maxEnd: null,
          earliestDue: null,
          status: storedStatuses[specId] || 'briefed', // Read from stored groups
        };
        channels[channel].totalCreatives++;
      }
      
      const spec = channels[channel].specs[specKey];
      spec.placements.push(item);
      channels[channel].totalPlacements++;
      
      // Track dates
      if (item.flightStart) {
        if (!spec.minStart || item.flightStart < spec.minStart) spec.minStart = item.flightStart;
      }
      if (item.flightEnd) {
        if (!spec.maxEnd || item.flightEnd > spec.maxEnd) spec.maxEnd = item.flightEnd;
      }
      if (item.dueDate) {
        if (!spec.earliestDue || item.dueDate < spec.earliestDue) spec.earliestDue = item.dueDate;
      }
    });
    
    return channels;
  }, [brief, storedStatuses]);

  // Stats
  const stats = useMemo(() => {
    let totalCreatives = 0;
    let totalPlacements = 0;
    let completed = 0;
    let dueSoon = 0;
    
    Object.values(channelData).forEach(channel => {
      totalCreatives += channel.totalCreatives;
      totalPlacements += channel.totalPlacements;
      
      Object.values(channel.specs).forEach(spec => {
        if (spec.status === 'approved' || spec.status === 'delivered') completed++;
        const days = getDaysUntil(spec.earliestDue);
        if (days !== null && days >= 0 && days <= 7) dueSoon++;
      });
    });
    
    return { totalCreatives, totalPlacements, completed, dueSoon };
  }, [channelData]);

  function toggleSpecExpanded(specId) {
    setExpandedSpecs(prev => {
      const next = new Set(prev);
      if (next.has(specId)) next.delete(specId);
      else next.add(specId);
      return next;
    });
  }

  async function handleStatusChange(specId, newStatus) {
    // Optimistic update - update the brief.groups so storedStatuses recalculates
    setBrief(prev => {
      if (!prev) return prev;
      
      const newGroups = prev.groups?.map(channelGroup => ({
        ...channelGroup,
        specs: channelGroup.specs?.map(spec => 
          spec.id === specId ? { ...spec, status: newStatus } : spec
        ) || []
      })) || [];
      
      return { ...prev, groups: newGroups };
    });
    
    // API call
    try {
      await fetch(`/api/brief/${briefId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: specId, status: newStatus }),
      });
    } catch (err) {
      console.error('Failed to update status:', err);
      // Could revert optimistic update here if needed
    }
  }

  function copyClientLink() {
    const url = `${window.location.origin}/brief/${briefId}/client`;
    navigator.clipboard.writeText(url);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
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
          <h1 className="text-2xl font-semibold mb-4">Brief not found</h1>
          <button onClick={() => router.push('/')} className="text-sunny-yellow hover:underline">
            ← Back to home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sunny-dark text-white">
      {/* Header */}
      <header className="border-b border-white/10 sticky top-0 z-50 bg-sunny-dark/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => router.push('/')} className="text-white/50 hover:text-white">
                ←
              </button>
              <img src="/sunny-logo-white.png" alt="Sunny" className="h-6" />
              <div className="border-l border-white/20 pl-4">
                <h1 className="text-xl font-semibold">{brief.clientName}</h1>
                <p className="text-sm text-white/50">{brief.campaignName}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={copyClientLink}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  copySuccess 
                    ? 'bg-green-500 text-white' 
                    : 'bg-white/5 border border-white/10 hover:bg-white/10'
                }`}
              >
                {copySuccess ? '✓ Copied!' : '🔗 Client Link'}
              </button>
              <button
                onClick={() => router.push(`/brief/${briefId}/client`)}
                className="px-4 py-2 bg-sunny-yellow text-black rounded-lg text-sm font-semibold hover:bg-yellow-300"
              >
                Preview →
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-10">
          <div className="bg-gradient-to-br from-sunny-yellow/20 to-sunny-yellow/5 border border-sunny-yellow/20 rounded-2xl p-5">
            <div className="text-4xl font-bold text-sunny-yellow">{stats.totalCreatives}</div>
            <div className="text-sm text-white/60 mt-1">Unique Creatives</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="text-4xl font-bold">{stats.totalPlacements}</div>
            <div className="text-sm text-white/60 mt-1">Total Placements</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="text-4xl font-bold text-green-400">{stats.completed}</div>
            <div className="text-sm text-white/60 mt-1">Completed</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="text-4xl font-bold text-amber-400">{stats.dueSoon}</div>
            <div className="text-sm text-white/60 mt-1">Due Soon</div>
          </div>
        </div>

        {/* Flight Plan Timeline */}
        <FlightTimeline channelData={channelData} />

        {/* Creative Requirements by Channel */}
        <div className="space-y-10">
          {Object.entries(channelData).map(([channelKey, channel]) => {
            const config = CHANNELS[channelKey] || CHANNELS.ooh;
            const specs = Object.values(channel.specs);
            
            return (
              <div key={channelKey}>
                {/* Channel Header */}
                <div className="flex items-center gap-3 mb-5">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center text-xl shadow-lg`}>
                    {config.icon}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">{config.name}</h2>
                    <p className="text-sm text-white/50">
                      {channel.totalCreatives} creative{channel.totalCreatives !== 1 ? 's' : ''} • {channel.totalPlacements} placement{channel.totalPlacements !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                
                {/* Spec Cards Grid */}
                <div className="grid grid-cols-2 gap-4">
                  {specs.map(spec => (
                    <SpecCard
                      key={spec.id}
                      spec={spec}
                      channel={channelKey}
                      onStatusChange={handleStatusChange}
                      onExpand={toggleSpecExpanded}
                      isExpanded={expandedSpecs.has(spec.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
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
