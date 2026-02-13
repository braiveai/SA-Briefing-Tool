import { put, list } from '@vercel/blob';
import { NextResponse } from 'next/server';

// GET /api/brief/[briefId]
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

// PUT /api/brief/[briefId] - Full update
export async function PUT(request, { params }) {
  try {
    const { briefId } = await params;
    const body = await request.json();

    const { blobs } = await list({ prefix: `briefs/${briefId}.json` });
    
    if (blobs.length === 0) {
      return NextResponse.json({ error: 'Brief not found' }, { status: 404 });
    }

    const res = await fetch(blobs[0].url);
    const existingBrief = await res.json();

    const updatedBrief = {
      ...existingBrief,
      ...body,
      id: briefId,
      updatedAt: new Date().toISOString(),
    };

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

// PATCH /api/brief/[briefId] - Partial updates
export async function PATCH(request, { params }) {
  try {
    const { briefId } = await params;
    const updates = await request.json();

    const { blobs } = await list({ prefix: `briefs/${briefId}.json` });
    
    if (blobs.length === 0) {
      return NextResponse.json({ error: 'Brief not found' }, { status: 404 });
    }

    const res = await fetch(blobs[0].url);
    const brief = await res.json();

    // Handle group status update
    if (updates.groupId && updates.status) {
      if (brief.groups) {
        brief.groups = brief.groups.map(channelGroup => ({
          ...channelGroup,
          specs: channelGroup.specs?.map(spec => 
            spec.id === updates.groupId 
              ? { ...spec, status: updates.status }
              : spec
          ) || []
        }));
      }
    }
    
    // Handle group upload
    if (updates.groupId && updates.uploadUrl) {
      if (brief.groups) {
        brief.groups = brief.groups.map(channelGroup => ({
          ...channelGroup,
          specs: channelGroup.specs?.map(spec => 
            spec.id === updates.groupId 
              ? { ...spec, uploadUrl: updates.uploadUrl, uploadedAt: new Date().toISOString() }
              : spec
          ) || []
        }));
      }
    }

    // Handle individual placement edit
    if (updates.placementId && updates.placementUpdates) {
      if (brief.items) {
        brief.items = brief.items.map(item => 
          item.id === updates.placementId 
            ? { ...item, ...updates.placementUpdates }
            : item
        );
      }
    }

    // Handle adding new placements
    if (updates.addItems && Array.isArray(updates.addItems)) {
      if (!brief.items) brief.items = [];
      brief.items = [...brief.items, ...updates.addItems];
    }

    // Handle adding reference document/attachment
    if (updates.addAttachment) {
      if (!brief.attachments) brief.attachments = [];
      brief.attachments.push({
        ...updates.addAttachment,
        addedAt: new Date().toISOString(),
      });
    }

    // Handle removing attachment
    if (updates.removeAttachmentIndex !== undefined) {
      if (brief.attachments) {
        brief.attachments = brief.attachments.filter((_, i) => i !== updates.removeAttachmentIndex);
      }
    }

    // Handle removing placement
    if (updates.removePlacementId) {
      if (brief.items) {
        brief.items = brief.items.filter(item => item.id !== updates.removePlacementId);
      }
    }

    // Handle removing multiple placements at once (e.g. deleting a whole spec card)
    if (updates.removePlacementIds && Array.isArray(updates.removePlacementIds)) {
      if (brief.items) {
        const idsToRemove = new Set(updates.removePlacementIds);
        brief.items = brief.items.filter(item => !idsToRemove.has(item.id));
      }
    }

    // Handle basic field updates
    if (updates.clientName) brief.clientName = updates.clientName;
    if (updates.campaignName) brief.campaignName = updates.campaignName;
    if (updates.dueDateBuffer !== undefined) brief.dueDateBuffer = updates.dueDateBuffer;

    brief.updatedAt = new Date().toISOString();

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
