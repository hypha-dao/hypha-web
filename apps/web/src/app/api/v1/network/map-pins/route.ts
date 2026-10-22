import { resolveCreatorMapCoordinates } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { NextRequest } from 'next/server';
import { z } from 'zod';

export const maxDuration = 60;

const bodySchema = z.object({
  spaces: z
    .array(
      z.object({
        id: z.number().int().positive(),
        creatorAddress: z.string().nullable().optional(),
        memberAddresses: z.array(z.string()).max(400).optional(),
      }),
    )
    .max(500),
});

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 12;

type RateLimitBucket = { count: number; windowStartedAt: number };
const rateLimitByIp = new Map<string, RateLimitBucket>();

function clientIp(request: NextRequest): string {
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  const forwarded = request.headers.get('x-forwarded-for');
  if (!forwarded) return 'unknown';
  const chain = forwarded
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return chain.at(-1) ?? 'unknown';
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  for (const [key, bucket] of rateLimitByIp) {
    if (now - bucket.windowStartedAt > RATE_LIMIT_WINDOW_MS) {
      rateLimitByIp.delete(key);
    }
  }
  const bucket = rateLimitByIp.get(ip);
  if (!bucket || now - bucket.windowStartedAt > RATE_LIMIT_WINDOW_MS) {
    rateLimitByIp.set(ip, { count: 1, windowStartedAt: now });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT_MAX_REQUESTS;
}

/**
 * Places for spaces that have no coordinates of their own. Each line is a
 * JSON object of space id to coordinates, written as soon as that place
 * resolves. The directory page does not wait for this.
 */
export async function POST(request: NextRequest) {
  if (isRateLimited(clientIp(request))) {
    return Response.json({ error: 'Too many requests' }, { status: 429 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: 'Invalid spaces' }, { status: 400 });
  }

  const encoder = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream({
    async start(controller) {
      const write = (
        pins: Record<number, { latitude: number; longitude: number }>,
      ) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(pins)}\n`));
        } catch {
          closed = true;
        }
      };
      try {
        await resolveCreatorMapCoordinates(
          parsed.data.spaces,
          { db, signal: request.signal },
          undefined,
          write,
        );
      } catch (error) {
        if (!request.signal.aborted) {
          console.error('[network/map-pins] failed to resolve pins', error);
        }
      } finally {
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            // The client already hung up.
          }
        }
      }
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
