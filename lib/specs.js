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
          { id: 'seven-tvc-15', name: '15" TVC', format: 'Video', specs: { duration: '15 seconds', resolution: '1920x1080', aspectRatio: '16:9', fileFormat: 'MOV, MP4', codec: 'H.264', maxFileSize: '500MB', frameRate: '25fps', audioSpec: 'Stereo, -24 LUFS' }, notes: 'Include 2 frames of black at start and end' },
          { id: 'seven-tvc-30', name: '30" TVC', format: 'Video', specs: { duration: '30 seconds', resolution: '1920x1080', aspectRatio: '16:9', fileFormat: 'MOV, MP4', codec: 'H.264', maxFileSize: '1GB', frameRate: '25fps', audioSpec: 'Stereo, -24 LUFS' }, notes: 'Include 2 frames of black at start and end' },
          { id: 'seven-bvod-15', name: '15" BVOD (7Plus)', format: 'Video', specs: { duration: '15 seconds', resolution: '1920x1080', aspectRatio: '16:9', fileFormat: 'MP4', codec: 'H.264', maxFileSize: '100MB', frameRate: '25fps' }, notes: 'Non-skippable pre-roll' },
          { id: 'seven-bvod-30', name: '30" BVOD (7Plus)', format: 'Video', specs: { duration: '30 seconds', resolution: '1920x1080', aspectRatio: '16:9', fileFormat: 'MP4', codec: 'H.264', maxFileSize: '150MB', frameRate: '25fps' }, notes: 'Non-skippable pre-roll' },
        ],
      },
      {
        id: 'nine',
        name: 'Nine Network',
        states: ['national'],
        placements: [
          { id: 'nine-tvc-15', name: '15" TVC', format: 'Video', specs: { duration: '15 seconds', resolution: '1920x1080', aspectRatio: '16:9', fileFormat: 'MOV, MP4', codec: 'H.264', maxFileSize: '500MB', frameRate: '25fps', audioSpec: 'Stereo, -24 LUFS' }, notes: null },
          { id: 'nine-tvc-30', name: '30" TVC', format: 'Video', specs: { duration: '30 seconds', resolution: '1920x1080', aspectRatio: '16:9', fileFormat: 'MOV, MP4', codec: 'H.264', maxFileSize: '1GB', frameRate: '25fps', audioSpec: 'Stereo, -24 LUFS' }, notes: null },
          { id: 'nine-bvod-15', name: '15" BVOD (9Now)', format: 'Video', specs: { duration: '15 seconds', resolution: '1920x1080', aspectRatio: '16:9', fileFormat: 'MP4', codec: 'H.264', maxFileSize: '100MB', frameRate: '25fps' }, notes: null },
        ],
      },
      {
        id: 'ten',
        name: 'Network 10',
        states: ['national'],
        placements: [
          { id: 'ten-tvc-15', name: '15" TVC', format: 'Video', specs: { duration: '15 seconds', resolution: '1920x1080', aspectRatio: '16:9', fileFormat: 'MOV, MP4', codec: 'H.264', maxFileSize: '500MB', frameRate: '25fps', audioSpec: 'Stereo, -24 LUFS' }, notes: null },
          { id: 'ten-tvc-30', name: '30" TVC', format: 'Video', specs: { duration: '30 seconds', resolution: '1920x1080', aspectRatio: '16:9', fileFormat: 'MOV, MP4', codec: 'H.264', maxFileSize: '1GB', frameRate: '25fps', audioSpec: 'Stereo, -24 LUFS' }, notes: null },
          { id: 'ten-bvod-15', name: '15" BVOD (10Play)', format: 'Video', specs: { duration: '15 seconds', resolution: '1920x1080', aspectRatio: '16:9', fileFormat: 'MP4', codec: 'H.264', maxFileSize: '100MB', frameRate: '25fps' }, notes: null },
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
          { id: 'sca-15', name: '15" Radio Spot', format: 'Audio', specs: { duration: '15 seconds', fileFormat: 'WAV, MP3', sampleRate: '44.1kHz', bitDepth: '16-bit', channels: 'Stereo', maxFileSize: '10MB' }, notes: 'Include 0.5s silence at start and end' },
          { id: 'sca-30', name: '30" Radio Spot', format: 'Audio', specs: { duration: '30 seconds', fileFormat: 'WAV, MP3', sampleRate: '44.1kHz', bitDepth: '16-bit', channels: 'Stereo', maxFileSize: '20MB' }, notes: 'Include 0.5s silence at start and end' },
          { id: 'sca-60', name: '60" Radio Spot', format: 'Audio', specs: { duration: '60 seconds', fileFormat: 'WAV, MP3', sampleRate: '44.1kHz', bitDepth: '16-bit', channels: 'Stereo', maxFileSize: '40MB' }, notes: 'Include 0.5s silence at start and end' },
          { id: 'sca-live-read', name: 'Live Read Script', format: 'Document', specs: { fileFormat: 'DOCX, PDF', wordCount: '75-100 words per 30 seconds' }, notes: 'Include pronunciation guide for brand names' },
        ],
      },
      {
        id: 'arn',
        name: 'Australian Radio Network',
        states: ['national'],
        placements: [
          { id: 'arn-15', name: '15" Radio Spot', format: 'Audio', specs: { duration: '15 seconds', fileFormat: 'WAV, MP3', sampleRate: '44.1kHz', bitDepth: '16-bit', channels: 'Stereo', maxFileSize: '10MB' }, notes: null },
          { id: 'arn-30', name: '30" Radio Spot', format: 'Audio', specs: { duration: '30 seconds', fileFormat: 'WAV, MP3', sampleRate: '44.1kHz', bitDepth: '16-bit', channels: 'Stereo', maxFileSize: '20MB' }, notes: null },
          { id: 'arn-60', name: '60" Radio Spot', format: 'Audio', specs: { duration: '60 seconds', fileFormat: 'WAV, MP3', sampleRate: '44.1kHz', bitDepth: '16-bit', channels: 'Stereo', maxFileSize: '40MB' }, notes: null },
        ],
      },
    ],
  },

  // ==================== OOH ====================
  ooh: {
    publishers: [
      {
        id: 'jcdecaux-nsw',
        name: 'JCDecaux',
        states: ['nsw'],
        placements: [
          { id: 'jcd-nsw-01998', name: 'M4 Mwy Portrait (O) - 01998.04.01', location: 'M4 Motorway, Granville', format: 'Digital Large Format', specs: { dimensions: '528 x 800 px', aspectRatio: '2:3', fileFormat: 'JPEG', colorMode: 'RGB', dpi: '72', maxFileSize: '5MB', spotDuration: '25 seconds' }, notes: 'No alcohol or religious references', restrictions: ['No alcohol', 'No religious content'] },
          { id: 'jcd-nsw-00833-i', name: 'General Holmes Drive (I) - 00833.02.01', location: 'General Holmes Drive, Mascot', format: 'Digital Large Format', specs: { dimensions: '1248 x 320 px', aspectRatio: '39:10', fileFormat: 'JPEG', colorMode: 'RGB', dpi: '72', maxFileSize: '5MB', spotDuration: '10 seconds' }, notes: 'No religious or sexual references', restrictions: ['No religious content', 'No sexual content'] },
          { id: 'jcd-nsw-00833-o', name: 'General Holmes Drive (O) - 00833.03.01', location: 'General Holmes Drive, Mascot', format: 'Digital Large Format', specs: { dimensions: '1248 x 320 px', aspectRatio: '39:10', fileFormat: 'JPEG', colorMode: 'RGB', dpi: '72', maxFileSize: '5MB', spotDuration: '10 seconds' }, notes: 'No religious or sexual references', restrictions: ['No religious content', 'No sexual content'] },
          { id: 'jcd-nsw-04007', name: 'Homebush Bay Drive (O) - 04007.01.01', location: 'Homebush Bay Drive, Rhodes', format: 'Digital Large Format', specs: { dimensions: '1248 x 320 px', aspectRatio: '39:10', fileFormat: 'JPEG', colorMode: 'RGB', dpi: '72', maxFileSize: '5MB', spotDuration: '15 seconds' }, notes: 'No images connecting alcohol and gambling', restrictions: ['No alcohol/gambling connection'] },
          { id: 'jcd-nsw-03451', name: 'M5 Mwy Junction (O) - 03451.01.11', location: 'M5 Motorway, Mascot', format: 'Digital Large Format', specs: { dimensions: '1888 x 448 px', aspectRatio: '59:14', fileFormat: 'JPEG', colorMode: 'RGB', dpi: '72', maxFileSize: '5MB', spotDuration: '10 seconds' }, notes: 'No sexual or religious references', restrictions: ['No religious content', 'No sexual content'] },
          { id: 'jcd-nsw-04149', name: 'M4 Parramatta Junction (O) - 04149.02.01', location: 'M4 Motorway, Parramatta', format: 'Digital Large Format', specs: { dimensions: '1888 x 448 px', aspectRatio: '59:14', fileFormat: 'JPEG', colorMode: 'RGB', dpi: '72', maxFileSize: '5MB', spotDuration: '10 seconds' }, notes: 'No sexual or religious references. No alcohol/gambling connection.', restrictions: ['No religious content', 'No sexual content', 'No alcohol/gambling'] },
          { id: 'jcd-nsw-rail-central', name: 'Central Station Digital', location: 'Central Station, Sydney', format: 'Rail Digital', specs: { dimensions: '1920 x 1080 px', aspectRatio: '16:9', fileFormat: 'JPEG, PNG', colorMode: 'RGB', dpi: '72', maxFileSize: '10MB', spotDuration: '15 seconds' }, notes: null, restrictions: [] },
          { id: 'jcd-nsw-rail-townhall', name: 'Town Hall Station Digital', location: 'Town Hall Station, Sydney', format: 'Rail Digital', specs: { dimensions: '1920 x 1080 px', aspectRatio: '16:9', fileFormat: 'JPEG, PNG', colorMode: 'RGB', dpi: '72', maxFileSize: '10MB', spotDuration: '15 seconds' }, notes: null, restrictions: [] },
        ],
      },
      {
        id: 'jcdecaux-vic',
        name: 'JCDecaux',
        states: ['vic'],
        placements: [
          { id: 'jcd-vic-03395', name: '660 Bridge Rd - 03395.01.11', location: 'Bridge Rd, Richmond', format: 'Digital Large Format', specs: { dimensions: '800 x 200 px', aspectRatio: '4:1', fileFormat: 'JPEG', colorMode: 'RGB', dpi: '72', maxFileSize: '5MB', spotDuration: '30 seconds' }, notes: 'No sexual or alcohol references', restrictions: ['No sexual content', 'No alcohol'] },
          { id: 'jcd-vic-03403', name: '1200 Stud Rd (I) - 03403.01.11', location: 'Stud Rd, Rowville', format: 'Digital Large Format', specs: { dimensions: '1040 x 272 px', aspectRatio: '65:17', fileFormat: 'JPEG', colorMode: 'RGB', dpi: '72', maxFileSize: '5MB', spotDuration: '30 seconds' }, notes: 'No images connecting alcohol and gambling', restrictions: ['No alcohol/gambling connection'] },
          { id: 'jcd-vic-03064', name: 'Mt Alexander Rd - 03064.01.11', location: 'Mt Alexander Rd, Ascot Vale', format: 'Digital Large Format', specs: { dimensions: '1248 x 320 px', aspectRatio: '39:10', fileFormat: 'JPEG', colorMode: 'RGB', dpi: '72', maxFileSize: '5MB', spotDuration: '10 seconds' }, notes: 'No images connecting alcohol and gambling', restrictions: ['No alcohol/gambling connection'] },
          { id: 'jcd-vic-03262', name: '131 Johnston St - 03262.02.01', location: 'Johnston St, Fitzroy', format: 'Digital Large Format', specs: { dimensions: '1248 x 320 px', aspectRatio: '39:10', fileFormat: 'JPEG', colorMode: 'RGB', dpi: '72', maxFileSize: '5MB', spotDuration: '30 seconds' }, notes: 'No alcohol or sexual references', restrictions: ['No alcohol', 'No sexual content'] },
          { id: 'jcd-vic-03452', name: 'Springvale Rd (I) - 03452.01.11', location: 'Springvale Rd, Springvale', format: 'Digital Large Format', specs: { dimensions: '1584 x 368 px', aspectRatio: '99:23', fileFormat: 'JPEG', colorMode: 'RGB', dpi: '72', maxFileSize: '5MB', spotDuration: '60 seconds' }, notes: 'No images connecting alcohol and gambling', restrictions: ['No alcohol/gambling connection'] },
          { id: 'jcd-vic-01391', name: 'Western Ring Rd South - 01391.03.01', location: 'Western Ring Rd, Deer Park', format: 'Digital Large Format', specs: { dimensions: '1584 x 368 px', aspectRatio: '99:23', fileFormat: 'JPEG', colorMode: 'RGB', dpi: '72', maxFileSize: '5MB', spotDuration: '30 seconds' }, notes: 'No images connecting alcohol and gambling', restrictions: ['No alcohol/gambling connection'] },
          { id: 'jcd-vic-04209', name: 'DFO Uni Hill (O) - 04209.02.01', location: 'DFO Uni Hill, Bundoora', format: 'Digital Large Format', specs: { dimensions: '1280 x 360 px', aspectRatio: '32:9', fileFormat: 'JPEG', colorMode: 'RGB', dpi: '72', maxFileSize: '5MB', spotDuration: '30 seconds' }, notes: null, restrictions: [] },
        ],
      },
      {
        id: 'jcdecaux-qld',
        name: 'JCDecaux',
        states: ['qld'],
        placements: [
          { id: 'jcd-qld-03785', name: 'Gold Coast Hwy Helensvale (O) - 03785.01.01', location: 'Gold Coast Hwy, Helensvale', format: 'Digital Large Format', specs: { dimensions: '936 x 312 px', aspectRatio: '3:1', fileFormat: 'JPEG', colorMode: 'RGB', dpi: '72', maxFileSize: '5MB', spotDuration: '25 seconds' }, notes: null, restrictions: [] },
          { id: 'jcd-qld-01049', name: '168 Musgrave Rd - 01049.03.01', location: 'Musgrave Rd, Red Hill', format: 'Digital Large Format', specs: { dimensions: '992 x 256 px', aspectRatio: '31:8', fileFormat: 'JPEG', colorMode: 'RGB', dpi: '72', maxFileSize: '5MB', spotDuration: '8 seconds' }, notes: 'No images connecting alcohol and gambling', restrictions: ['No alcohol/gambling connection'] },
          { id: 'jcd-qld-03516', name: '730 Old Cleveland Rd (I) - 03516.01.11', location: 'Old Cleveland Rd, Camp Hill', format: 'Digital Large Format', specs: { dimensions: '1248 x 320 px', aspectRatio: '39:10', fileFormat: 'JPEG', colorMode: 'RGB', dpi: '72', maxFileSize: '5MB', spotDuration: '8 seconds' }, notes: 'No sexual or religious references', restrictions: ['No sexual content', 'No religious content'] },
          { id: 'jcd-qld-00968', name: '55 Old Cleveland Rd (O) - 00968.02.01', location: 'Old Cleveland Rd, Capalaba', format: 'Digital Large Format', specs: { dimensions: '992 x 256 px', aspectRatio: '31:8', fileFormat: 'JPEG', colorMode: 'RGB', dpi: '72', maxFileSize: '5MB', spotDuration: '8 seconds' }, notes: 'No images connecting alcohol and gambling', restrictions: ['No alcohol/gambling connection'] },
          { id: 'jcd-qld-03461', name: 'Lutwyche Road Kedron - 03461.01.11', location: 'Lutwyche Rd, Kedron', format: 'Digital Large Format', specs: { dimensions: '992 x 288 px', aspectRatio: '31:9', fileFormat: 'JPEG', colorMode: 'RGB', dpi: '72', maxFileSize: '5MB', spotDuration: '8 seconds' }, notes: 'No religious or sexual references', restrictions: ['No religious content', 'No sexual content'] },
          { id: 'jcd-qld-03781', name: 'Gold Coast Hwy Mermaid Beach (I) - 03781.01.01', location: 'Gold Coast Hwy, Mermaid Beach', format: 'Digital Large Format', specs: { dimensions: '1248 x 312 px', aspectRatio: '4:1', fileFormat: 'JPEG', colorMode: 'RGB', dpi: '72', maxFileSize: '5MB', spotDuration: '10 seconds' }, notes: 'No images connecting alcohol and gambling', restrictions: ['No alcohol/gambling connection'] },
          { id: 'jcd-qld-03106', name: 'Kingsford Smith Drive - 03106.01.11', location: 'Kingsford Smith Drive, Hamilton', format: 'Digital Large Format', specs: { dimensions: '512 x 768 px', aspectRatio: '2:3', fileFormat: 'JPEG', colorMode: 'RGB', dpi: '72', maxFileSize: '5MB', spotDuration: '25 seconds' }, notes: 'No images connecting alcohol and gambling', restrictions: ['No alcohol/gambling connection'] },
        ],
      },
      {
        id: 'qms-nsw',
        name: 'QMS Media',
        states: ['nsw'],
        placements: [
          { id: 'qms-nsw-d497', name: 'QMN-D497 - King Georges Rd', location: 'King Georges & Stoney Creek Road, Beverly Hills', format: 'Digital Large Format', specs: { dimensions: '1248 x 320 px', aspectRatio: '39:10', fileFormat: 'JPEG', colorMode: 'RGB', dpi: '72', maxFileSize: '5MB', spotDuration: '25 seconds' }, notes: 'No alcohol', restrictions: ['No alcohol'] },
          { id: 'qms-nsw-d273', name: 'QMN-D273 - M4 Motorway Holroyd', location: 'M4 Motorway, Holroyd', format: 'Digital Large Format', specs: { dimensions: '1224 x 324 px', aspectRatio: '17:4.5', fileFormat: 'JPEG', colorMode: 'RGB', dpi: '72', maxFileSize: '5MB', spotDuration: '25 seconds' }, notes: 'No images connecting alcohol and gambling', restrictions: ['No alcohol/gambling connection'] },
          { id: 'qms-nsw-d17', name: 'QMN-D17 - Wentworth Ave Eastlake', location: 'Wentworth Avenue, Eastlake', format: 'Digital Large Format', specs: { dimensions: '1240 x 320 px', aspectRatio: '31:8', fileFormat: 'JPEG', colorMode: 'RGB', dpi: '72', maxFileSize: '5MB', spotDuration: '10 seconds' }, notes: null, restrictions: [] },
          { id: 'qms-nsw-d449', name: 'QMN-D449 - M2 Motorway Beecroft', location: 'M2 Motorway, Beecroft Road', format: 'Digital Large Format', specs: { dimensions: '1248 x 320 px', aspectRatio: '39:10', fileFormat: 'JPEG', colorMode: 'RGB', dpi: '72', maxFileSize: '5MB', spotDuration: '25 seconds' }, notes: null, restrictions: [] },
        ],
      },
      {
        id: 'qms-vic',
        name: 'QMS Media',
        states: ['vic'],
        placements: [
          { id: 'qms-vic-d617', name: 'QMV-D617 - Latrobe Boulevard', location: '32 Latrobe Boulevard, Geelong', format: 'Digital Large Format', specs: { dimensions: '1248 x 352 px', aspectRatio: '39:11', fileFormat: 'JPEG', colorMode: 'RGB', dpi: '72', maxFileSize: '5MB', spotDuration: '30 seconds' }, notes: null, restrictions: [] },
          { id: 'qms-vic-d681', name: 'QMV-D681 - Nepean Highway', location: '643 Nepean Highway, Brighton East', format: 'Digital Large Format', specs: { dimensions: '1380 x 400 px', aspectRatio: '69:20', fileFormat: 'JPEG', colorMode: 'RGB', dpi: '72', maxFileSize: '5MB', spotDuration: '30 seconds' }, notes: 'No alcohol', restrictions: ['No alcohol'] },
          { id: 'qms-vic-d281', name: 'QMV-D281 - Russell & Lonsdale', location: 'Russell and Lonsdale Street, Melbourne', format: 'Digital Large Format', specs: { dimensions: '1044 x 288 px', aspectRatio: '29:8', fileFormat: 'JPEG', colorMode: 'RGB', dpi: '72', maxFileSize: '5MB', spotDuration: '20 seconds' }, notes: null, restrictions: [] },
          { id: 'qms-vic-d505', name: 'QMV-D505 - Elizabeth Street', location: '1 Elizabeth Street, Melbourne', format: 'Digital Large Format', specs: { dimensions: '672 x 840 px', aspectRatio: '4:5', fileFormat: 'JPEG', colorMode: 'RGB', dpi: '72', maxFileSize: '5MB', spotDuration: '30 seconds' }, notes: null, restrictions: [] },
          { id: 'qms-vic-d73', name: 'QMV-D73 - South Rd & Nepean Hwy', location: 'Cnr South Road & Nepean Highway, Moorabbin', format: 'Digital Large Format', specs: { dimensions: '640 x 448 px', aspectRatio: '10:7', fileFormat: 'JPEG', colorMode: 'RGB', dpi: '72', maxFileSize: '5MB', spotDuration: '30 seconds' }, notes: 'Nothing religious', restrictions: ['No religious content'] },
          { id: 'qms-vic-d353', name: 'QMV-D353 - Curtis Street', location: '71 Curtis Street, Ballarat', format: 'Digital Large Format', specs: { dimensions: '1056 x 432 px', aspectRatio: '22:9', fileFormat: 'JPEG', colorMode: 'RGB', dpi: '72', maxFileSize: '5MB', spotDuration: '8 seconds' }, notes: null, restrictions: [] },
        ],
      },
      {
        id: 'qms-qld',
        name: 'QMS Media',
        states: ['qld'],
        placements: [
          { id: 'qms-qld-d321', name: 'QMQ-D321 - Finucane Road', location: '82 Finucane Road, Alexandra Hills', format: 'Digital Large Format', specs: { dimensions: '384 x 576 px', aspectRatio: '2:3', fileFormat: 'JPEG', colorMode: 'RGB', dpi: '72', maxFileSize: '5MB', spotDuration: '25 seconds' }, notes: 'No alcohol', restrictions: ['No alcohol'] },
          { id: 'qms-qld-d81', name: 'QMQ-D81 - Breakfast Creek Rd', location: '132 Breakfast Creek Road, Newstead', format: 'Digital Large Format', specs: { dimensions: '924 x 308 px', aspectRatio: '3:1', fileFormat: 'JPEG', colorMode: 'RGB', dpi: '72', maxFileSize: '5MB', spotDuration: '8 seconds' }, notes: 'No Dulux paints competitors', restrictions: ['No Dulux competitors'] },
          { id: 'qms-qld-d177', name: 'QMQ-D177 - Kingsford Smith Drive', location: '610 Kingsford Smith Drive, Hamilton', format: 'Digital Large Format', specs: { dimensions: '504 x 756 px', aspectRatio: '2:3', fileFormat: 'JPEG', colorMode: 'RGB', dpi: '72', maxFileSize: '5MB', spotDuration: '20 seconds' }, notes: null, restrictions: [] },
        ],
      },
      {
        id: 'lumo',
        name: 'LUMO Digital',
        states: ['nz'],
        placements: [
          { id: 'lumo-newton', name: 'LUMO-Newton', location: '118 Newton Rd, Eden Terrace, Auckland', format: 'Digital Billboard', specs: { dimensions: '1368 x 324 px', aspectRatio: '38:9', physicalSize: '14m x 3.5m', fileFormat: 'JPEG, PNG, MP4', colorMode: 'RGB', maxFileSize: '50MB', adLength: '8 seconds' }, notes: null, restrictions: [] },
          { id: 'lumo-grey', name: 'LUMO-Grey', location: '505 Grey St, Hamilton East, Hamilton', format: 'Digital Billboard', specs: { dimensions: '1188 x 288 px', aspectRatio: '33:8', physicalSize: '12m x 3m', fileFormat: 'JPEG, PNG, MP4', colorMode: 'RGB', maxFileSize: '50MB', adLength: '8 seconds' }, notes: null, restrictions: [] },
          { id: 'lumo-tamaki', name: 'LUMO-Tamaki Dr', location: 'Cnr Tamaki Dr & Solent St, Mechanics Bay, Auckland', format: 'Digital Billboard', specs: { dimensions: '1368 x 324 px', aspectRatio: '38:9', physicalSize: '14m x 3.5m', fileFormat: 'JPEG, PNG, MP4', colorMode: 'RGB', maxFileSize: '50MB', adLength: '8 seconds' }, notes: 'No political messaging', restrictions: ['No political content'] },
          { id: 'lumo-anzac', name: 'LUMO-Anzac', location: '2-8 Anzac Ave, Auckland CBD, Auckland', format: 'Digital Billboard', specs: { dimensions: '1764 x 468 px', aspectRatio: '49:13', physicalSize: '18m x 5m', fileFormat: 'JPEG, PNG, MP4', colorMode: 'RGB', maxFileSize: '50MB', adLength: '8 seconds' }, notes: 'Premium CBD location', restrictions: [] },
          { id: 'lumo-ports', name: 'LUMO-Ports', location: 'Cnr Quay & Plumer Sts, Auckland Central', format: 'Digital Billboard', specs: { dimensions: '1188 x 288 px', aspectRatio: '33:8', physicalSize: '12m x 3m', fileFormat: 'JPEG, PNG, MP4', colorMode: 'RGB', maxFileSize: '50MB', adLength: '8 seconds' }, notes: 'No political messaging', restrictions: ['No political content'] },
          { id: 'lumo-sturdee', name: 'LUMO-Sturdee', location: '15-17 Sturdee St, Viaduct Basin, Auckland', format: 'Digital Billboard', specs: { dimensions: '504 x 864 px', aspectRatio: '7:12', physicalSize: '5m x 9m', fileFormat: 'JPEG, PNG, MP4', colorMode: 'RGB', maxFileSize: '50MB', adLength: '8 seconds' }, notes: null, restrictions: [] },
          { id: 'lumo-khyber', name: 'LUMO-Khyber', location: '62 Khyber Pass Rd, Grafton, Auckland', format: 'Digital Billboard', specs: { dimensions: '1188 x 288 px', aspectRatio: '33:8', physicalSize: '12m x 3m', fileFormat: 'JPEG, PNG, MP4', colorMode: 'RGB', maxFileSize: '50MB', adLength: '8 seconds' }, notes: null, restrictions: [] },
          { id: 'lumo-parnell', name: 'LUMO-Parnell', location: '18 Stanley St, Parnell, Auckland', format: 'Digital Billboard', specs: { dimensions: '468 x 756 px', aspectRatio: '13:21', physicalSize: '4.5m x 7.5m', fileFormat: 'JPEG, PNG, MP4', colorMode: 'RGB', maxFileSize: '50MB', adLength: '16 seconds' }, notes: null, restrictions: [] },
          { id: 'lumo-ponsonby', name: 'LUMO-Ponsonby', location: '182 Ponsonby Rd, Ponsonby, Auckland', format: 'Digital Billboard', specs: { dimensions: '416 x 480 px', aspectRatio: '11:13', physicalSize: '4m x 4.75m', fileFormat: 'JPEG, PNG, MP4', colorMode: 'RGB', maxFileSize: '50MB', adLength: '8 seconds' }, notes: 'No ice cream brands', restrictions: ['No ice cream brands'] },
          { id: 'lumo-mt-eden-in', name: 'LUMO-Mt Eden IN', location: '10 Mount Eden Rd, Grafton, Auckland', format: 'Digital Billboard', specs: { dimensions: '432 x 864 px', aspectRatio: '1:2', physicalSize: '3.7m x 7.3m', fileFormat: 'JPEG, PNG, MP4', colorMode: 'RGB', maxFileSize: '50MB', adLength: '8 seconds' }, notes: null, restrictions: [] },
          { id: 'lumo-mt-eden-out', name: 'LUMO-Mt Eden OUT', location: '10 Mount Eden Rd, Grafton, Auckland', format: 'Digital Billboard', specs: { dimensions: '1188 x 288 px', aspectRatio: '33:8', physicalSize: '12m x 3m', fileFormat: 'JPEG, PNG, MP4', colorMode: 'RGB', maxFileSize: '50MB', adLength: '8 seconds' }, notes: null, restrictions: [] },
          { id: 'lumo-north-shore-in', name: 'LUMO-North Shore IN', location: '134 Wairau Rd, Wairau Valley, Auckland', format: 'Digital Billboard', specs: { dimensions: '900 x 288 px', aspectRatio: '25:8', physicalSize: '9m x 3m', fileFormat: 'JPEG, PNG, MP4', colorMode: 'RGB', maxFileSize: '50MB', adLength: '16 seconds' }, notes: 'Certain car brands restricted', restrictions: ['Car brand restrictions'] },
          { id: 'lumo-north-shore-out', name: 'LUMO-North Shore OUT', location: '134 Wairau Rd, Wairau Valley, Auckland', format: 'Digital Billboard', specs: { dimensions: '900 x 288 px', aspectRatio: '25:8', physicalSize: '9m x 3m', fileFormat: 'JPEG, PNG, MP4', colorMode: 'RGB', maxFileSize: '50MB', adLength: '16 seconds' }, notes: 'Certain car brands restricted', restrictions: ['Car brand restrictions'] },
        ],
      },
      {
        id: 'ooh-media',
        name: 'oOh! Media',
        states: ['nsw', 'vic', 'qld', 'wa', 'sa'],
        placements: [
          { id: 'ooh-retail-sydney', name: 'Retail Digital - Westfield Sydney', location: 'Westfield Sydney', format: 'Retail Digital', specs: { dimensions: '1920 x 1080 px', aspectRatio: '16:9', fileFormat: 'JPEG', colorMode: 'RGB', dpi: '72', maxFileSize: '10MB', spotDuration: '15 seconds' }, notes: null, restrictions: [] },
          { id: 'ooh-retail-bondi', name: 'Retail Digital - Westfield Bondi', location: 'Westfield Bondi Junction', format: 'Retail Digital', specs: { dimensions: '1920 x 1080 px', aspectRatio: '16:9', fileFormat: 'JPEG', colorMode: 'RGB', dpi: '72', maxFileSize: '10MB', spotDuration: '15 seconds' }, notes: null, restrictions: [] },
          { id: 'ooh-office-barangaroo', name: 'Office Towers - Barangaroo', location: 'Barangaroo, Sydney', format: 'Office Digital', specs: { dimensions: '1080 x 1920 px', aspectRatio: '9:16', fileFormat: 'JPEG', colorMode: 'RGB', dpi: '72', maxFileSize: '10MB', spotDuration: '10 seconds' }, notes: null, restrictions: [] },
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
          { id: 'meta-static-square', name: 'Static Image - Square (4:5)', format: 'Static Image', specs: { dimensions: '1080 x 1350 px', aspectRatio: '4:5', fileFormat: 'JPG, PNG', maxFileSize: '30MB' }, notes: 'Keep 250px clean space top/bottom for Stories. Square 1:1 will be expanded to fit 4:5.', restrictions: [] },
          { id: 'meta-static-vertical', name: 'Static Image - Vertical (9:16)', format: 'Static Image', specs: { dimensions: '1080 x 1920 px', aspectRatio: '9:16', fileFormat: 'JPG, PNG', maxFileSize: '30MB' }, notes: 'Stories and Reels placement', restrictions: [] },
          { id: 'meta-static-horizontal', name: 'Static Image - Horizontal (1.91:1)', format: 'Static Image', specs: { dimensions: '1200 x 628 px', aspectRatio: '1.91:1', fileFormat: 'JPG, PNG', maxFileSize: '30MB' }, notes: 'Feed and right column', restrictions: [] },
          { id: 'meta-carousel', name: 'Carousel (4:5)', format: 'Static Image', specs: { dimensions: '1080 x 1350 px', aspectRatio: '4:5', fileFormat: 'JPG, PNG', maxFileSize: '30MB', tiles: '3-5 tiles per carousel' }, notes: 'Can include short video/GIF. Different angles show full experience.', restrictions: [] },
          { id: 'meta-video-square', name: 'Video - Square (4:5)', format: 'Video', specs: { dimensions: '1080 x 1350 px', aspectRatio: '4:5', fileFormat: 'MOV, MP4', maxFileSize: '4GB', frameRate: '30fps max', duration: '1 second to 241 minutes' }, notes: 'Subtitles if dialogue. CTAs near beginning. 6, 15 & 30 sec variations recommended.', restrictions: [] },
          { id: 'meta-video-vertical', name: 'Video - Vertical (9:16)', format: 'Video', specs: { dimensions: '1080 x 1920 px', aspectRatio: '9:16', fileFormat: 'MOV, MP4', maxFileSize: '4GB', frameRate: '30fps max' }, notes: 'Stories and Reels', restrictions: [] },
        ],
      },
      {
        id: 'tiktok',
        name: 'TikTok',
        states: ['national'],
        placements: [
          { id: 'tiktok-infeed', name: 'In-Feed Video', format: 'Video', specs: { dimensions: '1080 x 1920 px', aspectRatio: '9:16', fileFormat: 'MP4, MOV', maxFileSize: '500MB', duration: '5-60 seconds', frameRate: '30fps' }, notes: 'Keep key content in safe zone. Sound-on environment.', restrictions: [] },
          { id: 'tiktok-topview', name: 'TopView', format: 'Video', specs: { dimensions: '1080 x 1920 px', aspectRatio: '9:16', fileFormat: 'MP4, MOV', maxFileSize: '500MB', duration: '5-60 seconds', frameRate: '30fps' }, notes: 'First ad users see when opening app', restrictions: [] },
          { id: 'tiktok-spark', name: 'Spark Ads (Boosted Organic)', format: 'Video', specs: { dimensions: '1080 x 1920 px', aspectRatio: '9:16', fileFormat: 'Native TikTok post' }, notes: 'Boost existing organic content', restrictions: [] },
        ],
      },
      {
        id: 'linkedin',
        name: 'LinkedIn',
        states: ['national'],
        placements: [
          { id: 'linkedin-single-image', name: 'Single Image Ad', format: 'Static Image', specs: { dimensions: '1200 x 627 px', aspectRatio: '1.91:1', fileFormat: 'JPG, PNG', maxFileSize: '5MB' }, notes: null, restrictions: [] },
          { id: 'linkedin-carousel', name: 'Carousel Ad', format: 'Static Image', specs: { dimensions: '1080 x 1080 px', aspectRatio: '1:1', fileFormat: 'JPG, PNG', maxFileSize: '10MB', tiles: '2-10 cards' }, notes: null, restrictions: [] },
          { id: 'linkedin-video', name: 'Video Ad', format: 'Video', specs: { dimensions: '1920 x 1080 px', aspectRatio: '16:9', fileFormat: 'MP4', maxFileSize: '200MB', duration: '3 seconds to 30 minutes', frameRate: '30fps max' }, notes: 'Recommended: 15-30 seconds', restrictions: [] },
        ],
      },
      {
        id: 'google-display',
        name: 'Google Display Network',
        states: ['national'],
        placements: [
          { id: 'gdn-300x250', name: 'Medium Rectangle (300x250)', format: 'Static Image', specs: { dimensions: '300 x 250 px', fileFormat: 'JPG, PNG, GIF', maxFileSize: '150KB' }, notes: 'Most common display size', restrictions: [] },
          { id: 'gdn-728x90', name: 'Leaderboard (728x90)', format: 'Static Image', specs: { dimensions: '728 x 90 px', fileFormat: 'JPG, PNG, GIF', maxFileSize: '150KB' }, notes: null, restrictions: [] },
          { id: 'gdn-160x600', name: 'Wide Skyscraper (160x600)', format: 'Static Image', specs: { dimensions: '160 x 600 px', fileFormat: 'JPG, PNG, GIF', maxFileSize: '150KB' }, notes: null, restrictions: [] },
          { id: 'gdn-320x50', name: 'Mobile Leaderboard (320x50)', format: 'Static Image', specs: { dimensions: '320 x 50 px', fileFormat: 'JPG, PNG, GIF', maxFileSize: '150KB' }, notes: null, restrictions: [] },
          { id: 'gdn-responsive', name: 'Responsive Display Ad', format: 'Static Image', specs: { landscapeImage: '1200 x 628 px', squareImage: '1200 x 1200 px', logo: '1200 x 1200 px', fileFormat: 'JPG, PNG', maxFileSize: '5MB per asset' }, notes: 'Provide multiple headlines and descriptions', restrictions: [] },
        ],
      },
      {
        id: 'youtube',
        name: 'YouTube',
        states: ['national'],
        placements: [
          { id: 'yt-skippable', name: 'Skippable In-Stream (TrueView)', format: 'Video', specs: { dimensions: '1920 x 1080 px', aspectRatio: '16:9', fileFormat: 'MP4, MOV', maxFileSize: '1GB', duration: '12 seconds minimum', frameRate: '30fps' }, notes: 'Users can skip after 5 seconds. Pay only when watched 30s or to completion.', restrictions: [] },
          { id: 'yt-non-skip', name: 'Non-Skippable In-Stream', format: 'Video', specs: { dimensions: '1920 x 1080 px', aspectRatio: '16:9', fileFormat: 'MP4, MOV', maxFileSize: '1GB', duration: '15-20 seconds', frameRate: '30fps' }, notes: 'Users must watch entire ad', restrictions: [] },
          { id: 'yt-bumper', name: 'Bumper Ad', format: 'Video', specs: { dimensions: '1920 x 1080 px', aspectRatio: '16:9', fileFormat: 'MP4, MOV', maxFileSize: '1GB', duration: '6 seconds max', frameRate: '30fps' }, notes: 'Non-skippable, best for awareness', restrictions: [] },
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
