'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';

// Channel colors
const CHANNEL_COLORS = {
  ooh: { bg: 'bg-blue-500', border: 'border-blue-400', light: 'bg-blue-500/20', text: 'text-blue-400' },
  tv: { bg: 'bg-purple-500', border: 'border-purple-400', light: 'bg-purple-500/20', text: 'text-purple-400' },
  radio: { bg: 'bg-amber-500', border: 'border-amber-400', light: 'bg-amber-500/20', text: 'text-amber-400' },
  digital: { bg: 'bg-green-500', border: 'border-green-400', light: 'bg-green-500/20', text: 'text-green-400' },
};

// Status colors and labels
const STATUS_CONFIG = {
  briefed: { label: 'Briefed', color: 'bg-gray-500', icon: '📋' },
  in_progress: { label: 'In Progress', color: 'bg-blue-500', icon: '🎨' },
  review: { label: 'In Review', color: 'bg-amber-500', icon: '👀' },
  approved: { label: 'Approved', color: 'bg-green-500', icon: '✅' },
  delivered: { label: 'Delivered', color: 'bg-purple-500', icon: '🚀' },
};

export default function BriefPage() {
  const params = useParams();
  const router = useRouter();
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [copySuccess, setCopySuccess] = useState(false);

  const briefId = params.briefId || briefId;

  useEffect(() => {
    async function loadBrief() {
      try {
        const res = await fetch(`/api/brief/${briefId}`);
        if (!res.ok) throw new Error('Brief not found');
        const data = await res.json();
        setBrief(data);
        
        // Expand first group by default
        if (data.groups && data.groups.length > 0) {
          setExpandedGroups(new Set([data.groups[0].id]));
        }
      } catch (err) {
        console.error('Failed to load brief:', err);
      }
      setLoading(false);
    }
    loadBrief();
  }, [briefId]);

  // Group items if not already grouped
  const groups = useMemo(() => {
    if (!brief) return [];
    
    // If brief has groups, use those
    if (brief.groups && brief.groups.length > 0) {
      return brief.groups;
    }
    
    // Otherwise, group items by specs
    const grouped = {};
    (brief.items || []).forEach(item => {
      const groupId = item.creativeGroupId || `${item.channel}-${item.specs?.dimensions || 'default'}`;
      if (!grouped[groupId]) {
        grouped[groupId] = {
          id: groupId,
          name: item.creativeGroupName || item.specs?.dimensions || 'Group',
          channel: item.channel,
          channelName: item.channelName,
          placements: [],
          earliestDue: null,
          minStart: null,
          maxEnd: null,
          status: 'briefed',
        };
      }
      grouped[groupId].placements.push(item);
      
      // Update dates
      if (item.dueDate && (!grouped[groupId].earliestDue || item.dueDate < grouped[groupId].earliestDue)) {
        grouped[groupId].earliestDue = item.dueDate;
      }
      if (item.flightStart && (!grouped[groupId].minStart || item.flightStart < grouped[groupId].minStart)) {
        grouped[groupId].minStart = item.flightStart;
      }
      if (item.flightEnd && (!grouped[groupId].maxEnd || item.flightEnd > grouped[groupId].maxEnd)) {
        grouped[groupId].maxEnd = item.flightEnd;
      }
    });
    
    return Object.values(grouped);
  }, [brief]);

  // Timeline calculations
  const timelineData = useMemo(() => {
    if (groups.length === 0) return null;
    
    let minDate = null;
    let maxDate = null;
    
    groups.forEach(group => {
      const start = group.minStart || (group.placements?.[0]?.flightStart);
      const end = group.maxEnd || (group.placements?.[0]?.flightEnd);
      
      if (start && (!minDate || start < minDate)) minDate = start;
      if (end && (!maxDate || end > maxDate)) maxDate = end;
    });
    
    if (!minDate || !maxDate) return null;
    
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
    
    // Calculate bar positions
    const bars = groups.map(group => {
      const groupStart = new Date(group.minStart || minDate);
      const groupEnd = new Date(group.maxEnd || maxDate);
      
      const startDays = Math.ceil((groupStart - start) / (1000 * 60 * 60 * 24));
      const endDays = Math.ceil((groupEnd - start) / (1000 * 60 * 60 * 24));
      
      const left = (startDays / totalDays) * 100;
      const width = ((endDays - startDays) / totalDays) * 100;
      
      return {
        ...group,
        left: Math.max(0, left),
        width: Math.max(3, width),
      };
    });
    
    return { start, end, totalDays, months, bars };
  }, [groups]);

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

  async function updateGroupStatus(groupId, newStatus) {
    // Optimistic update
    setBrief(prev => ({
      ...prev,
      groups: prev.groups?.map(g => 
        g.id === groupId ? { ...g, status: newStatus } : g
      ),
    }));
    
    // TODO: Save to API
    try {
      await fetch(`/api/brief/${briefId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId,
          status: newStatus,
        }),
      });
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  }

  function copyClientLink() {
    const clientUrl = `${window.location.origin}/brief/${briefId}/client`;
    navigator.clipboard.writeText(clientUrl);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  }

  function getDueDateStatus(dueDate) {
    if (!dueDate) return null;
    
    const today = new Date();
    const due = new Date(dueDate);
    const daysUntil = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
    
    if (daysUntil < 0) return { label: 'Overdue', class: 'text-red-400 bg-red-400/20' };
    if (daysUntil <= 3) return { label: `${daysUntil}d left`, class: 'text-amber-400 bg-amber-400/20' };
    if (daysUntil <= 7) return { label: `${daysUntil}d left`, class: 'text-yellow-400 bg-yellow-400/20' };
    return { label: `${daysUntil}d left`, class: 'text-green-400 bg-green-400/20' };
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-sunny-dark flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-sunny-yellow border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!brief) {
    return (
      <div className="min-h-screen bg-sunny-dark flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-4">Brief not found</h1>
          <button
            onClick={() => router.push('/')}
            className="text-sunny-yellow hover:underline"
          >
            ← Back to home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sunny-dark">
      {/* Header */}
      <header className="border-b border-gray-800 bg-sunny-gray sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => router.push('/')}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ← Back
              </button>
              <div>
                <h1 className="text-xl font-semibold">{brief.clientName}</h1>
                <p className="text-sm text-gray-400">{brief.campaignName}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={copyClientLink}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  copySuccess 
                    ? 'bg-green-600 text-white' 
                    : 'bg-sunny-dark border border-gray-600 hover:border-gray-500'
                }`}
              >
                {copySuccess ? '✓ Copied!' : '🔗 Copy Client Link'}
              </button>
              <button
                onClick={() => router.push(`/brief/${briefId}/client`)}
                className="px-4 py-2 bg-sunny-yellow text-black rounded-lg text-sm font-semibold hover:bg-yellow-400 transition-colors"
              >
                View as Client →
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-sunny-gray border border-gray-700 rounded-xl p-4">
            <div className="text-3xl font-bold text-sunny-yellow">{groups.length}</div>
            <div className="text-sm text-gray-400">Unique Creatives</div>
          </div>
          <div className="bg-sunny-gray border border-gray-700 rounded-xl p-4">
            <div className="text-3xl font-bold">{brief.items?.length || 0}</div>
            <div className="text-sm text-gray-400">Total Placements</div>
          </div>
          <div className="bg-sunny-gray border border-gray-700 rounded-xl p-4">
            <div className="text-3xl font-bold text-green-400">
              {groups.filter(g => g.status === 'approved' || g.status === 'delivered').length}
            </div>
            <div className="text-sm text-gray-400">Completed</div>
          </div>
          <div className="bg-sunny-gray border border-gray-700 rounded-xl p-4">
            <div className="text-3xl font-bold text-amber-400">
              {groups.filter(g => {
                const status = getDueDateStatus(g.earliestDue);
                return status && (status.label === 'Overdue' || status.label.includes('3d') || status.label.includes('2d') || status.label.includes('1d'));
              }).length}
            </div>
            <div className="text-sm text-gray-400">Due Soon</div>
          </div>
        </div>

        {/* Timeline */}
        {timelineData && (
          <div className="bg-sunny-gray border border-gray-700 rounded-xl p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">Flight Plan</h2>
            
            {/* Month labels */}
            <div className="relative h-6 mb-2 ml-48">
              {timelineData.months.map((month, i) => (
                <div
                  key={i}
                  className="absolute text-xs text-gray-500 transform -translate-x-1/2"
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
                const statusConfig = STATUS_CONFIG[bar.status || 'briefed'];
                
                return (
                  <div key={bar.id} className="flex items-center gap-4">
                    {/* Label */}
                    <div className="w-44 flex-shrink-0">
                      <div className="text-sm font-medium truncate">{bar.name}</div>
                      <div className="text-xs text-gray-500">
                        {bar.placements?.length || 0} placements
                      </div>
                    </div>
                    
                    {/* Track */}
                    <div className="flex-1 relative h-10">
                      <div className="absolute inset-0 bg-gray-800 rounded" />
                      
                      {/* Bar */}
                      <div
                        className={`absolute h-full rounded cursor-pointer transition-all hover:brightness-110 ${colors.bg}`}
                        style={{ left: `${bar.left}%`, width: `${bar.width}%` }}
                        onClick={() => toggleGroupExpanded(bar.id)}
                      >
                        <div className="px-2 py-1 text-xs text-white flex items-center justify-between h-full">
                          <span className="truncate">{bar.name}</span>
                          <span className="ml-1">{statusConfig.icon}</span>
                        </div>
                      </div>
                      
                      {/* Due date marker */}
                      {bar.earliestDue && (
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-red-500"
                          style={{
                            left: `${((new Date(bar.earliestDue) - timelineData.start) / (1000 * 60 * 60 * 24) / timelineData.totalDays) * 100}%`
                          }}
                          title={`Due: ${bar.earliestDue}`}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Legend */}
            <div className="flex items-center gap-6 mt-4 pt-4 border-t border-gray-700">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-blue-500" />
                <span className="text-xs text-gray-400">OOH</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-purple-500" />
                <span className="text-xs text-gray-400">TV</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-amber-500" />
                <span className="text-xs text-gray-400">Radio</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-green-500" />
                <span className="text-xs text-gray-400">Digital</span>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <div className="w-0.5 h-4 bg-red-500" />
                <span className="text-xs text-gray-400">Due date</span>
              </div>
            </div>
          </div>
        )}

        {/* Creative Groups */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Creative Requirements</h2>
          
          {groups.map((group) => {
            const colors = CHANNEL_COLORS[group.channel] || CHANNEL_COLORS.ooh;
            const isExpanded = expandedGroups.has(group.id);
            const statusConfig = STATUS_CONFIG[group.status || 'briefed'];
            const dueStatus = getDueDateStatus(group.earliestDue);
            
            return (
              <div
                key={group.id}
                className={`rounded-xl border ${colors.border} overflow-hidden`}
              >
                {/* Group Header */}
                <div
                  className={`p-4 ${colors.light} cursor-pointer`}
                  onClick={() => toggleGroupExpanded(group.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center text-white font-bold`}>
                        {group.placements?.length || 0}
                      </div>
                      
                      <div>
                        <div className="font-semibold text-lg">{group.name}</div>
                        <div className="text-sm text-gray-400">
                          {group.channelName} • {group.placements?.length || 0} placement{(group.placements?.length || 0) !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      {dueStatus && (
                        <span className={`text-xs px-2 py-1 rounded ${dueStatus.class}`}>
                          {dueStatus.label}
                        </span>
                      )}
                      
                      {group.earliestDue && (
                        <div className="text-sm text-right">
                          <div className="text-gray-500">Due</div>
                          <div className="font-medium">{group.earliestDue}</div>
                        </div>
                      )}
                      
                      {/* Status dropdown */}
                      <select
                        value={group.status || 'briefed'}
                        onChange={(e) => {
                          e.stopPropagation();
                          updateGroupStatus(group.id, e.target.value);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className={`px-3 py-1 rounded-lg text-sm font-medium ${statusConfig.color} text-white border-0 cursor-pointer`}
                      >
                        {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                          <option key={key} value={key}>{config.icon} {config.label}</option>
                        ))}
                      </select>
                      
                      <span className="text-gray-400 ml-2">{isExpanded ? '▼' : '▶'}</span>
                    </div>
                  </div>
                </div>
                
                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-gray-700">
                    {/* Specs summary */}
                    <div className="p-4 bg-sunny-dark/50 grid grid-cols-3 gap-4">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Specs</div>
                        <div className="font-medium">{group.name}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Flight</div>
                        <div className="font-medium">
                          {group.minStart || '—'} → {group.maxEnd || '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Publisher</div>
                        <div className="font-medium">
                          {group.placements?.[0]?.publisherName || '—'}
                        </div>
                      </div>
                    </div>
                    
                    {/* Upload section */}
                    <div className="p-4 border-t border-gray-700 bg-sunny-dark/30">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium">Creative Upload</h4>
                        <span className="text-xs text-gray-500">Upload one file for all {group.placements?.length} placements</span>
                      </div>
                      
                      <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center hover:border-sunny-yellow transition-colors cursor-pointer">
                        <div className="text-2xl mb-2">📁</div>
                        <div className="text-sm font-medium">Drop file here or click to upload</div>
                        <div className="text-xs text-gray-500 mt-1">or upload individually below</div>
                      </div>
                    </div>
                    
                    {/* Placements list */}
                    <div className="divide-y divide-gray-700">
                      {(group.placements || []).map((item, idx) => (
                        <div key={item.id || idx} className="p-4 flex items-center gap-4 hover:bg-sunny-dark/30">
                          <div className="w-8 h-8 rounded bg-gray-700 flex items-center justify-center text-xs text-gray-400">
                            {idx + 1}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{item.placementName}</div>
                            <div className="text-sm text-gray-500">
                              {item.location || item.stateName}
                              {item.flightStart && ` • ${item.flightStart} → ${item.flightEnd}`}
                            </div>
                          </div>
                          
                          {item.restrictions && item.restrictions.length > 0 && (
                            <div className="text-xs text-amber-400 px-2 py-1 bg-amber-400/20 rounded">
                              ⚠️ Restrictions
                            </div>
                          )}
                          
                          <div className="text-sm text-gray-400">
                            Due: {item.dueDate || '—'}
                          </div>
                          
                          <button className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-700">
                            Upload ↗
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
