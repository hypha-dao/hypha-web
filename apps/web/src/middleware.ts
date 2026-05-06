import { NextResponse, type NextRequest } from 'next/server';
import { middleware as i18nMiddleware } from '@hypha-platform/i18n';

const IMAGE_HOSTS = process.env.NEXT_PUBLIC_IMAGE_HOSTS?.split(', ') ?? [];
const CONNECT_SOURCES =
  process.env.NEXT_PUBLIC_CONNECT_SOURCES?.split(', ') ?? [];

/** UploadThing / Vercel Blob file hosts (Space Memory PDF previews use iframes). */
const UPLOADTHING_FRAME_HOST = 'https://*.ufs.sh';

/** Origin of `NEXT_PUBLIC_MATRIX_HOMESERVER_URL` for CSP (timeline MXC → HTTP). */
function matrixHomeserverImgSrc(): string {
  const raw = process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL?.trim();
  if (!raw) return '';
  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const u = new URL(withProtocol);
    return `${u.protocol}//${u.host}`;
  } catch {
    return '';
  }
}

function applyCsp(response: NextResponse, request: NextRequest): NextResponse {
  if (
    process.env.NODE_ENV === 'development' &&
    process.env.ENABLE_LOCALHOST_CSP !== 'true'
  ) {
    return response;
  }

  const matrixImg = matrixHomeserverImgSrc();
  const imageSrc = [
    'data:',
    'blob:',
    ...(matrixImg ? [matrixImg] : []),
    ...IMAGE_HOSTS.map((host) => `https://${host}`),
  ].join(' ');
  /** `<video>` / `<audio>` use `media-src`; if unset, `default-src` blocks cross-origin Matrix clips. */
  const mediaSrc = [
    "'self'",
    'data:',
    'blob:',
    ...(matrixImg ? [matrixImg] : []),
    ...IMAGE_HOSTS.map((host) => `https://${host}`),
  ].join(' ');
  const localChainRpc =
    process.env.NODE_ENV !== 'production'
      ? [
          'http://127.0.0.1:8545',
          'http://localhost:8545',
          'ws://127.0.0.1:8545',
          'ws://localhost:8545',
        ].join(' ')
      : '';

  const connectSrc = [
    ...CONNECT_SOURCES,
    process.env.NEXT_PUBLIC_RPC_URL ?? '',
    process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL ?? '',
    localChainRpc,
  ]
    .filter(Boolean)
    .join(' ');

  const enableUnsafeScripts = "'unsafe-inline' 'unsafe-eval'";
  const cspHeaderValue =
    [
      "default-src 'self'",
      `script-src 'self' ${enableUnsafeScripts} https://challenges.cloudflare.com https://cdn.onesignal.com https://api.onesignal.com https://vercel.live`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://onesignal.com",
      `img-src 'self' ${imageSrc}`,
      `media-src ${mediaSrc}`,
      "font-src 'self' https://fonts.gstatic.com https://vercel.live",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      `child-src https://auth.privy.io https://privy.hypha.earth https://verify.walletconnect.com https://verify.walletconnect.org ${UPLOADTHING_FRAME_HOST}`,
      `frame-src https://auth.privy.io https://privy.hypha.earth https://verify.walletconnect.com https://verify.walletconnect.org https://challenges.cloudflare.com https://vercel.live ${UPLOADTHING_FRAME_HOST}`,
      `connect-src 'self' ${connectSrc}`,
      "worker-src 'self'",
      "manifest-src 'self'",
    ].join(';') + ';';

  response.headers.set('Content-Security-Policy', cspHeaderValue);

  return response;
}

export function middleware(request: NextRequest) {
  const rawUrl = request.url;
  const hasPrivyOauthParams = /[?&]privy_oauth(?:_|=|&|$)/i.test(rawUrl);
  if (hasPrivyOauthParams && request.nextUrl.search) {
    const sanitizedUrl = request.nextUrl.clone();
    sanitizedUrl.search = '';
    return NextResponse.redirect(sanitizedUrl);
  }

  const response = i18nMiddleware(request);

  if (response.status === 301 || response.status === 302) {
    return response;
  }

  return applyCsp(response, request);
}

export const config = {
  matcher: [
    '/((?!api|signin|placeholder|icon|onesignal|.well-known|_next/static|_next/image|favicon.ico).*)',
  ],
};
