import { NextRequest, NextResponse } from 'next/server';

import {
  createDocumentService,
  DirectionType,
  Document,
  Order,
  OrderField,
} from '@hypha-platform/core/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ spaceSlug: string }> },
) {
  const { spaceSlug } = await params;

  // Get token from Authorization header
  const authToken = request.headers.get('Authorization')?.split(' ')[1] || '';

  const getDirection = (value: string) => {
    let dir: DirectionType = DirectionType.Asc;
    switch (value) {
      case '-':
        dir = DirectionType.Desc;
        break;
      case '+':
      default:
        dir = DirectionType.Asc;
        break;
    }
    return dir;
  };

  try {
    const documentsService = createDocumentService({ authToken });

    // Get URL parameters for pagination
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const pageSize = parseInt(url.searchParams.get('pageSize') || '10', 10);
    const state = url.searchParams.get('state');
    const searchTerm = url.searchParams.get('searchTerm') || undefined;
    const orderString = url.searchParams.get('order') || undefined;

    const order: Order<Document> = [];
    if (orderString) {
      orderString
        .split(',')
        .map((fieldName) => fieldName.trim())
        .forEach((fieldName) => {
          const match = /^([\+\-]?)(\w+)$/.exec(fieldName);
          if (match) {
            const dir = getDirection(match[1]);
            const name = match[2] as keyof Document;
            const orderField: OrderField<Document> = { dir, name };
            order.push(orderField);
          }
        });
    }

    const filter = {
      ...(state ? { state } : {}),
    };

    const paginatedDocuments = await documentsService.getAllBySpaceSlug(
      { spaceSlug },
      { pagination: { page, pageSize, order }, filter, searchTerm },
    );

    return NextResponse.json(paginatedDocuments);
  } catch (error) {
    console.error('Failed to fetch documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 },
    );
  }
}
