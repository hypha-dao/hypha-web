import {
  geocodeRequestSchema,
  geocodeResponseSchema,
  searchNominatim,
} from '@hypha-platform/core/server';
import { NextResponse } from 'next/server';

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

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  pruneRateLimitBuckets(now);
  const bucket = rateLimitByIp.get(ip);
  if (!bucket || now - bucket.windowStartedAt > RATE_LIMIT_WINDOW_MS) {
    rateLimitByIp.set(ip, { count: 1, windowStartedAt: now });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT_MAX_REQUESTS;
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many geocode requests. Please try again shortly.' },
        { status: 429 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Malformed JSON body' },
        { status: 400 },
      );
    }

    const parsed = geocodeRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.format() },
        { status: 400 },
      );
    }

    const results = await searchNominatim(
      parsed.data.query,
      parsed.data.limit ?? 5,
    );
    const response = geocodeResponseSchema.parse({ results });
    return NextResponse.json(response);
  } catch (error) {
    console.error('[api/v1/geocode] Failed to geocode:', error);
    return NextResponse.json(
      { error: 'Failed to geocode location' },
      { status: 500 },
    );
  }
}
