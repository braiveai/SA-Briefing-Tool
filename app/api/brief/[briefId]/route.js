import { put, list } from '@vercel/blob';
import { NextResponse } from 'next/server';

// GET /api/brief/[briefId] - Get single brief
export async function GET(request, { params }) {
  try {
    const { briefId } = await params;
    
    const { blobs } = await list({ prefix: `briefs/${briefId}.json` });
    
    if (blobs.length === 0) {
      return NextResponse.json({ error: 'Brief not found' }, { status: 404 });
    }

    const res = await fetch(blobs[0].url);
    const brief = await res.json();

    return NextResponse.json(brief);
  } catch (error) {
    console.error('Error getting brief:', error);
    return NextResponse.json({ error: 'Failed to get brief' }, { status: 500 });
  }
}

// PUT /api/brief/[briefId] - Update brief
export async function PUT(request, { params }) {
  try {
    const { briefId } = await params;
    const body = await request.json();

    // Get existing brief
    const { blobs } = await list({ prefix: `briefs/${briefId}.json` });
    
    if (blobs.length === 0) {
      return NextResponse.json({ error: 'Brief not found' }, { status: 404 });
    }

    const res = await fetch(blobs[0].url);
    const existingBrief = await res.json();

    // Merge updates
    const updatedBrief = {
      ...existingBrief,
      ...body,
      id: briefId, // Ensure ID doesn't change
      updatedAt: new Date().toISOString(),
    };

    // Save updated brief
    await put(`briefs/${briefId}.json`, JSON.stringify(updatedBrief), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
    });

    return NextResponse.json(updatedBrief);
  } catch (error) {
    console.error('Error updating brief:', error);
    return NextResponse.json({ error: 'Failed to update brief' }, { status: 500 });
  }
}
