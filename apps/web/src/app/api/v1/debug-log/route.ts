import { NextRequest, NextResponse } from 'next/server';
import { appendFileSync } from 'fs';

type DebugPayload = {
  hypothesisId?: string;
  location?: string;
  message?: string;
  data?: Record<string, unknown>;
  timestamp?: number;
};

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as DebugPayload;
    appendFileSync(
      '/opt/cursor/logs/debug.log',
      `${JSON.stringify({
        hypothesisId: payload.hypothesisId ?? 'unknown',
        location: payload.location ?? 'unknown',
        message: payload.message ?? 'unknown',
        data: payload.data ?? {},
        timestamp: payload.timestamp ?? Date.now(),
      })}\n`,
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
