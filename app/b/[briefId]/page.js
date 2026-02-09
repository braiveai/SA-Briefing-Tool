'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { STATUSES } from '@/lib/specs';

export default function ClientBriefView() {
  const params = useParams();
  const briefId = params.briefId;
  
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadingItemId, setUploadingItemId] = useState(null);
  const [expandedItem, setExpandedItem] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadBrief();
  }, [briefId]);

  async function loadBrief() {
    try {
      const res = await fetch(`/api/brief/${briefId}`);
      const data = await res.json();
      setBrief(data);
    } catch (err) {
      console.error('Failed to load brief:', err);
    }
    setLoading(false);
  }

  function handleUploadClick(itemId) {
    setUploadingItemId(itemId);
    fileInputRef.current?.click();
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file || !uploadingItemId) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('briefId', briefId);
    formData.append('itemId', uploadingItemId);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      
      // Update local state
      setBrief(prev => ({
        ...prev,
        items: prev.items.map(item => 
          item.id === uploadingItemId 
            ? { ...item, uploadedFile: data.file, status: 'received' }
            : item
        ),
      }));
    } catch (err) {
      console.error('Upload failed:', err);
    }
    
    setUploadingItemId(null);
    e.target.value = '';
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
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="text-2xl font-semibold mb-2">Brief not found</h2>
          <p className="text-gray-400">This link may be invalid or expired.</p>
        </div>
      </div>
    );
  }

  // Group items by channel
  const groupedItems = brief.items.reduce((acc, item) => {
    const channel = item.channelName || 'Other';
    if (!acc[channel]) acc[channel] = [];
    acc[channel].push(item);
    return acc;
  }, {});

  const progress = {
    total: brief.items.length,
    uploaded: brief.items.filter(i => i.uploadedFile).length,
  };

  return (
    <div className="min-h-screen bg-sunny-dark">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
      />

      {/* Header */}
      <header className="border-b border-gray-800 bg-sunny-gray">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-center justify-center mb-4">
            <img src="/sunny-logo.png" alt="Sunny Advertising" className="h-8" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-semibold mb-1">{brief.campaignName}</h1>
            <p className="text-gray-400">Creative Brief for {brief.clientName}</p>
          </div>
          
          {/* Progress */}
          <div className="mt-6 max-w-md mx-auto">
            <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
              <span>Creative Uploaded</span>
              <span>{progress.uploaded} / {progress.total}</span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-sunny-yellow transition-all duration-500"
                style={{ width: `${(progress.uploaded / progress.total) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {Object.entries(groupedItems).map(([channel, items]) => (
          <div key={channel} className="mb-10 animate-fade-in">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-300">
              {channel === 'TV' && '📺'}
              {channel === 'Radio' && '📻'}
              {channel === 'Out of Home' && '🏙️'}
              {channel === 'Digital' && '💻'}
              {channel}
            </h2>

            <div className="space-y-4">
              {items.map((item) => {
                const status = STATUSES.find(s => s.id === item.status) || STATUSES[0];
                const isExpanded = expandedItem === item.id;
                const isUploading = uploadingItemId === item.id;
                
                return (
                  <div
                    key={item.id}
                    className="bg-sunny-gray border border-gray-700 rounded-xl overflow-hidden"
                  >
                    {/* Main Row */}
                    <div 
                      className="p-4 cursor-pointer hover:bg-gray-800/30 transition-colors"
                      onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: status.color }}
                          />
                          <div>
                            <div className="font-medium">{item.placementName}</div>
                            <div className="text-sm text-gray-400">
                              {item.publisherName}
                              {item.location && ` • ${item.location}`}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {item.dueDate && (
                            <div className="text-sm text-gray-400">
                              Due: {new Date(item.dueDate).toLocaleDateString('en-AU', {
                                day: 'numeric',
                                month: 'short'
                              })}
                            </div>
                          )}
                          <span className="text-gray-500">
                            {isExpanded ? '▲' : '▼'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="border-t border-gray-700 p-4 bg-sunny-dark/50 animate-fade-in">
                        {/* Specs Grid */}
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <h4 className="text-xs font-medium text-gray-400 uppercase mb-2">Specifications</h4>
                            <div className="space-y-2 text-sm">
                              {item.specs?.dimensions && (
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Dimensions</span>
                                  <span className="font-mono">{item.specs.dimensions}</span>
                                </div>
                              )}
                              {item.specs?.aspectRatio && (
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Aspect Ratio</span>
                                  <span>{item.specs.aspectRatio}</span>
                                </div>
                              )}
                              {item.specs?.duration && (
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Duration</span>
                                  <span>{item.specs.duration}</span>
                                </div>
                              )}
                              {item.specs?.fileFormat && (
                                <div className="flex justify-between">
                                  <span className="text-gray-400">File Format</span>
                                  <span>{item.specs.fileFormat}</span>
                                </div>
                              )}
                              {item.specs?.maxFileSize && (
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Max File Size</span>
                                  <span>{item.specs.maxFileSize}</span>
                                </div>
                              )}
                              {item.specs?.resolution && (
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Resolution</span>
                                  <span>{item.specs.resolution}</span>
                                </div>
                              )}
                              {item.specs?.frameRate && (
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Frame Rate</span>
                                  <span>{item.specs.frameRate}</span>
                                </div>
                              )}
                              {item.specs?.colorMode && (
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Color Mode</span>
                                  <span>{item.specs.colorMode}</span>
                                </div>
                              )}
                              {item.specs?.physicalSize && (
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Physical Size</span>
                                  <span>{item.specs.physicalSize}</span>
                                </div>
                              )}
                              {item.specs?.spotDuration && (
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Spot Duration</span>
                                  <span>{item.specs.spotDuration}</span>
                                </div>
                              )}
                              {item.specs?.adLength && (
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Ad Length</span>
                                  <span>{item.specs.adLength}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div>
                            <h4 className="text-xs font-medium text-gray-400 uppercase mb-2">Details</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-400">Format</span>
                                <span>{item.format}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">Publisher</span>
                                <span>{item.publisherName}</span>
                              </div>
                              {item.location && (
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Location</span>
                                  <span className="text-right max-w-[150px]">{item.location}</span>
                                </div>
                              )}
                              <div className="flex justify-between">
                                <span className="text-gray-400">State/Region</span>
                                <span>{item.stateName}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">Status</span>
                                <span style={{ color: status.color }}>{status.name}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Notes */}
                        {item.notes && (
                          <div className="mb-4 p-3 bg-amber-900/20 border border-amber-700/30 rounded-lg">
                            <div className="text-xs font-medium text-amber-400 uppercase mb-1">Note</div>
                            <div className="text-sm text-amber-200">{item.notes}</div>
                          </div>
                        )}

                        {/* Upload Section */}
                        <div className="pt-4 border-t border-gray-700">
                          {item.uploadedFile ? (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-green-900/30 rounded-lg flex items-center justify-center">
                                  <span className="text-green-400">✓</span>
                                </div>
                                <div>
                                  <div className="text-sm font-medium">{item.uploadedFile.name}</div>
                                  <div className="text-xs text-gray-400">
                                    Uploaded {new Date(item.uploadedFile.uploadedAt).toLocaleDateString('en-AU')}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <a 
                                  href={item.uploadedFile.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sunny-yellow hover:underline text-sm"
                                >
                                  View
                                </a>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUploadClick(item.id);
                                  }}
                                  className="text-gray-400 hover:text-white text-sm"
                                >
                                  Replace
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUploadClick(item.id);
                              }}
                              disabled={isUploading}
                              className="w-full bg-sunny-yellow text-black font-semibold py-3 rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                              {isUploading ? (
                                <>
                                  <div className="animate-spin w-4 h-4 border-2 border-black border-t-transparent rounded-full" />
                                  Uploading...
                                </>
                              ) : (
                                <>
                                  📤 Upload Creative
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-6 mt-8">
        <div className="text-center">
          <img src="/sunny-logo.png" alt="Sunny Advertising" className="h-6 mx-auto opacity-50" />
          <p className="text-xs text-gray-500 mt-2">Powered by Sunny Advertising</p>
        </div>
      </footer>
    </div>
  );
}
