import { NextRequest, NextResponse } from 'next/server';

import { findDocumentBySlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import {
  findDocumentSpace,
  resolveMappedHostScope,
} from '../../../../../lib/white-label/mapped-host-scope';

type Params = { documentSlug: string };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { documentSlug } = await params;

  // TODO: implement authorization
  // const authToken = request.headers.get('Authorization')?.split(' ')[1] || '';

  try {
    // Mapped host (Space header set by middleware): a document of the host's
    // own Space only. No header means the main app, unchanged.
    const scope = await resolveMappedHostScope(request, { db });
    if (scope.kind !== 'main') {
      const row =
        scope.kind === 'mapped'
          ? await findDocumentSpace({ slug: documentSlug }, { db })
          : null;
      if (!row || scope.kind !== 'mapped' || row.spaceId !== scope.spaceId) {
        return NextResponse.json(
          { error: 'Document not found' },
          { status: 404 },
        );
      }
      const document = await findDocumentBySlug({ slug: documentSlug }, { db });
      // The row returned is the row that passed the Space check.
      if (!document || document.id !== row.id) {
        return NextResponse.json(
          { error: 'Document not found' },
          { status: 404 },
        );
      }
      return NextResponse.json(document);
    }

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
