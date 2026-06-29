import {
  geocodeRequestSchema,
  geocodeResponseSchema,
  searchNominatim,
} from '@hypha-platform/core/server';
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;

type RateLimitBucket = {
  count: number;
  windowStartedAt: number;
};

const rateLimitByIp = new Map<string, RateLimitBucket>();

function pruneRateLimitBuckets(now: number): void {
  for (const [ip, bucket] of rateLimitByIp) {
    if (now - bucket.windowStartedAt > RATE_LIMIT_WINDOW_MS) {
      rateLimitByIp.delete(ip);
    }
  }
}

function getClientIp(request: Request): string {
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const chain = forwarded
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    return chain.at(-1) ?? 'unknown';
  }

  return 'unknown';
}

function getRateLimitKey(ip: string): string {
  if (ip !== 'unknown') {
    return ip;
  }
  return `unknown:${randomUUID()}`;
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  pruneRateLimitBuckets(now);
  const bucket = rateLimitByIp.get(key);
  if (!bucket || now - bucket.windowStartedAt > RATE_LIMIT_WINDOW_MS) {
    rateLimitByIp.set(key, { count: 1, windowStartedAt: now });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT_MAX_REQUESTS;
}

function geocodeErrorResponse(
  code: string,
  message: string,
  status: number,
  details?: unknown,
) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
      },
    },
    { status },
  );
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const rateLimitKey = getRateLimitKey(ip);
    if (isRateLimited(rateLimitKey)) {
      return geocodeErrorResponse(
        'RATE_LIMIT_EXCEEDED',
        'Too many geocode requests. Please try again shortly.',
        429,
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return geocodeErrorResponse('MALFORMED_JSON', 'Malformed JSON body', 400);
    }

    const parsed = geocodeRequestSchema.safeParse(body);
    if (!parsed.success) {
      return geocodeErrorResponse(
        'VALIDATION_FAILED',
        'Validation failed',
        400,
        parsed.error.format(),
      );
    }

    const results = await searchNominatim(
      parsed.data.query,
      parsed.data.limit ?? 5,
    );
    const pageSize = parsed.data.limit ?? 5;
    const total = results.length;
    const response = geocodeResponseSchema.parse({
      data: results,
      pagination: {
        total,
        page: 1,
        pageSize,
        totalPages: total === 0 ? 0 : 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    });
    return NextResponse.json(response);
  } catch (error) {
    console.error('[api/v1/geocode] Failed to geocode:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to geocode location';
    const isUpstream = /nominatim/i.test(message);
    return geocodeErrorResponse(
      isUpstream ? 'UPSTREAM_GEOCODE_FAILED' : 'GEOCODE_FAILED',
      isUpstream ? 'Geocoding service is temporarily unavailable.' : message,
      isUpstream ? 502 : 500,
    );
  }
}
