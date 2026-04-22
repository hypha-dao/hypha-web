import { fetchCoherenceForEditAction } from '@hypha-platform/core/server';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const headersList = await headers();
  const authToken = headersList.get('Authorization')?.split(' ')[1] ?? '';

  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const signal = await fetchCoherenceForEditAction(slug, { authToken });

  if (!signal) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(signal);
}
