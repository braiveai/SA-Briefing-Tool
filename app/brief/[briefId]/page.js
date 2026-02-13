'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
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

const STATUS_STEPS = [
  { key: 'briefed', label: 'Briefed' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'review', label: 'Review' },
  { key: 'approved', label: 'Approved' },
  { key: 'delivered', label: 'Delivered' },
];

const IMPORT_PUBLISHERS = {
  ooh: ['JCDecaux', 'oOh!', 'QMS', 'Bishopp', 'LUMO', 'GOA', 'Other'],
  tv: ['Seven', 'Nine', 'Ten', 'SBS', 'Foxtel', 'Other'],
  radio: ['ARN', 'SCA', 'Nova', 'ACE Radio', 'Grant Broadcasters', 'Other'],
  digital: ['Google', 'Meta', 'TikTok', 'LinkedIn', 'Spotify', 'Other'],
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

function formatDateInput(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toISOString().split('T')[0];
  } catch {
    return '';
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
  startOfWeek.setDate(date.getDate() - date.getDay() + 1);
  return startOfWeek.toISOString().split('T')[0];
}

// ============================================
// DIMENSION PREVIEW
// ============================================
function DimensionPreview({ dimensions, channel }) {
  if (channel === 'radio' || channel === 'tv') {
    const seconds = parseInt(dimensions) || 30;
    const bars = Math.min(Math.ceil(seconds / 5), 12);
    return (
      <div className="w-16 h-12 flex items-end justify-center gap-0.5">
        {Array.from({ length: bars }).map((_, i) => (
          <div key={i} className="w-1 bg-gradient-to-t from-amber-500 to-amber-300 rounded-full"
            style={{ height: `${30 + Math.sin(i * 0.8) * 20 + Math.random() * 20}%`, opacity: 0.6 + (i / bars) * 0.4 }} />
        ))}
      </div>
    );
  }
  
  if (!dimensions) return <div className="w-16 h-12 rounded bg-white/10 flex items-center justify-center"><span className="text-white/30 text-xs">?</span></div>;
  
  const match = dimensions.match(/(\d+)\s*[x×]\s*(\d+)/i);
  if (!match) return <div className="w-16 h-12 rounded bg-white/10 flex items-center justify-center"><span className="text-white/30 text-xs">?</span></div>;
  
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
// STATUS TRACK
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
            <button onClick={() => onChange(groupId, step.key)} onMouseEnter={() => setHoveredIndex(idx)} onMouseLeave={() => setHoveredIndex(null)}
              className={`w-3 h-3 rounded-full transition-all duration-200 ${isFilled ? 'bg-sunny-yellow' : isHovered ? 'bg-sunny-yellow/50' : 'bg-white/20'} ${isHovered ? 'scale-125' : ''}`} />
            {showLabel && <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-black rounded text-xs whitespace-nowrap z-10">{step.label}</div>}
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// DUE BAR CHART
// ============================================
function DueBarChart({ specs, onWeekClick, selectedWeek }) {
  const weekData = useMemo(() => {
    const weeks = {};
    specs.forEach(spec => {
      if (!spec.earliestDue) return;
      const weekKey = getWeekKey(spec.earliestDue);
      if (!weekKey) return;
      if (!weeks[weekKey]) weeks[weekKey] = { pending: 0, uploaded: 0, overdue: false };
      const isUploaded = spec.status === 'approved' || spec.status === 'delivered';
      if (isUploaded) weeks[weekKey].uploaded++;
      else weeks[weekKey].pending++;
      if (getDaysUntil(spec.earliestDue) < 0) weeks[weekKey].overdue = true;
    });
    return Object.entries(weeks).sort(([a], [b]) => a.localeCompare(b)).map(([weekKey, data]) => ({ weekKey, ...data }));
  }, [specs]);
  
  if (weekData.length === 0) return null;
  const maxCount = Math.max(...weekData.map(w => w.pending + w.uploaded), 1);
  
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Creatives Due</h3>
        {selectedWeek && <button onClick={() => onWeekClick(null)} className="text-xs text-sunny-yellow hover:underline">Clear filter</button>}
      </div>
      <div className="flex items-end gap-2 h-32">
        {weekData.map(({ weekKey, pending, uploaded, overdue }) => {
          const total = pending + uploaded;
          const maxBarPx = 100;
          const barHeight = total > 0 ? Math.max(Math.round((total / maxCount) * maxBarPx), 16) : 0;
          const isSelected = selectedWeek === weekKey;
          const weekDate = new Date(weekKey);
          const label = `${weekDate.getDate()} ${weekDate.toLocaleDateString('en-AU', { month: 'short' })}`;
          return (
            <div key={weekKey} className="flex-1 flex flex-col items-center justify-end">
              <div className={`w-full relative cursor-pointer transition-all ${isSelected ? 'opacity-100' : 'opacity-70 hover:opacity-100'}`}
                style={{ height: `${barHeight}px` }} onClick={() => onWeekClick(isSelected ? null : weekKey)}>
                {uploaded > 0 && <div className="absolute bottom-0 w-full bg-green-500 rounded-t" style={{ height: `${(uploaded / total) * 100}%` }} />}
                {pending > 0 && <div className={`absolute w-full rounded-t ${overdue ? 'bg-red-500' : 'bg-sunny-yellow'}`}
                  style={{ height: `${(pending / total) * 100}%`, bottom: `${(uploaded / total) * 100}%` }} />}
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs font-medium">{total}</div>
              </div>
              <div className={`text-xs mt-2 ${overdue ? 'text-red-400' : 'text-white/40'}`}>{label}</div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/10 text-xs">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-sunny-yellow" /><span className="text-white/50">Pending</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-green-500" /><span className="text-white/50">Uploaded</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-red-500" /><span className="text-white/50">Overdue</span></div>
      </div>
    </div>
  );
}

// ============================================
// SPEC CARD WITH EDIT MODE
// ============================================
function SpecCard({ spec, channel, onStatusChange, onExpand, isExpanded, onPlacementEdit, onDeletePlacement, onDeleteCard, attachments }) {
  const [editingPlacement, setEditingPlacement] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [confirmDeleteCard, setConfirmDeleteCard] = useState(false);
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

  function startEdit(placement) {
    setEditingPlacement(placement.id);
    setEditValues({
      placementName: placement.placementName || '',
      location: placement.location || '',
      flightStart: formatDateInput(placement.flightStart),
      flightEnd: formatDateInput(placement.flightEnd),
    });
  }

  function cancelEdit() {
    setEditingPlacement(null);
    setEditValues({});
  }

  function saveEdit(placementId) {
    onPlacementEdit(placementId, editValues);
    setEditingPlacement(null);
    setEditValues({});
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
            {spec.earliestDue && (
              <div className={`text-sm font-medium ${daysUntil !== null && daysUntil < 0 ? 'text-red-400' : daysUntil !== null && daysUntil <= 3 ? 'text-red-400' : daysUntil !== null && daysUntil <= 7 ? 'text-amber-400' : 'text-white/70'}`}>
                {daysUntil !== null && daysUntil < 0 ? 'Overdue' : daysUntil === 0 ? 'Due today' : `${daysUntil}d left`}
              </div>
            )}
            <div className="text-xs text-white/40 mt-0.5">{spec.earliestDue ? formatDateFull(spec.earliestDue) : 'No due date'}</div>
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
              <div><div className="text-xs text-white/40 mb-1">Dimensions</div><div className="text-white/80 font-medium">{spec.label}</div></div>
              {fileSpecs.fileFormat && <div><div className="text-xs text-white/40 mb-1">File Format</div><div className="text-white/80">{fileSpecs.fileFormat}</div></div>}
              {fileSpecs.maxFileSize && <div><div className="text-xs text-white/40 mb-1">Max Size</div><div className="text-white/80">{fileSpecs.maxFileSize}</div></div>}
              {fileSpecs.dpi && <div><div className="text-xs text-white/40 mb-1">DPI</div><div className="text-white/80">{fileSpecs.dpi}</div></div>}
              {(fileSpecs.adLength || fileSpecs.spotLength || fileSpecs.slotLength) && (
                <div><div className="text-xs text-white/40 mb-1">Duration</div><div className="text-white/80">{fileSpecs.adLength || (fileSpecs.spotLength ? `${fileSpecs.spotLength}s` : `${fileSpecs.slotLength}s`)}</div></div>
              )}
              {fileSpecs.direction && <div><div className="text-xs text-white/40 mb-1">Direction</div><div className="text-white/80">{fileSpecs.direction}</div></div>}
              {fileSpecs.leadTime && <div><div className="text-xs text-white/40 mb-1">Lead Time</div><div className="text-white/80">{fileSpecs.leadTime}</div></div>}
              {fileSpecs.panelId && <div><div className="text-xs text-white/40 mb-1">Panel ID</div><div className="text-white/80">{fileSpecs.panelId}</div></div>}
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
            <div className="border-2 border-dashed border-white/20 rounded-xl p-5 text-center hover:border-sunny-yellow/50 hover:bg-sunny-yellow/5 transition-all cursor-pointer group">
              <div className="text-xl mb-1 group-hover:scale-110 transition-transform">📁</div>
              <div className="text-sm text-white/70">Upload creative</div>
              <div className="text-xs text-white/40 mt-1">for all {spec.placements.length} placements</div>
            </div>
          </div>
          
          {/* Placements List */}
          <div className="border-t border-white/5">
            <div className="max-h-80 overflow-y-auto">
              {spec.placements.map((p, idx) => {
                const isEditing = editingPlacement === p.id;
                return (
                  <div key={p.id || idx} className="px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5">
                    {isEditing ? (
                      // Edit Mode
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-white/40 block mb-1">Site Name</label>
                            <input type="text" value={editValues.placementName} onChange={e => setEditValues({ ...editValues, placementName: e.target.value })}
                              className="w-full bg-white/10 border border-white/20 rounded px-2 py-1.5 text-sm text-white" />
                          </div>
                          <div>
                            <label className="text-xs text-white/40 block mb-1">Location</label>
                            <input type="text" value={editValues.location} onChange={e => setEditValues({ ...editValues, location: e.target.value })}
                              className="w-full bg-white/10 border border-white/20 rounded px-2 py-1.5 text-sm text-white" />
                          </div>
                          <div>
                            <label className="text-xs text-white/40 block mb-1">Flight Start</label>
                            <input type="date" value={editValues.flightStart} onChange={e => setEditValues({ ...editValues, flightStart: e.target.value })}
                              className="w-full bg-white/10 border border-white/20 rounded px-2 py-1.5 text-sm text-white" />
                          </div>
                          <div>
                            <label className="text-xs text-white/40 block mb-1">Flight End</label>
                            <input type="date" value={editValues.flightEnd} onChange={e => setEditValues({ ...editValues, flightEnd: e.target.value })}
                              className="w-full bg-white/10 border border-white/20 rounded px-2 py-1.5 text-sm text-white" />
                          </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button onClick={cancelEdit} className="px-3 py-1 text-xs text-white/50 hover:text-white">Cancel</button>
                          <button onClick={() => saveEdit(p.id)} className="px-3 py-1 text-xs bg-sunny-yellow text-black rounded font-medium hover:bg-yellow-300">Save</button>
                        </div>
                      </div>
                    ) : (
                      // View Mode
                      <div className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded bg-white/10 flex items-center justify-center text-xs text-white/40 flex-shrink-0">{idx + 1}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate">{p.placementName}</div>
                          <div className="text-xs text-white/40 truncate">
                            {[p.location, p.flightStart && `${formatDate(p.flightStart)} → ${formatDate(p.flightEnd)}`].filter(Boolean).join(' • ')}
                          </div>
                        </div>
                        {p.dueDate && <div className="text-xs text-white/50 mr-2">Due: {formatDateFull(p.dueDate)}</div>}
                        <button onClick={(e) => { e.stopPropagation(); startEdit(p); }}
                          className="text-xs text-white/30 hover:text-sunny-yellow p-1 rounded hover:bg-white/10 flex-shrink-0">✎</button>
                        <button onClick={(e) => { e.stopPropagation(); onDeletePlacement(p.id); }}
                          className="text-xs text-white/30 hover:text-red-400 p-1 rounded hover:bg-white/10 flex-shrink-0">✕</button>
                        <button className="text-xs text-white/40 hover:text-sunny-yellow px-2 py-1 rounded hover:bg-white/10 flex-shrink-0">Upload ↗</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Delete Card */}
          <div className="border-t border-white/5 p-3">
            {confirmDeleteCard ? (
              <div className="flex items-center justify-between bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2">
                <span className="text-sm text-red-400">Delete this entire card and all {spec.placements.length} placements?</span>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmDeleteCard(false)} className="px-3 py-1 text-xs text-white/50 hover:text-white rounded hover:bg-white/10">Cancel</button>
                  <button onClick={() => { onDeleteCard(spec.placements.map(p => p.id)); setConfirmDeleteCard(false); }}
                    className="px-3 py-1 text-xs bg-red-500 text-white rounded font-medium hover:bg-red-400">Delete All</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmDeleteCard(true)}
                className="text-xs text-white/20 hover:text-red-400 transition-colors">
                Delete card
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// ADD PLACEMENT MODAL
// ============================================
function AddPlacementModal({ isOpen, onClose, onAddManual, onImport }) {
  const [mode, setMode] = useState(null); // null, 'manual', 'import'
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(null);
  const [parsedPlacements, setParsedPlacements] = useState([]);
  const [selectedImports, setSelectedImports] = useState(new Set());
  const [detectedChannel, setDetectedChannel] = useState('ooh');
  const [detectedPublisher, setDetectedPublisher] = useState('');
  
  const [manualForm, setManualForm] = useState({
    channel: 'ooh',
    publisher: '',
    siteName: '',
    dimensions: '',
    location: '',
    state: '',
    flightStart: '',
    flightEnd: '',
  });
  
  if (!isOpen) return null;

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setImporting(true);
    setImportError(null);
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await fetch('/api/parse-schedule', { method: 'POST', body: formData });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to parse schedule');
      if (!data.placements || data.placements.length === 0) throw new Error('No placements found in document.');
      
      setDetectedChannel(data.detectedChannel || 'ooh');
      setDetectedPublisher(data.detectedPublisher || '');
      
      const placementsWithIds = data.placements.map((p, i) => ({ ...p, _importId: p._importId || `import-${Date.now()}-${i}` }));
      setParsedPlacements(placementsWithIds);
      setSelectedImports(new Set(placementsWithIds.map(p => p._importId)));
    } catch (err) {
      setImportError(err.message);
    }
    setImporting(false);
    e.target.value = '';
  }

  function handleAddSelected() {
    const items = parsedPlacements.filter(p => selectedImports.has(p._importId)).map(p => ({
      id: p._importId,
      channel: detectedChannel,
      channelName: CHANNELS[detectedChannel]?.name,
      publisher: detectedPublisher?.toLowerCase().replace(/\s+/g, '-') || 'unknown',
      publisherName: detectedPublisher || 'Unknown',
      placementName: p.siteName,
      location: p.location || p.suburb || null,
      specs: { dimensions: p.dimensions, spotLength: p.spotLength, panelId: p.panelId, direction: p.direction },
      flightStart: p.startDate,
      flightEnd: p.endDate,
      status: 'briefed',
    }));
    onImport(items);
    handleClose();
  }

  function handleManualSubmit() {
    const item = {
      id: `manual-${Date.now()}`,
      channel: manualForm.channel,
      channelName: CHANNELS[manualForm.channel]?.name,
      publisher: manualForm.publisher?.toLowerCase().replace(/\s+/g, '-') || 'unknown',
      publisherName: manualForm.publisher || 'Unknown',
      placementName: manualForm.siteName,
      location: manualForm.location,
      state: manualForm.state,
      specs: { dimensions: manualForm.dimensions },
      flightStart: manualForm.flightStart,
      flightEnd: manualForm.flightEnd,
      status: 'briefed',
    };
    onAddManual(item);
    handleClose();
  }

  function handleClose() {
    setMode(null);
    setParsedPlacements([]);
    setSelectedImports(new Set());
    setManualForm({ channel: 'ooh', publisher: '', siteName: '', dimensions: '', location: '', state: '', flightStart: '', flightEnd: '' });
    onClose();
  }
  
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-sunny-gray border border-white/10 rounded-2xl w-full max-w-xl max-h-[80vh] overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="font-semibold text-lg">
            {mode === 'manual' ? 'Add Placement Manually' : mode === 'import' ? 'Import Schedule' : 'Add Placements'}
          </h3>
          <button onClick={handleClose} className="text-white/50 hover:text-white text-xl">×</button>
        </div>
        
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {!mode && (
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setMode('manual')}
                className="p-6 border border-white/10 rounded-xl hover:border-sunny-yellow/50 hover:bg-sunny-yellow/5 transition-all text-center">
                <div className="text-3xl mb-2">✏️</div>
                <div className="font-medium">Add Manually</div>
                <div className="text-xs text-white/50 mt-1">Enter placement details</div>
              </button>
              <button onClick={() => setMode('import')}
                className="p-6 border border-white/10 rounded-xl hover:border-sunny-yellow/50 hover:bg-sunny-yellow/5 transition-all text-center">
                <div className="text-3xl mb-2">📄</div>
                <div className="font-medium">Import Schedule</div>
                <div className="text-xs text-white/50 mt-1">Upload Excel, CSV, or PDF</div>
              </button>
            </div>
          )}
          
          {mode === 'manual' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-white/50 block mb-1">Channel</label>
                  <select value={manualForm.channel} onChange={e => setManualForm({ ...manualForm, channel: e.target.value, publisher: '' })}
                    className="w-full bg-sunny-dark border border-white/20 rounded-lg px-3 py-2 text-sm">
                    {Object.entries(CHANNELS).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-white/50 block mb-1">Publisher</label>
                  <select value={manualForm.publisher} onChange={e => setManualForm({ ...manualForm, publisher: e.target.value })}
                    className="w-full bg-sunny-dark border border-white/20 rounded-lg px-3 py-2 text-sm">
                    <option value="">Select...</option>
                    {IMPORT_PUBLISHERS[manualForm.channel]?.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-white/50 block mb-1">Site Name *</label>
                <input type="text" value={manualForm.siteName} onChange={e => setManualForm({ ...manualForm, siteName: e.target.value })}
                  placeholder="e.g. Olsen Drive Southport" className="w-full bg-sunny-dark border border-white/20 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-white/50 block mb-1">Dimensions</label>
                  <input type="text" value={manualForm.dimensions} onChange={e => setManualForm({ ...manualForm, dimensions: e.target.value })}
                    placeholder="e.g. 1080x360 px" className="w-full bg-sunny-dark border border-white/20 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-white/50 block mb-1">Location</label>
                  <input type="text" value={manualForm.location} onChange={e => setManualForm({ ...manualForm, location: e.target.value })}
                    placeholder="e.g. Brisbane CBD" className="w-full bg-sunny-dark border border-white/20 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-white/50 block mb-1">Flight Start</label>
                  <input type="date" value={manualForm.flightStart} onChange={e => setManualForm({ ...manualForm, flightStart: e.target.value })}
                    className="w-full bg-sunny-dark border border-white/20 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-white/50 block mb-1">Flight End</label>
                  <input type="date" value={manualForm.flightEnd} onChange={e => setManualForm({ ...manualForm, flightEnd: e.target.value })}
                    className="w-full bg-sunny-dark border border-white/20 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setMode(null)} className="flex-1 py-2 text-white/50 hover:text-white">← Back</button>
                <button onClick={handleManualSubmit} disabled={!manualForm.siteName}
                  className="flex-1 py-2 bg-sunny-yellow text-black rounded-lg font-medium disabled:opacity-50">Add Placement</button>
              </div>
            </div>
          )}
          
          {mode === 'import' && (
            <div className="space-y-4">
              {parsedPlacements.length === 0 ? (
                <div>
                  <label className="block border-2 border-dashed border-white/20 rounded-xl p-8 text-center cursor-pointer hover:border-sunny-yellow/50 hover:bg-sunny-yellow/5 transition-all">
                    <input type="file" accept=".xlsx,.xls,.csv,.pdf" onChange={handleFileUpload} className="hidden" />
                    {importing ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin w-5 h-5 border-2 border-sunny-yellow border-t-transparent rounded-full" />
                        <span>Processing...</span>
                      </div>
                    ) : (
                      <>
                        <div className="text-3xl mb-2">📄</div>
                        <div className="font-medium">Drop file or click to browse</div>
                        <div className="text-xs text-white/50 mt-1">Excel, CSV, or PDF</div>
                      </>
                    )}
                  </label>
                  {importError && <p className="text-red-400 text-sm mt-2">{importError}</p>}
                  <button onClick={() => setMode(null)} className="w-full py-2 mt-4 text-white/50 hover:text-white">← Back</button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-white/50 block mb-1">Channel</label>
                      <select value={detectedChannel} onChange={e => setDetectedChannel(e.target.value)}
                        className="w-full bg-sunny-dark border border-white/20 rounded-lg px-3 py-2 text-sm">
                        {Object.entries(CHANNELS).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-white/50 block mb-1">Publisher</label>
                      <select value={detectedPublisher} onChange={e => setDetectedPublisher(e.target.value)}
                        className="w-full bg-sunny-dark border border-white/20 rounded-lg px-3 py-2 text-sm">
                        <option value="">Select...</option>
                        {IMPORT_PUBLISHERS[detectedChannel]?.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="text-sm"><span className="text-sunny-yellow font-bold">{parsedPlacements.length}</span> placements found</div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {parsedPlacements.map(p => (
                      <div key={p._importId} onClick={() => {
                        const next = new Set(selectedImports);
                        if (next.has(p._importId)) next.delete(p._importId);
                        else next.add(p._importId);
                        setSelectedImports(next);
                      }} className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedImports.has(p._importId) ? 'border-sunny-yellow bg-sunny-yellow/10' : 'border-white/10 hover:border-white/20'}`}>
                        <div className="font-medium text-sm">{p.siteName}</div>
                        <div className="text-xs text-white/50">{p.dimensions} {p.startDate && `• ${p.startDate}`}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setParsedPlacements([]); setSelectedImports(new Set()); }} className="flex-1 py-2 text-white/50 hover:text-white">← Back</button>
                    <button onClick={handleAddSelected} disabled={selectedImports.size === 0}
                      className="flex-1 py-2 bg-sunny-yellow text-black rounded-lg font-medium disabled:opacity-50">
                      Add {selectedImports.size} Placement{selectedImports.size !== 1 ? 's' : ''}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// ADD REFERENCE DOC MODAL
// ============================================
function AddReferenceModal({ isOpen, onClose, onAdd, publishers }) {
  const [type, setType] = useState('link');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [publisher, setPublisher] = useState('');
  const [uploading, setUploading] = useState(false);
  
  if (!isOpen) return null;

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.url) {
        setUrl(data.url);
        if (!name) setName(file.name);
        // Try to detect publisher from filename
        const lowerName = file.name.toLowerCase();
        const detected = publishers.find(p => lowerName.includes(p.toLowerCase()));
        if (detected && !publisher) setPublisher(detected);
      }
    } catch (err) {
      console.error('Upload failed:', err);
    }
    setUploading(false);
  }

  function handleSubmit() {
    if (!name || !url) return;
    onAdd({ type, name, url, publisher: publisher || null });
    handleClose();
  }

  function handleClose() {
    setType('link');
    setName('');
    setUrl('');
    setPublisher('');
    onClose();
  }
  
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-sunny-gray border border-white/10 rounded-2xl w-full max-w-md">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="font-semibold">Add Reference Document</h3>
          <button onClick={handleClose} className="text-white/50 hover:text-white text-xl">×</button>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex gap-2">
            <button onClick={() => setType('link')} className={`flex-1 py-2 rounded-lg text-sm font-medium ${type === 'link' ? 'bg-sunny-yellow text-black' : 'bg-white/10'}`}>🔗 Link</button>
            <button onClick={() => setType('pdf')} className={`flex-1 py-2 rounded-lg text-sm font-medium ${type === 'pdf' ? 'bg-sunny-yellow text-black' : 'bg-white/10'}`}>📄 PDF</button>
          </div>
          
          {type === 'pdf' && (
            <label className="block border-2 border-dashed border-white/20 rounded-xl p-4 text-center cursor-pointer hover:border-sunny-yellow/50">
              <input type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" />
              {uploading ? 'Uploading...' : url ? '✓ Uploaded' : 'Click to upload PDF'}
            </label>
          )}
          
          {type === 'link' && (
            <div>
              <label className="text-xs text-white/50 block mb-1">URL</label>
              <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..."
                className="w-full bg-sunny-dark border border-white/20 rounded-lg px-3 py-2 text-sm" />
            </div>
          )}
          
          <div>
            <label className="text-xs text-white/50 block mb-1">Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. QMS Production Specs"
              className="w-full bg-sunny-dark border border-white/20 rounded-lg px-3 py-2 text-sm" />
          </div>
          
          <div>
            <label className="text-xs text-white/50 block mb-1">Link to Publisher (optional)</label>
            <select value={publisher} onChange={e => setPublisher(e.target.value)}
              className="w-full bg-sunny-dark border border-white/20 rounded-lg px-3 py-2 text-sm">
              <option value="">All / None</option>
              {publishers.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <p className="text-xs text-white/40 mt-1">If set, this doc will appear on matching publisher cards</p>
          </div>
          
          <button onClick={handleSubmit} disabled={!name || !url}
            className="w-full py-2 bg-sunny-yellow text-black rounded-lg font-medium disabled:opacity-50">
            Add Document
          </button>
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
  const [dueDateBuffer, setDueDateBuffer] = useState(5);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRefModal, setShowRefModal] = useState(false);

  const briefId = params.briefId || params.id;

  useEffect(() => {
    async function loadBrief() {
      try {
        const res = await fetch(`/api/brief/${briefId}`);
        if (!res.ok) throw new Error('Brief not found');
        const data = await res.json();
        setBrief(data);
        if (data.dueDateBuffer !== undefined) setDueDateBuffer(data.dueDateBuffer);
      } catch (err) {
        console.error('Failed to load brief:', err);
      }
      setLoading(false);
    }
    loadBrief();
  }, [briefId]);

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
          status: storedStatuses[specId] || 'briefed',
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
  }, [brief, storedStatuses, dueDateBuffer]);

  const allSpecs = useMemo(() => {
    const specs = [];
    Object.values(channelData).forEach(channel => Object.values(channel.specs).forEach(spec => specs.push(spec)));
    return specs;
  }, [channelData]);

  const filteredChannelData = useMemo(() => {
    if (!selectedWeek) return channelData;
    const filtered = {};
    Object.entries(channelData).forEach(([channelKey, channel]) => {
      const filteredSpecs = {};
      Object.entries(channel.specs).forEach(([specKey, spec]) => {
        if (spec.earliestDue && getWeekKey(spec.earliestDue) === selectedWeek) filteredSpecs[specKey] = spec;
      });
      if (Object.keys(filteredSpecs).length > 0) filtered[channelKey] = { ...channel, specs: filteredSpecs };
    });
    return filtered;
  }, [channelData, selectedWeek]);

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

  // Get unique publishers for reference doc linking
  const uniquePublishers = useMemo(() => {
    const pubs = new Set();
    brief?.items?.forEach(item => { if (item.publisherName) pubs.add(item.publisherName); });
    return Array.from(pubs);
  }, [brief]);

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
    } catch (err) { console.error('Failed to update status:', err); }
  }

  async function handleDueDateBufferChange(newBuffer) {
    setDueDateBuffer(newBuffer);
    try {
      await fetch(`/api/brief/${briefId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dueDateBuffer: newBuffer }),
      });
    } catch (err) { console.error('Failed to update due date buffer:', err); }
  }

  async function handlePlacementEdit(placementId, updates) {
    // Update local state
    setBrief(prev => {
      if (!prev) return prev;
      const newItems = prev.items.map(item => 
        item.id === placementId ? { ...item, ...updates } : item
      );
      return { ...prev, items: newItems };
    });
    // Save to API
    try {
      await fetch(`/api/brief/${briefId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placementId, placementUpdates: updates }),
      });
    } catch (err) { console.error('Failed to update placement:', err); }
  }

  async function handleAddPlacements(items) {
    setBrief(prev => {
      if (!prev) return prev;
      return { ...prev, items: [...(prev.items || []), ...items] };
    });
    try {
      await fetch(`/api/brief/${briefId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addItems: items }),
      });
    } catch (err) { console.error('Failed to add placements:', err); }
  }

  async function handleDeletePlacement(placementId) {
    setBrief(prev => {
      if (!prev) return prev;
      return { ...prev, items: prev.items.filter(item => item.id !== placementId) };
    });
    try {
      await fetch(`/api/brief/${briefId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ removePlacementId: placementId }),
      });
    } catch (err) { console.error('Failed to delete placement:', err); }
  }

  async function handleDeleteSpecCard(placementIds) {
    setBrief(prev => {
      if (!prev) return prev;
      const idsToRemove = new Set(placementIds);
      return { ...prev, items: prev.items.filter(item => !idsToRemove.has(item.id)) };
    });
    try {
      await fetch(`/api/brief/${briefId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ removePlacementIds: placementIds }),
      });
    } catch (err) { console.error('Failed to delete spec card:', err); }
  }

  async function handleAddReference(doc) {
    setBrief(prev => {
      if (!prev) return prev;
      return { ...prev, attachments: [...(prev.attachments || []), doc] };
    });
    try {
      await fetch(`/api/brief/${briefId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addAttachment: doc }),
      });
    } catch (err) { console.error('Failed to add reference:', err); }
  }

  function copyClientLink() {
    const url = `${window.location.origin}/brief/${briefId}/client`;
    navigator.clipboard.writeText(url);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  }

  if (loading) {
    return <div className="min-h-screen bg-sunny-dark flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-sunny-yellow border-t-transparent rounded-full" />
    </div>;
  }

  if (!brief) {
    return <div className="min-h-screen bg-sunny-dark flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold mb-4">Brief not found</h1>
        <button onClick={() => router.push('/')} className="text-sunny-yellow hover:underline">← Back to home</button>
      </div>
    </div>;
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
              <button onClick={() => setShowAddModal(true)} className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm hover:bg-white/10" title="Add placement">
                + Add
              </button>
              <button onClick={() => setShowRefModal(true)} className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm hover:bg-white/10" title="Add reference document">
                📎
              </button>
              <button onClick={copyClientLink}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${copySuccess ? 'bg-green-500 text-white' : 'bg-white/5 border border-white/10 hover:bg-white/10'}`}>
                {copySuccess ? '✓ Copied!' : '🔗 Client Link'}
              </button>
              <button onClick={() => router.push(`/brief/${briefId}/client`)}
                className="px-4 py-2 bg-sunny-yellow text-black rounded-lg text-sm font-semibold hover:bg-yellow-300">
                Preview →
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Reference Docs Banner */}
        {brief.attachments?.length > 0 && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-blue-400">📎</span>
              <span className="text-blue-400 font-medium">Reference Documents:</span>
              {brief.attachments.map((att, i) => (
                <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" className="text-blue-300 hover:text-blue-200 underline">
                  {att.name}
                  {att.publisher && <span className="text-blue-400/50 ml-1">({att.publisher})</span>}
                </a>
              ))}
            </div>
          </div>
        )}

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
            <input type="range" min="1" max="21" value={dueDateBuffer} onChange={(e) => handleDueDateBufferChange(parseInt(e.target.value))} className="flex-1 accent-sunny-yellow" />
            <span className="text-sm font-medium text-sunny-yellow w-32 text-right">{dueDateBuffer} days before flight</span>
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
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center text-xl shadow-lg`}>{config.icon}</div>
                  <div>
                    <h2 className="text-lg font-semibold">{config.name}</h2>
                    <p className="text-sm text-white/50">{specs.length} creative{specs.length !== 1 ? 's' : ''} • {channel.totalPlacements} placement{channel.totalPlacements !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {specs.map(spec => (
                    <SpecCard key={spec.id} spec={spec} channel={channelKey} onStatusChange={handleStatusChange}
                      onExpand={toggleSpecExpanded} isExpanded={expandedSpecs.has(spec.id)}
                      onPlacementEdit={handlePlacementEdit} onDeletePlacement={handleDeletePlacement}
                      onDeleteCard={handleDeleteSpecCard} attachments={brief.attachments} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {Object.keys(filteredChannelData).length === 0 && (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">{selectedWeek ? '🔍' : '📋'}</div>
            <p className="text-white/50 text-lg">{selectedWeek ? 'No creatives due this week.' : 'No placements in this brief yet.'}</p>
            {selectedWeek && <button onClick={() => setSelectedWeek(null)} className="mt-4 text-sunny-yellow hover:underline">Clear filter</button>}
            {!selectedWeek && <button onClick={() => setShowAddModal(true)} className="mt-4 text-sunny-yellow hover:underline">+ Add placements</button>}
          </div>
        )}
      </div>

      {/* Modals */}
      <AddPlacementModal isOpen={showAddModal} onClose={() => setShowAddModal(false)}
        onAddManual={(item) => handleAddPlacements([item])} onImport={handleAddPlacements} />
      <AddReferenceModal isOpen={showRefModal} onClose={() => setShowRefModal(false)}
        onAdd={handleAddReference} publishers={uniquePublishers} />
    </div>
  );
}
