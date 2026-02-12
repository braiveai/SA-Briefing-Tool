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

// PUT /api/brief/[briefId] - Full update brief
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

// PATCH /api/brief/[briefId] - Partial update (e.g., group status)
export async function PATCH(request, { params }) {
  try {
    const { briefId } = await params;
    const updates = await request.json();

    // Get existing brief
    const { blobs } = await list({ prefix: `briefs/${briefId}.json` });
    
    if (blobs.length === 0) {
      return NextResponse.json({ error: 'Brief not found' }, { status: 404 });
    }

    const res = await fetch(blobs[0].url);
    const brief = await res.json();

    // Handle group status update
    if (updates.groupId && updates.status) {
      brief.groups = (brief.groups || []).map(group => 
        group.id === updates.groupId 
          ? { ...group, status: updates.status }
          : group
      );
    }
    
    // Handle group upload update
    if (updates.groupId && updates.uploadUrl) {
      brief.groups = (brief.groups || []).map(group => 
        group.id === updates.groupId 
          ? { ...group, uploadUrl: updates.uploadUrl, uploadedAt: new Date().toISOString() }
          : group
      );
    }
    
    // Handle individual placement status update
    if (updates.placementId && updates.status) {
      brief.items = (brief.items || []).map(item => 
        item.id === updates.placementId 
          ? { ...item, status: updates.status }
          : item
      );
    }

    brief.updatedAt = new Date().toISOString();

    // Save updated brief
    await put(`briefs/${briefId}.json`, JSON.stringify(brief), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
    });

    return NextResponse.json(brief);
  } catch (error) {
    console.error('Error patching brief:', error);
    return NextResponse.json({ error: 'Failed to update brief' }, { status: 500 });
  }
}
