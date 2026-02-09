// Comprehensive spec database for all channels
// This would eventually be stored in a database, but for MVP it's static

export const CHANNELS = [
  { id: 'tv', name: 'TV', icon: '📺' },
  { id: 'radio', name: 'Radio', icon: '📻' },
  { id: 'ooh', name: 'Out of Home', icon: '🏙️' },
  { id: 'digital', name: 'Digital', icon: '💻' },
];

export const STATES = [
  { id: 'nsw', name: 'NSW' },
  { id: 'vic', name: 'VIC' },
  { id: 'qld', name: 'QLD' },
  { id: 'wa', name: 'WA' },
  { id: 'sa', name: 'SA' },
  { id: 'tas', name: 'TAS' },
  { id: 'nt', name: 'NT' },
  { id: 'act', name: 'ACT' },
  { id: 'nz', name: 'New Zealand' },
  { id: 'national', name: 'National' },
];

export const SPECS = {
  // ==================== TV ====================
  tv: {
    publishers: [
      {
        id: 'seven',
        name: 'Seven Network',
        states: ['national'],
        placements: [
          {
            id: 'seven-tvc-15',
            name: '15" TVC',
            format: 'Video',
            specs: {
              duration: '15 seconds',
              resolution: '1920x1080',
              aspectRatio: '16:9',
              fileFormat: 'MOV, MP4',
              codec: 'H.264',
              maxFileSize: '500MB',
              frameRate: '25fps',
              audioSpec: 'Stereo, -24 LUFS',
            },
            notes: 'Include 2 frames of black at start and end',
          },
          {
            id: 'seven-tvc-30',
            name: '30" TVC',
            format: 'Video',
            specs: {
              duration: '30 seconds',
              resolution: '1920x1080',
              aspectRatio: '16:9',
              fileFormat: 'MOV, MP4',
              codec: 'H.264',
              maxFileSize: '1GB',
              frameRate: '25fps',
              audioSpec: 'Stereo, -24 LUFS',
            },
            notes: 'Include 2 frames of black at start and end',
          },
          {
            id: 'seven-bvod-15',
            name: '15" BVOD (7Plus)',
            format: 'Video',
            specs: {
              duration: '15 seconds',
              resolution: '1920x1080',
              aspectRatio: '16:9',
              fileFormat: 'MP4',
              codec: 'H.264',
              maxFileSize: '100MB',
              frameRate: '25fps',
            },
            notes: 'Non-skippable pre-roll',
          },
          {
            id: 'seven-bvod-30',
            name: '30" BVOD (7Plus)',
            format: 'Video',
            specs: {
              duration: '30 seconds',
              resolution: '1920x1080',
              aspectRatio: '16:9',
              fileFormat: 'MP4',
              codec: 'H.264',
              maxFileSize: '150MB',
              frameRate: '25fps',
            },
            notes: 'Non-skippable pre-roll',
          },
        ],
      },
      {
        id: 'nine',
        name: 'Nine Network',
        states: ['national'],
        placements: [
          {
            id: 'nine-tvc-15',
            name: '15" TVC',
            format: 'Video',
            specs: {
              duration: '15 seconds',
              resolution: '1920x1080',
              aspectRatio: '16:9',
              fileFormat: 'MOV, MP4',
              codec: 'H.264',
              maxFileSize: '500MB',
              frameRate: '25fps',
              audioSpec: 'Stereo, -24 LUFS',
            },
            notes: null,
          },
          {
            id: 'nine-tvc-30',
            name: '30" TVC',
            format: 'Video',
            specs: {
              duration: '30 seconds',
              resolution: '1920x1080',
              aspectRatio: '16:9',
              fileFormat: 'MOV, MP4',
              codec: 'H.264',
              maxFileSize: '1GB',
              frameRate: '25fps',
              audioSpec: 'Stereo, -24 LUFS',
            },
            notes: null,
          },
          {
            id: 'nine-bvod-15',
            name: '15" BVOD (9Now)',
            format: 'Video',
            specs: {
              duration: '15 seconds',
              resolution: '1920x1080',
              aspectRatio: '16:9',
              fileFormat: 'MP4',
              codec: 'H.264',
              maxFileSize: '100MB',
              frameRate: '25fps',
            },
            notes: null,
          },
        ],
      },
      {
        id: 'ten',
        name: 'Network 10',
        states: ['national'],
        placements: [
          {
            id: 'ten-tvc-15',
            name: '15" TVC',
            format: 'Video',
            specs: {
              duration: '15 seconds',
              resolution: '1920x1080',
              aspectRatio: '16:9',
              fileFormat: 'MOV, MP4',
              codec: 'H.264',
              maxFileSize: '500MB',
              frameRate: '25fps',
              audioSpec: 'Stereo, -24 LUFS',
            },
            notes: null,
          },
          {
            id: 'ten-tvc-30',
            name: '30" TVC',
            format: 'Video',
            specs: {
              duration: '30 seconds',
              resolution: '1920x1080',
              aspectRatio: '16:9',
              fileFormat: 'MOV, MP4',
              codec: 'H.264',
              maxFileSize: '1GB',
              frameRate: '25fps',
              audioSpec: 'Stereo, -24 LUFS',
            },
            notes: null,
          },
          {
            id: 'ten-bvod-15',
            name: '15" BVOD (10Play)',
            format: 'Video',
            specs: {
              duration: '15 seconds',
              resolution: '1920x1080',
              aspectRatio: '16:9',
              fileFormat: 'MP4',
              codec: 'H.264',
              maxFileSize: '100MB',
              frameRate: '25fps',
            },
            notes: null,
          },
        ],
      },
    ],
  },

  // ==================== RADIO ====================
  radio: {
    publishers: [
      {
        id: 'sca',
        name: 'Southern Cross Austereo',
        states: ['national'],
        placements: [
          {
            id: 'sca-15',
            name: '15" Radio Spot',
            format: 'Audio',
            specs: {
              duration: '15 seconds',
              fileFormat: 'WAV, MP3',
              sampleRate: '44.1kHz',
              bitDepth: '16-bit',
              channels: 'Stereo',
              maxFileSize: '10MB',
            },
            notes: 'Include 0.5s silence at start and end',
          },
          {
            id: 'sca-30',
            name: '30" Radio Spot',
            format: 'Audio',
            specs: {
              duration: '30 seconds',
              fileFormat: 'WAV, MP3',
              sampleRate: '44.1kHz',
              bitDepth: '16-bit',
              channels: 'Stereo',
              maxFileSize: '20MB',
            },
            notes: 'Include 0.5s silence at start and end',
          },
          {
            id: 'sca-60',
            name: '60" Radio Spot',
            format: 'Audio',
            specs: {
              duration: '60 seconds',
              fileFormat: 'WAV, MP3',
              sampleRate: '44.1kHz',
              bitDepth: '16-bit',
              channels: 'Stereo',
              maxFileSize: '40MB',
            },
            notes: 'Include 0.5s silence at start and end',
          },
          {
            id: 'sca-live-read',
            name: 'Live Read Script',
            format: 'Document',
            specs: {
              fileFormat: 'DOCX, PDF',
              wordCount: '75-100 words per 30 seconds',
            },
            notes: 'Include pronunciation guide for brand names',
          },
        ],
      },
      {
        id: 'arn',
        name: 'Australian Radio Network',
        states: ['national'],
        placements: [
          {
            id: 'arn-15',
            name: '15" Radio Spot',
            format: 'Audio',
            specs: {
              duration: '15 seconds',
              fileFormat: 'WAV, MP3',
              sampleRate: '44.1kHz',
              bitDepth: '16-bit',
              channels: 'Stereo',
              maxFileSize: '10MB',
            },
            notes: null,
          },
          {
            id: 'arn-30',
            name: '30" Radio Spot',
            format: 'Audio',
            specs: {
              duration: '30 seconds',
              fileFormat: 'WAV, MP3',
              sampleRate: '44.1kHz',
              bitDepth: '16-bit',
              channels: 'Stereo',
              maxFileSize: '20MB',
            },
            notes: null,
          },
          {
            id: 'arn-60',
            name: '60" Radio Spot',
            format: 'Audio',
            specs: {
              duration: '60 seconds',
              fileFormat: 'WAV, MP3',
              sampleRate: '44.1kHz',
              bitDepth: '16-bit',
              channels: 'Stereo',
              maxFileSize: '40MB',
            },
            notes: null,
          },
        ],
      },
    ],
  },

  // ==================== OOH ====================
  ooh: {
    publishers: [
      {
        id: 'jcdecaux',
        name: 'JCDecaux',
        states: ['nsw', 'vic', 'qld', 'wa', 'sa'],
        placements: [
          {
            id: 'jcd-large-landscape',
            name: 'Digital Large Format - Landscape',
            format: 'Static Image',
            specs: {
              dimensions: '1248 x 320 px',
              aspectRatio: '39:10',
              fileFormat: 'JPEG',
              colorMode: 'RGB',
              dpi: '72',
              maxFileSize: '5MB',
              spotDuration: '10-25 seconds',
            },
            notes: 'No alcohol or religious references on select sites',
            restrictions: ['No alcohol', 'No religious content'],
          },
          {
            id: 'jcd-large-portrait',
            name: 'Digital Large Format - Portrait',
            format: 'Static Image',
            specs: {
              dimensions: '528 x 800 px',
              aspectRatio: '2:3',
              fileFormat: 'JPEG',
              colorMode: 'RGB',
              dpi: '72',
              maxFileSize: '5MB',
              spotDuration: '25 seconds',
            },
            notes: null,
            restrictions: [],
          },
          {
            id: 'jcd-rail',
            name: 'Rail Digital',
            format: 'Static Image',
            specs: {
              dimensions: '1920 x 1080 px',
              aspectRatio: '16:9',
              fileFormat: 'JPEG, PNG',
              colorMode: 'RGB',
              dpi: '72',
              maxFileSize: '10MB',
              spotDuration: '15 seconds',
            },
            notes: null,
            restrictions: [],
          },
        ],
      },
      {
        id: 'qms',
        name: 'QMS Media',
        states: ['nsw', 'vic', 'qld'],
        placements: [
          {
            id: 'qms-digital-large',
            name: 'Digital Large Format',
            format: 'Static Image',
            specs: {
              dimensions: '1248 x 320 px',
              aspectRatio: '39:10',
              fileFormat: 'JPEG',
              colorMode: 'RGB',
              dpi: '72',
              maxFileSize: '5MB',
              spotDuration: '25 seconds',
            },
            notes: null,
            restrictions: [],
          },
          {
            id: 'qms-portrait',
            name: 'Digital Portrait',
            format: 'Static Image',
            specs: {
              dimensions: '384 x 576 px',
              aspectRatio: '2:3',
              fileFormat: 'JPEG',
              colorMode: 'RGB',
              dpi: '72',
              maxFileSize: '5MB',
              spotDuration: '25 seconds',
            },
            notes: null,
            restrictions: [],
          },
          {
            id: 'qms-street-furniture',
            name: 'Street Furniture',
            format: 'Static Image',
            specs: {
              dimensions: '1080 x 1920 px',
              aspectRatio: '9:16',
              fileFormat: 'JPEG',
              colorMode: 'RGB',
              dpi: '72',
              maxFileSize: '5MB',
              spotDuration: '10 seconds',
            },
            notes: null,
            restrictions: [],
          },
        ],
      },
      {
        id: 'lumo',
        name: 'LUMO Digital',
        states: ['nz'],
        placements: [
          {
            id: 'lumo-landscape-large',
            name: 'LUMO Landscape Large (12m x 3m)',
            format: 'Static Image',
            specs: {
              dimensions: '1188 x 288 px',
              aspectRatio: '33:8',
              physicalSize: '12m x 3m',
              fileFormat: 'JPEG, PNG, MP4',
              colorMode: 'RGB',
              maxFileSize: '50MB',
              adLength: '8 seconds',
            },
            notes: null,
            restrictions: [],
          },
          {
            id: 'lumo-portrait',
            name: 'LUMO Portrait (3.7m x 7.3m)',
            format: 'Static Image',
            specs: {
              dimensions: '432 x 864 px',
              aspectRatio: '1:2',
              physicalSize: '3.7m x 7.3m',
              fileFormat: 'JPEG, PNG, MP4',
              colorMode: 'RGB',
              maxFileSize: '50MB',
              adLength: '8 seconds',
            },
            notes: null,
            restrictions: [],
          },
          {
            id: 'lumo-anzac',
            name: 'LUMO Anzac (18m x 5m)',
            format: 'Static Image',
            specs: {
              dimensions: '1764 x 468 px',
              aspectRatio: '49:13',
              physicalSize: '18m x 5m',
              fileFormat: 'JPEG, PNG, MP4',
              colorMode: 'RGB',
              maxFileSize: '50MB',
              adLength: '8 seconds',
            },
            notes: 'Premium CBD location',
            restrictions: [],
          },
        ],
      },
      {
        id: 'ooh-media',
        name: 'oOh! Media',
        states: ['nsw', 'vic', 'qld', 'wa', 'sa'],
        placements: [
          {
            id: 'ooh-retail',
            name: 'Retail Digital',
            format: 'Static Image',
            specs: {
              dimensions: '1920 x 1080 px',
              aspectRatio: '16:9',
              fileFormat: 'JPEG',
              colorMode: 'RGB',
              dpi: '72',
              maxFileSize: '10MB',
              spotDuration: '15 seconds',
            },
            notes: null,
            restrictions: [],
          },
          {
            id: 'ooh-office',
            name: 'Office Towers',
            format: 'Static Image',
            specs: {
              dimensions: '1080 x 1920 px',
              aspectRatio: '9:16',
              fileFormat: 'JPEG',
              colorMode: 'RGB',
              dpi: '72',
              maxFileSize: '10MB',
              spotDuration: '10 seconds',
            },
            notes: null,
            restrictions: [],
          },
        ],
      },
    ],
  },

  // ==================== DIGITAL ====================
  digital: {
    publishers: [
      {
        id: 'meta',
        name: 'Meta (Facebook/Instagram)',
        states: ['national'],
        placements: [
          {
            id: 'meta-static-square',
            name: 'Static Image - Square (4:5)',
            format: 'Static Image',
            specs: {
              dimensions: '1080 x 1350 px',
              aspectRatio: '4:5',
              fileFormat: 'JPG, PNG',
              maxFileSize: '30MB',
            },
            notes: 'Keep 250px clean space top/bottom for Stories. Square 1:1 will be expanded to fit 4:5.',
            restrictions: [],
          },
          {
            id: 'meta-static-vertical',
            name: 'Static Image - Vertical (9:16)',
            format: 'Static Image',
            specs: {
              dimensions: '1080 x 1920 px',
              aspectRatio: '9:16',
              fileFormat: 'JPG, PNG',
              maxFileSize: '30MB',
            },
            notes: 'Stories and Reels placement',
            restrictions: [],
          },
          {
            id: 'meta-static-horizontal',
            name: 'Static Image - Horizontal (1.91:1)',
            format: 'Static Image',
            specs: {
              dimensions: '1200 x 628 px',
              aspectRatio: '1.91:1',
              fileFormat: 'JPG, PNG',
              maxFileSize: '30MB',
            },
            notes: 'Feed and right column',
            restrictions: [],
          },
          {
            id: 'meta-carousel',
            name: 'Carousel (4:5)',
            format: 'Static Image',
            specs: {
              dimensions: '1080 x 1350 px',
              aspectRatio: '4:5',
              fileFormat: 'JPG, PNG',
              maxFileSize: '30MB',
              tiles: '3-5 tiles per carousel',
            },
            notes: 'Can include short video/GIF. Different angles show full experience.',
            restrictions: [],
          },
          {
            id: 'meta-video-square',
            name: 'Video - Square (4:5)',
            format: 'Video',
            specs: {
              dimensions: '1080 x 1350 px',
              aspectRatio: '4:5',
              fileFormat: 'MOV, MP4',
              maxFileSize: '4GB',
              frameRate: '30fps max',
              duration: '1 second to 241 minutes',
            },
            notes: 'Subtitles if dialogue. CTAs near beginning. 6, 15 & 30 sec variations recommended.',
            restrictions: [],
          },
          {
            id: 'meta-video-vertical',
            name: 'Video - Vertical (9:16)',
            format: 'Video',
            specs: {
              dimensions: '1080 x 1920 px',
              aspectRatio: '9:16',
              fileFormat: 'MOV, MP4',
              maxFileSize: '4GB',
              frameRate: '30fps max',
            },
            notes: 'Stories and Reels',
            restrictions: [],
          },
        ],
      },
      {
        id: 'tiktok',
        name: 'TikTok',
        states: ['national'],
        placements: [
          {
            id: 'tiktok-infeed',
            name: 'In-Feed Video',
            format: 'Video',
            specs: {
              dimensions: '1080 x 1920 px',
              aspectRatio: '9:16',
              fileFormat: 'MP4, MOV',
              maxFileSize: '500MB',
              duration: '5-60 seconds',
              frameRate: '30fps',
            },
            notes: 'Keep key content in safe zone. Sound-on environment.',
            restrictions: [],
          },
          {
            id: 'tiktok-topview',
            name: 'TopView',
            format: 'Video',
            specs: {
              dimensions: '1080 x 1920 px',
              aspectRatio: '9:16',
              fileFormat: 'MP4, MOV',
              maxFileSize: '500MB',
              duration: '5-60 seconds',
              frameRate: '30fps',
            },
            notes: 'First ad users see when opening app',
            restrictions: [],
          },
          {
            id: 'tiktok-spark',
            name: 'Spark Ads (Boosted Organic)',
            format: 'Video',
            specs: {
              dimensions: '1080 x 1920 px',
              aspectRatio: '9:16',
              fileFormat: 'Native TikTok post',
            },
            notes: 'Boost existing organic content',
            restrictions: [],
          },
        ],
      },
      {
        id: 'linkedin',
        name: 'LinkedIn',
        states: ['national'],
        placements: [
          {
            id: 'linkedin-single-image',
            name: 'Single Image Ad',
            format: 'Static Image',
            specs: {
              dimensions: '1200 x 627 px',
              aspectRatio: '1.91:1',
              fileFormat: 'JPG, PNG',
              maxFileSize: '5MB',
            },
            notes: null,
            restrictions: [],
          },
          {
            id: 'linkedin-carousel',
            name: 'Carousel Ad',
            format: 'Static Image',
            specs: {
              dimensions: '1080 x 1080 px',
              aspectRatio: '1:1',
              fileFormat: 'JPG, PNG',
              maxFileSize: '10MB',
              tiles: '2-10 cards',
            },
            notes: null,
            restrictions: [],
          },
          {
            id: 'linkedin-video',
            name: 'Video Ad',
            format: 'Video',
            specs: {
              dimensions: '1920 x 1080 px',
              aspectRatio: '16:9',
              fileFormat: 'MP4',
              maxFileSize: '200MB',
              duration: '3 seconds to 30 minutes',
              frameRate: '30fps max',
            },
            notes: 'Recommended: 15-30 seconds',
            restrictions: [],
          },
        ],
      },
      {
        id: 'google-display',
        name: 'Google Display Network',
        states: ['national'],
        placements: [
          {
            id: 'gdn-300x250',
            name: 'Medium Rectangle (300x250)',
            format: 'Static Image',
            specs: {
              dimensions: '300 x 250 px',
              fileFormat: 'JPG, PNG, GIF',
              maxFileSize: '150KB',
            },
            notes: 'Most common display size',
            restrictions: [],
          },
          {
            id: 'gdn-728x90',
            name: 'Leaderboard (728x90)',
            format: 'Static Image',
            specs: {
              dimensions: '728 x 90 px',
              fileFormat: 'JPG, PNG, GIF',
              maxFileSize: '150KB',
            },
            notes: null,
            restrictions: [],
          },
          {
            id: 'gdn-160x600',
            name: 'Wide Skyscraper (160x600)',
            format: 'Static Image',
            specs: {
              dimensions: '160 x 600 px',
              fileFormat: 'JPG, PNG, GIF',
              maxFileSize: '150KB',
            },
            notes: null,
            restrictions: [],
          },
          {
            id: 'gdn-320x50',
            name: 'Mobile Leaderboard (320x50)',
            format: 'Static Image',
            specs: {
              dimensions: '320 x 50 px',
              fileFormat: 'JPG, PNG, GIF',
              maxFileSize: '150KB',
            },
            notes: null,
            restrictions: [],
          },
          {
            id: 'gdn-responsive',
            name: 'Responsive Display Ad',
            format: 'Static Image',
            specs: {
              landscapeImage: '1200 x 628 px',
              squareImage: '1200 x 1200 px',
              logo: '1200 x 1200 px',
              fileFormat: 'JPG, PNG',
              maxFileSize: '5MB per asset',
            },
            notes: 'Provide multiple headlines and descriptions',
            restrictions: [],
          },
        ],
      },
      {
        id: 'youtube',
        name: 'YouTube',
        states: ['national'],
        placements: [
          {
            id: 'yt-skippable',
            name: 'Skippable In-Stream (TrueView)',
            format: 'Video',
            specs: {
              dimensions: '1920 x 1080 px',
              aspectRatio: '16:9',
              fileFormat: 'MP4, MOV',
              maxFileSize: '1GB',
              duration: '12 seconds minimum',
              frameRate: '30fps',
            },
            notes: 'Users can skip after 5 seconds. Pay only when watched 30s or to completion.',
            restrictions: [],
          },
          {
            id: 'yt-non-skip',
            name: 'Non-Skippable In-Stream',
            format: 'Video',
            specs: {
              dimensions: '1920 x 1080 px',
              aspectRatio: '16:9',
              fileFormat: 'MP4, MOV',
              maxFileSize: '1GB',
              duration: '15-20 seconds',
              frameRate: '30fps',
            },
            notes: 'Users must watch entire ad',
            restrictions: [],
          },
          {
            id: 'yt-bumper',
            name: 'Bumper Ad',
            format: 'Video',
            specs: {
              dimensions: '1920 x 1080 px',
              aspectRatio: '16:9',
              fileFormat: 'MP4, MOV',
              maxFileSize: '1GB',
              duration: '6 seconds max',
              frameRate: '30fps',
            },
            notes: 'Non-skippable, best for awareness',
            restrictions: [],
          },
        ],
      },
    ],
  },
};

// Helper function to get all placements for a channel/state/publisher combination
export function getPlacements(channelId, stateId, publisherId) {
  const channel = SPECS[channelId];
  if (!channel) return [];
  
  const publisher = channel.publishers.find(p => p.id === publisherId);
  if (!publisher) return [];
  
  // Check if publisher operates in this state
  if (!publisher.states.includes(stateId) && !publisher.states.includes('national')) {
    return [];
  }
  
  return publisher.placements;
}

// Helper function to get publishers for a channel/state
export function getPublishers(channelId, stateId) {
  const channel = SPECS[channelId];
  if (!channel) return [];
  
  return channel.publishers.filter(p => 
    p.states.includes(stateId) || p.states.includes('national')
  );
}

// Status options for deliverables
export const STATUSES = [
  { id: 'briefed', name: 'Briefed', color: '#3b82f6' },
  { id: 'received', name: 'Creative Received', color: '#f59e0b' },
  { id: 'approved', name: 'Approved', color: '#22c55e' },
  { id: 'live', name: 'Live', color: '#8b5cf6' },
];
