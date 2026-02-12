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
    const channel = formData.get('channel') || 'ooh';
    const publisher = formData.get('publisher') || 'Unknown';

    if (!file) {
      return NextResponse.json({ error: 'No file provided', debug: debugInfo }, { status: 400 });
    }

    debugInfo.steps.push(`File received: ${file.name}, channel: ${channel}, publisher: ${publisher}`);

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name.toLowerCase();

    let result;

    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const content = extractFromExcel(buffer);
      debugInfo.steps.push(`Excel extracted: ${content.length} chars`);
      result = await parseWithAI(openai, content, channel, debugInfo);
    } else if (fileName.endsWith('.csv')) {
      const content = buffer.toString('utf-8');
      debugInfo.steps.push(`CSV extracted: ${content.length} chars`);
      result = await parseWithAI(openai, content, channel, debugInfo);
    } else if (fileName.endsWith('.pdf')) {
      debugInfo.steps.push('Processing PDF with vision...');
      result = await parsePDFWithVision(openai, buffer, channel, debugInfo);
    } else {
      return NextResponse.json({
        error: 'Unsupported file type. Please upload Excel, CSV, or PDF.',
        debug: debugInfo
      }, { status: 400 });
    }

    const placements = result.placements.map(p => ({
      ...p,
      channel: channel,
      publisher: publisher,
    }));

    debugInfo.steps.push(`Parsed ${placements.length} placements`);

    return NextResponse.json({
      success: true,
      mediaType: channel,
      placements: placements,
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

async function parsePDFWithVision(openai, buffer, channel, debugInfo) {
  const base64PDF = buffer.toString('base64');
  const systemPrompt = getSystemPrompt(channel);

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

  const normalized = placements.map((p, i) => normalizePlacement(p, channel, i));
  return { placements: normalized };
}

async function parseWithAI(openai, content, channel, debugInfo) {
  const systemPrompt = getSystemPrompt(channel);

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

  const normalized = placements.map((p, i) => normalizePlacement(p, channel, i));
  return { placements: normalized };
}

function getSystemPrompt(channel) {
  const basePrompt = `You extract placement data from media schedules. Return JSON: {"placements": [...]}

RULES:
- Convert all dates to YYYY-MM-DD
- Extract EVERY row/placement
- Omit empty fields
- Combine any restrictions/prohibitions into one "restrictions" field`;

  if (channel === 'ooh') {
    return `${basePrompt}

This is an OUT OF HOME schedule. Extract for each placement:
- siteName (screen/panel name)
- panelId (if shown)
- dimensions (pixel size as "WxH px")
- pixelWidth, pixelHeight (numbers)
- location (address)
- suburb, state
- startDate, endDate
- restrictions
- direction (Inbound/Outbound if shown)
- format`;
  }

  if (channel === 'tv') {
    return `${basePrompt}

This is a TV schedule. Extract for each placement:
- siteName (use program or network name)
- station/network
- program
- daypart (e.g., Peak, Off-Peak)
- spotLength (in seconds)
- startDate, endDate
- spots (number of spots)`;
  }

  if (channel === 'radio') {
    return `${basePrompt}

This is a RADIO schedule. Extract for each placement:
- siteName (use station name)
- station
- daypart (e.g., Breakfast, Drive)
- spotLength (in seconds)
- startDate, endDate
- spots (number of spots)`;
  }

  if (channel === 'digital') {
    return `${basePrompt}

This is a DIGITAL schedule. Extract for each placement:
- siteName (platform or placement name)
- platform
- format (e.g., Display, Video, Native)
- dimensions
- impressions
- startDate, endDate`;
  }

  return basePrompt;
}

function normalizePlacement(p, channel, index) {
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
    startDate: normalizeDate(p.startDate || p.start_date || p.start),
    endDate: normalizeDate(p.endDate || p.end_date || p.end),
    channel: channel,
  };

  if (channel === 'ooh') {
    return {
      ...base,
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

  if (channel === 'tv' || channel === 'radio') {
    return {
      ...base,
      station: p.station || p.network || null,
      program: p.program || null,
      daypart: p.daypart || p.dayPart || null,
      spotLength: p.spotLength || p.duration || null,
      spots: p.spots || p.spotCount || null,
      format: p.format || (channel === 'tv' ? 'TV Spot' : 'Radio Spot'),
    };
  }

  if (channel === 'digital') {
    return {
      ...base,
      platform: p.platform || null,
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
