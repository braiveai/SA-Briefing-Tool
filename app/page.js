'use client';

import { useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { CHANNELS, STATES, SPECS, getPublishers, getPlacements } from '@/lib/specs';

// Publishers for import
const IMPORT_PUBLISHERS = {
  ooh: ['LUMO', 'JCDecaux', 'QMS', 'oOh!', 'Bishopp', 'GOA', 'Other'],
  tv: ['Seven', 'Nine', 'Ten', 'SBS', 'Foxtel', 'Sky', 'Other'],
  radio: ['ARN', 'SCA', 'Nova', 'ACE Radio', 'Grant Broadcasters', 'Other'],
  digital: ['Google', 'Meta', 'TikTok', 'LinkedIn', 'Spotify', 'Other'],
};

// Channel colors for timeline
const CHANNEL_COLORS = {
  ooh: { bg: 'bg-blue-500', border: 'border-blue-400', light: 'bg-blue-500/20' },
  tv: { bg: 'bg-purple-500', border: 'border-purple-400', light: 'bg-purple-500/20' },
  radio: { bg: 'bg-amber-500', border: 'border-amber-400', light: 'bg-amber-500/20' },
  digital: { bg: 'bg-green-500', border: 'border-green-400', light: 'bg-green-500/20' },
};

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
  
  // Cart - now stores grouped data
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
  
  // Grouping state
  const [groupedPlacements, setGroupedPlacements] = useState([]);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  
  // Get available options based on selections
  const publishers = selectedChannel && selectedState 
    ? getPublishers(selectedChannel, selectedState) 
    : [];
  const placements = selectedChannel && selectedState && selectedPublisher
    ? getPlacements(selectedChannel, selectedState, selectedPublisher)
    : [];

  // ============================================
  // GROUPING LOGIC
  // ============================================
  
  function autoGroupPlacements(placements, channel, publisher) {
    const groups = {};
    
    placements.forEach((p, index) => {
      // Determine the spec key based on channel type
      let specKey;
      let specLabel;
      
      if (channel === 'ooh') {
        specKey = p.dimensions || 'unknown';
        specLabel = p.dimensions || 'Unknown Size';
      } else if (channel === 'radio' || channel === 'tv') {
        specKey = p.spotLength ? `${p.spotLength}s` : 'unknown';
        specLabel = p.spotLength ? `${p.spotLength} seconds` : 'Unknown Duration';
      } else if (channel === 'digital') {
        specKey = p.dimensions || p.format || 'unknown';
        specLabel = p.dimensions || p.format || 'Unknown Format';
      } else {
        specKey = 'default';
        specLabel = 'Mixed';
      }
      
      const groupKey = `${channel}-${specKey}`;
      
      if (!groups[groupKey]) {
        groups[groupKey] = {
          id: groupKey,
          channel: channel,
          channelName: CHANNELS.find(c => c.id === channel)?.name || channel,
          publisher: publisher,
          specs: specKey,
          specLabel: specLabel,
          placements: [],
          minStartDate: null,
          maxEndDate: null,
          earliestDueDate: null,
        };
      }
      
      // Add placement with unique ID and group reference
      const placementWithMeta = {
        ...p,
        _importId: p._importId || `import-${Date.now()}-${index}`,
        _groupId: groupKey,
        _calculatedDueDate: p._calculatedDueDate || calculateDueDate(p.startDate, dueDateBuffer),
      };
      
      groups[groupKey].placements.push(placementWithMeta);
      
      // Update group date ranges
      if (placementWithMeta.startDate) {
        if (!groups[groupKey].minStartDate || placementWithMeta.startDate < groups[groupKey].minStartDate) {
          groups[groupKey].minStartDate = placementWithMeta.startDate;
        }
      }
      if (placementWithMeta.endDate) {
        if (!groups[groupKey].maxEndDate || placementWithMeta.endDate > groups[groupKey].maxEndDate) {
          groups[groupKey].maxEndDate = placementWithMeta.endDate;
        }
      }
      if (placementWithMeta._calculatedDueDate) {
        if (!groups[groupKey].earliestDueDate || placementWithMeta._calculatedDueDate < groups[groupKey].earliestDueDate) {
          groups[groupKey].earliestDueDate = placementWithMeta._calculatedDueDate;
        }
      }
    });
    
    return Object.values(groups);
  }
  
  function markAsDifferentCreative(groupId, placementId) {
    setGroupedPlacements(prev => {
      const newGroups = [...prev];
      const sourceGroupIndex = newGroups.findIndex(g => g.id === groupId);
      if (sourceGroupIndex === -1) return prev;
      
      const sourceGroup = newGroups[sourceGroupIndex];
      const placementIndex = sourceGroup.placements.findIndex(p => p._importId === placementId);
      if (placementIndex === -1) return prev;
      
      // Remove placement from source group
      const [placement] = sourceGroup.placements.splice(placementIndex, 1);
      
      // Create new group ID
      const newGroupId = `${groupId}-split-${Date.now()}`;
      placement._groupId = newGroupId;
      
      // Create new group
      const newGroup = {
        id: newGroupId,
        channel: sourceGroup.channel,
        channelName: sourceGroup.channelName,
        publisher: sourceGroup.publisher,
        specs: sourceGroup.specs,
        specLabel: `${sourceGroup.specLabel} (Alt)`,
        placements: [placement],
        minStartDate: placement.startDate,
        maxEndDate: placement.endDate,
        earliestDueDate: placement._calculatedDueDate,
        isSplit: true,
      };
      
      // Remove source group if empty
      if (sourceGroup.placements.length === 0) {
        newGroups.splice(sourceGroupIndex, 1);
      }
      
      newGroups.push(newGroup);
      return newGroups;
    });
  }
  
  function mergeBackToGroup(splitGroupId, targetGroupId) {
    setGroupedPlacements(prev => {
      const newGroups = [...prev];
      const splitGroupIndex = newGroups.findIndex(g => g.id === splitGroupId);
      const targetGroupIndex = newGroups.findIndex(g => g.id === targetGroupId);
      
      if (splitGroupIndex === -1 || targetGroupIndex === -1) return prev;
      
      const splitGroup = newGroups[splitGroupIndex];
      const targetGroup = newGroups[targetGroupIndex];
      
      // Move all placements back
      splitGroup.placements.forEach(p => {
        p._groupId = targetGroupId;
        targetGroup.placements.push(p);
      });
      
      // Recalculate target group dates
      recalculateGroupDates(targetGroup);
      
      // Remove split group
      newGroups.splice(splitGroupIndex, 1);
      
      return newGroups;
    });
  }
  
  function recalculateGroupDates(group) {
    group.minStartDate = null;
    group.maxEndDate = null;
    group.earliestDueDate = null;
    
    group.placements.forEach(p => {
      if (p.startDate) {
        if (!group.minStartDate || p.startDate < group.minStartDate) {
          group.minStartDate = p.startDate;
        }
      }
      if (p.endDate) {
        if (!group.maxEndDate || p.endDate > group.maxEndDate) {
          group.maxEndDate = p.endDate;
        }
      }
      if (p._calculatedDueDate) {
        if (!group.earliestDueDate || p._calculatedDueDate < group.earliestDueDate) {
          group.earliestDueDate = p._calculatedDueDate;
        }
      }
    });
  }
  
  function toggleGroupExpanded(groupId) {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }

  // ============================================
  // TIMELINE CALCULATIONS
  // ============================================
  
  const timelineData = useMemo(() => {
    const allGroups = groupedPlacements.length > 0 ? groupedPlacements : [];
    if (allGroups.length === 0) return null;
    
    // Find overall date range
    let minDate = null;
    let maxDate = null;
    
    allGroups.forEach(group => {
      if (group.minStartDate) {
        if (!minDate || group.minStartDate < minDate) minDate = group.minStartDate;
      }
      if (group.maxEndDate) {
        if (!maxDate || group.maxEndDate > maxDate) maxDate = group.maxEndDate;
      }
    });
    
    if (!minDate || !maxDate) return null;
    
    // Add some padding (1 week before/after)
    const start = new Date(minDate);
    start.setDate(start.getDate() - 7);
    const end = new Date(maxDate);
    end.setDate(end.getDate() + 7);
    
    const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    
    // Generate month markers
    const months = [];
    const current = new Date(start);
    current.setDate(1);
    while (current <= end) {
      const monthStart = new Date(current);
      const daysFromStart = Math.ceil((monthStart - start) / (1000 * 60 * 60 * 24));
      const position = Math.max(0, (daysFromStart / totalDays) * 100);
      
      months.push({
        label: monthStart.toLocaleDateString('en-AU', { month: 'short', year: '2-digit' }),
        position,
      });
      
      current.setMonth(current.getMonth() + 1);
    }
    
    // Calculate bar positions for each group
    const bars = allGroups.map(group => {
      const groupStart = new Date(group.minStartDate || minDate);
      const groupEnd = new Date(group.maxEndDate || maxDate);
      
      const startDays = Math.ceil((groupStart - start) / (1000 * 60 * 60 * 24));
      const endDays = Math.ceil((groupEnd - start) / (1000 * 60 * 60 * 24));
      
      const left = (startDays / totalDays) * 100;
      const width = ((endDays - startDays) / totalDays) * 100;
      
      return {
        ...group,
        left: Math.max(0, left),
        width: Math.max(2, width), // Minimum 2% width for visibility
      };
    });
    
    return { start, end, totalDays, months, bars };
  }, [groupedPlacements]);

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

  function updateDueDate(itemId, date) {
    setCart(cart.map(i => i.id === itemId ? { ...i, dueDate: date } : i));
  }

  function setAllDueDates(date) {
    setCart(cart.map(i => ({ ...i, dueDate: date })));
  }

  // ============================================
  // IMPORT FUNCTIONS
  // ============================================

  function openImportModal() {
    setShowImportModal(true);
    setImportError(null);
    setImportSuccess(null);
    setParsedPlacements([]);
    setGroupedPlacements([]);
    setSelectedImports(new Set());
    setExpandedGroups(new Set());
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
    setGroupedPlacements([]);
    
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
        throw new Error('No placements found in the document.');
      }
      
      // Set detected values
      const detectedChannel = data.detectedChannel || 'ooh';
      const detectedPublisher = data.detectedPublisher || '';
      setImportChannel(detectedChannel);
      setImportPublisher(detectedPublisher);
      
      // Store raw placements
      setParsedPlacements(data.placements);
      
      // Auto-group the placements
      const groups = autoGroupPlacements(data.placements, detectedChannel, detectedPublisher);
      setGroupedPlacements(groups);
      
      // Select all by default
      setSelectedImports(new Set(data.placements.map(p => p._importId || `import-${Date.now()}-${data.placements.indexOf(p)}`)));
      
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
  
  function updateDueDateBuffer(newBuffer) {
    setDueDateBuffer(newBuffer);
    
    // Recalculate due dates for all grouped placements
    setGroupedPlacements(prev => prev.map(group => {
      const updatedPlacements = group.placements.map(p => ({
        ...p,
        _calculatedDueDate: calculateDueDate(p.startDate, newBuffer),
      }));
      
      // Recalculate earliest due date
      let earliestDueDate = null;
      updatedPlacements.forEach(p => {
        if (p._calculatedDueDate && (!earliestDueDate || p._calculatedDueDate < earliestDueDate)) {
          earliestDueDate = p._calculatedDueDate;
        }
      });
      
      return {
        ...group,
        placements: updatedPlacements,
        earliestDueDate,
      };
    }));
  }
  
  function toggleGroupSelection(groupId) {
    const group = groupedPlacements.find(g => g.id === groupId);
    if (!group) return;
    
    const groupPlacementIds = group.placements.map(p => p._importId);
    const allSelected = groupPlacementIds.every(id => selectedImports.has(id));
    
    setSelectedImports(prev => {
      const next = new Set(prev);
      groupPlacementIds.forEach(id => {
        if (allSelected) {
          next.delete(id);
        } else {
          next.add(id);
        }
      });
      return next;
    });
  }
  
  function togglePlacementSelection(placementId) {
    setSelectedImports(prev => {
      const next = new Set(prev);
      if (next.has(placementId)) {
        next.delete(placementId);
      } else {
        next.add(placementId);
      }
      return next;
    });
  }
  
  function selectAllImports() {
    const allIds = groupedPlacements.flatMap(g => g.placements.map(p => p._importId));
    setSelectedImports(new Set(allIds));
  }
  
  function deselectAllImports() {
    setSelectedImports(new Set());
  }
  
  function addSelectedToCart() {
    // Build cart items from grouped placements
    const itemsToAdd = [];
    
    groupedPlacements.forEach(group => {
      const selectedInGroup = group.placements.filter(p => selectedImports.has(p._importId));
      
      selectedInGroup.forEach(p => {
        itemsToAdd.push({
          id: p._importId,
          placementId: `imported-${p.siteName}`,
          channel: importChannel,
          channelName: group.channelName,
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
          // Group info
          creativeGroupId: p._groupId,
          creativeGroupName: group.specLabel,
        });
      });
    });
    
    setCart([...cart, ...itemsToAdd]);
    setImportSuccess(`Added ${itemsToAdd.length} placement${itemsToAdd.length !== 1 ? 's' : ''} in ${groupedPlacements.filter(g => g.placements.some(p => selectedImports.has(p._importId))).length} creative groups`);
    setParsedPlacements([]);
    setGroupedPlacements([]);
    setSelectedImports(new Set());
    setImportChannel('ooh');
    setImportPublisher('');
    setTimeout(() => setImportSuccess(null), 3000);
  }
  
  function closeImportModal() {
    setShowImportModal(false);
    setParsedPlacements([]);
    setGroupedPlacements([]);
    setSelectedImports(new Set());
    setImportError(null);
    setImportSuccess(null);
  }

  // ============================================
  // SAVE BRIEF
  // ============================================

  async function handleSave() {
    if (!clientName || !campaignName || cart.length === 0) return;
    
    setSaving(true);
    try {
      // Group cart items for saving
      const groups = {};
      cart.forEach(item => {
        const groupId = item.creativeGroupId || `${item.channel}-${item.specs?.dimensions || 'default'}`;
        if (!groups[groupId]) {
          groups[groupId] = {
            id: groupId,
            name: item.creativeGroupName || item.specs?.dimensions || 'Group',
            channel: item.channel,
            channelName: item.channelName,
            specs: item.specs,
            placements: [],
          };
        }
        groups[groupId].placements.push(item);
      });
      
      const res = await fetch('/api/briefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName,
          campaignName,
          items: cart,
          groups: Object.values(groups),
        }),
      });
      const data = await res.json();
      router.push(`/brief/${data.id}`);
    } catch (err) {
      console.error('Failed to save brief:', err);
      setSaving(false);
    }
  }

  // ============================================
  // CART GROUPING FOR DISPLAY
  // ============================================
  
  const cartByGroup = useMemo(() => {
    const groups = {};
    cart.forEach(item => {
      const groupId = item.creativeGroupId || `${item.channel}-${item.specs?.dimensions || 'default'}`;
      if (!groups[groupId]) {
        groups[groupId] = {
          id: groupId,
          name: item.creativeGroupName || item.specs?.dimensions || 'Group',
          channel: item.channel,
          channelName: item.channelName,
          items: [],
          earliestDue: null,
          minStart: null,
          maxEnd: null,
        };
      }
      groups[groupId].items.push(item);
      
      if (item.dueDate && (!groups[groupId].earliestDue || item.dueDate < groups[groupId].earliestDue)) {
        groups[groupId].earliestDue = item.dueDate;
      }
      if (item.flightStart && (!groups[groupId].minStart || item.flightStart < groups[groupId].minStart)) {
        groups[groupId].minStart = item.flightStart;
      }
      if (item.flightEnd && (!groups[groupId].maxEnd || item.flightEnd > groups[groupId].maxEnd)) {
        groups[groupId].maxEnd = item.flightEnd;
      }
    });
    return Object.values(groups);
  }, [cart]);

  // ============================================
  // RENDER
  // ============================================

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

            {/* Right: Cart Summary */}
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
                    {/* Summary stats */}
                    <div className="mb-4 p-3 bg-sunny-dark rounded-lg">
                      <div className="text-2xl font-bold text-sunny-yellow">{cartByGroup.length}</div>
                      <div className="text-sm text-gray-400">unique creatives needed</div>
                      <div className="text-xs text-gray-500 mt-1">{cart.length} total placements</div>
                    </div>
                    
                    {/* Grouped items */}
                    <div className="space-y-3 max-h-[calc(100vh-450px)] overflow-y-auto">
                      {cartByGroup.map((group) => {
                        const colors = CHANNEL_COLORS[group.channel] || CHANNEL_COLORS.ooh;
                        return (
                          <div
                            key={group.id}
                            className={`rounded-lg border ${colors.border} ${colors.light} p-3`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <div className="font-medium text-sm">{group.name}</div>
                                <div className="text-xs text-gray-400">{group.channelName} • {group.items.length} placements</div>
                              </div>
                              <span className={`text-xs px-2 py-1 rounded ${colors.bg} text-white`}>
                                {group.items.length}
                              </span>
                            </div>
                            {group.earliestDue && (
                              <div className="text-xs text-gray-400">
                                Due: {group.earliestDue}
                              </div>
                            )}
                            {group.minStart && group.maxEnd && (
                              <div className="text-xs text-gray-500">
                                Flight: {group.minStart} → {group.maxEnd}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Save button */}
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="w-full mt-4 bg-sunny-yellow text-black font-semibold py-3 rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50"
                    >
                      {saving ? 'Creating Brief...' : `Create Brief (${cartByGroup.length} creatives)`}
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
            <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
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
              {/* Upload Area - shown when no results */}
              {groupedPlacements.length === 0 && (
                <div className="space-y-4">
                  {importSuccess && (
                    <div className="p-4 bg-green-900/30 border border-green-700 rounded-lg text-green-300 flex items-center gap-2">
                      <span>✓</span> {importSuccess}
                    </div>
                  )}
                  
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

              {/* Results - Grouped View with Timeline */}
              {groupedPlacements.length > 0 && (
                <div className="space-y-6">
                  {/* Confirm Channel & Publisher */}
                  <div className="p-4 bg-sunny-dark rounded-lg border border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Confirm details</span>
                        <span className="text-xs text-gray-500">(AI detected)</span>
                      </div>
                      
                      {/* Due date slider - MOVED HERE */}
                      <div className="flex items-center gap-3">
                        <label className="text-sm text-gray-400">Due:</label>
                        <input
                          type="range"
                          min="1"
                          max="21"
                          value={dueDateBuffer}
                          onChange={(e) => updateDueDateBuffer(parseInt(e.target.value))}
                          className="w-24 accent-sunny-yellow"
                        />
                        <span className="text-sm font-medium text-sunny-yellow w-20">
                          {dueDateBuffer}d before
                        </span>
                      </div>
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
                          className="w-full bg-sunny-gray border border-gray-600 rounded-lg px-3 py-2 text-sm"
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
                          className="w-full bg-sunny-gray border border-gray-600 rounded-lg px-3 py-2 text-sm"
                        >
                          <option value="">Select publisher...</option>
                          {IMPORT_PUBLISHERS[importChannel]?.map((pub) => (
                            <option key={pub} value={pub}>{pub}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  
                  {/* Summary */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-2xl font-bold text-sunny-yellow">{groupedPlacements.length}</span>
                      <span className="text-gray-400 ml-2">creative{groupedPlacements.length !== 1 ? 's' : ''} needed</span>
                      <span className="text-gray-500 text-sm ml-2">
                        ({groupedPlacements.reduce((sum, g) => sum + g.placements.length, 0)} placements)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={selectAllImports}
                        className="text-sm text-sunny-yellow hover:underline"
                      >
                        Select all
                      </button>
                      <span className="text-gray-600">|</span>
                      <button
                        onClick={deselectAllImports}
                        className="text-sm text-gray-400 hover:underline"
                      >
                        Deselect all
                      </button>
                    </div>
                  </div>
                  
                  {/* Timeline */}
                  {timelineData && (
                    <div className="bg-sunny-dark rounded-lg p-4 border border-gray-700">
                      <h4 className="text-sm font-medium text-gray-400 mb-3">Flight Plan</h4>
                      
                      {/* Month labels */}
                      <div className="relative h-6 mb-2">
                        {timelineData.months.map((month, i) => (
                          <div
                            key={i}
                            className="absolute text-xs text-gray-500"
                            style={{ left: `${month.position}%` }}
                          >
                            {month.label}
                          </div>
                        ))}
                      </div>
                      
                      {/* Timeline bars */}
                      <div className="space-y-2">
                        {timelineData.bars.map((bar) => {
                          const colors = CHANNEL_COLORS[bar.channel] || CHANNEL_COLORS.ooh;
                          const isSelected = bar.placements.some(p => selectedImports.has(p._importId));
                          
                          return (
                            <div key={bar.id} className="relative h-8">
                              {/* Track */}
                              <div className="absolute inset-0 bg-gray-800 rounded" />
                              
                              {/* Bar */}
                              <div
                                className={`absolute h-full rounded cursor-pointer transition-all ${colors.bg} ${isSelected ? 'opacity-100' : 'opacity-40'}`}
                                style={{ left: `${bar.left}%`, width: `${bar.width}%` }}
                                onClick={() => toggleGroupExpanded(bar.id)}
                              >
                                <div className="px-2 py-1 text-xs text-white truncate">
                                  {bar.specLabel} ({bar.placements.length})
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  {/* Grouped Placements */}
                  <div className="space-y-3">
                    {groupedPlacements.map((group) => {
                      const colors = CHANNEL_COLORS[group.channel] || CHANNEL_COLORS.ooh;
                      const isExpanded = expandedGroups.has(group.id);
                      const selectedCount = group.placements.filter(p => selectedImports.has(p._importId)).length;
                      const allSelected = selectedCount === group.placements.length;
                      
                      return (
                        <div
                          key={group.id}
                          className={`rounded-lg border ${colors.border} overflow-hidden`}
                        >
                          {/* Group Header */}
                          <div
                            className={`p-4 ${colors.light} cursor-pointer`}
                            onClick={() => toggleGroupExpanded(group.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleGroupSelection(group.id);
                                  }}
                                  className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer ${
                                    allSelected
                                      ? 'border-sunny-yellow bg-sunny-yellow'
                                      : selectedCount > 0
                                        ? 'border-sunny-yellow bg-sunny-yellow/50'
                                        : 'border-gray-600'
                                  }`}
                                >
                                  {allSelected && <span className="text-black text-xs">✓</span>}
                                  {!allSelected && selectedCount > 0 && <span className="text-black text-xs">−</span>}
                                </div>
                                
                                <div>
                                  <div className="font-medium">{group.specLabel}</div>
                                  <div className="text-sm text-gray-400">
                                    {group.channelName} • {group.placements.length} placement{group.placements.length !== 1 ? 's' : ''}
                                    {group.isSplit && <span className="ml-2 text-amber-400">(split)</span>}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-4">
                                {group.earliestDueDate && (
                                  <div className="text-sm">
                                    <span className="text-gray-500">Due:</span>
                                    <span className="ml-1 text-white">{group.earliestDueDate}</span>
                                  </div>
                                )}
                                <span className="text-gray-400">{isExpanded ? '▼' : '▶'}</span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Expanded Placements */}
                          {isExpanded && (
                            <div className="border-t border-gray-700 divide-y divide-gray-700">
                              {group.placements.map((p) => {
                                const isSelected = selectedImports.has(p._importId);
                                
                                return (
                                  <div
                                    key={p._importId}
                                    className={`p-3 flex items-center gap-3 ${isSelected ? 'bg-sunny-dark/50' : 'bg-sunny-dark'}`}
                                  >
                                    <div
                                      onClick={() => togglePlacementSelection(p._importId)}
                                      className={`w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer flex-shrink-0 ${
                                        isSelected
                                          ? 'border-sunny-yellow bg-sunny-yellow'
                                          : 'border-gray-600'
                                      }`}
                                    >
                                      {isSelected && <span className="text-black text-xs">✓</span>}
                                    </div>
                                    
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm font-medium truncate">{p.siteName}</div>
                                      <div className="text-xs text-gray-500">
                                        {p.startDate && `${p.startDate} → ${p.endDate}`}
                                        {p.location && ` • ${p.location}`}
                                      </div>
                                    </div>
                                    
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        markAsDifferentCreative(group.id, p._importId);
                                      }}
                                      className="text-xs text-gray-400 hover:text-amber-400 px-2 py-1 rounded hover:bg-gray-700 flex-shrink-0"
                                      title="Mark as different creative"
                                    >
                                      Split ↗
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            {groupedPlacements.length > 0 && (
              <div className="px-6 py-4 border-t border-gray-700 flex items-center justify-between flex-shrink-0">
                <button
                  onClick={() => {
                    setParsedPlacements([]);
                    setGroupedPlacements([]);
                    setSelectedImports(new Set());
                  }}
                  className="text-sm text-gray-400 hover:text-white"
                >
                  ← Upload different file
                </button>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-400">
                    {selectedImports.size} of {groupedPlacements.reduce((sum, g) => sum + g.placements.length, 0)} selected
                  </span>
                  <button
                    onClick={() => {
                      addSelectedToCart();
                    }}
                    disabled={selectedImports.size === 0 || !importPublisher}
                    className="px-4 py-2 border border-sunny-yellow text-sunny-yellow rounded-lg hover:bg-sunny-yellow/10 transition-colors disabled:opacity-50 disabled:border-gray-600 disabled:text-gray-500"
                  >
                    Add & Import More
                  </button>
                  <button
                    onClick={() => {
                      addSelectedToCart();
                      setTimeout(() => closeImportModal(), 100);
                    }}
                    disabled={selectedImports.size === 0 || !importPublisher}
                    className="bg-sunny-yellow text-black font-semibold px-6 py-2 rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:bg-gray-600"
                  >
                    Add & Done
                  </button>
                </div>
              </div>
            )}
            
            {/* Cart count when back at upload */}
            {groupedPlacements.length === 0 && cart.length > 0 && (
              <div className="px-6 py-3 border-t border-gray-700 flex items-center justify-between bg-sunny-dark/50 flex-shrink-0">
                <span className="text-sm text-gray-400">
                  {cart.length} placement{cart.length !== 1 ? 's' : ''} in brief ({cartByGroup.length} creatives)
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
