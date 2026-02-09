import { put, list } from '@vercel/blob';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const briefId = formData.get('briefId');
    const itemId = formData.get('itemId');

    if (!file || !briefId || !itemId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Upload file to blob storage
    const filename = `uploads/${briefId}/${itemId}/${file.name}`;
    const blob = await put(filename, file, {
      access: 'public',
      addRandomSuffix: true,
    });

    const uploadedFile = {
      name: file.name,
      url: blob.url,
      size: file.size,
      type: file.type,
      uploadedAt: new Date().toISOString(),
    };

    // Update the brief with the uploaded file info
    const { blobs } = await list({ prefix: `briefs/${briefId}.json` });
    
    if (blobs.length > 0) {
      const res = await fetch(blobs[0].url);
      const brief = await res.json();

      // Update the specific item
      const updatedItems = brief.items.map(item =>
        item.id === itemId
          ? { ...item, uploadedFile, status: 'received' }
          : item
      );

      const updatedBrief = {
        ...brief,
        items: updatedItems,
        updatedAt: new Date().toISOString(),
      };

      await put(`briefs/${briefId}.json`, JSON.stringify(updatedBrief), {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
      });
    }

    return NextResponse.json({ file: uploadedFile });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}
