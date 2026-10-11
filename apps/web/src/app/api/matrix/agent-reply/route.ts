import { NextRequest, NextResponse } from 'next/server';
import {
  replyToMatrixAgentMention,
  verifyPrivyAuthToken,
} from '@hypha-platform/chat-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Someone @mentioned Hypha in a Matrix room. Read that room and, when the latest
 * message is the mention, post one reply. Does nothing when the mention is absent.
 */
export async function POST(request: NextRequest) {
  const header = request.headers.get('authorization') ?? '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return NextResponse.json({ error: 'Missing auth token' }, { status: 401 });
  }
  const auth = await verifyPrivyAuthToken(token);
  if (!auth.valid) {
    return NextResponse.json({ error: 'Invalid auth token' }, { status: 401 });
  }

  let body: { roomId?: unknown; spaceSlug?: unknown };
  try {
    body = (await request.json()) as { roomId?: unknown; spaceSlug?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const roomId = typeof body.roomId === 'string' ? body.roomId.trim() : '';
  if (!roomId) {
    return NextResponse.json({ error: 'Missing room' }, { status: 400 });
  }
  const spaceSlug =
    typeof body.spaceSlug === 'string' ? body.spaceSlug.trim() : '';

  const result = await replyToMatrixAgentMention({
    roomId,
    authToken: token,
    spaceSlug: spaceSlug || null,
    requestUrl: request.url,
  });
  return NextResponse.json(result);
}
