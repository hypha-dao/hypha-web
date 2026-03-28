import { NextRequest, NextResponse } from 'next/server';
import { appendFileSync } from 'node:fs';

import { findDocumentBySlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

type Params = { documentSlug: string };

const appendDebugLog = (
  hypothesisId: string,
  location: string,
  message: string,
  data: Record<string, unknown>,
) => {
  appendFileSync(
    '/opt/cursor/logs/debug.log',
    JSON.stringify({
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }) + '\n',
  );
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { documentSlug } = await params;
  // #region agent log
  appendDebugLog('A', 'documents/[documentSlug]/route.ts:30', 'GET entry', {
    documentSlug,
  });
  // #endregion

  // TODO: implement authorization
  // const authToken = request.headers.get('Authorization')?.split(' ')[1] || '';

  try {
    // TODO: implement authorization
    const document = await findDocumentBySlug({ slug: documentSlug }, { db });
    // #region agent log
    appendDebugLog('A', 'documents/[documentSlug]/route.ts:41', 'GET success', {
      hasDocument: Boolean(document),
      web3ProposalId: document?.web3ProposalId ?? null,
      state: document?.state ?? null,
    });
    // #endregion

    return NextResponse.json(document);
  } catch (error) {
    console.error('Failed to fetch document:', error);
    return NextResponse.json(
      { error: 'Failed to fetch document' },
      { status: 500 },
    );
  }
}
