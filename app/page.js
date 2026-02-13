'use client';

import { useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { CHANNELS, STATES, SPECS, getPublishers, getPlacements } from '@/lib/specs';

// Publishers for import confirmation
const IMPORT_PUBLISHERS = {
  ooh: ['JCDecaux', 'oOh!', 'QMS', 'Bishopp', 'LUMO', 'GOA', 'Other'],
  tv: ['Seven', 'Nine', 'Ten', 'SBS', 'Foxtel', 'Other'],
  radio: ['ARN', 'SCA', 'Nova', 'ACE Radio', 'Grant Broadcasters', 'Other'],
  digital: ['Google', 'Meta', 'TikTok', 'LinkedIn', 'Spotify', 'Other'],
};

const CHANNEL_CONFIG = {
  ooh: { icon: '📍', name: 'Out of Home', color: 'from-blue-500 to-blue-600' },
  tv: { icon: '📺', name: 'Television', color: 'from-purple-500 to-purple-600' },
  radio: { icon: '📻', name: 'Radio', color: 'from-amber-500 to-amber-600' },
  digital: { icon: '💻', name: 'Digital', color: 'from-green-500 to-green-600' },
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
    const file = e.target.files?.[0];
    if (!file) return;
    
    setImporting(true);
    setImportError(null);
    setParsedPlacements([]);
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await fetch('/api/parse-schedule', {
        method: 'POST',
        body: formData,
      });
      
      const data = await res.json();
      console.log('Parse response:', data);
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to parse schedule');
      }
      
      if (!data.placements || data.placements.length === 0) {
        throw new Error('No placements found in document.');
      }
      
      // Use AI-detected values
      setDetectedChannel(data.detectedChannel || 'ooh');
      setDetectedPublisher(data.detectedPublisher || '');
      setPublisherSpecs(data.publisherSpecs || null);
      
      // Just add import IDs, due dates will be calculated in brief view
      const placementsWithIds = data.placements.map((p, i) => ({
        ...p,
        _importId: p._importId || `import-${Date.now()}-${i}`,
      }));
      
      setParsedPlacements(placementsWithIds);
      setSelectedImports(new Set(placementsWithIds.map(p => p._importId)));
      
    } catch (err) {
      console.error('Import error:', err);
      setImportError(err.message);
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
  return (
    <div className="min-h-screen bg-sunny-dark">
      {/* Header */}
      <header className="border-b border-gray-800 bg-sunny-gray sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
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
                        <option value="ooh">Out of Home</option>
                        <option value="tv">Television</option>
                        <option value="radio">Radio</option>
                        <option value="digital">Digital</option>
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
