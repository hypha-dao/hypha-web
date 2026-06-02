import { NextResponse, type NextRequest } from 'next/server';
import { middleware as i18nMiddleware } from '@hypha-platform/i18n';

const IMAGE_HOSTS = process.env.NEXT_PUBLIC_IMAGE_HOSTS?.split(', ') ?? [];
const CONNECT_SOURCES =
  process.env.NEXT_PUBLIC_CONNECT_SOURCES?.split(', ') ?? [];

/**
 * UploadThing file CDN (subdomain per app, e.g. `*.ufs.sh`).
 * - frame-src / child-src: embedded viewers
 * - connect-src: PDF.js `getDocument({ url })` fetch, UploadThing client XHR/fetch
 * - object-src: `<object type="application/pdf">` fallback when canvas render fails
 */
const UPLOADTHING_UFS_HOST = 'https://*.ufs.sh';

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
    UPLOADTHING_UFS_HOST,
    ...(matrixImg ? [matrixImg] : []),
    ...IMAGE_HOSTS.map((host) => `https://${host}`),
  ].join(' ');
  /** `<video>` / `<audio>` use `media-src`; if unset, `default-src` blocks cross-origin Matrix clips. */
  const mediaSrc = [
    "'self'",
    'data:',
    'blob:',
    UPLOADTHING_UFS_HOST,
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
    UPLOADTHING_UFS_HOST,
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
      // Allow PDF previews for Space Memory (UploadThing URLs); 'none' blocks <object> and triggers console CSP noise.
      `object-src 'self' blob: ${UPLOADTHING_UFS_HOST}`,
      "base-uri 'self'",
      "form-action 'self' https://auth.privy.io https://privy.hypha.earth https://accounts.google.com",
      "frame-ancestors 'none'",
      `child-src https://auth.privy.io https://privy.hypha.earth https://verify.walletconnect.com https://verify.walletconnect.org ${UPLOADTHING_UFS_HOST}`,
      `frame-src https://auth.privy.io https://privy.hypha.earth https://verify.walletconnect.com https://verify.walletconnect.org https://challenges.cloudflare.com https://vercel.live ${UPLOADTHING_UFS_HOST}`,
      `connect-src 'self' ${connectSrc}`,
      // pdf.js may spawn workers from blob URLs in some builds
      "worker-src 'self' blob:",
      "manifest-src 'self'",
    ].join(';') + ';';

  response.headers.set('Content-Security-Policy', cspHeaderValue);
  response.headers.set(
    'Permissions-Policy',
    'camera=(self), microphone=(self)',
  );

  return response;
}

export function middleware(request: NextRequest) {
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
