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

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
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

    const body = await request.json();
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
