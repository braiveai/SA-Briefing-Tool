import { put, list } from '@vercel/blob';
import { NextResponse } from 'next/server';

// GET /api/briefs - List all briefs
export async function GET() {
  try {
    const { blobs } = await list({ prefix: 'briefs/' });
    
    const briefs = await Promise.all(
      blobs.map(async (blob) => {
        try {
          const res = await fetch(blob.url);
          const data = await res.json();
          return data;
        } catch {
          return null;
        }
      })
    );

    // Filter out nulls and sort by createdAt desc
    const validBriefs = briefs
      .filter(Boolean)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return NextResponse.json({ briefs: validBriefs });
  } catch (error) {
    console.error('Error listing briefs:', error);
    return NextResponse.json({ briefs: [] });
  }
}

// POST /api/briefs - Create new brief
export async function POST(request) {
  try {
    const body = await request.json();
    const { clientName, campaignName, items } = body;

    if (!clientName || !campaignName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const id = generateId();
    const now = new Date().toISOString();

    const brief = {
      id,
      clientName,
      campaignName,
      items: items || [],
      createdAt: now,
      updatedAt: now,
    };

    // Save to blob storage
    await put(`briefs/${id}.json`, JSON.stringify(brief), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
    });

    return NextResponse.json({ id, brief });
  } catch (error) {
    console.error('Error creating brief:', error);
    return NextResponse.json({ error: 'Failed to create brief' }, { status: 500 });
  }
}

function generateId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 12; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}
