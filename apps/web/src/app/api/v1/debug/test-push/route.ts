/** TEMP(#2575): sends a OneSignal push to the caller, to exercise the notification click path. */
import { NextRequest, NextResponse } from 'next/server';
import {
  getAbsoluteAppUrl,
  resolvePersonFromAuthToken,
} from '@hypha-platform/core/server';
import { sendPushByAlias } from '@hypha-platform/notifications/server';
import { parseBearerToken } from '@web/utils/parse-bearer-token';

export async function POST(request: NextRequest) {
  if (process.env.VERCEL_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const authToken = parseBearerToken(request.headers.get('Authorization'));
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const self = await resolvePersonFromAuthToken(authToken);
  if (!self?.slug) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    path?: string;
  } | null;
  const path = body?.path?.trim();
  if (!path || !path.startsWith('/') || path.startsWith('//')) {
    return NextResponse.json(
      { error: 'path must start with a single /' },
      { status: 400 },
    );
  }

  const result = await sendPushByAlias({
    app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? '',
    alias: { include_aliases: { external_id: [self.slug] } },
    content: {
      headings: { en: '#2575 test push' },
      contents: { en: path },
    },
    url: getAbsoluteAppUrl(path),
  });
  return NextResponse.json({ ok: true, result });
}
