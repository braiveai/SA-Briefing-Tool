import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import * as XLSX from 'xlsx';

// PDF.js for serverless-compatible PDF extraction
async function extractFromPDF(buffer) {
  try {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    
    const loadingTask = pdfjsLib.getDocument({ data: buffer });
    const pdf = await loadingTask.promise;
    
    let fullText = [];
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map(item => item.str)
        .join(' ');
      fullText.push(`=== Page ${i} ===`);
      fullText.push(pageText);
    }
    
    return fullText.join('\n');
  } catch (e) {
    throw new Error(`Failed to read PDF: ${e.message}`);
  }
}

export async function POST(request) {
  const debugInfo = { steps: [] };

  try {
    debugInfo.steps.push('Starting request processing');

    // Check for API key
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        error: 'OpenAI API key not configured. Add OPENAI_API_KEY to Vercel environment variables and redeploy.',
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

    debugInfo.steps.push(`File received: ${file.name}, type: ${file.type}, size: ${file.size}`);

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name.toLowerCase();

    let content;
    let contentType;

    // Extract content based on file type
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      content = extractFromExcel(buffer);
      contentType = 'excel';
      debugInfo.steps.push(`Excel extracted: ${content.length} chars`);
    } else if (fileName.endsWith('.csv')) {
      content = buffer.toString('utf-8');
      contentType = 'csv';
      debugInfo.steps.push(`CSV extracted: ${content.length} chars`);
    } else if (fileName.endsWith('.pdf')) {
      content = await extractFromPDF(buffer);
      contentType = 'pdf';
      debugInfo.steps.push(`PDF extracted: ${content.length} chars`);
    } else {
      return NextResponse.json({
        error: 'Unsupported file type. Please upload Excel (.xlsx) or CSV.',
        debug: debugInfo
      }, { status: 400 });
    }

    if (!content || content.trim().length === 0) {
      return NextResponse.json({
        error: 'Could not extract content from file. The file may be empty or corrupted.',
        debug: debugInfo
      }, { status: 400 });
    }

    // Parse with AI
    const result = await parseWithAI(openai, content, debugInfo);
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

    // Process ALL sheets - different publishers structure data differently
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
    throw new Error(`Failed to read Excel file: ${e.message}`);
  }
}

async function parseWithAI(openai, content, debugInfo) {
  const systemPrompt = `You analyze media schedules and booking documents from various publishers.

STEP 1: Identify the media type based on content:
- "ooh" = Out of Home: billboards, digital screens, street furniture, transit ads (look for: panel names, pixel dimensions, site locations)
- "tv" = Television: broadcast spots, programs, dayparts (look for: networks, programs, spot lengths like 15s/30s)
- "radio" = Radio: station spots, dayparts (look for: station names, dayparts like Drive/Breakfast)
- "print" = Print: magazine/newspaper ads (look for: publications, ad sizes, insertion dates)
- "digital" = Digital/Online: banners, video ads (look for: platforms, impressions, CTR)

STEP 2: Extract ALL placements with relevant fields for that media type.

Return JSON:
{
  "mediaType": "ooh|tv|radio|print|digital",
  "placements": [...]
}

For OOH, extract: siteName, panelId, panelName, dimensions (as "WxH" or "W x H px"), pixelWidth, pixelHeight, location, suburb, state, startDate, endDate, restrictions, prohibitions, direction, format

For TV/Radio, extract: station, network, program, daypart, spotLength, startDate, endDate, spots, rotation

For Print, extract: publication, section, adSize, insertionDate, position

For Digital, extract: platform, format, dimensions, impressions, startDate, endDate

RULES:
- Convert ALL dates to YYYY-MM-DD format
- Extract EVERY row, even if same site appears with different date ranges
- Use camelCase for field names
- Combine restrictions and prohibitions into one "restrictions" field
- Omit fields that are empty/null
- If pixelWidth and pixelHeight exist, also create "dimensions" as "WxH px"`;

  try {
    let textContent = content;
    if (content.length > 25000) {
      textContent = content.substring(0, 25000);
      debugInfo.steps.push('Content truncated to 25000 chars');
    }

    debugInfo.steps.push('Calling OpenAI...');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Extract all placements from this media schedule:\n\n${textContent}` }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 16000,
    });

    const responseText = response.choices[0].message.content;
    const finishReason = response.choices[0].finish_reason;
    debugInfo.steps.push(`OpenAI responded (finish: ${finishReason})`);
    debugInfo.responsePreview = responseText.substring(0, 300);

    if (finishReason === 'length') {
      throw new Error('Response truncated - schedule too large. Try a smaller file.');
    }

    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch (e) {
      debugInfo.rawResponse = responseText.substring(0, 500);
      throw new Error('OpenAI returned invalid JSON');
    }

    const mediaType = parsed.mediaType || 'ooh';
    
    // Find placements array
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
      throw new Error('No placements found. Make sure the file contains a media schedule.');
    }

    // Normalize placements based on media type
    const normalized = placements.map((p, i) => normalizePlacement(p, mediaType, i));
    
    return { mediaType, placements: normalized };

  } catch (e) {
    debugInfo.steps.push(`AI parsing error: ${e.message}`);
    throw e;
  }
}

function normalizePlacement(p, mediaType, index) {
  // Build dimensions string if we have width/height
  let dimensions = p.dimensions || null;
  if (!dimensions && p.pixelWidth && p.pixelHeight) {
    dimensions = `${p.pixelWidth}x${p.pixelHeight} px`;
  }
  
  // Combine various name fields
  const siteName = p.siteName || p.panelName || p.site_name || p.name || 
                   p.station || p.network || p.publication || p.platform ||
                   `Placement ${index + 1}`;

  // Combine restrictions
  let restrictions = null;
  if (p.restrictions || p.prohibitions) {
    const parts = [p.restrictions, p.prohibitions].filter(Boolean);
    restrictions = parts.join('; ').replace(/\|/g, ', ');
  }

  // Base fields for all types
  const base = {
    siteName,
    startDate: normalizeDate(p.startDate || p.start_date || p.start || p.airDate || p.insertionDate),
    endDate: normalizeDate(p.endDate || p.end_date || p.end),
    channel: mediaType,
  };

  // Add type-specific fields
  if (mediaType === 'ooh') {
    return {
      ...base,
      publisher: inferPublisher(siteName),
      panelId: p.panelId || p.panel_id || null,
      dimensions,
      location: p.location || p.address || null,
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
      adSize: p.adSize || p.ad_size || null,
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

  // Fallback
  return {
    ...base,
    dimensions,
    restrictions,
    format: p.format || 'Media Placement',
  };
}

function normalizeDate(dateStr) {
  if (!dateStr) return null;
  
  const str = String(dateStr).trim();
  
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.substring(0, 10);
  }
  
  // DD.MM.YYYY or DD/MM/YYYY
  const ddmmyyyy = str.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/);
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  
  // Try parsing as date
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
