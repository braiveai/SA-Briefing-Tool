import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import * as XLSX from 'xlsx';

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

    debugInfo.steps.push(`File received: ${file.name}, size: ${file.size}`);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileName = file.name.toLowerCase();

    let extractedText = '';

    // Extract content based on file type
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      debugInfo.steps.push('Processing as Excel');
      extractedText = extractFromExcel(buffer);
    } else if (fileName.endsWith('.pdf')) {
      debugInfo.steps.push('Processing as PDF');
      extractedText = await extractFromPDF(buffer);
    } else if (fileName.endsWith('.csv')) {
      debugInfo.steps.push('Processing as CSV');
      extractedText = buffer.toString('utf-8');
    } else {
      return NextResponse.json({ 
        error: 'Unsupported file type. Please upload PDF, Excel (.xlsx), or CSV.',
        debug: debugInfo 
      }, { status: 400 });
    }

    debugInfo.steps.push(`Extracted ${extractedText.length} characters`);
    debugInfo.extractedPreview = extractedText.substring(0, 500);

    if (!extractedText || extractedText.trim().length < 20) {
      return NextResponse.json({ 
        error: 'Could not extract enough content from file.',
        debug: debugInfo 
      }, { status: 400 });
    }

    // Send to OpenAI for parsing
    debugInfo.steps.push('Calling OpenAI...');
    const placements = await parseWithAI(openai, extractedText, debugInfo);
    debugInfo.steps.push(`OpenAI returned ${placements.length} placements`);

    return NextResponse.json({ 
      success: true, 
      placements,
      debug: debugInfo
    });

  } catch (error) {
    console.error('Error parsing schedule:', error);
    debugInfo.steps.push(`Error: ${error.message}`);
    debugInfo.errorStack = error.stack;
    
    return NextResponse.json({ 
      error: error.message || 'Failed to parse schedule',
      debug: debugInfo
    }, { status: 500 });
  }
}

function extractFromExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  let allText = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    
    allText.push(`=== Sheet: ${sheetName} ===`);
    
    for (const row of data) {
      const rowText = row
        .map(cell => {
          if (cell === null || cell === undefined) return '';
          if (typeof cell === 'object' && cell instanceof Date) {
            return cell.toISOString().split('T')[0];
          }
          return String(cell);
        })
        .filter(cell => cell !== '')
        .join(' | ');
      if (rowText.trim()) {
        allText.push(rowText);
      }
    }
    allText.push('');
  }

  return allText.join('\n');
}

async function extractFromPDF(buffer) {
  try {
    const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error('Could not parse PDF. Try converting to Excel or CSV first.');
  }
}

async function parseWithAI(openai, text, debugInfo) {
  // Truncate if too long
  let processedText = text;
  if (text.length > 12000) {
    processedText = text.substring(0, 12000) + '\n\n[... content truncated for length ...]';
  }

  const systemPrompt = `You extract media placement data from schedules. 
Always respond with a JSON object containing a "placements" array.
Each placement object should have: siteName, publisher, dimensions, startDate, endDate, location, restrictions, channel, format.
Dates should be YYYY-MM-DD format. Channel should be one of: ooh, tv, radio, digital.
If you can't find certain fields, use null.`;

  const userPrompt = `Extract all media placements from this schedule document. 
Look for site names, screen names, billboard locations, dimensions, dates, and any restrictions.
Return JSON with a "placements" array.

Document:
${processedText}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 4000,
    });

    const content = response.choices[0].message.content;
    debugInfo.steps.push('OpenAI responded');
    debugInfo.aiResponsePreview = content.substring(0, 300);

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      debugInfo.steps.push('JSON parse failed');
      debugInfo.rawResponse = content;
      throw new Error(`Failed to parse OpenAI response: ${e.message}`);
    }

    // Handle various response shapes
    let placements = [];
    if (Array.isArray(parsed)) {
      placements = parsed;
    } else if (parsed.placements && Array.isArray(parsed.placements)) {
      placements = parsed.placements;
    } else if (parsed.data && Array.isArray(parsed.data)) {
      placements = parsed.data;
    } else {
      // Try to find any array in the response
      for (const key of Object.keys(parsed)) {
        if (Array.isArray(parsed[key])) {
          placements = parsed[key];
          break;
        }
      }
    }

    if (placements.length === 0) {
      debugInfo.steps.push('No placements found in response');
      debugInfo.parsedResponse = parsed;
      throw new Error('No placements found in the document. Make sure the file contains media schedule data.');
    }

    // Normalize each placement
    return placements.map((p, i) => ({
      siteName: p.siteName || p.site_name || p.name || p.screenName || p.screen || `Placement ${i + 1}`,
      publisher: p.publisher || p.vendor || p.media_owner || inferPublisher(p.siteName || p.name || ''),
      dimensions: p.dimensions || p.size || p.resolution || p.pixel_size || null,
      physicalSize: p.physicalSize || p.physical_size || null,
      startDate: normalizeDate(p.startDate || p.start_date || p.booking_start || p.start),
      endDate: normalizeDate(p.endDate || p.end_date || p.booking_end || p.end),
      duration: p.duration || p.ad_length || p.adLength || null,
      fileFormat: p.fileFormat || p.file_format || p.format_type || null,
      restrictions: p.restrictions || p.restriction || null,
      location: p.location || p.address || p.site_address || null,
      notes: p.notes || p.note || null,
      channel: p.channel || 'ooh',
      format: p.format || p.placement_type || 'Digital Billboard',
    }));

  } catch (error) {
    if (error.code === 'invalid_api_key') {
      throw new Error('Invalid OpenAI API key. Please check your OPENAI_API_KEY in Vercel environment variables.');
    }
    if (error.code === 'insufficient_quota') {
      throw new Error('OpenAI API quota exceeded. Please check your OpenAI account billing.');
    }
    throw error;
  }
}

function inferPublisher(siteName) {
  const name = (siteName || '').toLowerCase();
  if (name.includes('lumo')) return 'LUMO';
  if (name.includes('qms')) return 'QMS';
  if (name.includes('jcd') || name.includes('jcdecaux')) return 'JCDecaux';
  if (name.includes('ooh')) return 'oOh! Media';
  return 'Unknown';
}

function normalizeDate(dateStr) {
  if (!dateStr) return null;
  
  const str = String(dateStr).trim();
  
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  
  // DD.MM.YYYY or DD/MM/YYYY
  const euMatch = str.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/);
  if (euMatch) {
    const [, day, month, year] = euMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Try Date parsing
  try {
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch {}
  
  return null;
}
