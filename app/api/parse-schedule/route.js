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
      result = await parseWithAI(openai, content, providedChannel, debugInfo);
    } else if (fileName.endsWith('.csv')) {
      const content = buffer.toString('utf-8');
      debugInfo.steps.push(`CSV extracted: ${content.length} chars`);
      result = await parseWithAI(openai, content, providedChannel, debugInfo);
    } else if (fileName.endsWith('.pdf')) {
      debugInfo.steps.push('Processing PDF with vision...');
      result = await parsePDFWithVision(openai, buffer, providedChannel, debugInfo);
    } else {
      return NextResponse.json({
        error: 'Unsupported file type. Please upload Excel, CSV, or PDF.',
        debug: debugInfo
      }, { status: 400 });
    }

    const detectedChannel = providedChannel || result.detectedChannel || 'ooh';
    const detectedPublisher = providedPublisher || result.detectedPublisher || '';

    const placements = result.placements.map(p => ({
      ...p,
      channel: detectedChannel,
    }));

    debugInfo.steps.push(`Parsed ${placements.length} placements, detected: ${detectedChannel}/${detectedPublisher}`);

    return NextResponse.json({
      success: true,
      mediaType: detectedChannel,
      detectedChannel: detectedChannel,
      detectedPublisher: detectedPublisher,
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

async function parsePDFWithVision(openai, buffer, providedChannel, debugInfo) {
  const base64PDF = buffer.toString('base64');

  debugInfo.steps.push('Calling OpenAI vision...');

  const systemPrompt = `You are a media schedule data extractor. Your job is to extract placement data from media schedules and return it as JSON.

CRITICAL: You must return ONLY valid JSON. No markdown code blocks, no explanation text, no preamble. Your entire response must be parseable JSON starting with { and ending with }

Return this exact structure:
{
  "mediaType": "radio|tv|ooh|digital",
  "publisher": "detected publisher name",
  "placements": [...]
}

DETECTION RULES:
- If you see radio stations (AM/FM, MHz), dayparts like Breakfast/Drive, spot lengths → mediaType: "radio"
- If you see TV channels, programs, networks → mediaType: "tv"  
- If you see billboards, panels, pixel dimensions, street addresses → mediaType: "ooh"
- If you see impressions, CPM, digital platforms → mediaType: "digital"

PUBLISHER DETECTION:
- ARN logo or "ARN" text → publisher: "ARN"
- SCA, Triple M, Hit Network → publisher: "SCA"
- Nova → publisher: "Nova"
- JCDecaux → publisher: "JCDecaux"
- LUMO → publisher: "LUMO"
- QMS → publisher: "QMS"
- oOh! media → publisher: "oOh!"

FOR RADIO SCHEDULES, extract each unique line item with:
- siteName: station name (e.g., "Gold AM/FM Bendigo - Breakfast 15s")
- station: just the station (e.g., "Gold AM/FM Bendigo")
- daypart: e.g., "Breakfast", "Morning", "Drive", "Evening"
- spotLength: duration in seconds (15, 30, 60)
- spots: total spot count for that line
- startDate: YYYY-MM-DD format
- endDate: YYYY-MM-DD format
- classification: "Commercial" or "Live Read" etc.

FOR OOH SCHEDULES, extract:
- siteName, panelId, dimensions (WxH px), location, suburb, state, startDate, endDate, restrictions, direction

Convert all dates to YYYY-MM-DD. Use the contract start/end dates shown in the header.`;

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
            text: 'Extract all placements from this media schedule. Return ONLY the JSON object, nothing else.',
          },
        ],
      },
    ],
    max_tokens: 16000,
    temperature: 0.1,
  });

  const responseText = response.choices[0].message.content;
  debugInfo.steps.push('OpenAI vision responded');
  debugInfo.rawResponsePreview = responseText.substring(0, 500);

  // Try multiple methods to extract JSON
  let parsed = null;
  
  // Clean the response - remove markdown code blocks if present
  let cleanedResponse = responseText.trim();
  
  // Remove ```json ... ``` wrapper
  const codeBlockMatch = cleanedResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    cleanedResponse = codeBlockMatch[1].trim();
  }
  
  // Method 1: Try parsing the cleaned response directly
  try {
    parsed = JSON.parse(cleanedResponse);
    debugInfo.steps.push('Parsed JSON directly');
  } catch (e1) {
    debugInfo.steps.push(`Direct parse failed: ${e1.message}`);
    
    // Method 2: Find JSON object boundaries
    const jsonStart = cleanedResponse.indexOf('{');
    const jsonEnd = cleanedResponse.lastIndexOf('}');
    
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      const jsonStr = cleanedResponse.substring(jsonStart, jsonEnd + 1);
      try {
        parsed = JSON.parse(jsonStr);
        debugInfo.steps.push('Parsed JSON from substring');
      } catch (e2) {
        debugInfo.steps.push(`Substring parse failed: ${e2.message}`);
      }
    }
    
    // Method 3: Try to find and parse just the array
    if (!parsed) {
      const arrayStart = cleanedResponse.indexOf('[');
      const arrayEnd = cleanedResponse.lastIndexOf(']');
      
      if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
        const arrayStr = cleanedResponse.substring(arrayStart, arrayEnd + 1);
        try {
          const arr = JSON.parse(arrayStr);
          parsed = { placements: arr };
          debugInfo.steps.push('Parsed JSON array');
        } catch (e3) {
          debugInfo.steps.push(`Array parse failed: ${e3.message}`);
        }
      }
    }
  }
  
  if (!parsed) {
    debugInfo.rawResponse = responseText;
    throw new Error('Failed to parse AI response as JSON. Please try uploading an Excel or CSV version of this schedule.');
  }

  let placements = parsed.placements || [];
  
  // If placements is not an array, look for array in the parsed object
  if (!Array.isArray(placements)) {
    for (const key of Object.keys(parsed)) {
      if (Array.isArray(parsed[key]) && parsed[key].length > 0) {
        placements = parsed[key];
        break;
      }
    }
  }

  if (placements.length === 0) {
    throw new Error('No placements found in PDF. The document may not contain recognizable schedule data.');
  }

  // Detect channel and publisher
  const detected = detectChannelAndPublisher(placements, parsed);
  const channel = providedChannel || detected.channel;
  
  const normalized = placements.map((p, i) => normalizePlacement(p, channel, i));
  
  return { 
    placements: normalized,
    detectedChannel: detected.channel,
    detectedPublisher: detected.publisher,
  };
}

async function parseWithAI(openai, content, providedChannel, debugInfo) {
  const systemPrompt = getSystemPrompt(providedChannel);

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

  const detected = detectChannelAndPublisher(placements, parsed);
  const channel = providedChannel || detected.channel;

  const normalized = placements.map((p, i) => normalizePlacement(p, channel, i));
  return { 
    placements: normalized,
    detectedChannel: detected.channel,
    detectedPublisher: detected.publisher,
  };
}

function detectChannelAndPublisher(placements, parsed) {
  let channel = parsed.mediaType || parsed.channel || null;
  let publisher = parsed.publisher || parsed.mediaOwner || null;
  
  if (!channel) {
    const allText = JSON.stringify(placements).toLowerCase();
    
    // Radio indicators
    if (allText.includes('breakfast') || allText.includes('drive') || 
        allText.includes('am/fm') || allText.includes('radio') ||
        allText.includes('spot length') || allText.includes('live read')) {
      channel = 'radio';
    }
    // TV indicators
    else if (allText.includes('program') || allText.includes('network') || 
             allText.includes('tvc') || allText.includes('channel 7') ||
             allText.includes('channel 9') || allText.includes('channel 10')) {
      channel = 'tv';
    }
    // Digital indicators
    else if (allText.includes('impressions') || allText.includes('cpm') || 
             allText.includes('click') || allText.includes('banner')) {
      channel = 'digital';
    }
    // OOH indicators (default)
    else {
      channel = 'ooh';
    }
  }
  
  if (!publisher) {
    const allText = JSON.stringify(placements).toLowerCase();
    
    // Radio publishers
    if (allText.includes('arn') || allText.includes('kiis') || allText.includes('gold fm') || allText.includes('gold am')) {
      publisher = 'ARN';
    } else if (allText.includes('sca') || allText.includes('triple m') || allText.includes('hit ')) {
      publisher = 'SCA';
    } else if (allText.includes('nova')) {
      publisher = 'Nova';
    } else if (allText.includes('ace radio')) {
      publisher = 'ACE Radio';
    }
    // OOH publishers
    else if (allText.includes('lumo')) publisher = 'LUMO';
    else if (allText.includes('jcdecaux')) publisher = 'JCDecaux';
    else if (allText.includes('qms')) publisher = 'QMS';
    else if (allText.includes('ooh!') || allText.includes('ooh media')) publisher = 'oOh!';
    // TV publishers
    else if (allText.includes('seven') || allText.includes('channel 7')) publisher = 'Seven';
    else if (allText.includes('nine') || allText.includes('channel 9')) publisher = 'Nine';
    else if (allText.includes('ten') || allText.includes('channel 10')) publisher = 'Ten';
  }
  
  return { channel, publisher };
}

function getSystemPrompt(providedChannel) {
  const basePrompt = `You extract placement data from media schedules. Return JSON: {"placements": [...], "mediaType": "ooh|tv|radio|digital", "publisher": "detected publisher name"}

RULES:
- Detect the media type from the content
- Try to identify the publisher/media owner
- Convert all dates to YYYY-MM-DD
- Extract EVERY row/placement
- Omit empty fields`;

  if (providedChannel === 'radio') {
    return `${basePrompt}

This is a RADIO schedule. Extract for each line:
- siteName (station + daypart + duration, e.g., "Gold FM Bendigo - Breakfast 30s")
- station
- daypart (Breakfast, Morning, Drive, Evening, etc.)
- spotLength (in seconds)
- spots (total count)
- startDate, endDate
- classification (Commercial, Live Read, etc.)`;
  }

  if (providedChannel === 'ooh') {
    return `${basePrompt}

This is an OUT OF HOME schedule. Extract for each placement:
- siteName, panelId, dimensions (WxH px), location, suburb, state
- startDate, endDate, restrictions, direction, format`;
  }

  if (providedChannel === 'tv') {
    return `${basePrompt}

This is a TV schedule. Extract for each placement:
- siteName, station/network, program, daypart
- spotLength (seconds), spots (count)
- startDate, endDate`;
  }

  return `${basePrompt}

Detect the media type and extract appropriate fields:
- RADIO: siteName, station, daypart, spotLength, spots, startDate, endDate
- TV: siteName, station, program, daypart, spotLength, spots, startDate, endDate  
- OOH: siteName, panelId, dimensions, location, suburb, state, startDate, endDate, restrictions
- DIGITAL: siteName, platform, format, dimensions, impressions, startDate, endDate`;
}

function normalizePlacement(p, channel, index) {
  const siteName = p.siteName || p.name || p.station || p.panelName || 
                   p.network || p.platform || `Placement ${index + 1}`;

  const base = {
    siteName,
    startDate: normalizeDate(p.startDate || p.start_date || p.start),
    endDate: normalizeDate(p.endDate || p.end_date || p.end),
    channel: channel,
  };

  if (channel === 'radio') {
    return {
      ...base,
      station: p.station || null,
      daypart: p.daypart || p.dayPart || null,
      spotLength: p.spotLength || p.duration || null,
      spots: p.spots || p.spotCount || p.total || null,
      classification: p.classification || p.type || null,
      format: 'Radio Spot',
    };
  }

  if (channel === 'tv') {
    return {
      ...base,
      station: p.station || p.network || null,
      program: p.program || null,
      daypart: p.daypart || p.dayPart || null,
      spotLength: p.spotLength || p.duration || null,
      spots: p.spots || p.spotCount || null,
      format: 'TV Spot',
    };
  }

  if (channel === 'ooh') {
    let dimensions = p.dimensions || null;
    if (!dimensions && p.pixelWidth && p.pixelHeight) {
      dimensions = `${p.pixelWidth}x${p.pixelHeight} px`;
    }
    
    return {
      ...base,
      panelId: p.panelId || null,
      dimensions,
      location: p.location || null,
      suburb: p.suburb || null,
      state: p.state || null,
      direction: p.direction || null,
      restrictions: p.restrictions || null,
      format: p.format || 'Digital Billboard',
    };
  }

  if (channel === 'digital') {
    return {
      ...base,
      platform: p.platform || null,
      dimensions: p.dimensions || null,
      impressions: p.impressions || null,
      format: p.format || 'Digital Ad',
    };
  }

  return { ...base, format: p.format || 'Media Placement' };
}

function normalizeDate(dateStr) {
  if (!dateStr) return null;
  
  const str = String(dateStr).trim();
  
  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.substring(0, 10);
  }
  
  // DD/MM/YYYY or DD.MM.YYYY format
  const ddmmyyyy = str.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/);
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  
  // Try native Date parsing
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  
  return null;
}
