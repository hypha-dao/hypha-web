import { NextRequest, NextResponse } from 'next/server';
import { getAlchemyValidator } from '@hypha-platform/core/server';

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    const alchemySigningKey = process.env.ALCHEMY_WEBHOOK_SIGNING_KEY;
    if (!alchemySigningKey) {
      console.error('Alchemy signing key for a webhook is missing');

      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 },
      );
    }

    const isSignatureValid = await getAlchemyValidator(alchemySigningKey)(
      request,
    );
    if (!isSignatureValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  console.debug('body:', await request.json());

  return NextResponse.json({ status: 'ok' }, { status: 200 });
}
