import { NextRequest, NextResponse } from 'next/server';

import { findDocumentBySlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

type Params = { documentSlug: string };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { documentSlug } = await params;

  // TODO: implement authorization
  // const authToken = request.headers.get('Authorization')?.split(' ')[1] || '';

  try {
    // TODO: implement authorization
    const document = await findDocumentBySlug({ slug: documentSlug }, { db });

    return NextResponse.json(document);
  } catch (error) {
    console.error('Failed to fetch document:', error);
    return NextResponse.json(
      { error: 'Failed to fetch document' },
      { status: 500 },
    );
  }
}
