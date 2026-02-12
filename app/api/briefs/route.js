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
    const { clientName, campaignName, items, groups } = body;

    if (!clientName || !campaignName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const id = generateId();
    const now = new Date().toISOString();

    // If no groups provided, auto-generate from items
    let briefGroups = groups || [];
    if (briefGroups.length === 0 && items && items.length > 0) {
      briefGroups = autoGroupItems(items);
    }

    const brief = {
      id,
      clientName,
      campaignName,
      items: items || [],
      groups: briefGroups,
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

function autoGroupItems(items) {
  const groups = {};
  
  items.forEach(item => {
    const groupId = item.creativeGroupId || `${item.channel}-${item.specs?.dimensions || 'default'}`;
    
    if (!groups[groupId]) {
      groups[groupId] = {
        id: groupId,
        name: item.creativeGroupName || item.specs?.dimensions || 'Group',
        channel: item.channel,
        channelName: item.channelName,
        specs: item.specs,
        placements: [],
        earliestDue: null,
        minStart: null,
        maxEnd: null,
        status: 'briefed',
      };
    }
    
    groups[groupId].placements.push(item);
    
    // Update dates
    if (item.dueDate && (!groups[groupId].earliestDue || item.dueDate < groups[groupId].earliestDue)) {
      groups[groupId].earliestDue = item.dueDate;
    }
    if (item.flightStart && (!groups[groupId].minStart || item.flightStart < groups[groupId].minStart)) {
      groups[groupId].minStart = item.flightStart;
    }
    if (item.flightEnd && (!groups[groupId].maxEnd || item.flightEnd > groups[groupId].maxEnd)) {
      groups[groupId].maxEnd = item.flightEnd;
    }
  });
  
  return Object.values(groups);
}
