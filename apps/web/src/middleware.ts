import { NextResponse, type NextRequest } from 'next/server';
import { middleware as i18nMiddleware } from '@hypha-platform/i18n';

const IMAGE_HOSTS = process.env.NEXT_PUBLIC_IMAGE_HOSTS?.split(', ') ?? [];
const CONNECT_SOURCES =
  process.env.NEXT_PUBLIC_CONNECT_SOURCES?.split(', ') ?? [];

function applyCsp(response: NextResponse, request: NextRequest): NextResponse {
  if (
    process.env.NODE_ENV === 'development' &&
    process.env.ENABLE_LOCALHOST_CSP !== 'true'
  ) {
    return response;
  }

  const imageSrc = [
    'data:',
    ...IMAGE_HOSTS.map((host) => `https://${host}`),
  ].join(' ');
  const connectSrc = [
    ...CONNECT_SOURCES,
    process.env.NEXT_PUBLIC_RPC_URL ?? '',
  ].join(' ');

  const enableUnsafeScripts = "'unsafe-inline' 'unsafe-eval'";
  const cspHeaderValue =
    [
      "default-src 'self'",
      `script-src 'self' ${enableUnsafeScripts} https://challenges.cloudflare.com https://cdn.onesignal.com https://api.onesignal.com https://vercel.live`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://onesignal.com",
      `img-src 'self' ${imageSrc}`,
      "font-src 'self' https://fonts.gstatic.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      'child-src https://auth.privy.io https://verify.walletconnect.com https://verify.walletconnect.org',
      'frame-src https://auth.privy.io https://verify.walletconnect.com https://verify.walletconnect.org https://challenges.cloudflare.com',
      `connect-src 'self' ${connectSrc}`,
      "worker-src 'self'",
      "manifest-src 'self'",
    ].join(';') + ';';

  response.headers.set('Content-Security-Policy', cspHeaderValue);

  return response;
}

export function middleware(request: NextRequest) {
  // Run i18n middleware first — it returns a NextResponse with the
  // X-NEXT-INTL-LOCALE request header embedded. We must use this response
  // as-is (or only append to its *response* headers) to avoid dropping the
  // locale header that next-intl reads on the server side.
  const response = i18nMiddleware(request);

  // Short-circuit on redirects — CSP is irrelevant for redirect responses
  if (response.status === 301 || response.status === 302) {
    return response;
  }

  // Apply CSP headers on top of the i18n response
  return applyCsp(response, request);
}

export const config = {
  matcher: [
    '/((?!api|signin|placeholder|icon|onesignal|.well-known|_next/static|_next/image|favicon.ico).*)',
  ],
};
