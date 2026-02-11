'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CHANNELS, STATES, SPECS, getPublishers, getPlacements } from '@/lib/specs';

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
  const [dueDateBuffer, setDueDateBuffer] = useState(5); // Days before start date
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
        // Show detailed error with debug info if available
        let errorMsg = data.error || 'Failed to parse schedule';
        if (data.debug?.steps) {
          console.log('Debug steps:', data.debug.steps);
        }
        throw new Error(errorMsg);
      }
      
      if (!data.placements || data.placements.length === 0) {
        throw new Error('No placements found in the document. Check the file contains schedule data.');
      }
      
      // Add unique IDs and calculate due dates
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
    e.target.value = ''; // Reset file input
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
    const itemsToAdd = parsedPlacements
      .filter(p => selectedImports.has(p._importId))
      .map(p => ({
        id: p._importId,
        placementId: `imported-${p.siteName}`,
        channel: p.channel || 'ooh',
        channelName: CHANNELS.find(c => c.id === (p.channel || 'ooh'))?.name || 'Out of Home',
        state: 'imported',
        stateName: p.location ? extractState(p.location) : 'Imported',
        publisher: p.publisher?.toLowerCase().replace(/\s+/g, '-') || 'unknown',
        publisherName: p.publisher || 'Unknown Publisher',
        placementName: p.siteName,
        location: p.location || null,
        format: p.format || 'Digital Billboard',
        specs: {
          dimensions: p.dimensions,
          physicalSize: p.physicalSize,
          fileFormat: p.fileFormat,
          adLength: p.duration ? `${p.duration} seconds` : null,
        },
        notes: p.notes || null,
        restrictions: p.restrictions ? [p.restrictions] : [],
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
  
  function extractState(location) {
    // Try to extract state/region from location string
    const nzCities = ['auckland', 'wellington', 'christchurch', 'hamilton'];
    const lower = location.toLowerCase();
    if (nzCities.some(c => lower.includes(c))) return 'NZ';
    if (lower.includes('nsw') || lower.includes('sydney')) return 'NSW';
    if (lower.includes('vic') || lower.includes('melbourne')) return 'VIC';
    if (lower.includes('qld') || lower.includes('brisbane')) return 'QLD';
    return 'Imported';
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
                    onClick={() => setShowImportModal(true)}
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
                    <h3 className="text-sm font-medium text-gray-400 mb-3">Available Placements ({placements.length})</h3>
                    <div className="space-y-3 max-h-[500px] overflow-y-auto">
                      {placements.map((placement) => {
                        const isInCart = cart.some(i => i.placementId === placement.id && i.publisher === selectedPublisher);
                        return (
                          <div
                            key={placement.id}
                            className="bg-sunny-dark border border-gray-700 rounded-lg p-4"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-medium">{placement.name}</h4>
                                  <span className="text-xs px-2 py-0.5 bg-gray-700 rounded-full text-gray-300">
                                    {placement.format}
                                  </span>
                                </div>
                                {placement.location && (
                                  <div className="text-sm text-gray-400 mb-1">📍 {placement.location}</div>
                                )}
                                <div className="text-sm text-gray-400 space-y-1">
                                  {placement.specs.dimensions && (
                                    <div>📐 {placement.specs.dimensions}</div>
                                  )}
                                  {placement.specs.duration && (
                                    <div>⏱️ {placement.specs.duration}</div>
                                  )}
                                  {placement.specs.fileFormat && (
                                    <div>📁 {placement.specs.fileFormat}</div>
                                  )}
                                </div>
                                {placement.notes && (
                                  <div className="mt-2 text-xs text-amber-400">
                                    ⚠️ {placement.notes}
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => addToCart(placement)}
                                className={`ml-4 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                                  isInCart
                                    ? 'bg-green-600 text-white'
                                    : 'bg-sunny-yellow text-black hover:bg-yellow-400'
                                }`}
                              >
                                {isInCart ? '✓ Added' : '+ Add'}
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
              <div className="bg-sunny-gray border border-gray-700 rounded-xl p-6 sticky top-24 max-h-[calc(100vh-120px)] overflow-y-auto">
                <h3 className="font-semibold mb-4">Brief Summary</h3>
                
                {cart.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-400 text-sm mb-4">No items added yet.</p>
                    <p className="text-gray-500 text-xs">Select placements from the left or import a schedule.</p>
                  </div>
                ) : (
                  <>
                    {/* Bulk due date */}
                    <div className="mb-4 pb-4 border-b border-gray-700">
                      <label className="block text-xs font-medium text-gray-400 mb-2">Set all due dates</label>
                      <input
                        type="date"
                        onChange={(e) => setAllDueDates(e.target.value)}
                        className="w-full bg-sunny-dark border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-sunny-yellow"
                      />
                    </div>

                    {/* Grouped by channel */}
                    <div className="space-y-4">
                      {(() => {
                        const grouped = cart.reduce((acc, item) => {
                          const key = item.channel;
                          if (!acc[key]) acc[key] = { name: item.channelName, items: [] };
                          acc[key].items.push(item);
                          return acc;
                        }, {});

                        return Object.entries(grouped).map(([channelId, group]) => (
                          <div key={channelId} className="border border-gray-700 rounded-lg overflow-hidden">
                            <div className="bg-gray-800 px-3 py-2 flex items-center justify-between">
                              <span className="font-medium text-sm flex items-center gap-2">
                                {channelId === 'tv' && '📺'}
                                {channelId === 'radio' && '📻'}
                                {channelId === 'ooh' && '🏙️'}
                                {channelId === 'digital' && '💻'}
                                {group.name}
                              </span>
                              <span className="text-xs bg-sunny-yellow text-black px-2 py-0.5 rounded-full font-medium">
                                {group.items.length}
                              </span>
                            </div>
                            <div className="p-2 space-y-2">
                              {group.items.map((item) => (
                                <div
                                  key={item.id}
                                  className="bg-sunny-dark border border-gray-700 rounded-lg p-2 text-xs animate-fade-in"
                                >
                                  <div className="flex items-start justify-between mb-1.5">
                                    <div className="flex-1 min-w-0">
                                      <div className="font-medium text-sm truncate" title={item.placementName}>
                                        {item.placementName}
                                      </div>
                                      <div className="text-gray-400 truncate">
                                        {item.publisherName} • {item.stateName}
                                      </div>
                                      {item.flightStart && (
                                        <div className="text-gray-500 text-xs mt-1">
                                          Flight: {item.flightStart} → {item.flightEnd}
                                        </div>
                                      )}
                                    </div>
                                    <button
                                      onClick={() => removeFromCart(item.id)}
                                      className="text-gray-500 hover:text-red-400 transition-colors ml-2 flex-shrink-0"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                  <input
                                    type="date"
                                    value={item.dueDate}
                                    onChange={(e) => updateDueDate(item.id, e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs focus:outline-none focus:border-sunny-yellow"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>

                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="w-full bg-sunny-yellow text-black font-semibold py-3 rounded-lg hover:bg-yellow-400 transition-colors mt-4 disabled:opacity-50"
                    >
                      {saving ? 'Creating...' : `Create Brief (${cart.length} items)`}
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
          <div className="bg-sunny-gray border border-gray-700 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Import Schedule</h2>
                <p className="text-sm text-gray-400">Upload a media schedule (PDF, Excel, CSV) to auto-populate placements</p>
              </div>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setParsedPlacements([]);
                  setImportError(null);
                }}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Upload Area */}
              {parsedPlacements.length === 0 && (
                <div className="mb-6">
                  <input
                    ref={importFileRef}
                    type="file"
                    accept=".pdf,.xlsx,.xls,.csv"
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
                      <div className="flex flex-col items-center gap-3">
                        <div className="text-4xl">📄</div>
                        <span className="text-lg font-medium">Click to upload schedule</span>
                        <span className="text-sm text-gray-400">Supports PDF, Excel (.xlsx), and CSV</span>
                      </div>
                    )}
                  </button>
                  
                  {importError && (
                    <div className="mt-4 p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-300">
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
                              <span className="text-xs px-2 py-0.5 bg-gray-700 rounded-full">
                                {p.publisher || 'Unknown'}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-400">
                              {p.dimensions && <div>📐 {p.dimensions}</div>}
                              {p.physicalSize && <div>📏 {p.physicalSize}</div>}
                              {p.startDate && <div>📅 {p.startDate} → {p.endDate}</div>}
                              {p._calculatedDueDate && <div>⏰ Due: {p._calculatedDueDate}</div>}
                              {p.location && <div className="col-span-2">📍 {p.location}</div>}
                              {p.restrictions && p.restrictions !== 'N/A' && (
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
