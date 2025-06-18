import { NextRequest, NextResponse } from 'next/server';

import { createDocumentService, DirectionType, Order, OrderField, Document } from '@hypha-platform/core/server';

type Params = { spaceSlug: string };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> },
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

    // Get URL parameters for order
    const url = new URL(request.url);
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

    const documents = await documentsService.getAllBySpaceSlugWithoutPagination(
      {
        spaceSlug: spaceSlug,
        order: order,
      },
    );

    return NextResponse.json(documents);
  } catch (error) {
    console.error('Failed to fetch space documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch space documents' },
      { status: 500 },
    );
  }
}
