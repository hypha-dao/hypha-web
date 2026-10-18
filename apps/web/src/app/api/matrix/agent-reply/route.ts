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

  let body: {
    roomId?: unknown;
    spaceSlug?: unknown;
    context?: unknown;
  };
  try {
    body = (await request.json()) as {
      roomId?: unknown;
      spaceSlug?: unknown;
      context?: unknown;
    };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const roomId = typeof body.roomId === 'string' ? body.roomId.trim() : '';
  if (!roomId) {
    return NextResponse.json({ error: 'Missing room' }, { status: 400 });
  }
  const spaceSlug =
    typeof body.spaceSlug === 'string' ? body.spaceSlug.trim() : '';
  const rawContext =
    body.context && typeof body.context === 'object'
      ? (body.context as Record<string, unknown>)
      : null;
  const kindRaw = typeof rawContext?.kind === 'string' ? rawContext.kind : '';
  const kind = (
    [
      'proposal',
      'signal',
      'space',
      'ecosystem',
      'public',
      'network',
      'dm',
    ] as const
  ).find((value) => value === kindRaw);
  const readString = (value: unknown) =>
    typeof value === 'string' ? value.trim() : '';
  const context = kind
    ? {
        kind,
        spaceSlug: readString(rawContext?.spaceSlug) || spaceSlug || null,
        documentSlug: readString(rawContext?.documentSlug) || null,
        documentTitle: readString(rawContext?.documentTitle) || null,
        signalSlug: readString(rawContext?.signalSlug) || null,
        signalTitle: readString(rawContext?.signalTitle) || null,
      }
    : null;

  const result = await replyToMatrixAgentMention({
    roomId,
    authToken: token,
    spaceSlug: spaceSlug || context?.spaceSlug || null,
    context,
    requestUrl: request.url,
  });
  return NextResponse.json(result);
}
