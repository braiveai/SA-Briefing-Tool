'use client';

import { useState } from 'react';
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
                <div className="flex items-center gap-2 mb-6">
                  <button
                    onClick={() => setStep(1)}
                    className="text-gray-400 hover:text-white"
                  >
                    ← Details
                  </button>
                  <span className="text-gray-600">/</span>
                  <span className="font-medium">{clientName} - {campaignName}</span>
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
                  <p className="text-gray-400 text-sm">No items added yet. Select placements from the left.</p>
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
    </div>
  );
}
