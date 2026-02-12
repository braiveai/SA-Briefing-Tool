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
          return await res.json();
        } catch {
          return null;
        }
      })
    );

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

    // Build channel-grouped structure from items
    const groups = buildGroups(items || []);

    const brief = {
      id,
      clientName,
      campaignName,
      items: items || [],
      groups, // Channel → Specs hierarchy
      dueDateBuffer: 5, // Default: due 5 days before flight start
      createdAt: now,
      updatedAt: now,
    };

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

// ============================================
// BUILD GROUPS BY CHANNEL → SPECS
// ============================================
function buildGroups(items) {
  const channels = {};
  
  items.forEach(item => {
    const channel = item.channel || 'ooh';
    
    // Determine spec key based on channel type
    let specKey;
    if (channel === 'radio' || channel === 'tv') {
      specKey = item.specs?.adLength || item.specs?.spotLength || 'unknown';
    } else {
      specKey = item.specs?.dimensions || 'unknown';
    }
    
    const groupId = `${channel}-${specKey}`;
    
    if (!channels[channel]) {
      channels[channel] = {
        channel,
        specs: {},
      };
    }
    
    if (!channels[channel].specs[specKey]) {
      channels[channel].specs[specKey] = {
        id: groupId,
        specKey,
        label: specKey,
        channel,
        channelName: item.channelName,
        publisher: item.publisherName,
        placements: [],
        minStart: null,
        maxEnd: null,
        earliestDue: null,
        status: 'briefed',
      };
    }
    
    const spec = channels[channel].specs[specKey];
    spec.placements.push(item);
    
    // Update date ranges
    if (item.flightStart) {
      if (!spec.minStart || item.flightStart < spec.minStart) {
        spec.minStart = item.flightStart;
      }
    }
    if (item.flightEnd) {
      if (!spec.maxEnd || item.flightEnd > spec.maxEnd) {
        spec.maxEnd = item.flightEnd;
      }
    }
    if (item.dueDate) {
      if (!spec.earliestDue || item.dueDate < spec.earliestDue) {
        spec.earliestDue = item.dueDate;
      }
    }
  });
  
  // Convert to array format for storage
  // Structure: { channel: 'ooh', specs: [...] }
  return Object.values(channels).map(ch => ({
    channel: ch.channel,
    specs: Object.values(ch.specs),
  }));
}

function generateId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 12; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}
