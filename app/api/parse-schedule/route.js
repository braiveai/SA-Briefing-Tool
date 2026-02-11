import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import * as XLSX from 'xlsx';

export async function POST(request) {
  const debugInfo = { steps: [] };
  
  try {
    debugInfo.steps.push('Starting request processing');
    
    // Check for API key first
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ 
        error: 'OpenAI API key not configured. Add OPENAI_API_KEY to Vercel environment variables and redeploy.',
        debug: debugInfo
      }, { status: 500 });
    }
    
    debugInfo.steps.push('API key exists');

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    let formData;
    try {
      formData = await request.formData();
    } catch (e) {
      return NextResponse.json({ error: 'Invalid form data', debug: debugInfo }, { status: 400 });
    }
    
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'No file provided', debug: debugInfo }, { status: 400 });
    }

    debugInfo.steps.push(`File: ${file.name}, size: ${file.size}, type: ${file.type}`);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileName = file.name.toLowerCase();

    let extractedContent = null;
    let contentType = 'text';

    // Route based on file type
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      debugInfo.steps.push('Processing Excel file');
      extractedContent = extractFromExcel(buffer);
      contentType = 'text';
    } else if (fileName.endsWith('.csv')) {
      debugInfo.steps.push('Processing CSV file');
      extractedContent = buffer.toString('utf-8');
      contentType = 'text';
    } else if (fileName.endsWith('.pdf')) {
      // OpenAI vision doesn't support PDFs directly
      return NextResponse.json({ 
        error: 'PDF files are not yet supported. Please convert to Excel (.xlsx) or CSV and try again. Most media schedules are available in Excel format.',
        debug: debugInfo 
      }, { status: 400 });
    } else {
      return NextResponse.json({ 
        error: `Unsupported file type: ${fileName}. Please upload Excel (.xlsx), CSV, or PDF.`,
        debug: debugInfo 
      }, { status: 400 });
    }

    if (!extractedContent || extractedContent.length < 10) {
      return NextResponse.json({ 
        error: 'Could not extract content from file. The file may be empty or corrupted.',
        debug: debugInfo 
      }, { status: 400 });
    }

    debugInfo.steps.push(`Content extracted: ${contentType}, length: ${extractedContent.length}`);

    // Parse with OpenAI
    debugInfo.steps.push('Calling OpenAI...');
    const placements = await parseWithAI(openai, extractedContent, contentType, debugInfo);
    debugInfo.steps.push(`Success: ${placements.length} placements found`);

    return NextResponse.json({ 
      success: true, 
      placements,
      debug: debugInfo
    });

  } catch (error) {
    console.error('Parse schedule error:', error);
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
      
      allText.push(`=== Sheet: ${sheetName} ===`);
      
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
      allText.push('');
    }

    return allText.join('\n');
  } catch (e) {
    throw new Error(`Failed to read Excel file: ${e.message}`);
  }
}

async function parseWithAI(openai, content, contentType, debugInfo) {
  const systemPrompt = `Extract media placements from schedules. Return JSON with a "placements" array.

Each placement needs: siteName, publisher, dimensions, startDate (YYYY-MM-DD), endDate (YYYY-MM-DD), location, restrictions, channel (ooh/tv/radio/digital), format.

Only include fields that have values. Omit null fields to keep response short.
Infer publisher from site names: LUMO-xxx=LUMO, QMS-xxx=QMS, JCD=JCDecaux.`;

  try {
    // Truncate if too long
    let textContent = content;
    if (content.length > 12000) {
      textContent = content.substring(0, 12000) + '\n\n[truncated...]';
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Extract all media placements from this schedule. Be concise - only include fields that have values:\n\n${textContent}` }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 8000,
    });

    const responseText = response.choices[0].message.content;
    const finishReason = response.choices[0].finish_reason;
    debugInfo.steps.push(`OpenAI responded (finish: ${finishReason})`);
    debugInfo.responsePreview = responseText.substring(0, 200);

    if (finishReason === 'length') {
      throw new Error('OpenAI response was truncated. The schedule may be too large. Try uploading a smaller file or contact support.');
    }

    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch (e) {
      debugInfo.rawResponse = responseText;
      throw new Error('OpenAI returned invalid JSON');
    }

    // Find the placements array
    let placements = [];
    if (Array.isArray(parsed)) {
      placements = parsed;
    } else if (parsed.placements && Array.isArray(parsed.placements)) {
      placements = parsed.placements;
    } else {
      // Search for any array
      for (const key of Object.keys(parsed)) {
        if (Array.isArray(parsed[key]) && parsed[key].length > 0) {
          placements = parsed[key];
          break;
        }
      }
    }

    if (placements.length === 0) {
      throw new Error('No placements found. Make sure the file contains a media schedule with site names, dates, and specifications.');
    }

    // Normalize placements
    return placements.map((p, i) => ({
      siteName: p.siteName || p.site_name || p.name || p.screen || `Placement ${i + 1}`,
      publisher: p.publisher || inferPublisher(p.siteName || p.name || ''),
      dimensions: p.dimensions || p.size || p.resolution || null,
      physicalSize: p.physicalSize || p.physical_size || null,
      startDate: normalizeDate(p.startDate || p.start_date || p.start),
      endDate: normalizeDate(p.endDate || p.end_date || p.end),
      duration: p.duration || p.ad_length || p.adLength || null,
      fileFormat: p.fileFormat || p.file_format || null,
      restrictions: p.restrictions || null,
      location: p.location || p.address || null,
      notes: p.notes || null,
      channel: p.channel || 'ooh',
      format: p.format || 'Digital Billboard',
    }));

  } catch (error) {
    if (error.code === 'invalid_api_key') {
      throw new Error('Invalid OpenAI API key');
    }
    if (error.code === 'insufficient_quota') {
      throw new Error('OpenAI quota exceeded. Check your billing.');
    }
    throw error;
  }
}

function inferPublisher(name) {
  const lower = (name || '').toLowerCase();
  if (lower.includes('lumo')) return 'LUMO';
  if (lower.includes('qms') || lower.startsWith('qm')) return 'QMS';
  if (lower.includes('jcd') || lower.includes('jcdecaux')) return 'JCDecaux';
  if (lower.includes('ooh')) return 'oOh! Media';
  return 'Unknown';
}

function normalizeDate(dateStr) {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  
  // DD.MM.YYYY or DD/MM/YYYY
  const match = str.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/);
  if (match) {
    return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  }
  
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  } catch {}
  
  return null;
}
