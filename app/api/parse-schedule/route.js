import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import * as XLSX from 'xlsx';
import AdmZip from 'adm-zip';

export async function POST(request) {
  const debug = { steps: [] };

  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured.' }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    debug.steps.push(`Received: ${file.name}`);
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name.toLowerCase();

    let result;

    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const content = extractExcel(buffer);
      debug.steps.push(`Excel: ${content.length} chars`);
      result = await parseWithAI(openai, content, debug);
    } else if (fileName.endsWith('.csv')) {
      const content = buffer.toString('utf-8');
      debug.steps.push(`CSV: ${content.length} chars`);
      result = await parseWithAI(openai, content, debug);
    } else if (fileName.endsWith('.pdf')) {
      debug.steps.push('PDF → Vision API');
      result = await parsePDFWithVision(openai, buffer, debug);
    } else {
      return NextResponse.json({ error: 'Unsupported file type. Use Excel, CSV, or PDF.' }, { status: 400 });
    }

    // Validate result
    const validation = validateResult(result);
    if (!validation.valid) {
      debug.steps.push(`Validation failed: ${validation.issues.join(', ')}`);
      
      // Retry with stricter prompt if we got generic names
      if (validation.issues.some(i => i.includes('generic'))) {
        debug.steps.push('Retrying with stricter prompt...');
        // Could implement retry here
      }
    }

    debug.steps.push(`Result: ${result.placements.length} placements, ${result.detectedChannel}/${result.detectedPublisher}`);

    return NextResponse.json({
      success: true,
      detectedChannel: result.detectedChannel,
      detectedPublisher: result.detectedPublisher,
      placements: result.placements,
      validation: validation,
      debug
    });

  } catch (error) {
    console.error('Parse error:', error);
    debug.steps.push(`Error: ${error.message}`);
    return NextResponse.json({ error: error.message || 'Failed to parse schedule', debug }, { status: 500 });
  }
}

// ============================================
// EXCEL EXTRACTION - Enhanced to identify spec headers AND floating text boxes
// ============================================
function extractExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const lines = [];
  
  // FIRST: Try to extract text from floating text boxes/shapes (drawings)
  const drawingText = extractDrawingText(buffer);
  if (drawingText.length > 0) {
    lines.push('--- PUBLISHER REQUIREMENTS (from document header/text box) ---');
    drawingText.forEach(text => {
      lines.push(`[PUBLISHER SPECS] ${text}`);
    });
    lines.push('--- END PUBLISHER REQUIREMENTS ---');
    lines.push('');
  }
  
  // Keywords that indicate publisher spec info (not placement data)
  const specKeywords = [
    'important', 'specification', 'requirement', 'artwork', 'dpi', 'bitrate',
    'file size', 'max size', 'working days', 'lead time', 'deadline',
    'jpeg', 'png', 'mp4', 'video', 'audio', 'format', 'resolution',
    'delivery', 'submit', 'contact', '@', '.com'
  ];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
    
    lines.push(`=== Sheet: ${sheetName} ===`);
    
    // First pass: identify header rows vs data rows
    let headerSection = [];
    let dataSection = [];
    let foundTable = false;
    
    for (const row of data) {
      const cells = row.map(c => c == null ? '' : String(c).trim()).filter(c => c);
      if (cells.length === 0) continue;
      
      const rowText = cells.join(' ').toLowerCase();
      
      // Check if this looks like a table header (has multiple column-like entries)
      const hasDateColumns = rowText.includes('date') || rowText.includes('start') || rowText.includes('end');
      const hasDimensionColumns = rowText.includes('width') || rowText.includes('height') || rowText.includes('pixel');
      
      if ((hasDateColumns && hasDimensionColumns) || rowText.includes('postcode') || rowText.includes('booking')) {
        foundTable = true;
      }
      
      // Check if row contains spec keywords
      const hasSpecKeywords = specKeywords.some(kw => rowText.includes(kw));
      
      if (!foundTable && hasSpecKeywords) {
        headerSection.push(`[PUBLISHER SPECS] ${cells.join(' | ')}`);
      } else if (foundTable || cells.length >= 3) {
        dataSection.push(cells.join(' | '));
      } else if (hasSpecKeywords) {
        // Spec info found after table started
        headerSection.push(`[PUBLISHER SPECS] ${cells.join(' | ')}`);
      } else {
        dataSection.push(cells.join(' | '));
      }
    }
    
    // Output header section first (tagged) - only if we didn't already get drawing text
    if (headerSection.length > 0 && drawingText.length === 0) {
      lines.push('--- PUBLISHER REQUIREMENTS (extract these as publisherSpecs) ---');
      lines.push(...headerSection);
      lines.push('--- END PUBLISHER REQUIREMENTS ---');
    }
    
    // Then data section
    lines.push(...dataSection);
  }

  return lines.join('\n');
}

// ============================================
// EXTRACT TEXT FROM EXCEL DRAWINGS (text boxes, shapes)
// Uses adm-zip to read the xlsx as a zip archive and extract DrawingML text
// ============================================
function extractDrawingText(buffer) {
  const texts = [];
  
  try {
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();
    
    for (const entry of entries) {
      const name = entry.entryName;
      // Look for drawing XML files AND vmlDrawing files (text boxes can be in either)
      if ((name.includes('drawings/') || name.includes('vmlDrawing')) && (name.endsWith('.xml') || name.endsWith('.vml'))) {
        const content = entry.getData().toString('utf8');
        
        if (content) {
          // Extract text from DrawingML <a:t> tags (standard drawings)
          const drawingMatches = content.match(/<a:t>([^<]+)<\/a:t>/g);
          // Also extract from VML <t> tags inside text boxes
          const vmlMatches = content.match(/<v:textbox[^>]*>[\s\S]*?<\/v:textbox>/gi);
          
          let allTextParts = [];
          
          if (drawingMatches) {
            allTextParts = drawingMatches
              .map(match => match.replace(/<\/?a:t>/g, '').trim())
              .filter(t => t);
          }
          
          if (vmlMatches) {
            for (const vmlBlock of vmlMatches) {
              // Extract text content from within VML textboxes
              const innerText = vmlBlock.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
              if (innerText) allTextParts.push(innerText);
            }
          }
          
          if (allTextParts.length > 0) {
            const allText = allTextParts.join(' ').trim();
            // Text boxes in media schedules are almost always spec/requirement info
            // Don't filter by keywords - let the AI decide what's relevant
            if (allText.length > 10) {
              texts.push(allText);
            }
          }
        }
      }
    }
  } catch (err) {
    // If parsing fails, continue without drawing text - cell extraction still works
    console.log('Drawing extraction skipped:', err.message);
  }
  
  return texts;
}

// ============================================
// AI PROMPT - Explicit about site names, date formats, publisher specs
// ============================================
const EXTRACTION_PROMPT = `You are a media schedule parser. Extract placement data and return ONLY valid JSON.

Return this exact structure:
{
  "mediaType": "ooh|tv|radio|digital",
  "publisher": "publisher name you detect",
  "publisherSpecs": {
    "fileFormat": "JPEG, PNG, MP4, etc.",
    "maxFileSize": "5MB, 10MB, etc.",
    "dpi": "72 dpi, 300 dpi, etc.",
    "videoSpecs": "bitrate, codec, audio requirements if applicable",
    "leadTime": "5 working days, 7 days, etc.",
    "deliveryEmail": "email address for submissions if found",
    "notes": "any other important requirements"
  },
  "placements": [...]
}

PUBLISHER SPECS - CRITICAL:
- Look for sections tagged [PUBLISHER SPECS] - these contain document-level requirements
- Also look for "IMPORTANT INFO", "Specifications", "Requirements", "Artwork Guidelines" sections
- These are usually in headers, footers, or highlighted sections (often pink/colored)
- Extract ALL technical requirements: file format, size limits, DPI, video specs, lead times
- This is document-level info that applies to ALL placements
- If a spec mentions "5 working days" or similar, capture it in leadTime
- If video specs mention bitrate, codec, audio - capture in videoSpecs
- If there's an email address for submissions, capture in deliveryEmail

CRITICAL RULES FOR SITE NAMES:
- siteName MUST be the actual location/panel name from the document
- NEVER use generic terms like "Billboard", "Digital Billboard", "Panel", "Site", "Screen"
- Look for actual street names, venue names, shopping centre names, intersection names
- Examples of GOOD siteNames: "Olsen Drive Southport", "Pacific Mwy - Stewart Rd Overpass", "Westfield Bondi Junction Entry"
- Examples of BAD siteNames: "Billboard", "Digital Billboard", "Large Format", "Retail Screen"
- If you cannot find a specific name, use the panel ID or site code instead

CHANNEL DEFINITIONS:

OOH (Out of Home) - Physical advertising in public spaces:
- Billboards, digital billboards, street furniture, transit, retail displays
- Physical screens in malls, airports, bus stops, roadside
- "Digital Billboard" = OOH (physical screen), NOT digital channel
- "Large Format Digital" = OOH
- Common publishers: JCDecaux, oOh!, QMS, Bishopp, LUMO, GOA

RADIO - Audio advertising on radio stations:
- AM/FM radio stations
- Look for: station names, dayparts (Breakfast, Drive), spot durations
- Common publishers: ARN, SCA, Nova, ACE Radio, Grant Broadcasters

TV - Television advertising:
- Broadcast TV channels and programs
- Common publishers: Seven, Nine, Ten, SBS, Foxtel

DIGITAL - Online/internet advertising only:
- Social media, programmatic, display ads, search ads
- NOT physical screens - those are OOH
- Common publishers: Google, Meta, TikTok, LinkedIn, Spotify

DATE HANDLING:
- Infer date format from publisher/region context
- Australian publishers (QMS, JCDecaux, oOh!, ARN, SCA, etc.) use DD/MM/YYYY
- Always OUTPUT dates as YYYY-MM-DD regardless of input format
- If a date like "01/02/2025" is ambiguous, check other dates in the document - if ANY date has day > 12, the whole document uses DD/MM format

PLACEMENT FIELDS TO EXTRACT:

For OOH:
- siteName: ACTUAL location name (street, venue, intersection) - NEVER "Billboard"
- panelId: unique ID/code if available
- dimensions: "WIDTHxHEIGHT px" format
- location: full address/location description
- suburb: suburb name
- state: state abbreviation
- startDate, endDate: YYYY-MM-DD format
- direction: if available (Inbound/Outbound)
- fileType: from the File Type/s column if present (jpeg, mp4, etc.)
- slotLength: duration in seconds if applicable

For Radio:
- siteName: "Station - Daypart Duration" (e.g., "Gold FM - Breakfast 30s")
- station: station name
- daypart: Breakfast, Morning, Drive, etc.
- spotLength: seconds as number
- startDate, endDate: YYYY-MM-DD format

VERIFICATION BEFORE RESPONDING:
1. Check: Did you extract publisherSpecs from any header/footer info sections?
2. Check: Are ALL siteName values actual location names (not generic terms)?
3. Check: Are ALL dates in YYYY-MM-DD format?
4. Check: Is mediaType correct based on the content?

YOUR RESPONSE: Pure JSON only. No markdown, no explanation. Start with { end with }`;

// ============================================
// PARSE WITH AI (Excel/CSV)
// ============================================
async function parseWithAI(openai, content, debug) {
  let text = content;
  if (text.length > 30000) {
    text = text.substring(0, 30000);
    debug.steps.push('Truncated to 30k');
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: EXTRACTION_PROMPT },
      { role: 'user', content: `Extract placements from this schedule. Remember: siteName must be actual location names, never generic terms like "Billboard".\n\n${text}` }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
    max_tokens: 16000,
  });

  debug.steps.push(`AI responded (${response.choices[0].finish_reason})`);

  if (response.choices[0].finish_reason === 'length') {
    throw new Error('Response truncated - file may be too large');
  }

  const parsed = extractJSON(response.choices[0].message.content, debug);
  return normalize(parsed, debug);
}

// ============================================
// PARSE PDF WITH VISION
// ============================================
async function parsePDFWithVision(openai, buffer, debug) {
  const base64 = buffer.toString('base64');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: EXTRACTION_PROMPT },
      {
        role: 'user',
        content: [
          {
            type: 'file',
            file: {
              filename: 'schedule.pdf',
              file_data: `data:application/pdf;base64,${base64}`,
            },
          },
          { type: 'text', text: `Extract all placements from this media schedule.

IMPORTANT: 
1. Look for colored/highlighted boxes (often pink, yellow, or bordered) containing artwork specifications, file requirements, deadlines, and delivery info. Extract these as publisherSpecs.
2. siteName must be actual location names (streets, venues, intersections) - never generic terms like "Billboard".
3. Return ONLY valid JSON.` },
        ],
      },
    ],
    max_tokens: 16000,
    temperature: 0.1,
  });

  debug.steps.push('Vision API responded');
  const parsed = extractJSON(response.choices[0].message.content, debug);
  return normalize(parsed, debug);
}

// ============================================
// JSON EXTRACTION
// ============================================
function extractJSON(text, debug) {
  let clean = text.trim();
  
  // Remove markdown code blocks
  const codeMatch = clean.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeMatch) clean = codeMatch[1].trim();
  
  // Try direct parse
  try {
    return JSON.parse(clean);
  } catch (e) {
    debug.steps.push('Direct parse failed, trying extraction');
  }
  
  // Find JSON boundaries
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(clean.substring(start, end + 1));
    } catch (e) {
      debug.steps.push('Extraction failed');
    }
  }
  
  throw new Error('Could not parse AI response as JSON');
}

// ============================================
// SMART DATE DETECTION & NORMALIZATION
// ============================================
function detectDateFormat(placements) {
  // Scan all date-like strings to infer format
  // If ANY date has day > 12, whole doc is DD/MM
  
  const dateStrings = [];
  
  placements.forEach(p => {
    if (p.startDate) dateStrings.push(String(p.startDate));
    if (p.endDate) dateStrings.push(String(p.endDate));
    if (p.start_date) dateStrings.push(String(p.start_date));
    if (p.end_date) dateStrings.push(String(p.end_date));
    if (p.bookingStartDate) dateStrings.push(String(p.bookingStartDate));
    if (p.bookingEndDate) dateStrings.push(String(p.bookingEndDate));
  });
  
  for (const dateStr of dateStrings) {
    // Check for DD/MM/YYYY or DD-MM-YYYY patterns
    const match = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (match) {
      const first = parseInt(match[1]);
      const second = parseInt(match[2]);
      
      // If first number > 12, it MUST be a day (DD/MM format)
      if (first > 12) return 'DD/MM';
      // If second number > 12, it MUST be a day (MM/DD format)
      if (second > 12) return 'DD/MM'; // Actually this means first is month, second is day - but in AU context, more likely DD/MM
    }
  }
  
  // Default to DD/MM for Australian context
  return 'DD/MM';
}

function normalizeDate(dateStr, format = 'DD/MM') {
  if (!dateStr) return null;
  
  const s = String(dateStr).trim();
  
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  
  // Parse based on detected format
  const slashMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (slashMatch) {
    let [, first, second, year] = slashMatch;
    
    // Handle 2-digit year
    if (year.length === 2) {
      year = parseInt(year) > 50 ? `19${year}` : `20${year}`;
    }
    
    let day, month;
    if (format === 'DD/MM') {
      day = first;
      month = second;
    } else {
      month = first;
      day = second;
    }
    
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // DD-Mon-YYYY (e.g., 15-Dec-2025)
  const dMonY = s.match(/^(\d{1,2})[\/\-](\w{3})[\/\-](\d{4})/);
  if (dMonY) {
    const [, d, mon, y] = dMonY;
    const months = { jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06',
                     jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12' };
    const m = months[mon.toLowerCase()];
    if (m) return `${y}-${m}-${d.padStart(2, '0')}`;
  }
  
  // Try native Date
  try {
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  } catch {}
  
  return null;
}

// ============================================
// NORMALIZE RESULT
// ============================================
function normalize(parsed, debug) {
  // Get placements array
  let placements = parsed.placements || [];
  
  if (!Array.isArray(placements)) {
    for (const key of Object.keys(parsed)) {
      if (Array.isArray(parsed[key]) && parsed[key].length > 0) {
        placements = parsed[key];
        break;
      }
    }
  }
  
  if (placements.length === 0) {
    throw new Error('No placements found in document');
  }
  
  // Detect date format from all dates in document
  const dateFormat = detectDateFormat(placements);
  debug.steps.push(`Detected date format: ${dateFormat}`);
  
  // Normalize each placement
  const normalized = placements.map((p, i) => {
    // Build dimensions if we have width/height
    let dimensions = p.dimensions || null;
    if (!dimensions && p.pixelWidth && p.pixelHeight) {
      dimensions = `${p.pixelWidth}x${p.pixelHeight} px`;
    }
    if (!dimensions && p.pixel_width && p.pixel_height) {
      dimensions = `${p.pixel_width}x${p.pixel_height} px`;
    }
    
    // Clean up siteName - remove generic prefixes
    let siteName = p.siteName || p.name || p.panelName || p.panel_name || p.location || `Placement ${i + 1}`;
    
    // If siteName is generic, try to use panelId or other identifier
    const genericNames = ['billboard', 'digital billboard', 'panel', 'site', 'screen', 'large format', 'retail'];
    if (genericNames.some(g => siteName.toLowerCase() === g || siteName.toLowerCase() === `${g} ${i + 1}`)) {
      siteName = p.panelId || p.panel_id || p.siteCode || p.location || `Site ${p.panelId || i + 1}`;
    }
    
    return {
      siteName,
      panelId: p.panelId || p.panel_id || p.siteCode || p.site_code || null,
      dimensions,
      location: p.location || null,
      suburb: p.suburb || p.suburbName || null,
      state: p.state || p.stateName || null,
      direction: p.direction || p.panelDirection || null,
      fileType: p.fileType || p.file_type || null,
      slotLength: p.slotLength || p.slot_length || null,
      station: p.station || null,
      daypart: p.daypart || p.dayPart || p.day_part || null,
      spotLength: p.spotLength || p.duration || p.dur || null,
      spots: p.spots || p.total || p.spotCount || null,
      startDate: normalizeDate(p.startDate || p.start_date || p.bookingStartDate, dateFormat),
      endDate: normalizeDate(p.endDate || p.end_date || p.bookingEndDate, dateFormat),
      format: p.format || p.sizeName || null,
      _importId: `import-${Date.now()}-${i}`,
    };
  });
  
  // Extract and normalize publisher specs
  const publisherSpecs = parsed.publisherSpecs || {};
  
  return {
    placements: normalized,
    detectedChannel: parsed.mediaType || null,
    detectedPublisher: parsed.publisher || null,
    publisherSpecs: {
      fileFormat: publisherSpecs.fileFormat || null,
      maxFileSize: publisherSpecs.maxFileSize || null,
      dpi: publisherSpecs.dpi || null,
      videoSpecs: publisherSpecs.videoSpecs || null,
      leadTime: publisherSpecs.leadTime || null,
      deliveryEmail: publisherSpecs.deliveryEmail || null,
      notes: publisherSpecs.notes || null,
    },
  };
}

// ============================================
// VALIDATION
// ============================================
function validateResult(result) {
  const issues = [];
  
  const genericNames = ['billboard', 'digital billboard', 'panel', 'site', 'screen', 'large format', 'retail', 'placement'];
  
  result.placements.forEach((p, i) => {
    // Check for generic site names
    if (genericNames.some(g => p.siteName.toLowerCase() === g || p.siteName.toLowerCase().startsWith(g + ' '))) {
      issues.push(`Placement ${i + 1}: generic siteName "${p.siteName}"`);
    }
    
    // Check for invalid dates
    if (p.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(p.startDate)) {
      issues.push(`Placement ${i + 1}: invalid startDate "${p.startDate}"`);
    }
    if (p.endDate && !/^\d{4}-\d{2}-\d{2}$/.test(p.endDate)) {
      issues.push(`Placement ${i + 1}: invalid endDate "${p.endDate}"`);
    }
    
    // Check for dates outside reasonable range
    if (p.startDate) {
      const year = parseInt(p.startDate.substring(0, 4));
      if (year < 2020 || year > 2030) {
        issues.push(`Placement ${i + 1}: suspicious year ${year}`);
      }
    }
  });
  
  // Check channel detection
  if (!result.detectedChannel) {
    issues.push('No channel detected');
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}
