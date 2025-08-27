import { createHmac, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import type { Middleware } from '../../route-handlers';

export function newMiddleware(signingKey: string): Middleware {
  return async (req: Request) => {
    const header = req.headers.get('X-Alchemy-Signature');
    if (!header)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const theirSignature = Buffer.from(header);

    const hmac = createHmac('sha256', signingKey);
    const body = await req.text();
    hmac.update(body, 'utf8');
    const ourSignature = Buffer.from(hmac.digest('hex'));

    if (theirSignature.length !== ourSignature.length)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!timingSafeEqual(theirSignature, ourSignature))
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  };
}
