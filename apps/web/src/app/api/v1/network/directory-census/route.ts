import {
  findAllSpacesByWeb3SpaceIds,
  readNetworkDirectoryCensus,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { NextRequest } from 'next/server';
import { z } from 'zod';

export const maxDuration = 60;

const bodySchema = z.object({
  web3SpaceIds: z.array(z.number().int().positive()).max(4000),
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
 * Member and agreement figures for directory spaces already painted from
 * Postgres. Each line is one finished chain batch. Unknown ids are ignored.
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

  const requested = parsed.data.web3SpaceIds;
  const known =
    requested.length === 0
      ? []
      : await findAllSpacesByWeb3SpaceIds(
          { web3SpaceIds: requested, parentOnly: false },
          { db },
        );
  const allowed = new Set(
    known.flatMap((space) =>
      typeof space.web3SpaceId === 'number' && space.web3SpaceId > 0
        ? [space.web3SpaceId]
        : [],
    ),
  );
  const web3SpaceIds = requested.filter((id) => allowed.has(id));

  const encoder = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream({
    async start(controller) {
      const write = (rows: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(rows)}\n`));
        } catch {
          closed = true;
        }
      };
      try {
        await readNetworkDirectoryCensus(web3SpaceIds, write, request.signal);
      } catch (error) {
        if (!request.signal.aborted) {
          console.error(
            '[network/directory-census] failed to read census',
            error,
          );
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
