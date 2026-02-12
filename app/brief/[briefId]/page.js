'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';

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

function getWeekKey(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const startOfWeek = new Date(date);
  startOfWeek.setDate(date.getDate() - date.getDay() + 1); // Monday
  return startOfWeek.toISOString().split('T')[0];
}

// ============================================
// VISUAL DIMENSION PREVIEW COMPONENT
// ============================================
function DimensionPreview({ dimensions, channel }) {
  if (channel === 'radio' || channel === 'tv') {
    const seconds = parseInt(dimensions) || 30;
    const bars = Math.min(Math.ceil(seconds / 5), 12);
    
    return (
      <div className="w-16 h-12 flex items-end justify-center gap-0.5">
        {Array.from({ length: bars }).map((_, i) => (
          <div
            key={i}
            className="w-1 bg-gradient-to-t from-amber-500 to-amber-300 rounded-full"
            style={{ height: `${30 + Math.sin(i * 0.8) * 20 + Math.random() * 20}%`, opacity: 0.6 + (i / bars) * 0.4 }}
          />
        ))}
      </div>
    );
  }
  
  if (!dimensions) {
    return <div className="w-16 h-12 rounded bg-white/10 flex items-center justify-center"><span className="text-white/30 text-xs">?</span></div>;
  }
  
  const match = dimensions.match(/(\d+)\s*[x×]\s*(\d+)/i);
  if (!match) {
    return <div className="w-16 h-12 rounded bg-white/10 flex items-center justify-center"><span className="text-white/30 text-xs">?</span></div>;
  }
  
  const [, w, h] = match;
  const aspectRatio = parseInt(w) / parseInt(h);
  const containerW = 64, containerH = 48;
  
  let rectW, rectH;
  if (aspectRatio > containerW / containerH) { rectW = containerW; rectH = containerW / aspectRatio; }
  else { rectH = containerH; rectW = containerH * aspectRatio; }
  
  return (
    <div className="w-16 h-12 flex items-center justify-center">
      <div className="bg-gradient-to-br from-blue-400 to-blue-600 rounded-sm shadow-lg shadow-blue-500/20" style={{ width: `${rectW}px`, height: `${rectH}px` }} />
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
                isFilled ? 'bg-sunny-yellow' : isHovered ? 'bg-sunny-yellow/50' : 'bg-white/20'
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
// DUE BAR CHART COMPONENT
// ============================================
function DueBarChart({ specs, onWeekClick, selectedWeek }) {
  // Group specs by week of due date
  const weekData = useMemo(() => {
    const weeks = {};
    
    specs.forEach(spec => {
      if (!spec.earliestDue) return;
      const weekKey = getWeekKey(spec.earliestDue);
      if (!weekKey) return;
      
      if (!weeks[weekKey]) {
        weeks[weekKey] = { pending: 0, uploaded: 0, overdue: false };
      }
      
      // Check if uploaded (placeholder - would need actual upload status)
      const isUploaded = spec.status === 'approved' || spec.status === 'delivered';
      if (isUploaded) weeks[weekKey].uploaded++;
      else weeks[weekKey].pending++;
      
      // Check if overdue
      if (getDaysUntil(spec.earliestDue) < 0) {
        weeks[weekKey].overdue = true;
      }
    });
    
    // Sort by date
    return Object.entries(weeks)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([weekKey, data]) => ({ weekKey, ...data }));
  }, [specs]);
  
  if (weekData.length === 0) return null;
  
  const maxCount = Math.max(...weekData.map(w => w.pending + w.uploaded), 1);
  
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Creatives Due</h3>
        {selectedWeek && (
          <button onClick={() => onWeekClick(null)} className="text-xs text-sunny-yellow hover:underline">
            Clear filter
          </button>
        )}
      </div>
      
      <div className="flex items-end gap-2 h-32">
        {weekData.map(({ weekKey, pending, uploaded, overdue }) => {
          const total = pending + uploaded;
          const heightPercent = (total / maxCount) * 100;
          const pendingPercent = (pending / total) * heightPercent;
          const uploadedPercent = (uploaded / total) * heightPercent;
          const isSelected = selectedWeek === weekKey;
          
          // Format week label
          const weekDate = new Date(weekKey);
          const label = `${weekDate.getDate()} ${weekDate.toLocaleDateString('en-AU', { month: 'short' })}`;
          
          return (
            <div key={weekKey} className="flex-1 flex flex-col items-center">
              <div 
                className={`w-full relative cursor-pointer transition-all ${isSelected ? 'opacity-100' : 'opacity-70 hover:opacity-100'}`}
                style={{ height: `${heightPercent}%`, minHeight: total > 0 ? '20px' : '0' }}
                onClick={() => onWeekClick(isSelected ? null : weekKey)}
              >
                {/* Uploaded portion */}
                {uploaded > 0 && (
                  <div 
                    className="absolute bottom-0 w-full bg-green-500 rounded-t"
                    style={{ height: `${(uploaded / total) * 100}%` }}
                  />
                )}
                {/* Pending portion */}
                {pending > 0 && (
                  <div 
                    className={`absolute w-full rounded-t ${overdue ? 'bg-red-500' : 'bg-sunny-yellow'}`}
                    style={{ 
                      height: `${(pending / total) * 100}%`,
                      bottom: `${(uploaded / total) * 100}%`
                    }}
                  />
                )}
                {/* Count label */}
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs font-medium">
                  {total}
                </div>
              </div>
              <div className={`text-xs mt-2 ${overdue ? 'text-red-400' : 'text-white/40'}`}>
                {label}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/10 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-sunny-yellow" />
          <span className="text-white/50">Pending</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-green-500" />
          <span className="text-white/50">Uploaded</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-red-500" />
          <span className="text-white/50">Overdue</span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// SPEC CARD COMPONENT
// ============================================
function SpecCard({ spec, channel, onStatusChange, onExpand, isExpanded }) {
  const daysUntil = spec.earliestDue ? getDaysUntil(spec.earliestDue) : null;
  
  // Urgency styling
  let urgencyClass = '', urgencyGlow = '';
  if (daysUntil !== null) {
    if (daysUntil < 0) { urgencyClass = 'border-red-500/50'; urgencyGlow = 'shadow-red-500/20 shadow-lg'; }
    else if (daysUntil <= 3) { urgencyClass = 'border-red-500/30'; urgencyGlow = 'shadow-red-500/10 shadow-md'; }
    else if (daysUntil <= 7) { urgencyClass = 'border-amber-500/30'; urgencyGlow = 'shadow-amber-500/10 shadow-md'; }
  }
  
  // Get file specs and count unique sites
  const firstPlacement = spec.placements[0];
  const fileSpecs = firstPlacement?.specs || {};
  const restrictions = firstPlacement?.restrictions || [];
  
  // Count unique site names for "× flights" indicator
  const siteFlights = useMemo(() => {
    const sites = {};
    spec.placements.forEach(p => {
      const name = p.placementName || 'Unknown';
      sites[name] = (sites[name] || 0) + 1;
    });
    return Object.entries(sites).map(([name, count]) => ({ name, count }));
  }, [spec.placements]);
  
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
              <div className="text-xs text-white/40 mt-1">
                {formatDate(spec.minStart)} → {formatDate(spec.maxEnd)}
              </div>
            )}
          </div>
          
          <div className="text-right flex-shrink-0">
            {spec.earliestDue && (
              <div className={`text-sm font-medium ${
                daysUntil !== null && daysUntil < 0 ? 'text-red-400' :
                daysUntil !== null && daysUntil <= 3 ? 'text-red-400' :
                daysUntil !== null && daysUntil <= 7 ? 'text-amber-400' : 'text-white/70'
              }`}>
                {daysUntil !== null && daysUntil < 0 ? 'Overdue' : daysUntil === 0 ? 'Due today' : `${daysUntil}d left`}
              </div>
            )}
            <div className="text-xs text-white/40 mt-0.5">
              {spec.earliestDue ? formatDateFull(spec.earliestDue) : 'No due date'}
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
          <StatusTrack currentStatus={spec.status || 'briefed'} onChange={onStatusChange} groupId={spec.id} />
          <span className={`text-white/30 text-sm transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
        </div>
      </div>
      
      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-white/10">
          {/* File Specs */}
          <div className="p-4 bg-black/20">
            <div className="grid grid-cols-3 gap-4 text-sm">
              {/* Dimensions - always show */}
              <div>
                <div className="text-xs text-white/40 mb-1">Dimensions</div>
                <div className="text-white/80 font-medium">{spec.label}</div>
              </div>
              
              {/* File Format */}
              {fileSpecs.fileFormat && (
                <div>
                  <div className="text-xs text-white/40 mb-1">File Format</div>
                  <div className="text-white/80">{fileSpecs.fileFormat}</div>
                </div>
              )}
              
              {/* Max File Size */}
              {fileSpecs.maxFileSize && (
                <div>
                  <div className="text-xs text-white/40 mb-1">Max Size</div>
                  <div className="text-white/80">{fileSpecs.maxFileSize}</div>
                </div>
              )}
              
              {/* DPI */}
              {fileSpecs.dpi && (
                <div>
                  <div className="text-xs text-white/40 mb-1">DPI</div>
                  <div className="text-white/80">{fileSpecs.dpi}</div>
                </div>
              )}
              
              {/* Duration for radio/tv */}
              {(fileSpecs.adLength || fileSpecs.spotLength || fileSpecs.slotLength) && (
                <div>
                  <div className="text-xs text-white/40 mb-1">Duration</div>
                  <div className="text-white/80">
                    {fileSpecs.adLength || (fileSpecs.spotLength ? `${fileSpecs.spotLength}s` : `${fileSpecs.slotLength}s`)}
                  </div>
                </div>
              )}
              
              {/* Direction */}
              {fileSpecs.direction && (
                <div>
                  <div className="text-xs text-white/40 mb-1">Direction</div>
                  <div className="text-white/80">{fileSpecs.direction}</div>
                </div>
              )}
              
              {/* Lead Time */}
              {fileSpecs.leadTime && (
                <div>
                  <div className="text-xs text-white/40 mb-1">Lead Time</div>
                  <div className="text-white/80">{fileSpecs.leadTime}</div>
                </div>
              )}
              
              {/* Panel ID */}
              {fileSpecs.panelId && (
                <div>
                  <div className="text-xs text-white/40 mb-1">Panel ID</div>
                  <div className="text-white/80">{fileSpecs.panelId}</div>
                </div>
              )}
            </div>
            
            {/* Video Specs - full width if present */}
            {fileSpecs.videoSpecs && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <div className="text-xs text-white/40 mb-1">Video Specs</div>
                <div className="text-white/80 text-sm">{fileSpecs.videoSpecs}</div>
              </div>
            )}
            
            {/* Delivery Email - full width if present */}
            {fileSpecs.deliveryEmail && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <div className="text-xs text-white/40 mb-1">Submit Artwork To</div>
                <div className="text-sunny-yellow text-sm">{fileSpecs.deliveryEmail}</div>
              </div>
            )}
          </div>
          
          {/* Restrictions / Notes */}
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
            <div className="border-2 border-dashed border-white/20 rounded-xl p-5 text-center hover:border-sunny-yellow/50 hover:bg-sunny-yellow/5 transition-all cursor-pointer group">
              <div className="text-xl mb-1 group-hover:scale-110 transition-transform">📁</div>
              <div className="text-sm text-white/70">Upload creative</div>
              <div className="text-xs text-white/40 mt-1">for all {spec.placements.length} placements</div>
            </div>
          </div>
          
          {/* Placements List with Site × Flights */}
          <div className="border-t border-white/5">
            {siteFlights.length < spec.placements.length ? (
              // Show grouped by site
              <div className="max-h-64 overflow-y-auto">
                {siteFlights.map(({ name, count }, idx) => {
                  const sitePlacements = spec.placements.filter(p => p.placementName === name);
                  return (
                    <div key={name} className="border-b border-white/5 last:border-0">
                      <div className="px-4 py-2.5 flex items-center gap-3 bg-white/[0.02]">
                        <div className="w-5 h-5 rounded bg-white/10 flex items-center justify-center text-xs text-white/40 flex-shrink-0">
                          📍
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{name}</div>
                          <div className="text-xs text-white/40">
                            {count > 1 ? `× ${count} flights` : '1 flight'}
                          </div>
                        </div>
                        <button className="text-xs text-white/40 hover:text-sunny-yellow px-2 py-1 rounded hover:bg-white/10 flex-shrink-0">
                          Upload ↗
                        </button>
                      </div>
                      {/* Show individual flights if expanded */}
                      {sitePlacements.map((p, i) => (
                        <div key={p.id || i} className="px-4 py-2 pl-12 flex items-center gap-3 text-xs text-white/50 hover:bg-white/5">
                          <span>{formatDate(p.flightStart)} → {formatDate(p.flightEnd)}</span>
                          {p.dueDate && <span className="ml-auto">Due: {formatDateFull(p.dueDate)}</span>}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ) : (
              // Show flat list (no duplicate sites)
              <div className="max-h-64 overflow-y-auto">
                {spec.placements.map((p, idx) => (
                  <div key={p.id || idx} className="px-4 py-2.5 flex items-center gap-3 border-b border-white/5 last:border-0 hover:bg-white/5">
                    <div className="w-5 h-5 rounded bg-white/10 flex items-center justify-center text-xs text-white/40 flex-shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{p.placementName}</div>
                      <div className="text-xs text-white/40 truncate">
                        {[p.location, p.flightStart && `${formatDate(p.flightStart)} → ${formatDate(p.flightEnd)}`].filter(Boolean).join(' • ')}
                      </div>
                    </div>
                    {p.dueDate && <div className="text-xs text-white/50 mr-2">Due: {formatDateFull(p.dueDate)}</div>}
                    <button className="text-xs text-white/40 hover:text-sunny-yellow px-2 py-1 rounded hover:bg-white/10 flex-shrink-0">
                      Upload ↗
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
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
  const [dueDateBuffer, setDueDateBuffer] = useState(5);
  const [selectedWeek, setSelectedWeek] = useState(null);

  const briefId = params.briefId || params.id;

  useEffect(() => {
    async function loadBrief() {
      try {
        const res = await fetch(`/api/brief/${briefId}`);
        if (!res.ok) throw new Error('Brief not found');
        const data = await res.json();
        setBrief(data);
        // Load saved buffer if exists
        if (data.dueDateBuffer !== undefined) {
          setDueDateBuffer(data.dueDateBuffer);
        }
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

  // Organize data: Channel → Specs → Placements with calculated due dates
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
          status: storedStatuses[specId] || 'briefed',
        };
        channels[channel].totalCreatives++;
      }
      
      const spec = channels[channel].specs[specKey];
      
      // Calculate due date from flight start
      const calculatedDueDate = item.dueDate || calculateDueDate(item.flightStart, dueDateBuffer);
      
      spec.placements.push({
        ...item,
        dueDate: calculatedDueDate,
      });
      channels[channel].totalPlacements++;
      
      if (item.flightStart) {
        if (!spec.minStart || item.flightStart < spec.minStart) spec.minStart = item.flightStart;
      }
      if (item.flightEnd) {
        if (!spec.maxEnd || item.flightEnd > spec.maxEnd) spec.maxEnd = item.flightEnd;
      }
      if (calculatedDueDate) {
        if (!spec.earliestDue || calculatedDueDate < spec.earliestDue) spec.earliestDue = calculatedDueDate;
      }
    });
    
    return channels;
  }, [brief, storedStatuses, dueDateBuffer]);

  // Flatten all specs for bar chart
  const allSpecs = useMemo(() => {
    const specs = [];
    Object.values(channelData).forEach(channel => {
      Object.values(channel.specs).forEach(spec => {
        specs.push(spec);
      });
    });
    return specs;
  }, [channelData]);

  // Filter specs by selected week
  const filteredChannelData = useMemo(() => {
    if (!selectedWeek) return channelData;
    
    const filtered = {};
    Object.entries(channelData).forEach(([channelKey, channel]) => {
      const filteredSpecs = {};
      Object.entries(channel.specs).forEach(([specKey, spec]) => {
        if (spec.earliestDue && getWeekKey(spec.earliestDue) === selectedWeek) {
          filteredSpecs[specKey] = spec;
        }
      });
      if (Object.keys(filteredSpecs).length > 0) {
        filtered[channelKey] = { ...channel, specs: filteredSpecs };
      }
    });
    return filtered;
  }, [channelData, selectedWeek]);

  // Stats
  const stats = useMemo(() => {
    let totalCreatives = 0, totalPlacements = 0, completed = 0, dueSoon = 0;
    
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
    setBrief(prev => {
      if (!prev) return prev;
      const newGroups = prev.groups?.map(channelGroup => ({
        ...channelGroup,
        specs: channelGroup.specs?.map(spec => spec.id === specId ? { ...spec, status: newStatus } : spec) || []
      })) || [];
      return { ...prev, groups: newGroups };
    });
    
    try {
      await fetch(`/api/brief/${briefId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: specId, status: newStatus }),
      });
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  }

  async function handleDueDateBufferChange(newBuffer) {
    setDueDateBuffer(newBuffer);
    
    // Persist to API
    try {
      await fetch(`/api/brief/${briefId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dueDateBuffer: newBuffer }),
      });
    } catch (err) {
      console.error('Failed to update due date buffer:', err);
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
          <button onClick={() => router.push('/')} className="text-sunny-yellow hover:underline">← Back to home</button>
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
              <button onClick={() => router.push('/')} className="text-white/50 hover:text-white">←</button>
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
                  copySuccess ? 'bg-green-500 text-white' : 'bg-white/5 border border-white/10 hover:bg-white/10'
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
        <div className="grid grid-cols-4 gap-4 mb-8">
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

        {/* Due Date Buffer Slider */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-8">
          <div className="flex items-center gap-4">
            <label className="text-sm text-white/60 whitespace-nowrap">Creative due dates:</label>
            <input
              type="range"
              min="1"
              max="21"
              value={dueDateBuffer}
              onChange={(e) => handleDueDateBufferChange(parseInt(e.target.value))}
              className="flex-1 accent-sunny-yellow"
            />
            <span className="text-sm font-medium text-sunny-yellow w-32 text-right">
              {dueDateBuffer} days before flight
            </span>
          </div>
        </div>

        {/* Due Bar Chart */}
        <DueBarChart specs={allSpecs} onWeekClick={setSelectedWeek} selectedWeek={selectedWeek} />

        {/* Creative Requirements by Channel */}
        <div className="space-y-10">
          {Object.entries(filteredChannelData).map(([channelKey, channel]) => {
            const config = CHANNELS[channelKey] || CHANNELS.ooh;
            const specs = Object.values(channel.specs);
            
            return (
              <div key={channelKey}>
                <div className="flex items-center gap-3 mb-5">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center text-xl shadow-lg`}>
                    {config.icon}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">{config.name}</h2>
                    <p className="text-sm text-white/50">
                      {specs.length} creative{specs.length !== 1 ? 's' : ''} • {channel.totalPlacements} placement{channel.totalPlacements !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                
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

        {Object.keys(filteredChannelData).length === 0 && (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">{selectedWeek ? '🔍' : '📋'}</div>
            <p className="text-white/50 text-lg">
              {selectedWeek ? 'No creatives due this week.' : 'No placements in this brief yet.'}
            </p>
            {selectedWeek && (
              <button onClick={() => setSelectedWeek(null)} className="mt-4 text-sunny-yellow hover:underline">
                Clear filter
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
