import { NextRequest, NextResponse } from 'next/server';
import {
  handleIbaMemoryMcpRequest,
  ibaMemoryMcpHealth,
} from '@hypha-platform/mcp-server/iba-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Non-secret protocol discovery. Hosted MCP is IBA-only; POST requires a space API key. */
export async function GET() {
  return NextResponse.json(ibaMemoryMcpHealth());
}

export async function POST(request: NextRequest) {
  return handleIbaMemoryMcpRequest(request);
}

export async function DELETE(request: NextRequest) {
  return handleIbaMemoryMcpRequest(request);
}
