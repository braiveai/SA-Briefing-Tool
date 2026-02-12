import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import * as XLSX from 'xlsx';

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

    debug.steps.push(`Result: ${result.placements.length} placements, ${result.detectedChannel}/${result.detectedPublisher}`);

    return NextResponse.json({
      success: true,
      detectedChannel: result.detectedChannel,
      detectedPublisher: result.detectedPublisher,
      placements: result.placements,
      debug
    });

  } catch (error) {
    console.error('Parse error:', error);
    debug.steps.push(`Error: ${error.message}`);
    return NextResponse.json({ error: error.message || 'Failed to parse schedule', debug }, { status: 500 });
  }
}

// ============================================
// EXCEL EXTRACTION
// ============================================
function extractExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const lines = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
    
    lines.push(`=== Sheet: ${sheetName} ===`);
    
    for (const row of data) {
      const cells = row.map(c => c == null ? '' : String(c).trim()).filter(c => c);
      if (cells.length > 0) {
        lines.push(cells.join(' | '));
      }
    }
  }

  return lines.join('\n');
}

// ============================================
// AI PROMPT - Teaches AI what channels mean, AI decides
// ============================================
const EXTRACTION_PROMPT = `You are a media schedule parser. Extract placement data and return ONLY valid JSON.

Return this exact structure:
{
  "mediaType": "ooh|tv|radio|digital",
  "publisher": "publisher name you detect",
  "placements": [...]
}

CHANNEL DEFINITIONS (use these to determine mediaType):

OOH (Out of Home) - Physical advertising in public spaces:
- Billboards, digital billboards, street furniture, transit, retail displays
- Physical screens in malls, airports, bus stops, roadside
- Look for: panel IDs, pixel dimensions for physical screens, site codes, locations/suburbs
- Common publishers: JCDecaux, oOh!, QMS, Bishopp, LUMO, GOA
- Note: "Digital Billboard" or "Large Format Digital" = OOH (physical screen), NOT digital channel

RADIO - Audio advertising on radio stations:
- AM/FM radio stations, spots during programs
- Look for: station names, dayparts (Breakfast, Drive), spot durations (15s, 30s), start/end times
- Common publishers: ARN, SCA, Nova, ACE Radio, Grant Broadcasters

TV - Television advertising:
- Broadcast TV channels and programs
- Look for: channel names, program names, TVCs, networks
- Common publishers: Seven, Nine, Ten, Foxtel, SBS

DIGITAL - Online/internet advertising only:
- Social media, programmatic, display ads, search ads
- Look for: impressions, CPM, clicks, online platforms
- Common publishers: Google, Meta, TikTok, LinkedIn, Spotify
- Note: Physical digital screens are OOH, not this category

PLACEMENT FIELDS TO EXTRACT:

For OOH:
- siteName: panel/site name
- panelId: unique ID
- dimensions: "WIDTHxHEIGHT px" format
- location, suburb, state
- startDate, endDate: YYYY-MM-DD
- direction: if available
- restrictions: content restrictions

For Radio:
- siteName: "Station - Daypart Duration" (e.g., "Gold FM - Breakfast 30s")
- station: station name
- daypart: Breakfast, Morning, Drive, etc.
- spotLength: seconds as number
- spots: total count
- startDate, endDate: YYYY-MM-DD (use contract dates)

For TV:
- siteName: channel/program name
- spotLength: seconds
- startDate, endDate

For Digital:
- siteName: platform/placement name
- format: ad format
- dimensions: if applicable
- startDate, endDate

DATE FORMAT: Always YYYY-MM-DD. Convert any format you see.

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
      { role: 'user', content: `Extract placements:\n\n${text}` }
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
  return normalize(parsed);
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
          { type: 'text', text: 'Extract all placements. Return ONLY valid JSON.' },
        ],
      },
    ],
    max_tokens: 16000,
    temperature: 0.1,
  });

  debug.steps.push('Vision API responded');
  const parsed = extractJSON(response.choices[0].message.content, debug);
  return normalize(parsed);
}

// ============================================
// JSON EXTRACTION (handles markdown, etc)
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
// NORMALIZE RESULT
// No detection logic here - just clean up data
// ============================================
function normalize(parsed) {
  // Get placements array
  let placements = parsed.placements || [];
  
  if (!Array.isArray(placements)) {
    // Find first array in response
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
  
  // Normalize each placement - just field mapping and date formatting
  const normalized = placements.map((p, i) => {
    // Build dimensions if we have width/height
    let dimensions = p.dimensions || null;
    if (!dimensions && p.pixelWidth && p.pixelHeight) {
      dimensions = `${p.pixelWidth}x${p.pixelHeight} px`;
    }
    if (!dimensions && p.pixel_width && p.pixel_height) {
      dimensions = `${p.pixel_width}x${p.pixel_height} px`;
    }
    
    return {
      siteName: p.siteName || p.name || p.panelName || p.panel_name || `Placement ${i + 1}`,
      panelId: p.panelId || p.panel_id || p.siteCode || p.site_code || null,
      dimensions,
      location: p.location || null,
      suburb: p.suburb || p.suburbName || null,
      state: p.state || p.stateName || null,
      direction: p.direction || p.panelDirection || null,
      restrictions: p.restrictions || null,
      station: p.station || null,
      daypart: p.daypart || p.dayPart || p.day_part || null,
      spotLength: p.spotLength || p.duration || p.dur || null,
      spots: p.spots || p.total || p.spotCount || null,
      startDate: normalizeDate(p.startDate || p.start_date || p.bookingStartDate),
      endDate: normalizeDate(p.endDate || p.end_date || p.bookingEndDate),
      format: p.format || p.sizeName || null,
      _importId: `import-${Date.now()}-${i}`,
    };
  });
  
  return {
    placements: normalized,
    detectedChannel: parsed.mediaType || null,
    detectedPublisher: parsed.publisher || null,
  };
}

// ============================================
// DATE NORMALIZATION
// ============================================
function normalizeDate(dateStr) {
  if (!dateStr) return null;
  
  const s = String(dateStr).trim();
  
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  
  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  
  // DD-Mon-YYYY
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
