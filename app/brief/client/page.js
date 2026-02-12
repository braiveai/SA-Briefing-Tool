'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';

// Channel colors
const CHANNEL_COLORS = {
  ooh: { bg: 'bg-blue-500', border: 'border-blue-400', light: 'bg-blue-500/10' },
  tv: { bg: 'bg-purple-500', border: 'border-purple-400', light: 'bg-purple-500/10' },
  radio: { bg: 'bg-amber-500', border: 'border-amber-400', light: 'bg-amber-500/10' },
  digital: { bg: 'bg-green-500', border: 'border-green-400', light: 'bg-green-500/10' },
};

const CHANNEL_ICONS = {
  ooh: '🏙️',
  tv: '📺',
  radio: '📻',
  digital: '💻',
};

export default function ClientBriefPage() {
  const params = useParams();
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [uploadingGroup, setUploadingGroup] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const fileInputRefs = useRef({});
  
  const briefId = params.briefId || params.id;

  useEffect(() => {
    async function loadBrief() {
      try {
        const res = await fetch(`/api/brief/${briefId}`);
        if (!res.ok) throw new Error('Brief not found');
        const data = await res.json();
        setBrief(data);
        
        // Expand all groups by default for client view
        if (data.groups) {
          setExpandedGroups(new Set(data.groups.map(g => g.id)));
        }
      } catch (err) {
        console.error('Failed to load brief:', err);
      }
      setLoading(false);
    }
    loadBrief();
  }, [params.id]);

  // Group items if not already grouped
  const groups = brief?.groups || [];
  
  // Recompute groups from items if needed
  const computedGroups = groups.length > 0 ? groups : (() => {
    const grouped = {};
    (brief?.items || []).forEach(item => {
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
        };
      }
      grouped[groupId].placements.push(item);
      
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
  })();

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

  function getDaysUntil(dateStr) {
    if (!dateStr) return null;
    const today = new Date();
    const date = new Date(dateStr);
    return Math.ceil((date - today) / (1000 * 60 * 60 * 24));
  }

  function getDueBadge(dateStr) {
    const days = getDaysUntil(dateStr);
    if (days === null) return null;
    
    if (days < 0) {
      return { text: 'OVERDUE', class: 'bg-red-500 text-white' };
    } else if (days === 0) {
      return { text: 'DUE TODAY', class: 'bg-red-500 text-white' };
    } else if (days <= 3) {
      return { text: `${days} day${days !== 1 ? 's' : ''} left`, class: 'bg-amber-500 text-white' };
    } else if (days <= 7) {
      return { text: `${days} days left`, class: 'bg-yellow-500 text-black' };
    }
    return { text: `${days} days left`, class: 'bg-gray-600 text-white' };
  }

  async function handleFileUpload(groupId, file) {
    if (!file) return;
    
    setUploadingGroup(groupId);
    
    // Simulate upload - in production, this would upload to storage
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setUploadingGroup(null);
    setUploadSuccess(groupId);
    setTimeout(() => setUploadSuccess(null), 3000);
    
    // TODO: Actually upload file and update brief
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!brief) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">Brief not found</h1>
          <p className="text-gray-500">This link may have expired or the brief may have been removed.</p>
        </div>
      </div>
    );
  }

  // Calculate overall earliest due date
  const overallEarliestDue = computedGroups.reduce((earliest, group) => {
    if (!group.earliestDue) return earliest;
    if (!earliest || group.earliestDue < earliest) return group.earliestDue;
    return earliest;
  }, null);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm text-gray-500 mb-1">Creative Brief</div>
              <h1 className="text-2xl font-bold text-gray-900">{brief.clientName}</h1>
              <p className="text-gray-600">{brief.campaignName}</p>
            </div>
            
            <div className="text-right">
              <div className="text-sm text-gray-500">Prepared by</div>
              <div className="font-semibold text-gray-900">Sunny Advertising</div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Summary Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="grid grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600">{computedGroups.length}</div>
              <div className="text-sm text-gray-500 mt-1">Creatives Needed</div>
            </div>
            <div className="text-center border-l border-r border-gray-200">
              <div className="text-4xl font-bold text-gray-900">{brief.items?.length || 0}</div>
              <div className="text-sm text-gray-500 mt-1">Total Placements</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-amber-600">
                {overallEarliestDue ? getDaysUntil(overallEarliestDue) : '—'}
              </div>
              <div className="text-sm text-gray-500 mt-1">Days to First Deadline</div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-8">
          <div className="flex gap-3">
            <div className="text-2xl">💡</div>
            <div>
              <div className="font-medium text-blue-900">How this works</div>
              <p className="text-sm text-blue-700 mt-1">
                Below are the creative assets needed for your campaign. Each card shows the specifications 
                and which placements it covers. You can upload one file per card, or expand to upload 
                different files for individual placements.
              </p>
            </div>
          </div>
        </div>

        {/* Creative Groups */}
        <div className="space-y-6">
          {computedGroups.map((group) => {
            const colors = CHANNEL_COLORS[group.channel] || CHANNEL_COLORS.ooh;
            const icon = CHANNEL_ICONS[group.channel] || '📄';
            const isExpanded = expandedGroups.has(group.id);
            const dueBadge = getDueBadge(group.earliestDue);
            const isUploading = uploadingGroup === group.id;
            const justUploaded = uploadSuccess === group.id;
            
            return (
              <div
                key={group.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden"
              >
                {/* Card Header */}
                <div className={`p-6 ${colors.light}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl ${colors.bg} flex items-center justify-center text-2xl text-white`}>
                        {icon}
                      </div>
                      
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="text-xl font-bold text-gray-900">{group.name}</h3>
                          {dueBadge && (
                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${dueBadge.class}`}>
                              {dueBadge.text}
                            </span>
                          )}
                        </div>
                        <div className="text-gray-600 mt-1">
                          {group.channelName} • {group.placements?.length || 0} placement{(group.placements?.length || 0) !== 1 ? 's' : ''}
                        </div>
                        
                        <div className="flex items-center gap-4 mt-3 text-sm">
                          <div>
                            <span className="text-gray-500">Due:</span>
                            <span className="ml-1 font-medium text-gray-900">{group.earliestDue || 'TBD'}</span>
                          </div>
                          {group.minStart && (
                            <div>
                              <span className="text-gray-500">Flight:</span>
                              <span className="ml-1 font-medium text-gray-900">{group.minStart} → {group.maxEnd}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => toggleGroupExpanded(group.id)}
                      className="text-gray-400 hover:text-gray-600 p-2"
                    >
                      {isExpanded ? '▼' : '▶'}
                    </button>
                  </div>
                </div>
                
                {/* Upload Section */}
                <div className="p-6 border-t border-gray-100">
                  <input
                    ref={(el) => fileInputRefs.current[group.id] = el}
                    type="file"
                    className="hidden"
                    onChange={(e) => handleFileUpload(group.id, e.target.files?.[0])}
                  />
                  
                  {justUploaded ? (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                      <div className="text-3xl mb-2">✅</div>
                      <div className="font-medium text-green-800">Upload successful!</div>
                      <div className="text-sm text-green-600 mt-1">Your creative has been received.</div>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileInputRefs.current[group.id]?.click()}
                      disabled={isUploading}
                      className={`w-full border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                        isUploading
                          ? 'border-gray-300 bg-gray-50'
                          : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                      }`}
                    >
                      {isUploading ? (
                        <div className="flex flex-col items-center gap-2">
                          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
                          <div className="text-gray-500">Uploading...</div>
                        </div>
                      ) : (
                        <>
                          <div className="text-3xl mb-2">📤</div>
                          <div className="font-medium text-gray-700">Upload creative for all {group.placements?.length} placements</div>
                          <div className="text-sm text-gray-500 mt-1">or expand below to upload individually</div>
                        </>
                      )}
                    </button>
                  )}
                </div>
                
                {/* Expanded Placements */}
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    <div className="px-6 py-3 bg-gray-50 text-sm font-medium text-gray-500">
                      Individual Placements
                    </div>
                    
                    <div className="divide-y divide-gray-100">
                      {(group.placements || []).map((item, idx) => (
                        <div key={item.id || idx} className="px-6 py-4 flex items-center gap-4">
                          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-sm font-medium text-gray-500">
                            {idx + 1}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 truncate">{item.placementName}</div>
                            <div className="text-sm text-gray-500">
                              {item.location || item.stateName}
                              {item.flightStart && ` • ${item.flightStart} → ${item.flightEnd}`}
                            </div>
                          </div>
                          
                          {item.restrictions && item.restrictions.length > 0 && (
                            <div className="flex-shrink-0" title={item.restrictions.join(', ')}>
                              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
                                ⚠️ Restrictions
                              </span>
                            </div>
                          )}
                          
                          <div className="flex-shrink-0 text-sm text-gray-500">
                            Due: {item.dueDate || '—'}
                          </div>
                          
                          <button className="flex-shrink-0 text-sm text-blue-600 hover:text-blue-800 font-medium px-3 py-1 rounded-lg hover:bg-blue-50">
                            Upload
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

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-gray-200 text-center">
          <div className="text-sm text-gray-500">
            Questions about this brief? Contact your account manager.
          </div>
          <div className="mt-4">
            <span className="text-xs text-gray-400">Powered by</span>
            <span className="ml-1 text-xs font-semibold text-gray-600">Sunny Advertising</span>
          </div>
        </div>
      </div>
    </div>
  );
}
