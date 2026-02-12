'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CHANNELS, STATES, SPECS, getPublishers, getPlacements } from '@/lib/specs';

// Publishers for import (can be different from specs database)
const IMPORT_PUBLISHERS = {
  ooh: ['LUMO', 'JCDecaux', 'QMS', 'oOh!', 'Bishopp', 'GOA', 'Other'],
  tv: ['Seven', 'Nine', 'Ten', 'SBS', 'Foxtel', 'Sky', 'Other'],
  radio: ['ARN', 'SCA', 'Nova', 'ACE Radio', 'Grant Broadcasters', 'Other'],
  digital: ['Google', 'Meta', 'TikTok', 'LinkedIn', 'Spotify', 'Other'],
};

export default function NewBrief() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  
  // Brief details
  const [clientName, setClientName] = useState('');
  const [campaignName, setCampaignName] = useState('');
  
  // Selection state
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [selectedState, setSelectedState] = useState(null);
  const [selectedPublisher, setSelectedPublisher] = useState(null);
  
  // Cart
  const [cart, setCart] = useState([]);
  
  // Schedule import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(null);
  const [parsedPlacements, setParsedPlacements] = useState([]);
  const [selectedImports, setSelectedImports] = useState(new Set());
  const [dueDateBuffer, setDueDateBuffer] = useState(5);
  const [importChannel, setImportChannel] = useState('ooh');
  const [importPublisher, setImportPublisher] = useState('');
  const importFileRef = useRef(null);
  
  // Get available options based on selections
  const publishers = selectedChannel && selectedState 
    ? getPublishers(selectedChannel, selectedState) 
    : [];
  const placements = selectedChannel && selectedState && selectedPublisher
    ? getPlacements(selectedChannel, selectedState, selectedPublisher)
    : [];

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

  function updateDueDate(itemId, date) {
    setCart(cart.map(i => i.id === itemId ? { ...i, dueDate: date } : i));
  }

  function setAllDueDates(date) {
    setCart(cart.map(i => ({ ...i, dueDate: date })));
  }

  // Schedule import functions
  function openImportModal() {
    setShowImportModal(true);
    setImportError(null);
    setParsedPlacements([]);
    setSelectedImports(new Set());
    setImportChannel('ooh');
    setImportPublisher('');
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!importPublisher) {
      setImportError('Please select a publisher first');
      e.target.value = '';
      return;
    }
    
    setImporting(true);
    setImportError(null);
    setParsedPlacements([]);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('channel', importChannel);
    formData.append('publisher', importPublisher);
    
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
      
      const placementsWithIds = data.placements.map((p, i) => ({
        ...p,
        _importId: `import-${Date.now()}-${i}`,
        _calculatedDueDate: calculateDueDate(p.startDate, dueDateBuffer),
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
  
  function calculateDueDate(startDate, bufferDays) {
    if (!startDate) return '';
    try {
      const date = new Date(startDate);
      date.setDate(date.getDate() - bufferDays);
      return date.toISOString().split('T')[0];
    } catch {
      return '';
    }
  }
  
  function toggleImportSelection(importId) {
    const newSelected = new Set(selectedImports);
    if (newSelected.has(importId)) {
      newSelected.delete(importId);
    } else {
      newSelected.add(importId);
    }
    setSelectedImports(newSelected);
  }
  
  function selectAllImports() {
    setSelectedImports(new Set(parsedPlacements.map(p => p._importId)));
  }
  
  function deselectAllImports() {
    setSelectedImports(new Set());
  }
  
  function addSelectedToCart() {
    const channelName = CHANNELS.find(c => c.id === importChannel)?.name || 'Out of Home';
    
    const itemsToAdd = parsedPlacements
      .filter(p => selectedImports.has(p._importId))
      .map(p => ({
        id: p._importId,
        placementId: `imported-${p.siteName}`,
        channel: importChannel,
        channelName: channelName,
        state: p.state?.toLowerCase() || 'imported',
        stateName: p.state || p.suburb || 'Imported',
        publisher: importPublisher.toLowerCase().replace(/\s+/g, '-'),
        publisherName: importPublisher,
        placementName: p.siteName,
        location: p.location || null,
        format: p.format || 'Digital Billboard',
        specs: {
          dimensions: p.dimensions,
          physicalSize: p.physicalSize,
          fileFormat: p.fileFormat,
          adLength: p.spotLength ? `${p.spotLength} seconds` : null,
          dayPart: p.daypart || null,
          spotCount: p.spots || null,
          panelId: p.panelId || null,
          direction: p.direction || null,
        },
        notes: p.notes || null,
        restrictions: p.restrictions ? (Array.isArray(p.restrictions) ? p.restrictions : [p.restrictions]) : [],
        dueDate: p._calculatedDueDate || '',
        flightStart: p.startDate,
        flightEnd: p.endDate,
        status: 'briefed',
      }));
    
    setCart([...cart, ...itemsToAdd]);
    setShowImportModal(false);
    setParsedPlacements([]);
    setSelectedImports(new Set());
  }
  
  function updateDueDateBuffer(newBuffer) {
    setDueDateBuffer(newBuffer);
    setParsedPlacements(prev => prev.map(p => ({
      ...p,
      _calculatedDueDate: calculateDueDate(p.startDate, newBuffer),
    })));
  }

  async function handleSave() {
    if (!clientName || !campaignName || cart.length === 0) return;
    
    setSaving(true);
    try {
      const res = await fetch('/api/briefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName,
          campaignName,
          items: cart,
        }),
      });
      const data = await res.json();
      router.push(`/brief/${data.id}`);
    } catch (err) {
      console.error('Failed to save brief:', err);
      setSaving(false);
    }
  }

  // Group cart items by channel for display
  const cartByChannel = cart.reduce((acc, item) => {
    const channel = item.channelName || 'Other';
    if (!acc[channel]) acc[channel] = [];
    acc[channel].push(item);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-sunny-dark">
      {/* Header */}
      <header className="border-b border-gray-800 bg-sunny-gray sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push('/')}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ← Back
            </button>
            <h1 className="text-xl font-semibold">New Creative Brief</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-400">{cart.length} items</span>
            <button
              onClick={handleSave}
              disabled={saving || cart.length === 0 || !clientName || !campaignName}
              className="bg-sunny-yellow text-black font-semibold px-6 py-2 rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create Brief'}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="col-span-2">
            {step === 1 ? (
              /* Step 1: Brief Details */
              <div className="bg-sunny-gray border border-gray-700 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-6">Brief Details</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Client Name</label>
                    <input
                      type="text"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="e.g., Acme Corp"
                      className="w-full bg-sunny-dark border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-sunny-yellow"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Campaign Name</label>
                    <input
                      type="text"
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                      placeholder="e.g., Summer 2024 Launch"
                      className="w-full bg-sunny-dark border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-sunny-yellow"
                    />
                  </div>
                </div>
                <button
                  onClick={() => setStep(2)}
                  disabled={!clientName || !campaignName}
                  className="mt-6 bg-sunny-yellow text-black font-semibold px-6 py-2 rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            ) : (
              /* Step 2: Select Placements */
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
                    onClick={openImportModal}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                  >
                    📄 Import Schedule
                  </button>
                </div>

                {/* Channel Selection */}
                <div className="mb-6">
                  <label className="block text-sm text-gray-400 mb-3">Select Channel</label>
                  <div className="grid grid-cols-4 gap-3">
                    {CHANNELS.map((channel) => (
                      <button
                        key={channel.id}
                        onClick={() => {
                          setSelectedChannel(channel.id);
                          setSelectedState(null);
                          setSelectedPublisher(null);
                        }}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          selectedChannel === channel.id
                            ? 'border-sunny-yellow bg-sunny-yellow/10'
                            : 'border-gray-700 hover:border-gray-500'
                        }`}
                      >
                        <div className="text-2xl mb-2">{channel.icon}</div>
                        <div className="text-sm font-medium">{channel.name}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* State Selection */}
                {selectedChannel && (
                  <div className="mb-6">
                    <label className="block text-sm text-gray-400 mb-3">Select State/Region</label>
                    <div className="flex flex-wrap gap-2">
                      {STATES.map((state) => (
                        <button
                          key={state.id}
                          onClick={() => {
                            setSelectedState(state.id);
                            setSelectedPublisher(null);
                          }}
                          className={`px-4 py-2 rounded-lg border transition-all ${
                            selectedState === state.id
                              ? 'border-sunny-yellow bg-sunny-yellow/10'
                              : 'border-gray-700 hover:border-gray-500'
                          }`}
                        >
                          {state.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Publisher Selection */}
                {selectedState && publishers.length > 0 && (
                  <div className="mb-6">
                    <label className="block text-sm text-gray-400 mb-3">Select Publisher</label>
                    <div className="flex flex-wrap gap-2">
                      {publishers.map((pub) => (
                        <button
                          key={pub.id}
                          onClick={() => setSelectedPublisher(pub.id)}
                          className={`px-4 py-2 rounded-lg border transition-all ${
                            selectedPublisher === pub.id
                              ? 'border-sunny-yellow bg-sunny-yellow/10'
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
                  <div>
                    <label className="block text-sm text-gray-400 mb-3">Available Placements</label>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {placements.map((placement) => {
                        const inCart = cart.some(i => i.placementId === placement.id);
                        return (
                          <div
                            key={placement.id}
                            className="flex items-center justify-between p-4 bg-sunny-dark rounded-lg border border-gray-700"
                          >
                            <div>
                              <div className="font-medium">{placement.name}</div>
                              {placement.location && (
                                <div className="text-sm text-gray-400">📍 {placement.location}</div>
                              )}
                              <div className="text-xs text-gray-500 mt-1">
                                {placement.specs?.dimensions} • {placement.format}
                              </div>
                            </div>
                            <button
                              onClick={() => addToCart(placement)}
                              disabled={inCart}
                              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                inCart
                                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                                  : 'bg-sunny-yellow text-black hover:bg-yellow-400'
                              }`}
                            >
                              {inCart ? 'Added' : 'Add'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar - Brief Summary */}
          <div className="col-span-1">
            <div className="bg-sunny-gray border border-gray-700 rounded-xl p-6 sticky top-24">
              <h3 className="font-semibold mb-4">Brief Summary</h3>
              
              {cart.length === 0 ? (
                <p className="text-gray-400 text-sm">No items added yet.</p>
              ) : (
                <>
                  <div className="mb-4">
                    <label className="block text-sm text-gray-400 mb-2">Set all due dates</label>
                    <input
                      type="date"
                      onChange={(e) => setAllDueDates(e.target.value)}
                      className="w-full bg-sunny-dark border border-gray-700 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  
                  <div className="space-y-4 max-h-[500px] overflow-y-auto">
                    {Object.entries(cartByChannel).map(([channel, items]) => (
                      <div key={channel}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-medium text-gray-300">📁{channel}</span>
                          <span className="text-xs bg-sunny-yellow text-black px-2 py-0.5 rounded-full">
                            {items.length}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {items.map((item) => (
                            <div key={item.id} className="bg-sunny-dark rounded-lg p-3 border border-gray-700">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <div className="font-medium text-sm">{item.placementName}</div>
                                  <div className="text-xs text-gray-400">{item.publisherName} • {item.stateName}</div>
                                  {item.flightStart && (
                                    <div className="text-xs text-blue-400">
                                      Flight: {item.flightStart} → {item.flightEnd}
                                    </div>
                                  )}
                                </div>
                                <button
                                  onClick={() => removeFromCart(item.id)}
                                  className="text-gray-500 hover:text-red-400"
                                >
                                  ×
                                </button>
                              </div>
                              <input
                                type="date"
                                value={item.dueDate}
                                onChange={(e) => updateDueDate(item.id, e.target.value)}
                                className="w-full bg-sunny-gray border border-gray-600 rounded px-2 py-1 text-sm"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              
              {cart.length > 0 && (
                <button
                  onClick={handleSave}
                  disabled={saving || !clientName || !campaignName}
                  className="w-full mt-4 bg-sunny-yellow text-black font-semibold py-3 rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50"
                >
                  Create Brief ({cart.length} items)
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-sunny-gray border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Import Schedule</h2>
                <p className="text-sm text-gray-400">Upload a media schedule to auto-populate placements</p>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-gray-400 hover:text-white text-xl"
              >
                ×
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1">
              {/* Channel & Publisher Selection */}
              {parsedPlacements.length === 0 && (
                <div className="space-y-4 mb-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Channel</label>
                      <select
                        value={importChannel}
                        onChange={(e) => {
                          setImportChannel(e.target.value);
                          setImportPublisher('');
                        }}
                        className="w-full bg-sunny-dark border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-sunny-yellow"
                      >
                        <option value="ooh">Out of Home</option>
                        <option value="tv">TV</option>
                        <option value="radio">Radio</option>
                        <option value="digital">Digital</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Publisher</label>
                      <select
                        value={importPublisher}
                        onChange={(e) => setImportPublisher(e.target.value)}
                        className="w-full bg-sunny-dark border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-sunny-yellow"
                      >
                        <option value="">Select publisher...</option>
                        {IMPORT_PUBLISHERS[importChannel]?.map((pub) => (
                          <option key={pub} value={pub}>{pub}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* File Upload */}
                  <input
                    ref={importFileRef}
                    type="file"
                    accept=".xlsx,.xls,.csv,.pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => {
                      if (!importPublisher) {
                        setImportError('Please select a publisher first');
                        return;
                      }
                      importFileRef.current?.click();
                    }}
                    disabled={importing || !importPublisher}
                    className={`w-full border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                      importPublisher 
                        ? 'border-gray-600 hover:border-sunny-yellow cursor-pointer' 
                        : 'border-gray-700 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    {importing ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="animate-spin w-8 h-8 border-2 border-sunny-yellow border-t-transparent rounded-full" />
                        <span className="text-gray-400">Parsing schedule with AI...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <div className="text-3xl">📄</div>
                        <span className="font-medium">Click to upload schedule</span>
                        <span className="text-sm text-gray-400">Supports Excel, CSV, and PDF files</span>
                      </div>
                    )}
                  </button>
                  
                  {importError && (
                    <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-300">
                      {importError}
                    </div>
                  )}
                </div>
              )}

              {/* Parsed Results */}
              {parsedPlacements.length > 0 && (
                <div>
                  {/* Controls */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-400">
                        {selectedImports.size} of {parsedPlacements.length} selected
                      </span>
                      <button
                        onClick={selectAllImports}
                        className="text-sm text-sunny-yellow hover:underline"
                      >
                        Select all
                      </button>
                      <button
                        onClick={deselectAllImports}
                        className="text-sm text-gray-400 hover:underline"
                      >
                        Deselect all
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-400">Due date buffer:</label>
                      <select
                        value={dueDateBuffer}
                        onChange={(e) => updateDueDateBuffer(parseInt(e.target.value))}
                        className="bg-sunny-dark border border-gray-700 rounded px-2 py-1 text-sm"
                      >
                        <option value={3}>3 days before</option>
                        <option value={5}>5 days before</option>
                        <option value={7}>7 days before</option>
                        <option value={10}>10 days before</option>
                        <option value={14}>14 days before</option>
                      </select>
                    </div>
                  </div>

                  {/* Selected channel/publisher badge */}
                  <div className="mb-4 flex gap-2">
                    <span className="text-xs px-2 py-1 bg-blue-900 text-blue-300 rounded-full">
                      {importChannel.toUpperCase()}
                    </span>
                    <span className="text-xs px-2 py-1 bg-gray-700 rounded-full">
                      {importPublisher}
                    </span>
                  </div>

                  {/* Placements List */}
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {parsedPlacements.map((p) => (
                      <div
                        key={p._importId}
                        onClick={() => toggleImportSelection(p._importId)}
                        className={`p-4 rounded-lg border cursor-pointer transition-all ${
                          selectedImports.has(p._importId)
                            ? 'border-sunny-yellow bg-sunny-yellow/10'
                            : 'border-gray-700 hover:border-gray-500'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            selectedImports.has(p._importId)
                              ? 'border-sunny-yellow bg-sunny-yellow'
                              : 'border-gray-600'
                          }`}>
                            {selectedImports.has(p._importId) && (
                              <span className="text-black text-xs">✓</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{p.siteName}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-400">
                              {p.dimensions && <div>📐 {p.dimensions}</div>}
                              {p.spotLength && <div>⏱️ {p.spotLength} sec</div>}
                              {p.daypart && <div>🕐 {p.daypart}</div>}
                              {p.spots && <div>🔢 {p.spots} spots</div>}
                              {p.station && <div>📻 {p.station}</div>}
                              {p.startDate && <div>📅 {p.startDate} → {p.endDate}</div>}
                              {p._calculatedDueDate && <div>⏰ Due: {p._calculatedDueDate}</div>}
                              {(p.location || p.suburb) && <div className="col-span-2">📍 {p.location || `${p.suburb}, ${p.state}`}</div>}
                              {p.restrictions && (
                                <div className="col-span-2 text-amber-400">⚠️ {p.restrictions}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Upload another */}
                  <button
                    onClick={() => {
                      setParsedPlacements([]);
                      setSelectedImports(new Set());
                    }}
                    className="mt-4 text-sm text-gray-400 hover:text-white"
                  >
                    ← Upload different file
                  </button>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            {parsedPlacements.length > 0 && (
              <div className="px-6 py-4 border-t border-gray-700 flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setParsedPlacements([]);
                  }}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={addSelectedToCart}
                  disabled={selectedImports.size === 0}
                  className="bg-sunny-yellow text-black font-semibold px-6 py-2 rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50"
                >
                  Add {selectedImports.size} to Brief
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
