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
  const [importSuccess, setImportSuccess] = useState(null);
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
    setImportSuccess(null);
    setParsedPlacements([]);
    setSelectedImports(new Set());
    setImportChannel('ooh');
    setImportPublisher('');
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setImporting(true);
    setImportError(null);
    setImportSuccess(null);
    setParsedPlacements([]);
    
    const formData = new FormData();
    formData.append('file', file);
    // Don't send channel/publisher - let AI detect
    
    try {
      const res = await fetch('/api/parse-schedule', {
        method: 'POST',
        body: formData,
      });
      
      const data = await res.json();
      console.log('Parse response:', data);
      
      if (!res.ok) {
        let errorMsg = data.error || 'Failed to parse schedule';
        if (data.debug?.steps) {
          console.log('Debug steps:', data.debug.steps);
        }
        throw new Error(errorMsg);
      }
      
      if (!data.placements || data.placements.length === 0) {
        throw new Error('No placements found in the document. Check the file contains schedule data.');
      }
      
      // Set detected channel/publisher from AI
      const detectedChannel = data.detectedChannel || 'ooh';
      const detectedPublisher = data.detectedPublisher || '';
      setImportChannel(detectedChannel);
      setImportPublisher(detectedPublisher);
      
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
        publisherName: importPublisher || 'Unknown',
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
    // Show success and allow uploading more
    setImportSuccess(`Added ${itemsToAdd.length} placement${itemsToAdd.length !== 1 ? 's' : ''} to brief`);
    setParsedPlacements([]);
    setSelectedImports(new Set());
    // Reset for next upload
    setImportChannel('ooh');
    setImportPublisher('');
    // Clear success after 3 seconds
    setTimeout(() => setImportSuccess(null), 3000);
  }
  
  function updateDueDateBuffer(newBuffer) {
    setDueDateBuffer(newBuffer);
    setParsedPlacements(prev => prev.map(p => ({
      ...p,
      _calculatedDueDate: calculateDueDate(p.startDate, newBuffer),
    })));
  }
  
  function closeImportModal() {
    setShowImportModal(false);
    setParsedPlacements([]);
    setSelectedImports(new Set());
    setImportError(null);
    setImportSuccess(null);
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
          <div className="flex items-center gap-3">
            <span className="text-gray-400">{cart.length} items</span>
            <button
              onClick={handleSave}
              disabled={saving || !clientName || !campaignName || cart.length === 0}
              className="bg-sunny-yellow text-black font-semibold px-5 py-2.5 rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="w-full bg-sunny-yellow text-black font-semibold py-3 rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-6"
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
                    <button
                      onClick={() => setStep(1)}
                      className="text-gray-400 hover:text-white"
                    >
                      ← Details
                    </button>
                    <span className="text-gray-600">/</span>
                    <span className="font-medium">{clientName} - {campaignName}</span>
                  </div>
                  
                  {/* Import Schedule Button */}
                  <button
                    onClick={openImportModal}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
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
                              inCart 
                                ? 'border-green-600 bg-green-900/20' 
                                : 'border-gray-700 hover:border-gray-500'
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
                                className={`ml-4 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
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

            {/* Right: Cart */}
            <div className="col-span-4">
              <div className="bg-sunny-gray border border-gray-700 rounded-xl p-6 sticky top-24">
                <h3 className="font-semibold mb-4">Brief Summary</h3>
                
                {cart.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-400 text-sm mb-4">No items added yet.</p>
                    <p className="text-gray-500 text-xs">Select placements from the left or import a schedule.</p>
                  </div>
                ) : (
                  <>
                    {/* Bulk due date setter */}
                    <div className="mb-4 pb-4 border-b border-gray-700">
                      <label className="block text-xs text-gray-400 mb-2">Set all due dates:</label>
                      <input
                        type="date"
                        onChange={(e) => setAllDueDates(e.target.value)}
                        className="w-full bg-sunny-dark border border-gray-700 rounded px-3 py-2 text-sm"
                      />
                    </div>
                    
                    {/* Cart items grouped by channel */}
                    <div className="space-y-4 max-h-[calc(100vh-400px)] overflow-y-auto">
                      {Object.entries(cartByChannel).map(([channel, items]) => (
                        <div key={channel}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-medium text-gray-300">{channel}</span>
                            <span className="text-xs bg-sunny-yellow text-black px-2 py-0.5 rounded-full">
                              {items.length}
                            </span>
                          </div>
                          <div className="space-y-2">
                            {items.map((item) => (
                              <div
                                key={item.id}
                                className="bg-sunny-dark rounded-lg p-3 border border-gray-700"
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm truncate">{item.placementName}</div>
                                    <div className="text-xs text-gray-400">{item.publisherName}</div>
                                    {item.flightStart && (
                                      <div className="text-xs text-blue-400 mt-1">
                                        Flight: {item.flightStart} → {item.flightEnd}
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => removeFromCart(item.id)}
                                    className="text-gray-500 hover:text-red-400 ml-2"
                                  >
                                    ×
                                  </button>
                                </div>
                                <input
                                  type="date"
                                  value={item.dueDate}
                                  onChange={(e) => updateDueDate(item.id, e.target.value)}
                                  placeholder="Due date"
                                  className="w-full bg-sunny-gray border border-gray-600 rounded px-2 py-1 text-xs"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Save button */}
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="w-full mt-4 bg-sunny-yellow text-black font-semibold py-3 rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50"
                    >
                      {saving ? 'Creating Brief...' : `Create Brief (${cart.length} items)`}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Import Schedule Modal */}
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
                onClick={closeImportModal}
                className="text-gray-400 hover:text-white text-xl"
              >
                ×
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1">
              {/* Upload Area - shown when no parsed placements */}
              {parsedPlacements.length === 0 && (
                <div className="space-y-4">
                  {/* Success message */}
                  {importSuccess && (
                    <div className="p-4 bg-green-900/30 border border-green-700 rounded-lg text-green-300 flex items-center gap-2">
                      <span>✓</span> {importSuccess}
                    </div>
                  )}
                  
                  {/* Due date buffer slider */}
                  <div className="flex items-center justify-between p-4 bg-sunny-dark rounded-lg">
                    <label className="text-sm text-gray-400">Creative deadline:</label>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">1</span>
                      <input
                        type="range"
                        min="1"
                        max="21"
                        value={dueDateBuffer}
                        onChange={(e) => setDueDateBuffer(parseInt(e.target.value))}
                        className="w-32 accent-sunny-yellow"
                      />
                      <span className="text-xs text-gray-500">21</span>
                      <span className="text-sm font-medium text-sunny-yellow w-24 text-right">
                        {dueDateBuffer} day{dueDateBuffer !== 1 ? 's' : ''} before
                      </span>
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
                    onClick={() => importFileRef.current?.click()}
                    disabled={importing}
                    className="w-full border-2 border-dashed border-gray-600 rounded-xl p-12 text-center hover:border-sunny-yellow transition-colors disabled:opacity-50"
                  >
                    {importing ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="animate-spin w-8 h-8 border-2 border-sunny-yellow border-t-transparent rounded-full" />
                        <span className="text-gray-400">Parsing schedule with AI...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <div className="text-4xl">📄</div>
                        <span className="text-lg font-medium">Click to upload schedule</span>
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

              {/* Parsed Results - shown after upload */}
              {parsedPlacements.length > 0 && (
                <div>
                  {/* Confirm Channel & Publisher */}
                  <div className="mb-6 p-4 bg-sunny-dark rounded-lg border border-gray-700">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm font-medium">Confirm details</span>
                      <span className="text-xs text-gray-500">(AI detected, adjust if needed)</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Channel</label>
                        <select
                          value={importChannel}
                          onChange={(e) => {
                            setImportChannel(e.target.value);
                            setImportPublisher('');
                          }}
                          className="w-full bg-sunny-gray border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sunny-yellow"
                        >
                          <option value="ooh">Out of Home</option>
                          <option value="tv">TV</option>
                          <option value="radio">Radio</option>
                          <option value="digital">Digital</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Publisher</label>
                        <select
                          value={importPublisher}
                          onChange={(e) => setImportPublisher(e.target.value)}
                          className="w-full bg-sunny-gray border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sunny-yellow"
                        >
                          <option value="">Select publisher...</option>
                          {IMPORT_PUBLISHERS[importChannel]?.map((pub) => (
                            <option key={pub} value={pub}>{pub}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  
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
                    <div className="flex items-center gap-3">
                      <label className="text-sm text-gray-400">Due date:</label>
                      <input
                        type="range"
                        min="1"
                        max="21"
                        value={dueDateBuffer}
                        onChange={(e) => updateDueDateBuffer(parseInt(e.target.value))}
                        className="w-24 accent-sunny-yellow"
                      />
                      <span className="text-sm font-medium text-sunny-yellow w-20">
                        {dueDateBuffer} day{dueDateBuffer !== 1 ? 's' : ''} before
                      </span>
                    </div>
                  </div>

                  {/* Placements List */}
                  <div className="space-y-2 max-h-[350px] overflow-y-auto">
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
                </div>
              )}
            </div>

            {/* Modal Footer */}
            {parsedPlacements.length > 0 && (
              <div className="px-6 py-4 border-t border-gray-700 flex items-center justify-between">
                <button
                  onClick={() => {
                    setParsedPlacements([]);
                    setSelectedImports(new Set());
                  }}
                  className="text-sm text-gray-400 hover:text-white"
                >
                  ← Upload different file
                </button>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      addSelectedToCart();
                    }}
                    disabled={selectedImports.size === 0 || !importPublisher}
                    className="px-4 py-2 border border-sunny-yellow text-sunny-yellow rounded-lg hover:bg-sunny-yellow/10 transition-colors disabled:opacity-50 disabled:border-gray-600 disabled:text-gray-500"
                  >
                    Add & Upload More
                  </button>
                  <button
                    onClick={() => {
                      addSelectedToCart();
                      setTimeout(() => closeImportModal(), 100);
                    }}
                    disabled={selectedImports.size === 0 || !importPublisher}
                    className="bg-sunny-yellow text-black font-semibold px-6 py-2 rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:bg-gray-600"
                  >
                    Add {selectedImports.size} & Done
                  </button>
                </div>
              </div>
            )}
            
            {/* Show cart count in modal when items added */}
            {parsedPlacements.length === 0 && cart.length > 0 && (
              <div className="px-6 py-3 border-t border-gray-700 flex items-center justify-between bg-sunny-dark/50">
                <span className="text-sm text-gray-400">
                  {cart.length} item{cart.length !== 1 ? 's' : ''} in brief
                </span>
                <button
                  onClick={closeImportModal}
                  className="text-sunny-yellow hover:underline text-sm"
                >
                  Done importing
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
