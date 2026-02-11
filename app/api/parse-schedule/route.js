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

    // Process ALL sheets - different schedules structure data differently
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

async function parseWithAI(openai, content, contentType, debugInfo) {
  const systemPrompt = `Find media placements in this schedule. Return JSON: {"placements": [...]}

For each placement, include ONLY these fields (skip if not found):
- siteName (screen/site name)
- dimensions (pixel size)  
- startDate (YYYY-MM-DD)
- endDate (YYYY-MM-DD)
- restrictions (content restrictions like "No alcohol", "No political")
- location (address if shown)

Keep it minimal. Data may be spread across multiple sheets.`;

  try {
    // Send up to 15000 chars - need room for all sheets
    let textContent = content;
    if (content.length > 15000) {
      textContent = content.substring(0, 15000);
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Find all placements:\n\n${textContent}` }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 16000,
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
      throw new Error('No placements found. Make sure the file contains a media schedule with site names and dates.');
    }

    // Normalize - infer publisher and other fields from siteName
    return placements.map((p, i) => {
      const siteName = p.siteName || p.site_name || p.name || p.screen || `Placement ${i + 1}`;
      return {
        siteName,
        publisher: inferPublisher(siteName),
        dimensions: p.dimensions || p.size || null,
        startDate: normalizeDate(p.startDate || p.start_date || p.start),
        endDate: normalizeDate(p.endDate || p.end_date || p.end),
        restrictions: p.restrictions || null,
        location: p.location || p.address || null,
        channel: 'ooh',
        format: 'Digital Billboard',
      };
    });

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
