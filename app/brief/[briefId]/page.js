'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DEFAULT_LEAD_TIMES } from '@/lib/specs';

// ============================================
// CHANNEL CONFIG
// ============================================
const CHANNELS = {
  ooh: { name: 'Out of Home', icon: '📍', gradient: 'from-blue-500 to-blue-600' },
  tv: { name: 'Television', icon: '📺', gradient: 'from-purple-500 to-purple-600' },
  radio: { name: 'Radio', icon: '📻', gradient: 'from-amber-500 to-amber-600' },
  digital: { name: 'Digital', icon: '💻', gradient: 'from-green-500 to-green-600' },
  press: { name: 'Press', icon: '📰', gradient: 'from-rose-500 to-rose-600' },
  transit: { name: 'Transit', icon: '🚌', gradient: 'from-cyan-500 to-cyan-600' },
  programmatic: { name: 'Programmatic', icon: '🎯', gradient: 'from-indigo-500 to-indigo-600' },
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
  press: ['News Corp', 'Nine Publishing', 'Are Media', 'Other'],
  transit: ['oOh!', 'JCDecaux', 'QMS', 'Other'],
  programmatic: ['DV360', 'The Trade Desk', 'Verizon Media', 'Other'],
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
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/40">Click a bar to filter by week</span>
          {selectedWeek && <button onClick={() => onWeekClick(null)} className="text-xs text-sunny-yellow hover:underline">Clear filter</button>}
        </div>
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
function SpecCard({ spec, channel, onStatusChange, onExpand, isExpanded, onPlacementEdit, onPlacementDelete, onDeleteCard, attachments, specNote, onSpecNoteChange, briefId, mergeTargets, onMerge, showBulkSelect, isSelected, onToggleSelect, clientComment }) {
  const [editingPlacement, setEditingPlacement] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [editingNote, setEditingNote] = useState(false);
  const [noteText, setNoteText] = useState(specNote || '');
  const [uploading, setUploading] = useState({});
  const fileInputRef = useRef(null);
  const placementFileRefs = useRef({});
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

  async function handleGroupUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !briefId) return;
    setUploading(prev => ({ ...prev, group: true }));
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('briefId', briefId);
      formData.append('itemId', spec.placements[0]?.id || spec.id);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.file) {
        // Update all placements in this group
        spec.placements.forEach(p => onPlacementEdit(p.id, { uploadedFile: data.file, status: 'received' }));
      }
    } catch (err) { console.error('Upload failed:', err); }
    setUploading(prev => ({ ...prev, group: false }));
    e.target.value = '';
  }

  async function handlePlacementUpload(e, placementId) {
    const file = e.target.files?.[0];
    if (!file || !briefId) return;
    setUploading(prev => ({ ...prev, [placementId]: true }));
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('briefId', briefId);
      formData.append('itemId', placementId);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.file) onPlacementEdit(placementId, { uploadedFile: data.file, status: 'received' });
    } catch (err) { console.error('Upload failed:', err); }
    setUploading(prev => ({ ...prev, [placementId]: false }));
    e.target.value = '';
  }

  function saveNote() {
    onSpecNoteChange(spec.id, noteText);
    setEditingNote(false);
  }
  
  return (
    <div className={`bg-white/5 rounded-2xl border border-white/10 overflow-hidden transition-all hover:bg-white/[0.07] ${urgencyClass} ${urgencyGlow}`}>
      {/* Card Header */}
      <div className="p-4 cursor-pointer" onClick={() => showBulkSelect ? onToggleSelect(spec.id) : onExpand(spec.id)}>
        <div className="flex items-start gap-4">
          {showBulkSelect && (
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-1 transition-colors ${isSelected ? 'bg-sunny-yellow border-sunny-yellow' : 'border-white/20 hover:border-white/40'}`}>
              {isSelected && <span className="text-black text-xs font-bold">✓</span>}
            </div>
          )}
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
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/30">Status:</span>
            <StatusTrack currentStatus={spec.status || 'briefed'} onChange={onStatusChange} groupId={spec.id} />
          </div>
          <div className="flex items-center gap-2">
            {clientComment?.text && <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full font-medium" title={clientComment.text}>💬 Feedback</span>}
            <span className={`text-white/30 text-sm transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
          </div>
        </div>
        {/* Delete/Merge card - only visible on hover */}
        {isExpanded && (
          <div className="px-4 pb-2 flex justify-between items-center">
            {mergeTargets && mergeTargets.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/30">Merge into:</span>
                {mergeTargets.map(t => (
                  <button key={t.id} onClick={(e) => { e.stopPropagation(); if (confirm(`Merge "${spec.label}" placements into "${t.label}"?`)) onMerge(spec.id, t.id); }}
                    className="text-xs px-2 py-1 rounded bg-white/5 border border-white/10 text-white/50 hover:text-sunny-yellow hover:border-sunny-yellow/30">{t.label}</button>
                ))}
              </div>
            )}
            <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this entire spec card and all its placements?')) onDeleteCard(spec.placements.map(p => p.id)); }}
              className="text-xs text-white/20 hover:text-red-400 ml-auto">Delete card</button>
          </div>
        )}
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
            <input type="file" ref={fileInputRef} onChange={handleGroupUpload} className="hidden" />
            <div onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-sunny-yellow', 'bg-sunny-yellow/10'); }}
              onDragLeave={(e) => { e.currentTarget.classList.remove('border-sunny-yellow', 'bg-sunny-yellow/10'); }}
              onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-sunny-yellow', 'bg-sunny-yellow/10'); const file = e.dataTransfer.files?.[0]; if (file) { const dt = new DataTransfer(); dt.items.add(file); fileInputRef.current.files = dt.files; handleGroupUpload({ target: { files: [file] } }); } }}
              className="border-2 border-dashed border-white/20 rounded-xl p-5 text-center hover:border-sunny-yellow/50 hover:bg-sunny-yellow/5 transition-all cursor-pointer group">
              {uploading.group ? (
                <div className="flex items-center justify-center gap-2"><div className="animate-spin w-5 h-5 border-2 border-sunny-yellow border-t-transparent rounded-full" /><span className="text-sm">Uploading...</span></div>
              ) : spec.placements[0]?.uploadedFile ? (
                <div><div className="text-green-400 text-sm font-medium">✓ {spec.placements[0].uploadedFile.name}</div><div className="text-xs text-white/40 mt-1">Click to replace</div></div>
              ) : (
                <><div className="text-xl mb-1 group-hover:scale-110 transition-transform">📁</div><div className="text-sm text-white/70">Upload creative</div><div className="text-xs text-white/40 mt-1">for all {spec.placements.length} placements</div></>
              )}
            </div>
          </div>
          
          {/* Notes / Creative Guidance */}
          <div className="px-4 py-3 border-t border-white/5">
            {editingNote ? (
              <div className="space-y-2">
                <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add creative guidance, e.g. Easter Wild Wonderland script pointers for awareness..."
                  className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-sm text-white resize-none" rows={2} autoFocus />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => { setEditingNote(false); setNoteText(specNote || ''); }} className="px-3 py-1 text-xs text-white/50 hover:text-white">Cancel</button>
                  <button onClick={saveNote} className="px-3 py-1 text-xs bg-sunny-yellow text-black rounded font-medium">Save</button>
                </div>
              </div>
            ) : (
              <div onClick={() => setEditingNote(true)} className="cursor-pointer hover:bg-white/5 rounded-lg px-2 py-1.5 -mx-2">
                {specNote ? (
                  <div className="text-sm text-white/70"><span className="text-xs text-white/40">📝 </span>{specNote}</div>
                ) : (
                  <div className="text-xs text-white/30 hover:text-white/50">+ Add creative guidance or notes</div>
                )}
              </div>
            )}
          </div>
          
          {/* Client Feedback */}
          {clientComment?.text && (
            <div className="px-4 py-3 border-t border-blue-500/20 bg-blue-500/10">
              <div className="flex items-start gap-2">
                <span className="text-blue-400">💬</span>
                <div className="flex-1">
                  <div className="text-xs font-medium text-blue-400 mb-0.5">Client Feedback</div>
                  <div className="text-sm text-white/70">{clientComment.text}</div>
                  {clientComment.timestamp && <div className="text-xs text-white/30 mt-1">{new Date(clientComment.timestamp).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>}
                </div>
              </div>
            </div>
          )}

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
                        <label className="text-xs text-white/40 hover:text-sunny-yellow px-2 py-1 rounded hover:bg-white/10 flex-shrink-0 cursor-pointer">
                          {uploading[p.id] ? '...' : p.uploadedFile ? '✓' : 'Upload ↗'}
                          <input type="file" className="hidden" onChange={(e) => handlePlacementUpload(e, p.id)} />
                        </label>
                        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this placement?')) onPlacementDelete(p.id); }}
                          className="text-xs text-white/20 hover:text-red-400 p-1 rounded hover:bg-white/10 flex-shrink-0">×</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
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
  const [importPublisherSpecs, setImportPublisherSpecs] = useState(null);
  
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
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    setImporting(true);
    setImportError(null);
    
    let allPlacements = [];
    let lastChannel = 'ooh';
    let lastPublisher = '';
    let lastSpecs = null;
    
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      
      try {
        const res = await fetch('/api/parse-schedule', { method: 'POST', body: formData });
        
        if (!res.ok) {
          let errorMsg = `Failed to parse ${file.name}`;
          try { const errData = await res.json(); errorMsg = errData.error || errorMsg; }
          catch { const text = await res.text().catch(() => ''); if (text.includes('An error')) errorMsg = `${file.name}: Server error — try a smaller file.`; else if (text) errorMsg = text.substring(0, 200); }
          throw new Error(errorMsg);
        }
        
        const data = await res.json();
        if (data.placements?.length > 0) {
          lastChannel = data.detectedChannel || lastChannel;
          lastPublisher = data.detectedPublisher || lastPublisher;
          lastSpecs = data.publisherSpecs || lastSpecs;
          const placementsWithIds = data.placements.map((p, i) => ({ ...p, _importId: `import-${Date.now()}-${allPlacements.length + i}`, _sourceFile: file.name }));
          allPlacements = [...allPlacements, ...placementsWithIds];
        }
      } catch (err) {
        setImportError(err.message);
        break;
      }
    }
    
    if (allPlacements.length > 0) {
      setDetectedChannel(lastChannel);
      setDetectedPublisher(lastPublisher);
      setImportPublisherSpecs(lastSpecs);
      setParsedPlacements(allPlacements);
      setSelectedImports(new Set(allPlacements.map(p => p._importId)));
    } else if (!importError) {
      setImportError('No placements found in uploaded files.');
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
      specs: {
        dimensions: p.dimensions,
        adLength: p.spotLength ? `${p.spotLength} seconds` : null,
        spotLength: p.spotLength,
        panelId: p.panelId, direction: p.direction,
        fileType: p.fileType, slotLength: p.slotLength,
        fileFormat: importPublisherSpecs?.fileFormat || null,
        maxFileSize: importPublisherSpecs?.maxFileSize || null,
        dpi: importPublisherSpecs?.dpi || null,
        videoSpecs: importPublisherSpecs?.videoSpecs || null,
        leadTime: importPublisherSpecs?.leadTime || null,
        deliveryEmail: importPublisherSpecs?.deliveryEmail || null,
      },
      notes: importPublisherSpecs?.notes || null,
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
    setImportPublisherSpecs(null);
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
                    <input type="file" accept=".xlsx,.xls,.csv,.pdf" onChange={handleFileUpload} className="hidden" multiple />
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
  const [dueDateBuffer, setDueDateBuffer] = useState(5);
  const [publisherLeadTimes, setPublisherLeadTimes] = useState({});
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRefModal, setShowRefModal] = useState(false);
  const [specNotes, setSpecNotes] = useState({});
  const [editingBestPractices, setEditingBestPractices] = useState(false);
  const [bestPracticesText, setBestPracticesText] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [viewMode, setViewMode] = useState('cards');
  const [sortBy, setSortBy] = useState('default'); // 'default' | 'due' | 'status' | 'publisher'
  const [channelFilter, setChannelFilter] = useState(null); // null = all
  const [selectedSpecs, setSelectedSpecs] = useState(new Set());
  const [showBulkBar, setShowBulkBar] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved'
  const saveTimerRef = useRef(null);

  // Wrap any save operation to show indicator
  async function withSave(fn) {
    setSaveStatus('saving');
    try { await fn(); } catch (e) { console.error('Save failed:', e); }
    setSaveStatus('saved');
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
  } // 'cards' or 'table'

  const briefId = params.briefId || params.id;

  useEffect(() => {
    async function loadBrief() {
      try {
        const res = await fetch(`/api/brief/${briefId}`);
        if (!res.ok) throw new Error('Brief not found');
        const data = await res.json();
        setBrief(data);
        if (data.dueDateBuffer !== undefined) setDueDateBuffer(data.dueDateBuffer);
        if (data.specNotes) setSpecNotes(data.specNotes);
        
        // Auto-populate publisher lead times from defaults if not already set
        const savedLeadTimes = data.publisherLeadTimes || {};
        const publishers = new Set();
        data.items?.forEach(item => { if (item.publisherName) publishers.add(item.publisherName); });
        const merged = { ...savedLeadTimes };
        publishers.forEach(pub => {
          const pubKey = pub.toLowerCase();
          if (!(pubKey in merged)) {
            merged[pubKey] = DEFAULT_LEAD_TIMES[pubKey] || DEFAULT_LEAD_TIMES['_default'] || 5;
          }
        });
        setPublisherLeadTimes(merged);
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
      
      // Skip bonus placements
      const nameLC = (item.placementName || '').toLowerCase();
      if (nameLC.includes('bonus') || nameLC.includes('value add') || nameLC.includes('value-add')) return;
      
      let specKey, specLabel;
      if (channel === 'radio' || channel === 'tv') {
        const duration = item.specs?.adLength || (item.specs?.spotLength ? `${item.specs.spotLength} seconds` : null) || (item.specs?.slotLength ? `${item.specs.slotLength} seconds` : null);
        specKey = duration || item.specs?.dimensions || 'duration-tbc';
        specLabel = specKey === 'duration-tbc' ? 'Duration TBC' : (specKey.includes('second') ? specKey : `${specKey} seconds`);
      } else {
        specKey = item.specs?.dimensions || 'dimensions-tbc';
        specLabel = specKey === 'dimensions-tbc' ? 'Dimensions TBC' : specKey;
      }
      const publisherKey = item.publisherName || 'unknown';
      const specId = `${channel}-${publisherKey}-${specKey}`;
      
      if (!channels[channel]) channels[channel] = { specs: {}, totalPlacements: 0, totalCreatives: 0 };
      if (!channels[channel].specs[specId]) {
        channels[channel].specs[specId] = {
          id: specId, key: specKey, label: specLabel, publisher: item.publisherName,
          placements: [], minStart: null, maxEnd: null, earliestDue: null,
          status: storedStatuses[specId] || 'briefed',
        };
        channels[channel].totalCreatives++;
      }
      
      const spec = channels[channel].specs[specId];
      const pubName = (item.publisherName || '').toLowerCase();
      const leadTime = publisherLeadTimes[pubName] || dueDateBuffer;
      const calculatedDueDate = item.dueDate || calculateDueDate(item.flightStart, leadTime);
      spec.placements.push({ ...item, dueDate: calculatedDueDate });
      channels[channel].totalPlacements++;
      
      if (item.flightStart && (!spec.minStart || item.flightStart < spec.minStart)) spec.minStart = item.flightStart;
      if (item.flightEnd && (!spec.maxEnd || item.flightEnd > spec.maxEnd)) spec.maxEnd = item.flightEnd;
      if (calculatedDueDate && (!spec.earliestDue || calculatedDueDate < spec.earliestDue)) spec.earliestDue = calculatedDueDate;
    });
    
    return channels;
  }, [brief, storedStatuses, dueDateBuffer, publisherLeadTimes]);

  const allSpecs = useMemo(() => {
    const specs = [];
    Object.values(channelData).forEach(channel => Object.values(channel.specs).forEach(spec => specs.push(spec)));
    return specs;
  }, [channelData]);

  const filteredChannelData = useMemo(() => {
    let data = channelData;
    // Channel filter
    if (channelFilter) {
      const filtered = {};
      if (data[channelFilter]) filtered[channelFilter] = data[channelFilter];
      data = filtered;
    }
    // Week filter
    if (selectedWeek) {
      const filtered = {};
      Object.entries(data).forEach(([channelKey, channel]) => {
        const filteredSpecs = {};
        Object.entries(channel.specs).forEach(([specKey, spec]) => {
          if (spec.earliestDue && getWeekKey(spec.earliestDue) === selectedWeek) filteredSpecs[specKey] = spec;
        });
        if (Object.keys(filteredSpecs).length > 0) filtered[channelKey] = { ...channel, specs: filteredSpecs };
      });
      data = filtered;
    }
    // Sort specs within channels
    if (sortBy !== 'default') {
      const sorted = {};
      Object.entries(data).forEach(([channelKey, channel]) => {
        const specsArr = Object.entries(channel.specs);
        specsArr.sort(([, a], [, b]) => {
          if (sortBy === 'due') {
            const da = a.earliestDue || '9999'; const db = b.earliestDue || '9999';
            return da.localeCompare(db);
          }
          if (sortBy === 'status') {
            const order = { delivered: 4, approved: 3, review: 2, in_progress: 1, briefed: 0 };
            return (order[b.status] || 0) - (order[a.status] || 0);
          }
          if (sortBy === 'publisher') return (a.publisher || '').localeCompare(b.publisher || '');
          return 0;
        });
        sorted[channelKey] = { ...channel, specs: Object.fromEntries(specsArr) };
      });
      data = sorted;
    }
    return data;
  }, [channelData, selectedWeek, channelFilter, sortBy]);

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

  const clientComments = brief?.clientComments || {};
  const totalComments = Object.keys(clientComments).length;

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
    withSave(() => fetch(`/api/brief/${briefId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId: specId, status: newStatus }),
    }));
  }

  function toggleSpecSelection(specId) {
    setSelectedSpecs(prev => {
      const next = new Set(prev);
      next.has(specId) ? next.delete(specId) : next.add(specId);
      return next;
    });
  }

  async function bulkStatusChange(newStatus) {
    for (const specId of selectedSpecs) {
      await handleStatusChange(specId, newStatus);
    }
    setSelectedSpecs(new Set());
    setShowBulkBar(false);
  }

  async function handleDueDateBufferChange(newBuffer) {
    setDueDateBuffer(newBuffer);
    withSave(() => fetch(`/api/brief/${briefId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dueDateBuffer: newBuffer }),
    }));
  }

  async function handlePublisherLeadTimeChange(pubKey, days) {
    const updated = { ...publisherLeadTimes, [pubKey]: days };
    setPublisherLeadTimes(updated);
    withSave(() => fetch(`/api/brief/${briefId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publisherLeadTimes: updated }),
    }));
  }

  async function handleSpecNoteChange(specId, note) {
    const updated = { ...specNotes, [specId]: note };
    setSpecNotes(updated);
    withSave(() => fetch(`/api/brief/${briefId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ specNotes: updated }),
    }));
  }

  async function handlePlacementEdit(placementId, updates) {
    setBrief(prev => {
      if (!prev) return prev;
      const newItems = prev.items.map(item => 
        item.id === placementId ? { ...item, ...updates } : item
      );
      return { ...prev, items: newItems };
    });
    withSave(() => fetch(`/api/brief/${briefId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placementId, placementUpdates: updates }),
    }));
  }

  async function handlePlacementDelete(placementId) {
    setBrief(prev => {
      if (!prev) return prev;
      return { ...prev, items: prev.items.filter(item => item.id !== placementId) };
    });
    withSave(() => fetch(`/api/brief/${briefId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ removePlacementId: placementId }),
    }));
  }

  async function handleDeleteCard(placementIds) {
    setBrief(prev => {
      if (!prev) return prev;
      return { ...prev, items: prev.items.filter(item => !placementIds.includes(item.id)) };
    });
    for (const pid of placementIds) {
      try {
        await fetch(`/api/brief/${briefId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ removePlacementId: pid }),
        });
      } catch (err) { console.error('Failed to delete placement:', err); }
    }
  }

  async function handleMergeSpecs(sourceSpecId, targetSpecId) {
    let targetSpec = null;
    Object.values(channelData).forEach(channel => {
      Object.values(channel.specs).forEach(spec => {
        if (spec.id === targetSpecId) targetSpec = spec;
      });
    });
    if (!targetSpec) return;
    let sourceSpec = null;
    Object.values(channelData).forEach(channel => {
      Object.values(channel.specs).forEach(spec => {
        if (spec.id === sourceSpecId) sourceSpec = spec;
      });
    });
    if (!sourceSpec) return;
    const targetPlacement = targetSpec.placements[0];
    for (const placement of sourceSpec.placements) {
      const updates = {
        publisherName: targetSpec.publisher,
        publisher: targetSpec.publisher?.toLowerCase().replace(/\s+/g, '-'),
      };
      if (targetPlacement?.specs?.dimensions) updates.specs = { ...placement.specs, dimensions: targetPlacement.specs.dimensions };
      if (targetPlacement?.specs?.adLength) updates.specs = { ...(updates.specs || placement.specs), adLength: targetPlacement.specs.adLength };
      if (targetPlacement?.specs?.spotLength) updates.specs = { ...(updates.specs || placement.specs), spotLength: targetPlacement.specs.spotLength };
      await handlePlacementEdit(placement.id, updates);
    }
  }

  // Auto-merge: combine all same-duration specs within a radio/tv channel into one per duration
  async function handleAutoMergeDurations(channelKey) {
    const channel = channelData[channelKey];
    if (!channel) return;
    const specs = Object.values(channel.specs);
    // Group by duration label
    const byLabel = {};
    specs.forEach(s => {
      if (!byLabel[s.label]) byLabel[s.label] = [];
      byLabel[s.label].push(s);
    });
    let mergeCount = 0;
    for (const [label, group] of Object.entries(byLabel)) {
      if (group.length <= 1) continue;
      // Keep the first (largest by placement count), merge others into it
      group.sort((a, b) => b.placements.length - a.placements.length);
      const target = group[0];
      for (let i = 1; i < group.length; i++) {
        await handleMergeSpecs(group[i].id, target.id);
        mergeCount++;
      }
    }
    if (mergeCount === 0) alert('No same-duration specs to merge.');
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
    setSaveStatus('copied');
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
  }

  function getClientSlug() {
    return (brief?.clientName || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  async function handleDeleteBrief() {
    if (!confirm(`Delete "${brief?.campaignName || 'this brief'}"? This cannot be undone.`)) return;
    try {
      await fetch(`/api/brief/${briefId}`, { method: 'DELETE' });
      router.push('/');
    } catch (err) { console.error('Delete failed:', err); }
  }

  async function handleDuplicateBrief() {
    if (!brief) return;
    const newName = prompt('Campaign name for the copy:', `${brief.campaignName} (Copy)`);
    if (!newName) return;
    try {
      const res = await fetch('/api/briefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: brief.clientName,
          campaignName: newName,
          items: (brief.items || []).map(item => ({
            ...item,
            id: undefined, // Let API generate new IDs
            status: 'briefed',
            uploadedFile: null,
          })),
          bestPractices: brief.bestPractices,
          dueDateBuffer: brief.dueDateBuffer || dueDateBuffer,
          publisherLeadTimes: brief.publisherLeadTimes || publisherLeadTimes,
          specNotes: brief.specNotes || specNotes,
        }),
      });
      const data = await res.json();
      window.open(`/brief/${data.id}`, '_blank');
    } catch (err) { console.error('Duplicate failed:', err); }
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
                <h1 className="text-xl font-semibold">
                  <button onClick={() => router.push(`/client/${getClientSlug()}`)} className="hover:text-sunny-yellow transition-colors" title="View all briefs for this client">
                    {brief.clientName}
                  </button>
                </h1>
                <p className="text-sm text-white/50">{brief.campaignName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowSettings(!showSettings)} className={`px-3 py-2 border rounded-lg text-sm hover:bg-white/10 transition-colors relative ${showSettings ? 'bg-white/10 border-sunny-yellow/50 text-sunny-yellow' : 'bg-white/5 border-white/10'}`} title="Brief settings">
                ⚙️
                {(!brief.bestPractices && Object.keys(publisherLeadTimes).length === 0) && <div className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full" />}
              </button>
              <button onClick={() => setShowAddModal(true)} className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm hover:bg-white/10" title="Add placement">
                + Add
              </button>
              <div className="relative">
                <button onClick={() => setShowMoreMenu(!showMoreMenu)} className={`px-3 py-2 bg-white/5 border rounded-lg text-sm hover:bg-white/10 transition-colors ${showMoreMenu ? 'border-white/30' : 'border-white/10'}`} title="More actions">
                  ⋯
                </button>
                {showMoreMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 z-50 bg-[#1e1e1e] border border-white/15 rounded-xl shadow-2xl py-1 min-w-[180px]">
                      <button onClick={() => { setShowRefModal(true); setShowMoreMenu(false); }}
                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-white/5 flex items-center gap-2.5">
                        <span className="text-base">📎</span> Add Reference Doc
                      </button>
                      <button onClick={() => { window.open(`/brief/${briefId}/print`, '_blank'); setShowMoreMenu(false); }}
                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-white/5 flex items-center gap-2.5">
                        <span className="text-base">📄</span> Export PDF
                      </button>
                      <button onClick={() => { handleDuplicateBrief(); setShowMoreMenu(false); }}
                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-white/5 flex items-center gap-2.5">
                        <span className="text-base">📋</span> Clone Brief
                      </button>
                      <button onClick={() => { copyClientLink(); setShowMoreMenu(false); }}
                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-white/5 flex items-center gap-2.5">
                        <span className="text-base">🔗</span> Copy Client Link
                      </button>
                      <div className="border-t border-white/10 my-1" />
                      <button onClick={() => { handleDeleteBrief(); setShowMoreMenu(false); }}
                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-white/5 flex items-center gap-2.5 text-red-400">
                        <span className="text-base">🗑</span> Delete Brief
                      </button>
                    </div>
                  </>
                )}
              </div>
              <button onClick={() => window.open(`/brief/${briefId}/client`, '_blank')}
                className="px-4 py-2 bg-sunny-yellow text-black rounded-lg text-sm font-semibold hover:bg-yellow-300">
                Preview ↗
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Reference Docs Banner */}
        {brief.attachments?.length > 0 && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 mb-6">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-blue-400">📎</span>
              {brief.attachments.map((att, i) => (
                <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" className="text-blue-300 hover:text-blue-200 underline text-xs">
                  {att.name}{att.publisher && <span className="text-blue-400/50 ml-1">({att.publisher})</span>}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Best Practices Banner (visible when settings closed + content exists) */}
        {!showSettings && brief.bestPractices && (
          <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl px-4 py-3 mb-6 flex items-start gap-3 cursor-pointer hover:bg-amber-500/10 transition-colors"
            onClick={() => setShowSettings(true)}>
            <span className="text-sm mt-0.5">💡</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-amber-400/60 font-medium mb-0.5">Creative Recommendations</div>
              <div className="text-sm text-white/60 line-clamp-2 whitespace-pre-wrap">{brief.bestPractices}</div>
            </div>
            <span className="text-white/20 text-xs mt-1">Edit ⚙️</span>
          </div>
        )}

        {/* Settings Drawer */}
        {showSettings && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6 space-y-5">
            {/* Lead Times */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Creative Lead Times</span>
                  <span className="text-xs text-white/40">(days before flight start)</span>
                </div>
                <div className="flex items-center gap-4">
                  <label className="text-xs text-white/40">Default:</label>
                  <input type="range" min="1" max="21" value={dueDateBuffer} onChange={(e) => handleDueDateBufferChange(parseInt(e.target.value))} className="accent-sunny-yellow w-24" />
                  <span className="text-xs font-medium text-sunny-yellow w-14 text-right">{dueDateBuffer} days</span>
                </div>
              </div>
              {uniquePublishers.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {uniquePublishers.map(pub => {
                    const pubKey = pub.toLowerCase();
                    const currentVal = publisherLeadTimes[pubKey] ?? dueDateBuffer;
                    const isDefault = !(pubKey in publisherLeadTimes) || publisherLeadTimes[pubKey] === dueDateBuffer;
                    return (
                      <div key={pub} className="flex items-center gap-3">
                        <span className="text-sm text-white/70 w-32 truncate" title={pub}>{pub}</span>
                        <input type="range" min="1" max="21" value={currentVal}
                          onChange={(e) => handlePublisherLeadTimeChange(pubKey, parseInt(e.target.value))}
                          className="flex-1 accent-sunny-yellow" />
                        <span className={`text-xs w-16 text-right ${isDefault ? 'text-white/40' : 'text-sunny-yellow font-medium'}`}>{currentVal} days</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Best Practices */}
            <div className="pt-4 border-t border-white/10">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span>💡</span>
                  <span className="text-sm font-medium">Creative Recommendations</span>
                </div>
                {!editingBestPractices && (
                  <button onClick={() => { setEditingBestPractices(true); setBestPracticesText(brief.bestPractices || ''); }}
                    className="text-xs text-white/30 hover:text-sunny-yellow">{brief.bestPractices ? 'Edit' : '+ Add'}</button>
                )}
              </div>
              {editingBestPractices ? (
                <div>
                  <textarea value={bestPracticesText} onChange={e => setBestPracticesText(e.target.value)}
                    rows={3} placeholder="Creative recommendations, best practices, guidelines..."
                    className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-white placeholder-white/30 focus:border-sunny-yellow/50 focus:outline-none resize-y" />
                  <div className="flex justify-end gap-2 mt-2">
                    <button onClick={() => setEditingBestPractices(false)} className="text-xs text-white/30 hover:text-white px-3 py-1">Cancel</button>
                    <button onClick={async () => {
                      setBrief(prev => prev ? { ...prev, bestPractices: bestPracticesText } : prev);
                      setEditingBestPractices(false);
                      await fetch(`/api/brief/${briefId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bestPractices: bestPracticesText }) });
                    }} className="text-xs bg-sunny-yellow/20 text-sunny-yellow px-3 py-1 rounded hover:bg-sunny-yellow/30">Save</button>
                  </div>
                </div>
              ) : brief.bestPractices ? (
                <div className="text-sm text-white/70 whitespace-pre-wrap">{brief.bestPractices}</div>
              ) : (
                <p className="text-sm text-white/30 italic">No creative recommendations added yet.</p>
              )}
            </div>
          </div>
        )}

        {/* Compact Stats + View Toggle + Save Indicator */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-6">
            {[
              { value: stats.totalCreatives, label: 'Creatives', color: 'text-sunny-yellow' },
              { value: stats.totalPlacements, label: 'Placements', color: 'text-white' },
              { value: stats.completed, label: 'Completed', color: 'text-green-400' },
              { value: stats.dueSoon, label: 'Due Soon', color: 'text-amber-400', tooltip: 'Due within the next 7 days' },
            ].map(s => (
              <div key={s.label} className="relative group">
                <span className={`text-2xl font-bold ${s.color}`}>{s.value}</span>
                <span className="text-xs text-white/40 ml-1.5">{s.label}</span>
                {s.tooltip && <div className="hidden group-hover:block absolute -top-8 left-0 px-2 py-1 bg-black rounded text-xs text-white/80 whitespace-nowrap z-10 border border-white/10">{s.tooltip}</div>}
              </div>
            ))}
            {/* Progress bar */}
            {stats.totalCreatives > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all duration-500"
                    style={{ width: `${Math.round((stats.completed / stats.totalCreatives) * 100)}%` }} />
                </div>
                <span className="text-xs text-white/40">{Math.round((stats.completed / stats.totalCreatives) * 100)}%</span>
              </div>
            )}
            {totalComments > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full font-medium">💬 {totalComments}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Save indicator */}
            <div className={`text-xs transition-opacity duration-300 ${saveStatus === 'idle' ? 'opacity-0' : 'opacity-100'}`}>
              {saveStatus === 'saving' && <span className="text-white/40">Saving...</span>}
              {saveStatus === 'saved' && <span className="text-green-400">✓ Saved</span>}
              {saveStatus === 'copied' && <span className="text-green-400">✓ Link copied</span>}
            </div>
            <label className="flex items-center gap-2 text-xs text-white/40 cursor-pointer select-none">
              <div className={`w-8 h-4 rounded-full transition-colors relative ${viewMode === 'table' ? 'bg-sunny-yellow/50' : 'bg-white/10'}`}
                onClick={() => setViewMode(v => v === 'cards' ? 'table' : 'cards')}>
                <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${viewMode === 'table' ? 'left-4' : 'left-0.5'}`} />
              </div>
              Table view
            </label>
          </div>
        </div>

        {/* Sort, Filter & View Controls */}
        {stats.totalCreatives > 3 && (
          <div className="flex items-center gap-3 mb-4">
            {/* Channel filter chips */}
            <div className="flex items-center gap-1.5 flex-1">
              <button onClick={() => setChannelFilter(null)}
                className={`text-xs px-2.5 py-1 rounded-full transition-colors ${!channelFilter ? 'bg-sunny-yellow/20 text-sunny-yellow' : 'bg-white/5 text-white/40 hover:text-white/60'}`}>All</button>
              {Object.keys(channelData).map(ch => {
                const cfg = CHANNELS[ch];
                return (
                  <button key={ch} onClick={() => setChannelFilter(channelFilter === ch ? null : ch)}
                    className={`text-xs px-2.5 py-1 rounded-full transition-colors ${channelFilter === ch ? 'bg-sunny-yellow/20 text-sunny-yellow' : 'bg-white/5 text-white/40 hover:text-white/60'}`}>
                    {cfg?.icon} {cfg?.name}
                  </button>
                );
              })}
            </div>
            {/* Sort */}
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              className="text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white/50 focus:outline-none">
              <option value="default">Sort: Default</option>
              <option value="due">Sort: Due Date</option>
              <option value="status">Sort: Status</option>
              <option value="publisher">Sort: Publisher</option>
            </select>
            <button onClick={() => { setShowBulkBar(!showBulkBar); if (showBulkBar) setSelectedSpecs(new Set()); }}
              className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors ${showBulkBar ? 'bg-sunny-yellow/20 text-sunny-yellow border border-sunny-yellow/30' : 'bg-white/5 text-white/40 border border-white/10 hover:text-white/60'}`}>
              ☑ Select
            </button>
          </div>
        )}

        {/* Due Bar Chart */}
        <DueBarChart specs={allSpecs} onWeekClick={setSelectedWeek} selectedWeek={selectedWeek} />

        {/* TABLE VIEW */}
        {viewMode === 'table' ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs text-white/40">
                  <th className="px-4 py-3 font-medium w-8">{showBulkBar ? '' : ''}</th>
                  <th className="px-4 py-3 font-medium">Channel</th>
                  <th className="px-4 py-3 font-medium">Spec</th>
                  <th className="px-4 py-3 font-medium">Publisher</th>
                  <th className="px-4 py-3 font-medium text-center">Placements</th>
                  <th className="px-4 py-3 font-medium">Flight</th>
                  <th className="px-4 py-3 font-medium">Due</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {Object.entries(filteredChannelData).flatMap(([channelKey, channel]) =>
                  Object.values(channel.specs).flatMap(spec => {
                    const config = CHANNELS[channelKey] || CHANNELS.ooh;
                    const dueDate = spec.earliestDue;
                    const daysLeft = dueDate ? Math.ceil((new Date(dueDate) - new Date()) / (1000*60*60*24)) : null;
                    const statusStep = STATUS_STEPS.findIndex(s => s.key === (spec.placements[0]?.status || 'briefed'));
                    const isExp = expandedSpecs.has(spec.id);
                    const rows = [(
                      <tr key={spec.id} className={`hover:bg-white/[0.03] cursor-pointer ${isExp ? 'bg-white/[0.02]' : ''}`} onClick={() => showBulkBar ? toggleSpecSelection(spec.id) : toggleSpecExpanded(spec.id)}>
                        <td className="px-4 py-3 text-white/30 text-xs">
                          {showBulkBar ? (
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${selectedSpecs.has(spec.id) ? 'bg-sunny-yellow border-sunny-yellow' : 'border-white/20'}`}>
                              {selectedSpecs.has(spec.id) && <span className="text-black text-[10px] font-bold">✓</span>}
                            </div>
                          ) : (
                            <span className={`inline-block transition-transform ${isExp ? 'rotate-90' : ''}`}>▶</span>
                          )}
                        </td>
                        <td className="px-4 py-3"><span className="mr-1.5">{config.icon}</span><span className="text-white/60">{config.name}</span></td>
                        <td className="px-4 py-3 font-medium">{spec.label}</td>
                        <td className="px-4 py-3 text-white/60">{spec.publisher || '—'}</td>
                        <td className="px-4 py-3 text-center">{spec.placements.length}</td>
                        <td className="px-4 py-3 text-white/50 text-xs">
                          {spec.minStart && spec.maxEnd ? `${formatDate(spec.minStart)} → ${formatDate(spec.maxEnd)}` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {dueDate ? (
                            <div>
                              <span className={`text-xs font-medium ${daysLeft < 0 ? 'text-red-400' : daysLeft <= 3 ? 'text-red-400' : daysLeft <= 7 ? 'text-amber-400' : 'text-white/50'}`}>
                                {daysLeft < 0 ? 'Overdue' : daysLeft === 0 ? 'Today' : `${daysLeft}d left`}
                              </span>
                              <div className="text-xs text-white/30">{formatDateFull(dueDate)}</div>
                            </div>
                          ) : <span className="text-white/20">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {STATUS_STEPS.map((step, i) => (
                              <div key={step.key} className={`w-2 h-2 rounded-full ${i <= statusStep ? 'bg-sunny-yellow' : 'bg-white/10'}`} title={step.label} />
                            ))}
                            <span className="text-xs text-white/40 ml-1">{STATUS_STEPS[statusStep]?.label || 'Briefed'}</span>
                          </div>
                        </td>
                      </tr>
                    )];
                    // Expanded detail row
                    if (isExp) {
                      rows.push(
                        <tr key={`${spec.id}-detail`} className="bg-white/[0.02]">
                          <td colSpan={8} className="px-6 py-4">
                            <div className="grid grid-cols-3 gap-6 text-xs mb-3">
                              <div>
                                <span className="text-white/40">Dimensions: </span>
                                <span className="text-white/80">{spec.label}</span>
                              </div>
                              {spec.placements[0]?.specs?.fileFormat && <div>
                                <span className="text-white/40">Format: </span>
                                <span className="text-white/80">{spec.placements[0].specs.fileFormat}</span>
                              </div>}
                              {spec.placements[0]?.specs?.maxFileSize && <div>
                                <span className="text-white/40">Max Size: </span>
                                <span className="text-white/80">{spec.placements[0].specs.maxFileSize}</span>
                              </div>}
                            </div>
                            {specNotes[spec.id] && <div className="text-xs text-white/50 mb-3">📝 {specNotes[spec.id]}</div>}
                            <div className="text-xs text-white/30">
                              Placements: {spec.placements.map(p => p.placementName || 'Unknown').join(' • ')}
                            </div>
                            <div className="flex items-center gap-3 mt-3">
                              <button onClick={(e) => { e.stopPropagation(); setViewMode('cards'); }}
                                className="text-xs text-sunny-yellow hover:underline">View in cards →</button>
                              <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this spec and all its placements?')) handleDeleteCard(spec.placements.map(p => p.id)); }}
                                className="text-xs text-white/20 hover:text-red-400">Delete</button>
                            </div>
                          </td>
                        </tr>
                      );
                    }
                    return rows;
                  })
                )}
              </tbody>
            </table>
            {Object.keys(filteredChannelData).length === 0 && (
              <div className="text-center py-12">
                <div className="text-3xl mb-2">{selectedWeek ? '🔍' : '📋'}</div>
                <p className="text-white/40 text-sm">{selectedWeek ? 'No creatives due this week.' : 'No placements yet.'}</p>
              </div>
            )}
          </div>
        ) : (
        /* CARD VIEW */
        <div className="space-y-10">
          {Object.entries(filteredChannelData).map(([channelKey, channel]) => {
            const config = CHANNELS[channelKey] || CHANNELS.ooh;
            const specs = Object.values(channel.specs);
            return (
              <div key={channelKey}>
                <div className="flex items-center gap-3 mb-5">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center text-xl shadow-lg`}>{config.icon}</div>
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold">{config.name}</h2>
                    <p className="text-sm text-white/50">{specs.length} creative{specs.length !== 1 ? 's' : ''} • {channel.totalPlacements} placement{channel.totalPlacements !== 1 ? 's' : ''}</p>
                  </div>
                  {(channelKey === 'radio' || channelKey === 'tv') && specs.length > 1 && (() => {
                    const labels = specs.map(s => s.label);
                    const hasDupes = labels.length !== new Set(labels).size;
                    return hasDupes ? (
                      <button onClick={() => { if (confirm('Merge all same-duration timeslots into single cards?')) handleAutoMergeDurations(channelKey); }}
                        className="text-xs px-3 py-1.5 bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-500/25 transition-colors"
                        title="Combine specs with the same duration (e.g. Breakfast 15s + Morning 15s → single 15s card)">
                        🔗 Merge same durations
                      </button>
                    ) : null;
                  })()}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {specs.map(spec => {
                    // Merge only makes sense for radio/tv same-duration specs across timeslots
                    const mergeTargets = (channelKey === 'radio' || channelKey === 'tv')
                      ? specs.filter(s => s.id !== spec.id && s.label === spec.label).map(s => ({ id: s.id, label: `${s.publisher || 'Unknown'} - ${s.label}` }))
                      : [];
                    return (
                      <SpecCard key={spec.id} spec={spec} channel={channelKey} onStatusChange={handleStatusChange}
                        onExpand={toggleSpecExpanded} isExpanded={expandedSpecs.has(spec.id)}
                        onPlacementEdit={handlePlacementEdit} onPlacementDelete={handlePlacementDelete}
                        onDeleteCard={handleDeleteCard} attachments={brief.attachments}
                        specNote={specNotes[spec.id]} onSpecNoteChange={handleSpecNoteChange} briefId={briefId}
                        mergeTargets={mergeTargets} onMerge={handleMergeSpecs}
                        showBulkSelect={showBulkBar} isSelected={selectedSpecs.has(spec.id)} onToggleSelect={toggleSpecSelection}
                        clientComment={clientComments[spec.id]} />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        )}

        {Object.keys(filteredChannelData).length === 0 && (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">{selectedWeek ? '🔍' : '📋'}</div>
            <p className="text-white/50 text-lg">{selectedWeek ? 'No creatives due this week.' : 'No placements in this brief yet.'}</p>
            {selectedWeek && <button onClick={() => setSelectedWeek(null)} className="mt-4 text-sunny-yellow hover:underline">Clear filter</button>}
            {!selectedWeek && <button onClick={() => setShowAddModal(true)} className="mt-4 text-sunny-yellow hover:underline">+ Add placements</button>}
          </div>
        )}
      </div>

      {/* Bulk Action Bar */}
      {showBulkBar && selectedSpecs.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-sunny-dark/95 border border-white/20 rounded-2xl px-6 py-3 flex items-center gap-4 shadow-2xl backdrop-blur">
          <span className="text-sm font-medium">{selectedSpecs.size} selected</span>
          <div className="w-px h-6 bg-white/10" />
          <span className="text-xs text-white/40">Set status:</span>
          {STATUS_STEPS.map(step => (
            <button key={step.key} onClick={() => bulkStatusChange(step.key)}
              className="text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-sunny-yellow hover:border-sunny-yellow/30 transition-colors">
              {step.label}
            </button>
          ))}
          <div className="w-px h-6 bg-white/10" />
          <button onClick={() => { setSelectedSpecs(new Set()); setShowBulkBar(false); }}
            className="text-xs text-white/30 hover:text-white">Cancel</button>
        </div>
      )}

      {/* Modals */}
      <AddPlacementModal isOpen={showAddModal} onClose={() => setShowAddModal(false)}
        onAddManual={(item) => handleAddPlacements([item])} onImport={handleAddPlacements} />
      <AddReferenceModal isOpen={showRefModal} onClose={() => setShowRefModal(false)}
        onAdd={handleAddReference} publishers={uniquePublishers} />
    </div>
  );
}
