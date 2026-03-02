'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
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

const STATUS_STEPS = [
  { key: 'briefed', label: 'Briefed' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'review', label: 'Review' },
  { key: 'approved', label: 'Approved' },
  { key: 'delivered', label: 'Delivered' },
];

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try { const d = new Date(dateStr); return `${d.getDate()} ${d.toLocaleDateString('en-AU', { month: 'short' })}`; } catch { return dateStr; }
}
function formatDateFull(dateStr) {
  if (!dateStr) return '—';
  try { const d = new Date(dateStr); return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear().toString().slice(-2)}`; } catch { return dateStr; }
}
function getDaysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / (1000*60*60*24));
}
function calculateDueDate(flightStart, bufferDays) {
  if (!flightStart) return null;
  try { const d = new Date(flightStart); d.setDate(d.getDate() - bufferDays); return d.toISOString().split('T')[0]; } catch { return null; }
}
function getWeekKey(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr); const s = new Date(d); s.setDate(d.getDate() - d.getDay() + 1); return s.toISOString().split('T')[0];
}

function DimensionPreview({ dimensions, channel }) {
  if (channel === 'radio' || channel === 'tv') {
    const seconds = parseInt(dimensions) || 30;
    const bars = Math.min(Math.ceil(seconds / 5), 12);
    return (<div className="w-14 h-10 flex items-end justify-center gap-0.5">
      {Array.from({ length: bars }).map((_, i) => (<div key={i} className="w-1 bg-gradient-to-t from-amber-500 to-amber-300 rounded-full" style={{ height: `${30 + Math.sin(i * 0.8) * 20 + Math.random() * 20}%`, opacity: 0.6 + (i / bars) * 0.4 }} />))}
    </div>);
  }
  if (!dimensions) return <div className="w-14 h-10 rounded bg-white/10 flex items-center justify-center"><span className="text-white/30 text-xs">?</span></div>;
  const match = dimensions.match(/(\d+)\s*[x×]\s*(\d+)/i);
  if (!match) return <div className="w-14 h-10 rounded bg-white/10 flex items-center justify-center"><span className="text-white/30 text-xs">?</span></div>;
  const [, w, h] = match;
  const ar = parseInt(w) / parseInt(h); const cW = 56, cH = 40;
  let rW, rH;
  if (ar > cW / cH) { rW = cW; rH = cW / ar; } else { rH = cH; rW = cH * ar; }
  return (<div className="w-14 h-10 flex items-center justify-center"><div className="bg-gradient-to-br from-blue-400 to-blue-600 rounded-sm shadow-lg shadow-blue-500/20" style={{ width: `${rW}px`, height: `${rH}px` }} /></div>);
}

function StatusDisplay({ currentStatus }) {
  const currentIndex = STATUS_STEPS.findIndex(s => s.key === currentStatus);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  return (
    <div className="flex items-center gap-1">
      {STATUS_STEPS.map((step, idx) => {
        const isFilled = idx <= currentIndex;
        const showLabel = hoveredIndex === idx;
        return (
          <div key={step.key} className="relative">
            <div onMouseEnter={() => setHoveredIndex(idx)} onMouseLeave={() => setHoveredIndex(null)}
              className={`w-3 h-3 rounded-full transition-all ${isFilled ? 'bg-sunny-yellow' : 'bg-white/20'} ${showLabel ? 'scale-125' : ''}`} />
            {showLabel && <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-black rounded text-xs whitespace-nowrap z-10 border border-white/10">{step.label}</div>}
          </div>
        );
      })}
    </div>
  );
}

function UploadProgressCircle({ uploaded, total }) {
  const pct = total > 0 ? (uploaded / total) * 100 : 0;
  const r = 40, c = 2 * Math.PI * r, off = c - (pct / 100) * c;
  return (
    <div className="relative w-24 h-24">
      <svg className="w-24 h-24 transform -rotate-90">
        <circle cx="48" cy="48" r={r} stroke="rgba(255,255,255,0.1)" strokeWidth="6" fill="none" />
        <circle cx="48" cy="48" r={r} stroke="#FACC15" strokeWidth="6" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} className="transition-all duration-500" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold">{uploaded}/{total}</span>
        <span className="text-xs text-white/50">uploaded</span>
      </div>
    </div>
  );
}

function DueBarChart({ specs, onWeekClick, selectedWeek }) {
  const weekData = useMemo(() => {
    const weeks = {};
    specs.forEach(spec => {
      if (!spec.earliestDue) return;
      const wk = getWeekKey(spec.earliestDue);
      if (!wk) return;
      if (!weeks[wk]) weeks[wk] = { pending: 0, uploaded: 0, overdue: false };
      const isUp = spec.status === 'approved' || spec.status === 'delivered';
      if (isUp) weeks[wk].uploaded++; else weeks[wk].pending++;
      if (getDaysUntil(spec.earliestDue) < 0) weeks[wk].overdue = true;
    });
    return Object.entries(weeks).sort(([a], [b]) => a.localeCompare(b)).map(([wk, d]) => ({ weekKey: wk, ...d }));
  }, [specs]);
  if (weekData.length === 0) return null;
  const maxCount = Math.max(...weekData.map(w => w.pending + w.uploaded), 1);
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Creatives Due by Week</h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/40">Click a bar to filter</span>
          {selectedWeek && <button onClick={() => onWeekClick(null)} className="text-xs text-sunny-yellow hover:underline">Clear filter</button>}
        </div>
      </div>
      <div className="flex items-end gap-2 h-32">
        {weekData.map(({ weekKey, pending, uploaded, overdue }) => {
          const total = pending + uploaded;
          const barH = total > 0 ? Math.max(Math.round((total / maxCount) * 100), 16) : 0;
          const isSel = selectedWeek === weekKey;
          const wd = new Date(weekKey);
          const label = `${wd.getDate()} ${wd.toLocaleDateString('en-AU', { month: 'short' })}`;
          return (
            <div key={weekKey} className="flex-1 flex flex-col items-center justify-end">
              <div className={`w-full relative cursor-pointer transition-all ${isSel ? 'opacity-100' : 'opacity-70 hover:opacity-100'}`}
                style={{ height: `${barH}px` }} onClick={() => onWeekClick(isSel ? null : weekKey)}>
                {uploaded > 0 && <div className="absolute bottom-0 w-full bg-green-500 rounded-t" style={{ height: `${(uploaded/total)*100}%` }} />}
                {pending > 0 && <div className={`absolute w-full rounded-t ${overdue ? 'bg-red-500' : 'bg-sunny-yellow'}`}
                  style={{ height: `${(pending/total)*100}%`, bottom: `${(uploaded/total)*100}%` }} />}
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

function ClientSpecCard({ spec, channel, onExpand, isExpanded, uploads, onUpload, attachments, specNote, clientComment, onComment, briefId }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState(clientComment?.text || '');
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
  const publisherAttachments = useMemo(() => {
    if (!attachments || !spec.publisher) return [];
    return attachments.filter(a => a.publisher?.toLowerCase() === spec.publisher?.toLowerCase());
  }, [attachments, spec.publisher]);
  const siteFlights = useMemo(() => {
    const sites = {};
    spec.placements.forEach(p => { const n = p.placementName || 'Unknown'; sites[n] = (sites[n] || 0) + 1; });
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
      if (data.url) onUpload(spec.id, { url: data.url, filename: file.name });
    } catch (err) { console.error('Upload failed:', err); }
    setUploading(false);
    e.target.value = '';
  }

  return (
    <div className={`bg-white/5 rounded-2xl border border-white/10 overflow-hidden transition-all hover:bg-white/[0.07] ${urgencyClass} ${urgencyGlow}`}>
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
                {daysUntil !== null && daysUntil < 0 ? 'Overdue' : daysUntil === 0 ? 'Due today' : `${daysUntil}d left`}
              </div>
            ) : null}
            <div className="text-xs text-white/40 mt-0.5">{spec.earliestDue ? formatDateFull(spec.earliestDue) : ''}</div>
          </div>
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
          <StatusDisplay currentStatus={spec.status || 'briefed'} />
          <span className={`text-white/30 text-sm transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
        </div>
      </div>
      {isExpanded && (
        <div className="border-t border-white/10">
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
              {spec.minStart && spec.maxEnd && (
                <div><div className="text-xs text-white/40 mb-1">Flight Dates</div><div className="text-white/80">{formatDate(spec.minStart)} → {formatDate(spec.maxEnd)}</div></div>
              )}
            </div>
            {fileSpecs.videoSpecs && <div className="mt-3 pt-3 border-t border-white/10"><div className="text-xs text-white/40 mb-1">Video Specs</div><div className="text-white/80 text-sm">{fileSpecs.videoSpecs}</div></div>}
          </div>
          {publisherAttachments.length > 0 && (
            <div className="px-4 py-3 bg-blue-500/10 border-t border-blue-500/20">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-blue-400">📎</span>
                <span className="text-blue-400 font-medium">Publisher Docs:</span>
                {publisherAttachments.map((att, i) => (
                  <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" className="text-blue-300 hover:text-blue-200 underline">{att.name}</a>
                ))}
              </div>
            </div>
          )}
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
          {specNote && (
            <div className="px-4 py-3 border-t border-white/5">
              <div className="text-sm text-white/70"><span className="text-xs text-white/40">📝 </span>{specNote}</div>
            </div>
          )}
          <div className="p-4 border-t border-white/5">
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,video/*,.pdf,.ai,.psd,.eps,.zip" />
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
                  <div className="flex items-center justify-center gap-2"><div className="animate-spin w-5 h-5 border-2 border-sunny-yellow border-t-transparent rounded-full" /><span>Uploading...</span></div>
                ) : (
                  <><div className="text-xl mb-1 group-hover:scale-110 transition-transform">📁</div><div className="text-sm text-white/70">Upload creative</div><div className="text-xs text-white/40 mt-1">for all {spec.placements.length} placements</div></>
                )}
              </div>
            )}
          </div>
          {/* Client Comment / Request Change */}
          <div className="px-4 py-3 border-t border-white/5">
            {clientComment?.text && !showCommentInput ? (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-blue-400 font-medium">💬 Your feedback</span>
                  <button onClick={() => setShowCommentInput(true)} className="text-xs text-white/30 hover:text-white">Edit</button>
                </div>
                <div className="text-sm text-white/70">{clientComment.text}</div>
                <div className="text-xs text-white/30 mt-1">{clientComment.timestamp ? new Date(clientComment.timestamp).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</div>
              </div>
            ) : showCommentInput ? (
              <div className="space-y-2">
                <textarea value={commentText} onChange={e => setCommentText(e.target.value)}
                  placeholder="Describe the change you need, e.g. 'Can we swap the hero image?' or 'Wrong dates for panel 3'..."
                  className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-sm text-white resize-none placeholder-white/30 focus:border-blue-400/50 focus:outline-none" rows={2} autoFocus />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => { setShowCommentInput(false); setCommentText(clientComment?.text || ''); }} className="px-3 py-1 text-xs text-white/50 hover:text-white">Cancel</button>
                  <button onClick={() => { onComment(spec.id, commentText); setShowCommentInput(false); }}
                    className="px-3 py-1 text-xs bg-blue-500/20 text-blue-400 rounded font-medium hover:bg-blue-500/30">Send Feedback</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowCommentInput(true)}
                className="w-full text-left text-xs text-white/30 hover:text-blue-400 transition-colors py-1">
                💬 Request a change or leave feedback...
              </button>
            )}
          </div>
          <div className="border-t border-white/5">
            <div className="max-h-64 overflow-y-auto">
              {siteFlights.length < spec.placements.length ? (
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

export default function ClientBriefPage() {
  const params = useParams();
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedSpecs, setExpandedSpecs] = useState(new Set());
  const [uploads, setUploads] = useState({});
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [clientComments, setClientComments] = useState({});
  const briefId = params.briefId || params.id;
  const dueDateBuffer = brief?.dueDateBuffer || 5;
  const publisherLeadTimes = brief?.publisherLeadTimes || {};
  const specNotes = brief?.specNotes || {};

  useEffect(() => {
    async function loadBrief() {
      try {
        const res = await fetch(`/api/brief/${briefId}`);
        if (!res.ok) throw new Error('Brief not found');
        const data = await res.json();
        setBrief(data);
        setClientComments(data.clientComments || {});
      } catch (err) { console.error('Failed to load brief:', err); }
      setLoading(false);
    }
    loadBrief();
  }, [briefId]);

  async function handleClientComment(specId, text) {
    const updated = { ...clientComments, [specId]: { text, timestamp: new Date().toISOString() } };
    setClientComments(updated);
    try {
      await fetch(`/api/brief/${briefId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientComments: updated }),
      });
    } catch (err) { console.error('Failed to save comment:', err); }
  }

  const channelData = useMemo(() => {
    if (!brief?.items) return {};
    const channels = {};
    brief.items.forEach(item => {
      const channel = item.channel || 'ooh';
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
        channels[channel].specs[specId] = { id: specId, key: specKey, label: specLabel, publisher: item.publisherName, placements: [], minStart: null, maxEnd: null, earliestDue: null, status: 'briefed' };
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
  }, [brief, dueDateBuffer, publisherLeadTimes]);

  const allSpecs = useMemo(() => {
    const s = []; Object.values(channelData).forEach(ch => Object.values(ch.specs).forEach(sp => s.push(sp))); return s;
  }, [channelData]);

  const filteredChannelData = useMemo(() => {
    if (!selectedWeek) return channelData;
    const filtered = {};
    Object.entries(channelData).forEach(([ck, ch]) => {
      const fs = {}; Object.entries(ch.specs).forEach(([sk, sp]) => { if (sp.earliestDue && getWeekKey(sp.earliestDue) === selectedWeek) fs[sk] = sp; });
      if (Object.keys(fs).length > 0) filtered[ck] = { ...ch, specs: fs };
    });
    return filtered;
  }, [channelData, selectedWeek]);

  const stats = useMemo(() => {
    let totalCreatives = 0, totalPlacements = 0, uploaded = 0, dueSoon = 0;
    Object.values(channelData).forEach(ch => {
      totalCreatives += ch.totalCreatives; totalPlacements += ch.totalPlacements;
      Object.values(ch.specs).forEach(sp => {
        if (uploads[sp.id]) uploaded++;
        const d = getDaysUntil(sp.earliestDue);
        if (d !== null && d >= 0 && d <= 7) dueSoon++;
      });
    });
    return { totalCreatives, totalPlacements, uploaded, dueSoon };
  }, [channelData, uploads]);

  function toggleSpecExpanded(specId) {
    setExpandedSpecs(prev => { const n = new Set(prev); if (n.has(specId)) n.delete(specId); else n.add(specId); return n; });
  }
  function handleUpload(specId, uploadData) { setUploads(prev => ({ ...prev, [specId]: uploadData })); }

  if (loading) return <div className="min-h-screen bg-sunny-dark flex items-center justify-center"><div className="animate-spin w-8 h-8 border-2 border-sunny-yellow border-t-transparent rounded-full" /></div>;
  if (!brief) return <div className="min-h-screen bg-sunny-dark flex items-center justify-center text-white"><div className="text-center"><h1 className="text-2xl font-semibold mb-4">Brief not found</h1><p className="text-white/50">This link may have expired or the brief may have been removed.</p></div></div>;

  return (
    <div className="min-h-screen bg-sunny-dark text-white">
      <header className="border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <a href={`/client/${(brief.clientName || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`}
                className="text-white/50 hover:text-white text-lg" title="All briefs for this client">←</a>
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
      <div className="max-w-6xl mx-auto px-6 py-8">
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
            <div className="text-4xl font-bold text-green-400">{stats.uploaded}</div>
            <div className="text-sm text-white/60 mt-1">Uploaded</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 relative group">
            <div className="text-4xl font-bold text-amber-400">{stats.dueSoon}</div>
            <div className="text-sm text-white/60 mt-1">Due Soon</div>
            <div className="hidden group-hover:block absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black rounded-lg text-xs text-white/80 whitespace-nowrap z-10 border border-white/10">Due within the next 7 days</div>
          </div>
        </div>
        <DueBarChart specs={allSpecs} onWeekClick={setSelectedWeek} selectedWeek={selectedWeek} />
        <div className="bg-sunny-yellow/10 border border-sunny-yellow/20 rounded-xl p-4 mb-8">
          <div className="flex items-start gap-3">
            <span className="text-sunny-yellow">💡</span>
            <div>
              <h3 className="font-medium text-sunny-yellow">How to upload</h3>
              <p className="text-sm text-white/70 mt-1">Upload one creative file per card below. Each file will be used for all placements in that group. Click a card to see individual placements and specifications.</p>
            </div>
          </div>
        </div>
        {brief.attachments?.length > 0 && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-8">
            <div className="flex items-center gap-2 text-sm flex-wrap">
              <span className="text-blue-400">📎</span>
              <span className="text-blue-400 font-medium">Reference Documents:</span>
              {brief.attachments.map((att, i) => (<a key={i} href={att.url} target="_blank" rel="noopener noreferrer" className="text-blue-300 hover:text-blue-200 underline">{att.name}</a>))}
            </div>
          </div>
        )}
        {brief.bestPractices && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-8">
            <div className="flex items-center gap-2 mb-2">
              <span>💡</span>
              <span className="text-sm font-medium">Creative Recommendations & Best Practices</span>
            </div>
            <div className="text-sm text-white/70 whitespace-pre-wrap">{brief.bestPractices}</div>
          </div>
        )}
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
                    <ClientSpecCard key={spec.id} spec={spec} channel={channelKey}
                      onExpand={toggleSpecExpanded} isExpanded={expandedSpecs.has(spec.id)}
                      uploads={uploads} onUpload={handleUpload} attachments={brief.attachments}
                      specNote={specNotes[spec.id]} clientComment={clientComments[spec.id]}
                      onComment={handleClientComment} briefId={briefId} />
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
          </div>
        )}
      </div>
    </div>
  );
}
