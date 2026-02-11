import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import * as XLSX from 'xlsx';

export async function POST(request) {
  try {
    // Check for API key
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured. Add OPENAI_API_KEY to environment variables.' }, { status: 500 });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileName = file.name.toLowerCase();

    let extractedText = '';

    // Extract content based on file type
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      extractedText = await extractFromExcel(buffer);
    } else if (fileName.endsWith('.pdf')) {
      extractedText = await extractFromPDF(buffer);
    } else if (fileName.endsWith('.csv')) {
      extractedText = buffer.toString('utf-8');
    } else {
      return NextResponse.json({ error: 'Unsupported file type. Please upload PDF, Excel, or CSV.' }, { status: 400 });
    }

    if (!extractedText || extractedText.trim().length < 50) {
      return NextResponse.json({ error: 'Could not extract enough content from file. Please check the file format.' }, { status: 400 });
    }

    // Send to OpenAI for parsing
    const placements = await parseWithAI(openai, extractedText, fileName);

    return NextResponse.json({ 
      success: true, 
      placements,
      extractedLength: extractedText.length
    });

  } catch (error) {
    console.error('Error parsing schedule:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to parse schedule',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

async function extractFromExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  let allText = [];

  // Process each sheet
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    
    allText.push(`=== Sheet: ${sheetName} ===`);
    
    // Convert rows to readable text
    for (const row of data) {
      const rowText = row.filter(cell => cell !== '').join(' | ');
      if (rowText.trim()) {
        allText.push(rowText);
      }
    }
    allText.push('');
  }

  return allText.join('\n');
}

async function extractFromPDF(buffer) {
  // Dynamic import for pdf-parse
  try {
    const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error('Could not parse PDF. Try converting to Excel or CSV.');
  }
}

async function parseWithAI(openai, text, fileName) {
  // Truncate if too long (keep first and last parts for context)
  let processedText = text;
  if (text.length > 15000) {
    const firstPart = text.substring(0, 10000);
    const lastPart = text.substring(text.length - 5000);
    processedText = firstPart + '\n\n... [content truncated] ...\n\n' + lastPart;
  }

  const prompt = `You are extracting media placement data from a media schedule/booking document.

Analyze the following content and extract ALL media placements. Return a JSON array where each object has these fields:
- siteName (string): The name of the site/screen/placement
- publisher (string): The media company (e.g., "LUMO", "JCDecaux", "QMS")
- dimensions (string): Pixel dimensions as "width x height px"
- physicalSize (string or null): Physical size if mentioned
- startDate (string): Start date as YYYY-MM-DD
- endDate (string): End date as YYYY-MM-DD  
- duration (number or null): Ad duration in seconds
- fileFormat (string or null): Required file format
- restrictions (string or null): Content restrictions
- location (string or null): Physical address
- notes (string or null): Other relevant notes
- channel (string): One of: "ooh", "tv", "radio", "digital"
- format (string): Format type like "Digital Billboard", "Video", "Audio"

Important rules:
- Return ONLY a valid JSON array, no other text
- Extract every unique placement row
- Parse dates to YYYY-MM-DD format (input might be DD.MM.YYYY or DD/MM/YYYY)
- If publisher not explicit, infer from naming (LUMO-xxx = LUMO, QMS-xxx = QMS)
- For outdoor/billboard placements, channel should be "ooh"

Document content:
${processedText}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { 
          role: 'system', 
          content: 'You are a data extraction assistant. You ONLY output valid JSON arrays. Never include markdown formatting, code blocks, or explanations. Just the raw JSON array.' 
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 4000,
    });

    let content = response.choices[0].message.content.trim();
    
    // Clean up common issues with AI responses
    // Remove markdown code blocks if present
    content = content.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
    
    // Remove any leading/trailing whitespace or newlines
    content = content.trim();
    
    // If it doesn't start with [, try to find the array
    if (!content.startsWith('[')) {
      const arrayStart = content.indexOf('[');
      const arrayEnd = content.lastIndexOf(']');
      if (arrayStart !== -1 && arrayEnd !== -1) {
        content = content.substring(arrayStart, arrayEnd + 1);
      }
    }

    // Parse the JSON
    let placements;
    try {
      placements = JSON.parse(content);
    } catch (parseError) {
      console.error('JSON parse error. Content was:', content.substring(0, 500));
      throw new Error('Failed to parse AI response as JSON. The AI may have returned an unexpected format.');
    }

    // Validate it's an array
    if (!Array.isArray(placements)) {
      throw new Error('AI did not return an array of placements.');
    }

    // Basic validation/cleanup of each placement
    return placements.map((p, index) => ({
      siteName: p.siteName || `Placement ${index + 1}`,
      publisher: p.publisher || 'Unknown',
      dimensions: p.dimensions || null,
      physicalSize: p.physicalSize || null,
      startDate: formatDate(p.startDate),
      endDate: formatDate(p.endDate),
      duration: p.duration || null,
      fileFormat: p.fileFormat || null,
      restrictions: p.restrictions || null,
      location: p.location || null,
      notes: p.notes || null,
      channel: p.channel || 'ooh',
      format: p.format || 'Digital Billboard',
    }));

  } catch (error) {
    if (error.message.includes('API')) {
      throw new Error('OpenAI API error. Please check your API key and try again.');
    }
    throw error;
  }
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  
  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  // DD.MM.YYYY or DD/MM/YYYY format
  const match = dateStr.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Try native Date parsing as fallback
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch {}
  
  return null;
}
