import { NextRequest, NextResponse } from 'next/server';

const VIMEO_THUMBNAIL_HOST = /(^|\.)vimeocdn\.com$/i;

/**
 * Public Vimeo thumbnail for a signal card that has a video and no image.
 * YouTube posters are built in the client. This only resolves Vimeo.
 */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')?.trim() ?? '';
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ thumbnail: null }, { status: 400 });
  }

  const endpoint = new URL('https://vimeo.com/api/oembed.json');
  endpoint.searchParams.set('url', `https://vimeo.com/${id}`);
  endpoint.searchParams.set('width', '640');

  try {
    const response = await fetch(endpoint, { next: { revalidate: 86_400 } });
    if (!response.ok) {
      return NextResponse.json({ thumbnail: null });
    }
    const body = (await response.json()) as { thumbnail_url?: unknown };
    const thumbnail =
      typeof body.thumbnail_url === 'string' ? body.thumbnail_url : '';
    let host = '';
    try {
      host = new URL(thumbnail).hostname;
    } catch {
      host = '';
    }
    if (!thumbnail.startsWith('https://') || !VIMEO_THUMBNAIL_HOST.test(host)) {
      return NextResponse.json({ thumbnail: null });
    }
    return NextResponse.json({ thumbnail });
  } catch (error) {
    console.error('[video-poster] vimeo oembed failed', error);
    return NextResponse.json({ thumbnail: null });
  }
}
