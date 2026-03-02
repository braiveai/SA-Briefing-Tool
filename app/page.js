'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CHANNELS, STATES, SPECS, getPublishers, getPlacements } from '@/lib/specs';

// Publishers for import confirmation
const IMPORT_PUBLISHERS = {
  ooh: ['JCDecaux', 'oOh!', 'QMS', 'Bishopp', 'LUMO', 'GOA', 'Other'],
  tv: ['Seven', 'Nine', 'Ten', 'SBS', 'Foxtel', 'Other'],
  radio: ['ARN', 'SCA', 'Nova', 'ACE Radio', 'Grant Broadcasters', 'Other'],
  digital: ['Google', 'Meta', 'TikTok', 'LinkedIn', 'Spotify', 'Other'],
  press: ['News Corp', 'Nine Publishing', 'Are Media', 'Other'],
  transit: ['oOh!', 'JCDecaux', 'QMS', 'Other'],
  programmatic: ['DV360', 'The Trade Desk', 'Verizon Media', 'Other'],
};

const CHANNEL_CONFIG = {
  ooh: { icon: '📍', name: 'Out of Home', color: 'from-blue-500 to-blue-600' },
  tv: { icon: '📺', name: 'Television', color: 'from-purple-500 to-purple-600' },
  radio: { icon: '📻', name: 'Radio', color: 'from-amber-500 to-amber-600' },
  digital: { icon: '💻', name: 'Digital', color: 'from-green-500 to-green-600' },
  press: { icon: '📰', name: 'Press', color: 'from-rose-500 to-rose-600' },
  transit: { icon: '🚌', name: 'Transit', color: 'from-cyan-500 to-cyan-600' },
  programmatic: { icon: '🎯', name: 'Programmatic', color: 'from-indigo-500 to-indigo-600' },
};

// ============================================
// VISUAL DIMENSION PREVIEW (mini version for cart)
// ============================================
function MiniDimensionPreview({ dimensions, channel }) {
  if (channel === 'radio' || channel === 'tv') {
    const bars = 6;
    return (
      <div className="w-8 h-6 flex items-end justify-center gap-px">
        {Array.from({ length: bars }).map((_, i) => (
          <div
            key={i}
            className="w-0.5 bg-amber-400 rounded-full"
            style={{ height: `${40 + Math.sin(i) * 30}%` }}
          />
        ))}
      </div>
    );
  }
  
  if (!dimensions) return <div className="w-8 h-6 rounded bg-white/10" />;
  
  const match = dimensions.match(/(\d+)\s*[x×]\s*(\d+)/i);
  if (!match) return <div className="w-8 h-6 rounded bg-white/10" />;
  
  const [, w, h] = match;
  const aspectRatio = parseInt(w) / parseInt(h);
  
  let rectW, rectH;
  if (aspectRatio > 32/24) {
    rectW = 32;
    rectH = 32 / aspectRatio;
  } else {
    rectH = 24;
    rectW = 24 * aspectRatio;
  }
  
  return (
    <div className="w-8 h-6 flex items-center justify-center">
      <div 
        className="bg-gradient-to-br from-blue-400 to-blue-600 rounded-sm"
        style={{ width: `${rectW}px`, height: `${rectH}px` }}
      />
    </div>
  );
}

export default function NewBrief() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [showNewBrief, setShowNewBrief] = useState(false);
  
  // Dashboard state
  const [existingBriefs, setExistingBriefs] = useState([]);
  const [loadingBriefs, setLoadingBriefs] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dashboardFilter, setDashboardFilter] = useState('all');
  const [expandedClients, setExpandedClients] = useState(new Set());

  // Load existing briefs
  useEffect(() => {
    async function loadBriefs() {
      try {
        const res = await fetch('/api/briefs');
        const data = await res.json();
        setExistingBriefs(data.briefs || []);
      } catch (err) { console.error('Failed to load briefs:', err); }
      setLoadingBriefs(false);
    }
    loadBriefs();
  }, []);

  function toggleClient(name) {
    setExpandedClients(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  async function deleteBrief(briefId, e) {
    e.stopPropagation();
    if (!confirm('Delete this brief? This cannot be undone.')) return;
    try {
      await fetch(`/api/brief/${briefId}`, { method: 'DELETE' });
      setExistingBriefs(prev => prev.filter(b => b.id !== briefId));
    } catch (err) { console.error('Failed to delete:', err); }
  }

  // Helper: compute brief stats
  function getBriefStats(brief) {
    const items = brief.items || [];
    const channelSet = new Set(items.map(i => i.channel));
    const specSet = new Set();
    items.forEach(i => {
      const key = (i.channel === 'radio' || i.channel === 'tv')
        ? (i.specs?.adLength || i.specs?.spotLength || 'unknown')
        : (i.specs?.dimensions || 'unknown');
      specSet.add(`${i.channel}-${key}`);
    });
    let earliestDue = null; let dueSoonCount = 0; let overdueCount = 0; let completedCount = 0;
    items.forEach(i => {
      const due = i.dueDate || (i.flightStart ? (() => {
        const d = new Date(i.flightStart); d.setDate(d.getDate() - (brief.dueDateBuffer || 5));
        return d.toISOString().split('T')[0];
      })() : null);
      if (due && (!earliestDue || due < earliestDue)) earliestDue = due;
      const dUntil = due ? Math.ceil((new Date(due) - new Date()) / (1000*60*60*24)) : null;
      if (dUntil !== null && dUntil < 0) overdueCount++;
      else if (dUntil !== null && dUntil <= 7) dueSoonCount++;
      if (i.status === 'delivered' || i.status === 'approved') completedCount++;
    });
    const daysUntil = earliestDue ? Math.ceil((new Date(earliestDue) - new Date()) / (1000*60*60*24)) : null;
    return { channels: channelSet, creatives: specSet.size, placements: items.length, earliestDue, daysUntil, dueSoon: dueSoonCount, overdue: overdueCount, completed: completedCount };
  }

  // Filter and group briefs by client
  const { clientGroups, totalStats } = useMemo(() => {
    let briefs = existingBriefs;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      briefs = briefs.filter(b => b.clientName?.toLowerCase().includes(q) || b.campaignName?.toLowerCase().includes(q));
    }
    // Compute stats per brief for filtering
    const briefsWithStats = briefs.map(b => ({ ...b, _stats: getBriefStats(b) }));
    // Apply filter
    let filtered = briefsWithStats;
    if (dashboardFilter === 'due-soon') filtered = briefsWithStats.filter(b => b._stats.dueSoon > 0);
    else if (dashboardFilter === 'overdue') filtered = briefsWithStats.filter(b => b._stats.overdue > 0);
    // Group by client
    const groups = {};
    filtered.forEach(b => {
      const client = b.clientName || 'Unknown Client';
      if (!groups[client]) groups[client] = { name: client, briefs: [], totalPlacements: 0, totalCreatives: 0, dueSoon: 0, overdue: 0 };
      groups[client].briefs.push(b);
      groups[client].totalPlacements += b._stats.placements;
      groups[client].totalCreatives += b._stats.creatives;
      groups[client].dueSoon += b._stats.dueSoon;
      groups[client].overdue += b._stats.overdue;
    });
    // Sort clients: overdue first, then due soon, then alphabetical
    const sorted = Object.values(groups).sort((a, b) => (b.overdue - a.overdue) || (b.dueSoon - a.dueSoon) || a.name.localeCompare(b.name));
    // Sort briefs within each client by urgency
    sorted.forEach(g => g.briefs.sort((a, b) => {
      const da = a._stats.daysUntil ?? 999; const db = b._stats.daysUntil ?? 999;
      return da - db;
    }));
    // Total stats
    const ts = { clients: sorted.length, briefs: filtered.length, dueSoon: filtered.reduce((s, b) => s + b._stats.dueSoon, 0), overdue: filtered.reduce((s, b) => s + b._stats.overdue, 0) };
    return { clientGroups: sorted, totalStats: ts };
  }, [existingBriefs, searchQuery, dashboardFilter]);
  
  // Brief details
  const [clientName, setClientName] = useState('');
  const [campaignName, setCampaignName] = useState('');
  
  // Manual selection state
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [selectedState, setSelectedState] = useState(null);
  const [selectedPublisher, setSelectedPublisher] = useState(null);
  
  // Cart
  const [cart, setCart] = useState([]);
  
  // Import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(null);
  const [parsedPlacements, setParsedPlacements] = useState([]);
  const [selectedImports, setSelectedImports] = useState(new Set());
  const [detectedChannel, setDetectedChannel] = useState('ooh');
  const [detectedPublisher, setDetectedPublisher] = useState('');
  const [publisherSpecs, setPublisherSpecs] = useState(null);
  const importFileRef = useRef(null);
  
  // Get available options based on selections
  const publishers = selectedChannel && selectedState 
    ? getPublishers(selectedChannel, selectedState) 
    : [];
  const placements = selectedChannel && selectedState && selectedPublisher
    ? getPlacements(selectedChannel, selectedState, selectedPublisher)
    : [];

  // ============================================
  // CART GROUPED BY CHANNEL → SPECS
  // ============================================
  const cartGrouped = useMemo(() => {
    const channels = {};
    
    cart.forEach(item => {
      const channel = item.channel || 'ooh';
      
      // Determine spec key
      let specKey;
      if (channel === 'radio' || channel === 'tv') {
        specKey = item.specs?.adLength || item.specs?.spotLength || 'unknown';
      } else {
        specKey = item.specs?.dimensions || 'unknown';
      }
      
      if (!channels[channel]) {
        channels[channel] = {
          name: item.channelName || CHANNEL_CONFIG[channel]?.name || 'Unknown',
          specs: {},
          totalPlacements: 0,
        };
      }
      
      if (!channels[channel].specs[specKey]) {
        channels[channel].specs[specKey] = {
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
  }, [cart]);

  const totalCreatives = useMemo(() => {
    let count = 0;
    Object.values(cartGrouped).forEach(ch => {
      count += Object.keys(ch.specs).length;
    });
    return count;
  }, [cartGrouped]);

  // ============================================
  // CART FUNCTIONS
  // ============================================
  function addToCart(placement) {
    const publisher = SPECS[selectedChannel].publishers.find(p => p.id === selectedPublisher);
    const newItem = {
      id: `${placement.id}-${Date.now()}`,
      placementId: placement.id,
      channel: selectedChannel,
      channelName: CHANNELS.find(c => c.id === selectedChannel)?.name,
      state: selectedState,
      stateName: STATES.find(s => s.id === selectedState)?.name,
      publisher: selectedPublisher,
      publisherName: publisher?.name,
      placementName: placement.name,
      location: placement.location || null,
      format: placement.format,
      specs: placement.specs,
      notes: placement.notes,
      restrictions: placement.restrictions || [],
      dueDate: '',
      status: 'briefed',
    };
    setCart([...cart, newItem]);
  }

  function removeFromCart(itemId) {
    setCart(cart.filter(i => i.id !== itemId));
  }

  function removeSpecGroup(channel, specKey) {
    setCart(cart.filter(item => {
      const itemSpec = (item.channel === 'radio' || item.channel === 'tv')
        ? (item.specs?.adLength || item.specs?.spotLength || 'unknown')
        : (item.specs?.dimensions || 'unknown');
      return !(item.channel === channel && itemSpec === specKey);
    }));
  }

  function updateSpecGroupChannel(oldChannel, specKey, newChannel, newPublisher) {
    setCart(cart.map(item => {
      const itemSpec = (item.channel === 'radio' || item.channel === 'tv')
        ? (item.specs?.adLength || item.specs?.spotLength || 'unknown')
        : (item.specs?.dimensions || 'unknown');
      if (item.channel === oldChannel && itemSpec === specKey) {
        return {
          ...item,
          channel: newChannel,
          channelName: CHANNEL_CONFIG[newChannel]?.name,
          publisher: newPublisher?.toLowerCase().replace(/\s+/g, '-') || item.publisher,
          publisherName: newPublisher || item.publisherName,
        };
      }
      return item;
    }));
  }

  // State for editing cart items
  const [editingSpec, setEditingSpec] = useState(null); // { channel, specKey }
  const [editChannel, setEditChannel] = useState('ooh');
  const [editPublisher, setEditPublisher] = useState('');

  // ============================================
  // IMPORT FUNCTIONS
  // ============================================
  async function handleFileUpload(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    setImporting(true);
    setImportError(null);
    setParsedPlacements([]);
    
    let allPlacements = [];
    let lastChannel = 'ooh';
    let lastPublisher = '';
    let lastSpecs = null;
    
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      
      try {
        const res = await fetch('/api/parse-schedule', {
          method: 'POST',
          body: formData,
        });
        
        if (!res.ok) {
          let errorMsg = `Failed to parse ${file.name}`;
          try {
            const errData = await res.json();
            errorMsg = errData.error || errorMsg;
          } catch {
            const text = await res.text().catch(() => '');
            if (res.status === 504 || text.includes('FUNCTION_INVOCATION_TIMEOUT')) {
              errorMsg = `${file.name}: Request timed out — try a smaller file.`;
            } else if (text.includes('An error occurred')) {
              errorMsg = `${file.name}: Server error — file may be too large or complex.`;
            } else if (text) { errorMsg = text.substring(0, 200); }
          }
          throw new Error(errorMsg);
        }
        
        const data = await res.json();
        console.log(`Parse response for ${file.name}:`, data);
        
        if (data.placements?.length > 0) {
          lastChannel = data.detectedChannel || lastChannel;
          lastPublisher = data.detectedPublisher || lastPublisher;
          lastSpecs = data.publisherSpecs || lastSpecs;
          const placementsWithIds = data.placements.map((p, i) => ({
            ...p,
            _importId: `import-${Date.now()}-${allPlacements.length + i}`,
            _sourceFile: file.name,
          }));
          allPlacements = [...allPlacements, ...placementsWithIds];
        }
      } catch (err) {
        console.error('Import error:', err);
        setImportError(err.message);
        break;
      }
    }
    
    if (allPlacements.length > 0) {
      setDetectedChannel(lastChannel);
      setDetectedPublisher(lastPublisher);
      setPublisherSpecs(lastSpecs);
      setParsedPlacements(allPlacements);
      setSelectedImports(new Set(allPlacements.map(p => p._importId)));
    } else if (!importError) {
      setImportError('No placements found in uploaded files.');
    }
    
    setImporting(false);
    e.target.value = '';
  }
  
  // Format date as DD/MM/YY for display
  function formatDateShort(dateStr) {
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
  
  function toggleImportSelection(importId) {
    setSelectedImports(prev => {
      const next = new Set(prev);
      if (next.has(importId)) next.delete(importId);
      else next.add(importId);
      return next;
    });
  }
  
  function selectAllImports() {
    setSelectedImports(new Set(parsedPlacements.map(p => p._importId)));
  }
  
  function deselectAllImports() {
    setSelectedImports(new Set());
  }
  
  function addSelectedToCart() {
    const channelName = CHANNEL_CONFIG[detectedChannel]?.name || 'Out of Home';
    
    const itemsToAdd = parsedPlacements
      .filter(p => selectedImports.has(p._importId))
      .map(p => ({
        id: p._importId,
        placementId: `imported-${p.siteName}`,
        channel: detectedChannel,
        channelName: channelName,
        state: p.state?.toLowerCase() || 'imported',
        stateName: p.state || p.suburb || 'Imported',
        publisher: detectedPublisher?.toLowerCase().replace(/\s+/g, '-') || 'unknown',
        publisherName: detectedPublisher || 'Unknown',
        placementName: p.siteName,
        location: p.location || p.suburb || null,
        format: p.format || null,
        specs: {
          dimensions: p.dimensions,
          adLength: p.spotLength ? `${p.spotLength} seconds` : null,
          spotLength: p.spotLength,
          panelId: p.panelId || null,
          direction: p.direction || null,
          fileType: p.fileType || null,
          slotLength: p.slotLength || null,
          // Publisher-level specs from document header
          fileFormat: publisherSpecs?.fileFormat || null,
          maxFileSize: publisherSpecs?.maxFileSize || null,
          dpi: publisherSpecs?.dpi || null,
          videoSpecs: publisherSpecs?.videoSpecs || null,
          leadTime: publisherSpecs?.leadTime || null,
          deliveryEmail: publisherSpecs?.deliveryEmail || null,
        },
        notes: publisherSpecs?.notes || p.notes || null,
        restrictions: p.restrictions ? (Array.isArray(p.restrictions) ? p.restrictions : [p.restrictions]) : [],
        dueDate: null, // Will be calculated in brief view with slider
        flightStart: p.startDate,
        flightEnd: p.endDate,
        status: 'briefed',
      }));
    
    setCart([...cart, ...itemsToAdd]);
    setShowImportModal(false);
    setParsedPlacements([]);
    setSelectedImports(new Set());
    setPublisherSpecs(null);
  }

  // ============================================
  // SAVE
  // ============================================
  async function handleSave() {
    if (!clientName || !campaignName || cart.length === 0) return;
    
    setSaving(true);
    try {
      const res = await fetch('/api/briefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientName, campaignName, items: cart }),
      });
      const data = await res.json();
      router.push(`/brief/${data.id}`);
    } catch (err) {
      console.error('Failed to save brief:', err);
      setSaving(false);
    }
  }

  // Format date as DD Mon for display
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

  // ============================================
  // RENDER
  // ============================================
  
  // DASHBOARD VIEW
  if (!showNewBrief) {
    return (
      <div className="min-h-screen bg-sunny-dark">
        <header className="border-b border-gray-800 bg-sunny-gray sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src="/sunny-logo-white.png" alt="Sunny" className="h-6" />
              <div className="border-l border-white/20 pl-4">
                <h1 className="text-xl font-semibold">Creative Briefs</h1>
              </div>
            </div>
            <button onClick={() => setShowNewBrief(true)}
              className="bg-sunny-yellow text-black font-semibold px-5 py-2.5 rounded-lg hover:bg-yellow-400">
              + New Brief
            </button>
          </div>
        </header>

        <div className="max-w-6xl mx-auto px-6 py-8">
          {/* Stats Bar */}
          {!loadingBriefs && existingBriefs.length > 0 && (
            <div className="grid grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Clients', value: totalStats.clients, color: 'border-blue-500/30' },
                { label: 'Active Briefs', value: totalStats.briefs, color: 'border-white/10' },
                { label: 'Due Soon', value: totalStats.dueSoon, color: 'border-amber-500/30', warning: true },
                { label: 'Overdue', value: totalStats.overdue, color: 'border-red-500/30', danger: true },
              ].map(s => (
                <div key={s.label} className={`bg-white/5 border ${s.color} rounded-xl p-4 text-center`}>
                  <div className={`text-2xl font-bold ${s.danger && s.value > 0 ? 'text-red-400' : s.warning && s.value > 0 ? 'text-amber-400' : 'text-sunny-yellow'}`}>{s.value}</div>
                  <div className="text-xs text-white/50 mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Search + Filters */}
          <div className="flex items-center gap-3 mb-6">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search clients or campaigns..."
              className="flex-1 bg-sunny-gray border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-sunny-yellow"
            />
            <div className="flex bg-sunny-gray border border-gray-700 rounded-xl overflow-hidden">
              {[
                { key: 'all', label: 'All' },
                { key: 'due-soon', label: 'Due Soon' },
                { key: 'overdue', label: 'Overdue' },
              ].map(f => (
                <button key={f.key} onClick={() => setDashboardFilter(f.key)}
                  className={`px-4 py-3 text-sm font-medium transition-colors ${dashboardFilter === f.key ? 'bg-sunny-yellow text-black' : 'text-white/50 hover:text-white'}`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Client Groups */}
          {loadingBriefs ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin w-8 h-8 border-2 border-sunny-yellow border-t-transparent rounded-full" />
            </div>
          ) : clientGroups.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-5xl mb-4">{searchQuery || dashboardFilter !== 'all' ? '🔍' : '📋'}</div>
              <p className="text-white/50 text-lg mb-4">
                {searchQuery ? 'No briefs match your search.' : dashboardFilter !== 'all' ? `No ${dashboardFilter.replace('-', ' ')} briefs.` : 'No briefs created yet.'}
              </p>
              {!searchQuery && dashboardFilter === 'all' && (
                <button onClick={() => setShowNewBrief(true)}
                  className="bg-sunny-yellow text-black font-semibold px-6 py-3 rounded-lg hover:bg-yellow-400">
                  Create your first brief
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {clientGroups.map(client => {
                const isExpanded = expandedClients.has(client.name);
                return (
                <div key={client.name} className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
                  {/* Client Header - Click to expand */}
                  <div onClick={() => toggleClient(client.name)}
                    className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-white/[0.03] transition-colors">
                    <div className="flex items-center gap-3">
                      <span className={`text-white/30 text-xs transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                      <div className="w-9 h-9 bg-gradient-to-br from-sunny-yellow/30 to-sunny-yellow/10 rounded-lg flex items-center justify-center text-sm font-bold text-sunny-yellow">
                        {(client.name[0] || '?').toUpperCase()}
                      </div>
                      <div>
                        <h2 className="font-semibold">
                          <button onClick={(e) => { e.stopPropagation(); router.push(`/client/${client.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`); }}
                            className="hover:text-sunny-yellow transition-colors" title="View client portal">
                            {client.name}
                          </button>
                        </h2>
                        <div className="flex items-center gap-3 text-xs text-white/40 mt-0.5">
                          <span>{client.briefs.length} brief{client.briefs.length !== 1 ? 's' : ''}</span>
                          <span>{client.totalPlacements} placement{client.totalPlacements !== 1 ? 's' : ''}</span>
                          <span>{client.totalCreatives} creative{client.totalCreatives !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {client.overdue > 0 && <span className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded-full font-medium">{client.overdue} overdue</span>}
                      {client.dueSoon > 0 && <span className="text-xs px-2 py-1 bg-amber-500/20 text-amber-400 rounded-full font-medium">{client.dueSoon} due soon</span>}
                    </div>
                  </div>

                  {/* Briefs within this client - collapsible */}
                  {isExpanded && (
                    <div className="divide-y divide-white/5 border-t border-white/5">
                      {client.briefs.map(brief => {
                        const s = brief._stats;
                        let urgencyText = ''; let urgencyColor = 'text-white/40';
                        if (s.daysUntil !== null && s.daysUntil < 0) { urgencyText = 'Overdue'; urgencyColor = 'text-red-400'; }
                        else if (s.daysUntil !== null && s.daysUntil === 0) { urgencyText = 'Due today'; urgencyColor = 'text-red-400'; }
                        else if (s.daysUntil !== null && s.daysUntil <= 3) { urgencyText = `${s.daysUntil}d left`; urgencyColor = 'text-red-400'; }
                        else if (s.daysUntil !== null && s.daysUntil <= 7) { urgencyText = `${s.daysUntil}d left`; urgencyColor = 'text-amber-400'; }
                        else if (s.daysUntil !== null) { urgencyText = `${s.daysUntil}d left`; urgencyColor = 'text-white/40'; }

                        return (
                          <div key={brief.id} onClick={() => router.push(`/brief/${brief.id}`)}
                            className="px-5 py-3.5 hover:bg-white/[0.04] cursor-pointer transition-all flex items-center justify-between group">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium truncate">{brief.campaignName || 'Untitled Campaign'}</span>
                                <div className="flex gap-0.5">
                                  {Array.from(s.channels).map(ch => {
                                    const cfg = CHANNEL_CONFIG[ch];
                                    return <span key={ch} className="text-xs" title={cfg?.name || ch}>{cfg?.icon || '📄'}</span>;
                                  })}
                                </div>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-white/30 mt-0.5">
                                <span>{s.creatives} creative{s.creatives !== 1 ? 's' : ''}</span>
                                <span>{s.placements} placement{s.placements !== 1 ? 's' : ''}</span>
                                {brief.createdAt && <span>{new Date(brief.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {urgencyText && <span className={`text-xs font-medium ${urgencyColor}`}>{urgencyText}</span>}
                              <button onClick={(e) => deleteBrief(brief.id, e)}
                                className="text-white/0 group-hover:text-white/20 hover:!text-red-400 transition-colors text-xs p-1" title="Delete brief">✕</button>
                              <span className="text-white/15 group-hover:text-white/40 transition-colors">→</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );})}
            </div>
          )}
        </div>
      </div>
    );
  }

  // NEW BRIEF CREATION VIEW (existing flow)
  return (
    <div className="min-h-screen bg-sunny-dark">
      {/* Header */}
      <header className="border-b border-gray-800 bg-sunny-gray sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
              <button onClick={() => setShowNewBrief(false)} className="text-white/50 hover:text-white text-lg">←</button>
              <img src="/sunny-logo-white.png" alt="Sunny" className="h-6" />
              <div className="border-l border-white/20 pl-4">
                <h1 className="text-xl font-semibold">New Creative Brief</h1>
              </div>
            </div>
          <div className="flex items-center gap-3">
            <span className="text-gray-400">{totalCreatives} creative{totalCreatives !== 1 ? 's' : ''}</span>
            <button
              onClick={handleSave}
              disabled={saving || !clientName || !campaignName || cart.length === 0}
              className="bg-sunny-yellow text-black font-semibold px-5 py-2.5 rounded-lg hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Create Brief'}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Step 1: Brief Details */}
        {step === 1 && (
          <div className="max-w-xl mx-auto animate-fade-in">
            <h2 className="text-2xl font-semibold mb-6">Brief Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Client Name</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. Ingenia Holiday Parks"
                  className="w-full bg-sunny-gray border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-sunny-yellow"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Campaign Name</label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="e.g. Summer 2025 Campaign"
                  className="w-full bg-sunny-gray border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-sunny-yellow"
                />
              </div>
              <button
                onClick={() => setStep(2)}
                disabled={!clientName || !campaignName}
                className="w-full bg-sunny-yellow text-black font-semibold py-3 rounded-lg hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
              >
                Continue to Add Placements
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Add Placements */}
        {step === 2 && (
          <div className="grid grid-cols-12 gap-6 animate-fade-in">
            {/* Left: Selector */}
            <div className="col-span-8">
              <div className="bg-sunny-gray border border-gray-700 rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setStep(1)} className="text-gray-400 hover:text-white">
                      ← Details
                    </button>
                    <span className="text-gray-600">/</span>
                    <span className="font-medium">{clientName} - {campaignName}</span>
                  </div>
                  
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium"
                  >
                    📄 Import Schedule
                  </button>
                </div>

                {/* Channel Selection */}
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-400 mb-3">Select Channel</h3>
                  <div className="grid grid-cols-4 gap-3">
                    {CHANNELS.map((channel) => (
                      <button
                        key={channel.id}
                        onClick={() => {
                          setSelectedChannel(channel.id);
                          setSelectedState(null);
                          setSelectedPublisher(null);
                        }}
                        className={`p-4 rounded-lg border text-center transition-all ${
                          selectedChannel === channel.id
                            ? 'border-sunny-yellow bg-sunny-yellow/10'
                            : 'border-gray-700 hover:border-gray-500'
                        }`}
                      >
                        <div className="text-2xl mb-1">{channel.icon}</div>
                        <div className="text-sm font-medium">{channel.name}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* State Selection */}
                {selectedChannel && (
                  <div className="mb-6 animate-fade-in">
                    <h3 className="text-sm font-medium text-gray-400 mb-3">Select State/Region</h3>
                    <div className="flex flex-wrap gap-2">
                      {STATES.map((state) => {
                        const hasPublishers = getPublishers(selectedChannel, state.id).length > 0;
                        if (!hasPublishers) return null;
                        return (
                          <button
                            key={state.id}
                            onClick={() => {
                              setSelectedState(state.id);
                              setSelectedPublisher(null);
                            }}
                            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                              selectedState === state.id
                                ? 'border-sunny-yellow bg-sunny-yellow/10 text-sunny-yellow'
                                : 'border-gray-700 hover:border-gray-500'
                            }`}
                          >
                            {state.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Publisher Selection */}
                {selectedState && publishers.length > 0 && (
                  <div className="mb-6 animate-fade-in">
                    <h3 className="text-sm font-medium text-gray-400 mb-3">Select Publisher</h3>
                    <div className="flex flex-wrap gap-2">
                      {publishers.map((pub) => (
                        <button
                          key={pub.id}
                          onClick={() => setSelectedPublisher(pub.id)}
                          className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                            selectedPublisher === pub.id
                              ? 'border-sunny-yellow bg-sunny-yellow/10 text-sunny-yellow'
                              : 'border-gray-700 hover:border-gray-500'
                          }`}
                        >
                          {pub.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Placements */}
                {selectedPublisher && placements.length > 0 && (
                  <div className="animate-fade-in">
                    <h3 className="text-sm font-medium text-gray-400 mb-3">Available Placements</h3>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                      {placements.map((placement) => {
                        const inCart = cart.some(item => 
                          item.placementId === placement.id && 
                          item.channel === selectedChannel &&
                          item.publisher === selectedPublisher
                        );
                        return (
                          <div
                            key={placement.id}
                            className={`p-4 rounded-lg border transition-all ${
                              inCart ? 'border-green-600 bg-green-900/20' : 'border-gray-700 hover:border-gray-500'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="font-medium">{placement.name}</div>
                                {placement.location && (
                                  <div className="text-sm text-gray-400 mt-1">📍 {placement.location}</div>
                                )}
                                <div className="text-xs text-gray-500 mt-2">
                                  {placement.specs?.dimensions} • {placement.format}
                                </div>
                              </div>
                              <button
                                onClick={() => addToCart(placement)}
                                disabled={inCart}
                                className={`ml-4 px-4 py-2 rounded-lg text-sm font-medium ${
                                  inCart
                                    ? 'bg-green-600/20 text-green-400 cursor-not-allowed'
                                    : 'bg-sunny-yellow text-black hover:bg-yellow-400'
                                }`}
                              >
                                {inCart ? '✓ Added' : 'Add'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Cart Summary - Channel → Specs grouped */}
            <div className="col-span-4">
              <div className="bg-sunny-gray border border-gray-700 rounded-xl p-5 sticky top-24">
                <h3 className="font-semibold mb-4">Brief Summary</h3>
                
                {cart.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-400 text-sm mb-2">No items added yet.</p>
                    <p className="text-gray-500 text-xs">Select placements or import a schedule.</p>
                  </div>
                ) : (
                  <>
                    {/* Creative count highlight */}
                    <div className="mb-5 p-4 bg-gradient-to-br from-sunny-yellow/20 to-sunny-yellow/5 border border-sunny-yellow/20 rounded-xl">
                      <div className="text-3xl font-bold text-sunny-yellow">{totalCreatives}</div>
                      <div className="text-sm text-white/60">unique creative{totalCreatives !== 1 ? 's' : ''} needed</div>
                      <div className="text-xs text-white/40 mt-1">{cart.length} total placements</div>
                    </div>
                    
                    {/* Channel → Specs grouped */}
                    <div className="space-y-4 max-h-[calc(100vh-400px)] overflow-y-auto">
                      {Object.entries(cartGrouped).map(([channelKey, channel]) => {
                        const config = CHANNEL_CONFIG[channelKey] || CHANNEL_CONFIG.ooh;
                        const specs = Object.entries(channel.specs);
                        
                        return (
                          <div key={channelKey}>
                            {/* Channel header */}
                            <div className="flex items-center gap-2 mb-2">
                              <div className={`w-6 h-6 rounded-md bg-gradient-to-br ${config.color} flex items-center justify-center text-sm`}>
                                {config.icon}
                              </div>
                              <span className="text-sm font-medium text-white/80">{config.name}</span>
                              <span className="text-xs text-white/40">({channel.totalPlacements})</span>
                            </div>
                            
                            {/* Spec cards */}
                            <div className="space-y-2 ml-8">
                              {specs.map(([specKey, spec]) => {
                                const isEditing = editingSpec?.channel === channelKey && editingSpec?.specKey === specKey;
                                
                                return (
                                  <div
                                    key={specKey}
                                    className="bg-white/5 border border-white/10 rounded-lg p-3 group"
                                  >
                                    {isEditing ? (
                                      // Edit mode
                                      <div className="space-y-3">
                                        <div className="text-sm font-medium">{spec.label}</div>
                                        <div className="grid grid-cols-2 gap-2">
                                          <select
                                            value={editChannel}
                                            onChange={(e) => setEditChannel(e.target.value)}
                                            className="bg-sunny-dark border border-white/20 rounded px-2 py-1 text-sm"
                                          >
                                            <option value="ooh">Out of Home</option>
                                            <option value="tv">Television</option>
                                            <option value="radio">Radio</option>
                                            <option value="digital">Digital</option>
                                          </select>
                                          <select
                                            value={editPublisher}
                                            onChange={(e) => setEditPublisher(e.target.value)}
                                            className="bg-sunny-dark border border-white/20 rounded px-2 py-1 text-sm"
                                          >
                                            <option value="">Select publisher</option>
                                            {IMPORT_PUBLISHERS[editChannel]?.map(p => (
                                              <option key={p} value={p}>{p}</option>
                                            ))}
                                          </select>
                                        </div>
                                        <div className="flex gap-2 justify-end">
                                          <button
                                            onClick={() => setEditingSpec(null)}
                                            className="px-2 py-1 text-xs text-white/50 hover:text-white"
                                          >
                                            Cancel
                                          </button>
                                          <button
                                            onClick={() => {
                                              updateSpecGroupChannel(channelKey, specKey, editChannel, editPublisher);
                                              setEditingSpec(null);
                                            }}
                                            className="px-2 py-1 text-xs bg-sunny-yellow text-black rounded font-medium"
                                          >
                                            Save
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      // View mode
                                      <div className="flex items-center gap-3">
                                        <MiniDimensionPreview dimensions={spec.label} channel={channelKey} />
                                        <div className="flex-1 min-w-0">
                                          <div className="text-sm font-medium truncate">{spec.label}</div>
                                          <div className="text-xs text-white/40">
                                            {spec.placements.length} placement{spec.placements.length !== 1 ? 's' : ''}
                                            {spec.publisher && ` • ${spec.publisher}`}
                                          </div>
                                          {spec.minStart && (
                                            <div className="text-xs text-white/30 mt-0.5">
                                              {formatDate(spec.minStart)} → {formatDate(spec.maxEnd)}
                                            </div>
                                          )}
                                        </div>
                                        <button
                                          onClick={() => {
                                            setEditingSpec({ channel: channelKey, specKey });
                                            setEditChannel(channelKey);
                                            setEditPublisher(spec.publisher || '');
                                          }}
                                          className="text-white/20 hover:text-sunny-yellow opacity-0 group-hover:opacity-100 transition-all text-xs"
                                        >
                                          ✎
                                        </button>
                                        <button
                                          onClick={() => removeSpecGroup(channelKey, specKey)}
                                          className="text-white/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                        >
                                          ✕
                                        </button>
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
                    
                    {/* Save button */}
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="w-full mt-5 bg-sunny-yellow text-black font-semibold py-3 rounded-lg hover:bg-yellow-400 disabled:opacity-50"
                    >
                      {saving ? 'Creating...' : `Create Brief (${totalCreatives} creatives)`}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-sunny-gray border border-gray-700 rounded-xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-lg font-semibold">Import Schedule</h2>
                <p className="text-sm text-gray-400">Upload a media schedule file</p>
              </div>
              <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-white text-xl">
                ×
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto flex-1">
              {/* Upload Area - shown when no results */}
              {parsedPlacements.length === 0 && (
                <div className="space-y-4">
                  <input
                    ref={importFileRef}
                    type="file"
                    accept=".xlsx,.xls,.csv,.pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                    multiple
                  />
                  <button
                    onClick={() => importFileRef.current?.click()}
                    disabled={importing}
                    className="w-full border-2 border-dashed border-gray-600 rounded-xl p-10 text-center hover:border-sunny-yellow transition-colors disabled:opacity-50"
                  >
                    {importing ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="animate-spin w-8 h-8 border-2 border-sunny-yellow border-t-transparent rounded-full" />
                        <span className="text-gray-400">Parsing with AI...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <div className="text-4xl">📄</div>
                        <span className="text-lg font-medium">Click to upload</span>
                        <span className="text-sm text-gray-400">Excel, CSV, or PDF</span>
                      </div>
                    )}
                  </button>
                  
                  {importError && (
                    <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">
                      {importError}
                    </div>
                  )}
                </div>
              )}

              {/* Results */}
              {parsedPlacements.length > 0 && (
                <div className="space-y-5">
                  {/* Confirm channel & publisher */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Channel (AI detected)</label>
                      <select
                        value={detectedChannel}
                        onChange={(e) => setDetectedChannel(e.target.value)}
                        className="w-full bg-sunny-dark border border-gray-600 rounded-lg px-3 py-2 text-sm"
                      >
                        {Object.entries(CHANNEL_CONFIG).map(([key, cfg]) => (
                          <option key={key} value={key}>{cfg.icon} {cfg.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Publisher</label>
                      <select
                        value={detectedPublisher}
                        onChange={(e) => setDetectedPublisher(e.target.value)}
                        className="w-full bg-sunny-dark border border-gray-600 rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="">Select publisher...</option>
                        {IMPORT_PUBLISHERS[detectedChannel]?.map((pub) => (
                          <option key={pub} value={pub}>{pub}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* AI Spot-Check Summary */}
                  {(() => {
                    const dims = new Set(); const dates = []; const durations = new Set();
                    parsedPlacements.forEach(p => {
                      if (p.dimensions) dims.add(p.dimensions);
                      if (p.spotLength) durations.add(`${p.spotLength}s`);
                      if (p.adLength) durations.add(`${p.adLength}s`);
                      if (p.startDate) dates.push(p.startDate);
                      if (p.endDate) dates.push(p.endDate);
                    });
                    dates.sort();
                    const earliest = dates[0]; const latest = dates[dates.length - 1];
                    return (
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs">
                        <div className="flex items-center gap-2 mb-2 text-blue-400 font-medium"><span>🤖</span> AI Extraction Summary — please verify</div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-white/60">
                          <div>Channel: <span className="text-white/90">{CHANNEL_CONFIG[detectedChannel]?.name || detectedChannel}</span></div>
                          <div>Publisher: <span className="text-white/90">{detectedPublisher || '—'}</span></div>
                          <div>Placements: <span className="text-white/90">{parsedPlacements.length}</span></div>
                          {earliest && <div>Dates: <span className="text-white/90">{formatDateShort(earliest)} → {formatDateShort(latest)}</span></div>}
                          {dims.size > 0 && <div className="col-span-2">Dimensions: <span className="text-white/90">{Array.from(dims).join(', ')}</span></div>}
                          {durations.size > 0 && <div className="col-span-2">Durations: <span className="text-white/90">{Array.from(durations).join(', ')}</span></div>}
                        </div>
                      </div>
                    );
                  })()}
                  
                  {/* Summary */}
                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <span className="text-2xl font-bold text-sunny-yellow">{parsedPlacements.length}</span>
                      <span className="text-gray-400 ml-2">placements found</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <button onClick={selectAllImports} className="text-sunny-yellow hover:underline">
                        Select all
                      </button>
                      <span className="text-gray-600">|</span>
                      <button onClick={deselectAllImports} className="text-gray-400 hover:underline">
                        None
                      </button>
                    </div>
                  </div>
                  
                  {/* Placements list */}
                  <div className="space-y-2 max-h-[350px] overflow-y-auto">
                    {parsedPlacements.map((p) => (
                      <div
                        key={p._importId}
                        onClick={() => toggleImportSelection(p._importId)}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          selectedImports.has(p._importId)
                            ? 'border-sunny-yellow bg-sunny-yellow/10'
                            : 'border-gray-700 hover:border-gray-600'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                            selectedImports.has(p._importId)
                              ? 'border-sunny-yellow bg-sunny-yellow'
                              : 'border-gray-600'
                          }`}>
                            {selectedImports.has(p._importId) && <span className="text-black text-xs">✓</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{p.siteName}</div>
                            <div className="text-xs text-gray-400">
                              {p.dimensions || (p.spotLength && `${p.spotLength}s`)}
                              {p.startDate && ` • ${formatDateShort(p.startDate)} → ${formatDateShort(p.endDate)}`}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {parsedPlacements.length > 0 && (
              <div className="px-6 py-4 border-t border-gray-700 flex items-center justify-between flex-shrink-0">
                <button
                  onClick={() => {
                    setParsedPlacements([]);
                    setSelectedImports(new Set());
                  }}
                  className="text-sm text-gray-400 hover:text-white"
                >
                  ← Different file
                </button>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-400">
                    {selectedImports.size} selected
                  </span>
                  <button
                    onClick={addSelectedToCart}
                    disabled={selectedImports.size === 0 || !detectedPublisher}
                    className="bg-sunny-yellow text-black font-semibold px-5 py-2 rounded-lg hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add to Brief
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
