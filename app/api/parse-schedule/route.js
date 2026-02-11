import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import * as XLSX from 'xlsx';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request) {
  try {
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

    // Send to OpenAI for parsing
    const placements = await parseWithAI(extractedText, fileName);

    return NextResponse.json({ 
      success: true, 
      placements,
      rawText: extractedText.substring(0, 2000) + '...' // Preview for debugging
    });

  } catch (error) {
    console.error('Error parsing schedule:', error);
    return NextResponse.json({ error: error.message || 'Failed to parse schedule' }, { status: 500 });
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
  // Dynamic import for pdf-parse (it has issues with static imports in Next.js)
  try {
    const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    console.error('PDF parsing error:', error);
    // Fallback: return a message that PDF parsing failed
    throw new Error('Could not parse PDF. Try converting to Excel or CSV.');
  }
}

async function parseWithAI(text, fileName) {
  const prompt = `You are extracting media placement data from a media schedule/booking document.

Analyze the following content and extract ALL media placements. Each placement should include:
- siteName: The name of the site/screen/placement (e.g., "LUMO-Newton", "M4 Motorway Portrait")
- publisher: The media company (e.g., "LUMO", "JCDecaux", "QMS", "oOh!"). Infer from context if not explicit.
- dimensions: Pixel dimensions as "width x height px" (e.g., "1368 x 324 px")
- physicalSize: Physical size if mentioned (e.g., "14m x 3.5m")
- startDate: Booking/flight start date in YYYY-MM-DD format
- endDate: Booking/flight end date in YYYY-MM-DD format
- duration: Ad/spot duration in seconds if mentioned
- fileFormat: Required file format if mentioned (e.g., "JPEG", "MP4")
- restrictions: Any content restrictions (e.g., "No alcohol", "No political content")
- location: Physical address or location if mentioned
- notes: Any other relevant notes
- channel: The channel type - must be one of: "ooh", "tv", "radio", "digital"
- format: The format type (e.g., "Digital Billboard", "Digital Large Format", "Video", "Audio")

Important:
- Extract EVERY unique placement, even if they share specs
- If a site appears multiple times with different dates, include each instance separately
- Parse dates carefully - they may be in DD.MM.YYYY, DD/MM/YYYY, or other formats
- If dimensions are given as "1368 x 324", format as "1368 x 324 px"
- For OOH placements, channel should be "ooh"
- Infer the publisher from site naming conventions (LUMO-xxx = LUMO, QMS-xxx = QMS, etc.)

Document content:
${text}

Return ONLY a valid JSON array of placement objects. No explanation, no markdown, just the JSON array.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are a precise data extraction assistant. You only output valid JSON arrays, nothing else.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.1,
    max_tokens: 4000,
  });

  const content = response.choices[0].message.content.trim();
  
  // Try to parse JSON, handling potential markdown code blocks
  let jsonStr = content;
  if (content.startsWith('```')) {
    jsonStr = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
  }

  try {
    const placements = JSON.parse(jsonStr);
    return placements;
  } catch (e) {
    console.error('Failed to parse AI response:', content);
    throw new Error('AI returned invalid JSON. Please try again.');
  }
}
