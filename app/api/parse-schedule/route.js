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

    debugInfo.steps.push('API key found');

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'No file provided', debug: debugInfo }, { status: 400 });
    }

    debugInfo.steps.push(`File received: ${file.name}, size: ${file.size}`);

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

    debugInfo.steps.push(`Parsed ${result.placements.length} placements, mediaType: ${result.mediaType}`);

    return NextResponse.json({
      success: true,
      mediaType: result.mediaType,
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
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    let allText = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
      
      allText.push(`=== ${sheetName} ===`);
      
      for (const row of data) {
        const cells = row.map(cell => {
          if (cell === null || cell === undefined) return '';
          return String(cell).trim();
        });
        const rowText = cells.filter(c => c !== '').join(' | ');
        if (rowText.trim()) {
          allText.push(rowText);
        }
      }
    }

    return allText.join('\n');
  } catch (e) {
    throw new Error(`Failed to read Excel: ${e.message}`);
  }
}

// PDF parsing using GPT-4o vision
async function parsePDFWithVision(openai, buffer, debugInfo) {
  const base64PDF = buffer.toString('base64');
  
  const systemPrompt = getSystemPrompt();

  debugInfo.steps.push('Calling OpenAI vision...');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
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
            text: 'Extract all placements from this media schedule PDF.',
          },
        ],
      },
    ],
    max_tokens: 16000,
  });

  const responseText = response.choices[0].message.content;
  debugInfo.steps.push('OpenAI vision responded');

  // Extract JSON from response (might be wrapped in markdown)
  let jsonStr = responseText;
  const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    debugInfo.rawResponse = responseText.substring(0, 500);
    throw new Error('Failed to parse AI response as JSON');
  }

  const mediaType = parsed.mediaType || 'ooh';
  let placements = parsed.placements || parsed || [];
  
  if (!Array.isArray(placements)) {
    for (const key of Object.keys(parsed)) {
      if (Array.isArray(parsed[key])) {
        placements = parsed[key];
        break;
      }
    }
  }

  if (placements.length === 0) {
    throw new Error('No placements found in PDF.');
  }

  const normalized = placements.map((p, i) => normalizePlacement(p, mediaType, i));
  return { mediaType, placements: normalized };
}

// Text-based parsing for Excel/CSV
async function parseWithAI(openai, content, debugInfo) {
  const systemPrompt = getSystemPrompt();

  let textContent = content;
  if (content.length > 25000) {
    textContent = content.substring(0, 25000);
    debugInfo.steps.push('Content truncated');
  }

  debugInfo.steps.push('Calling OpenAI...');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Extract all placements:\n\n${textContent}` }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
    max_tokens: 16000,
  });

  const responseText = response.choices[0].message.content;
  const finishReason = response.choices[0].finish_reason;
  debugInfo.steps.push(`OpenAI responded (finish: ${finishReason})`);

  if (finishReason === 'length') {
    throw new Error('Response truncated - file too large.');
  }

  let parsed;
  try {
    parsed = JSON.parse(responseText);
  } catch (e) {
    throw new Error('OpenAI returned invalid JSON');
  }

  const mediaType = parsed.mediaType || 'ooh';
  
  let placements = [];
  if (Array.isArray(parsed.placements)) {
    placements = parsed.placements;
  } else if (Array.isArray(parsed)) {
    placements = parsed;
  } else {
    for (const key of Object.keys(parsed)) {
      if (Array.isArray(parsed[key]) && parsed[key].length > 0) {
        placements = parsed[key];
        break;
      }
    }
  }

  if (placements.length === 0) {
    throw new Error('No placements found in file.');
  }

  const normalized = placements.map((p, i) => normalizePlacement(p, mediaType, i));
  return { mediaType, placements: normalized };
}

function getSystemPrompt() {
  return `You analyze media schedules from various publishers.

STEP 1: Identify media type:
- "ooh" = Out of Home: billboards, screens, street furniture
- "tv" = Television: networks, programs, spot lengths
- "radio" = Radio: stations, dayparts
- "print" = Print: publications, ad sizes
- "digital" = Digital: platforms, impressions

STEP 2: Extract ALL placements with relevant fields.

Return JSON:
{
  "mediaType": "ooh|tv|radio|print|digital",
  "placements": [...]
}

For OOH: siteName, panelId, dimensions, pixelWidth, pixelHeight, location, suburb, state, startDate, endDate, restrictions, prohibitions, direction, format

For TV/Radio: siteName (use station name), station, network, program, daypart, spotLength, startDate, endDate, spots

For Print: siteName (use publication name), publication, section, adSize, insertionDate

For Digital: siteName (use platform name), platform, format, dimensions, impressions, startDate, endDate

RULES:
- Convert dates to YYYY-MM-DD
- Extract EVERY row
- Combine restrictions and prohibitions
- Omit empty fields
- Create dimensions as "WxH px" from pixelWidth/pixelHeight`;
}

function normalizePlacement(p, mediaType, index) {
  let dimensions = p.dimensions || null;
  if (!dimensions && p.pixelWidth && p.pixelHeight) {
    dimensions = `${p.pixelWidth}x${p.pixelHeight} px`;
  }
  
  const siteName = p.siteName || p.panelName || p.name || 
                   p.station || p.network || p.publication || p.platform ||
                   `Placement ${index + 1}`;

  let restrictions = null;
  if (p.restrictions || p.prohibitions) {
    const parts = [p.restrictions, p.prohibitions].filter(Boolean);
    restrictions = parts.join('; ').replace(/\|/g, ', ');
  }

  const base = {
    siteName,
    startDate: normalizeDate(p.startDate || p.start_date || p.start || p.airDate || p.insertionDate),
    endDate: normalizeDate(p.endDate || p.end_date || p.end),
    channel: mediaType,
  };

  if (mediaType === 'ooh') {
    return {
      ...base,
      publisher: inferPublisher(siteName),
      panelId: p.panelId || null,
      dimensions,
      location: p.location || null,
      suburb: p.suburb || null,
      state: p.state || null,
      direction: p.direction || null,
      restrictions,
      format: p.format || 'Digital Billboard',
    };
  }

  if (mediaType === 'tv' || mediaType === 'radio') {
    return {
      ...base,
      station: p.station || p.network || null,
      program: p.program || null,
      daypart: p.daypart || p.dayPart || null,
      spotLength: p.spotLength || p.duration || null,
      spots: p.spots || p.spotCount || null,
      format: p.format || (mediaType === 'tv' ? 'TV Spot' : 'Radio Spot'),
    };
  }

  if (mediaType === 'print') {
    return {
      ...base,
      publication: p.publication || siteName,
      section: p.section || null,
      adSize: p.adSize || null,
      position: p.position || null,
      format: p.format || 'Print Ad',
    };
  }

  if (mediaType === 'digital') {
    return {
      ...base,
      platform: p.platform || siteName,
      dimensions,
      impressions: p.impressions || null,
      format: p.format || 'Digital Ad',
    };
  }

  return { ...base, dimensions, restrictions, format: p.format || 'Media Placement' };
}

function normalizeDate(dateStr) {
  if (!dateStr) return null;
  
  const str = String(dateStr).trim();
  
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.substring(0, 10);
  }
  
  const ddmmyyyy = str.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/);
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  
  return null;
}

function inferPublisher(siteName) {
  if (!siteName) return null;
  const name = siteName.toLowerCase();
  
  if (name.includes('lumo')) return 'LUMO';
  if (name.includes('qms')) return 'QMS';
  if (name.includes('jcd') || name.includes('jcdecaux')) return 'JCDecaux';
  if (name.includes('ooh')) return 'oOh!';
  if (name.includes('bishopp')) return 'Bishopp';
  if (name.includes('goa')) return 'GOA';
  
  return null;
}
