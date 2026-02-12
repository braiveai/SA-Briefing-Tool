import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import * as XLSX from 'xlsx';

export async function POST(request) {
  const debugInfo = { steps: [] };

  try {
    debugInfo.steps.push('Starting request processing');

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        error: 'OpenAI API key not configured.',
        debug: debugInfo
      }, { status: 500 });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const formData = await request.formData();
    const file = formData.get('file');
    const providedChannel = formData.get('channel') || null;
    const providedPublisher = formData.get('publisher') || null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided', debug: debugInfo }, { status: 400 });
    }

    debugInfo.steps.push(`File received: ${file.name}`);

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name.toLowerCase();

    let result;

    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const content = extractFromExcel(buffer);
      debugInfo.steps.push(`Excel extracted: ${content.length} chars`);
      result = await parseWithAI(openai, content, debugInfo);
    } else if (fileName.endsWith('.csv')) {
      const content = buffer.toString('utf-8');
      debugInfo.steps.push(`CSV extracted: ${content.length} chars`);
      result = await parseWithAI(openai, content, debugInfo);
    } else if (fileName.endsWith('.pdf')) {
      debugInfo.steps.push('Processing PDF with vision...');
      result = await parsePDFWithVision(openai, buffer, debugInfo);
    } else {
      return NextResponse.json({
        error: 'Unsupported file type. Please upload Excel, CSV, or PDF.',
        debug: debugInfo
      }, { status: 400 });
    }

    // Use provided values if given, otherwise use AI-detected values
    const detectedChannel = providedChannel || result.detectedChannel || 'ooh';
    const detectedPublisher = providedPublisher || result.detectedPublisher || '';

    debugInfo.steps.push(`Parsed ${result.placements.length} placements, detected: ${detectedChannel}/${detectedPublisher}`);

    return NextResponse.json({
      success: true,
      detectedChannel,
      detectedPublisher,
      placements: result.placements,
      debug: debugInfo
    });

  } catch (error) {
    console.error('Error parsing schedule:', error);
    debugInfo.steps.push(`Error: ${error.message}`);
    return NextResponse.json({
      error: error.message || 'Failed to parse schedule',
      debug: debugInfo
    }, { status: 500 });
  }
}

function extractFromExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  let allText = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
    
    allText.push(`=== Sheet: ${sheetName} ===`);
    
    for (const row of data) {
      const cells = row.map(cell => cell === null || cell === undefined ? '' : String(cell).trim());
      const rowText = cells.filter(c => c !== '').join(' | ');
      if (rowText.trim()) {
        allText.push(rowText);
      }
    }
  }

  return allText.join('\n');
}

// Shared prompt - AI figures out everything
const EXTRACTION_PROMPT = `You are a media schedule parser. Extract placement data and return ONLY valid JSON.

YOUR RESPONSE MUST BE PURE JSON - no markdown, no explanation, no text before or after.
Start your response with { and end with }

Return this structure:
{
  "mediaType": "ooh|tv|radio|digital",
  "publisher": "publisher/media owner name from the document",
  "placements": [...]
}

DETECTION INSTRUCTIONS:
1. Determine mediaType from document content:
   - "radio" = radio stations, AM/FM, dayparts like Breakfast/Drive, spot lengths
   - "tv" = TV channels, programs, networks, TVCs
   - "ooh" = billboards, digital screens, panels, street furniture, pixel dimensions
   - "digital" = online ads, impressions, CPM, programmatic

2. Find publisher/media owner from logos, headers, footers, or document branding

3. Extract ALL line items as placements with relevant fields:

FOR RADIO:
- siteName: descriptive name (e.g., "Gold FM Bendigo - Breakfast 30s")  
- station: station name
- daypart: time segment (Breakfast, Morning, Drive, etc.)
- spotLength: duration in seconds
- spots: total spot count
- startDate, endDate: YYYY-MM-DD format

FOR TV:
- siteName, station, program, daypart, spotLength, spots, startDate, endDate

FOR OOH:
- siteName, panelId, dimensions (as "WxH px"), location, suburb, state
- startDate, endDate, direction, restrictions

FOR DIGITAL:
- siteName, platform, format, dimensions, impressions, startDate, endDate

RULES:
- Convert ALL dates to YYYY-MM-DD format
- Extract EVERY placement/line item
- Omit fields that are empty or not present
- Use the contract/campaign dates if individual placement dates aren't specified`;

async function parsePDFWithVision(openai, buffer, debugInfo) {
  const base64PDF = buffer.toString('base64');

  debugInfo.steps.push('Calling OpenAI vision...');

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
              file_data: `data:application/pdf;base64,${base64PDF}`,
            },
          },
          {
            type: 'text',
            text: 'Extract all placements. Return ONLY JSON, nothing else.',
          },
        ],
      },
    ],
    max_tokens: 16000,
    temperature: 0.1,
  });

  const responseText = response.choices[0].message.content;
  debugInfo.steps.push('OpenAI vision responded');
  
  const parsed = extractJSON(responseText, debugInfo);
  return normalizeResult(parsed);
}

async function parseWithAI(openai, content, debugInfo) {
  let textContent = content;
  if (content.length > 25000) {
    textContent = content.substring(0, 25000);
    debugInfo.steps.push('Content truncated to 25k chars');
  }

  debugInfo.steps.push('Calling OpenAI...');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: EXTRACTION_PROMPT },
      { role: 'user', content: `Extract all placements from this schedule:\n\n${textContent}` }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
    max_tokens: 16000,
  });

  const responseText = response.choices[0].message.content;
  debugInfo.steps.push(`OpenAI responded (finish: ${response.choices[0].finish_reason})`);

  if (response.choices[0].finish_reason === 'length') {
    throw new Error('Response truncated - file may be too large. Try a smaller file.');
  }

  const parsed = extractJSON(responseText, debugInfo);
  return normalizeResult(parsed);
}

function extractJSON(responseText, debugInfo) {
  // Clean up the response
  let text = responseText.trim();
  
  // Remove markdown code blocks if present
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    text = codeBlockMatch[1].trim();
  }
  
  // Try parsing directly
  try {
    return JSON.parse(text);
  } catch (e) {
    debugInfo.steps.push(`Direct parse failed: ${e.message.substring(0, 50)}`);
  }
  
  // Try to find JSON object in text
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  
  if (jsonStart !== -1 && jsonEnd > jsonStart) {
    try {
      return JSON.parse(text.substring(jsonStart, jsonEnd + 1));
    } catch (e) {
      debugInfo.steps.push(`Substring parse failed: ${e.message.substring(0, 50)}`);
    }
  }
  
  // Try to find JSON array
  const arrayStart = text.indexOf('[');
  const arrayEnd = text.lastIndexOf(']');
  
  if (arrayStart !== -1 && arrayEnd > arrayStart) {
    try {
      const arr = JSON.parse(text.substring(arrayStart, arrayEnd + 1));
      return { placements: arr };
    } catch (e) {
      debugInfo.steps.push(`Array parse failed: ${e.message.substring(0, 50)}`);
    }
  }
  
  // All methods failed
  debugInfo.rawResponse = text.substring(0, 1000);
  throw new Error('Failed to parse AI response. Try uploading an Excel or CSV version instead.');
}

function normalizeResult(parsed) {
  // Extract placements array
  let placements = parsed.placements || [];
  
  if (!Array.isArray(placements)) {
    // Look for any array in the response
    for (const key of Object.keys(parsed)) {
      if (Array.isArray(parsed[key]) && parsed[key].length > 0) {
        placements = parsed[key];
        break;
      }
    }
  }
  
  if (placements.length === 0) {
    throw new Error('No placements found in document.');
  }
  
  // Normalize each placement
  const normalized = placements.map((p, i) => ({
    siteName: p.siteName || p.name || p.station || p.panelName || `Placement ${i + 1}`,
    station: p.station || null,
    daypart: p.daypart || p.dayPart || null,
    spotLength: p.spotLength || p.duration || null,
    spots: p.spots || p.spotCount || p.total || null,
    panelId: p.panelId || null,
    dimensions: p.dimensions || (p.pixelWidth && p.pixelHeight ? `${p.pixelWidth}x${p.pixelHeight} px` : null),
    location: p.location || null,
    suburb: p.suburb || null,
    state: p.state || null,
    direction: p.direction || null,
    restrictions: p.restrictions || null,
    platform: p.platform || null,
    impressions: p.impressions || null,
    startDate: normalizeDate(p.startDate || p.start_date || p.start),
    endDate: normalizeDate(p.endDate || p.end_date || p.end),
    format: p.format || null,
  }));
  
  return {
    placements: normalized,
    detectedChannel: parsed.mediaType || null,
    detectedPublisher: parsed.publisher || null,
  };
}

function normalizeDate(dateStr) {
  if (!dateStr) return null;
  
  const str = String(dateStr).trim();
  
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.substring(0, 10);
  }
  
  // DD/MM/YYYY or DD.MM.YYYY
  const ddmmyyyy = str.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/);
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  
  // Try native parsing
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  
  return null;
}
