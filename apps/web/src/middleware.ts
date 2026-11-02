import { NextResponse, type NextRequest } from 'next/server';
import { middleware as i18nMiddleware } from '@hypha-platform/i18n';
import { matrixTurnConnectSourcesFromEnv } from './lib/matrix-connect-src';

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
/** Older UploadThing links use utfs.io. PDF iframes need them in frame-src. */
const UPLOADTHING_FILE_HOSTS = `${UPLOADTHING_UFS_HOST} https://utfs.io https://*.utfs.io`;
/**
 * UploadThing v7 uploads go to a region-prefixed ingest host
 * (`<region>.ingest.uploadthing.com`), which is distinct from the `*.ufs.sh`
 * serving CDN. Without it in `connect-src`, the upload PUT is blocked by CSP and
 * the client hangs (e.g. "Uploading token icon..." never completes). Hardcoded
 * (like `*.ufs.sh`) so uploads work regardless of per-env `NEXT_PUBLIC_CONNECT_SOURCES`.
 */
const UPLOADTHING_INGEST_HOST = 'https://*.ingest.uploadthing.com';

/** Signal videos pasted as a YouTube or Vimeo link. `frame-src` blocks the embed otherwise. */
const SIGNAL_VIDEO_FRAME_HOSTS =
  'https://www.youtube-nocookie.com https://www.youtube.com https://player.vimeo.com';
/** Still frames shown before play. Without these, the card stays a black box. */
const SIGNAL_VIDEO_POSTER_HOSTS =
  'https://i.ytimg.com https://img.youtube.com https://i.vimeocdn.com';

/** OpenAI Realtime API (WebRTC / client secrets) — onboarding voice discovery Phase 2. */
const OPENAI_REALTIME_CONNECT_SOURCES =
  'https://api.openai.com wss://api.openai.com';

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
    'https://utfs.io',
    'https://*.utfs.io',
    ...(matrixImg ? [matrixImg] : []),
    'https://*.googleusercontent.com',
    'https://*.ggpht.com',
    ...IMAGE_HOSTS.map((host) => `https://${host}`),
  ].join(' ');
  /** `<video>` / `<audio>` use `media-src`; if unset, `default-src` blocks cross-origin Matrix clips. */
  const mediaSrc = [
    "'self'",
    'data:',
    'blob:',
    UPLOADTHING_UFS_HOST,
    'https://utfs.io',
    'https://*.utfs.io',
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
    ...matrixTurnConnectSourcesFromEnv(),
    OPENAI_REALTIME_CONNECT_SOURCES,
    'https://www.googleapis.com',
    'https://oauth2.googleapis.com',
    'https://content.googleapis.com',
    UPLOADTHING_UFS_HOST,
    'https://utfs.io',
    'https://*.utfs.io',
    UPLOADTHING_INGEST_HOST,
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
      `script-src 'self' ${enableUnsafeScripts} https://challenges.cloudflare.com https://cdn.onesignal.com https://api.onesignal.com https://vercel.live https://apis.google.com https://accounts.google.com`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://onesignal.com",
      `img-src 'self' ${imageSrc} ${SIGNAL_VIDEO_POSTER_HOSTS}`,
      `media-src ${mediaSrc}`,
      "font-src 'self' https://fonts.gstatic.com https://vercel.live",
      // Allow PDF previews for Space Memory (UploadThing URLs); 'none' blocks <object> and triggers console CSP noise.
      `object-src 'self' blob: ${UPLOADTHING_FILE_HOSTS}`,
      "base-uri 'self'",
      "form-action 'self' https://auth.privy.io https://privy.hypha.earth https://accounts.google.com",
      "frame-ancestors 'none'",
      `child-src https://auth.privy.io https://privy.hypha.earth https://verify.walletconnect.com https://verify.walletconnect.org ${SIGNAL_VIDEO_FRAME_HOSTS} ${UPLOADTHING_FILE_HOSTS}`,
      `frame-src https://auth.privy.io https://privy.hypha.earth https://verify.walletconnect.com https://verify.walletconnect.org https://challenges.cloudflare.com https://vercel.live https://docs.google.com https://drive.google.com ${SIGNAL_VIDEO_FRAME_HOSTS} ${UPLOADTHING_FILE_HOSTS}`,
      `connect-src 'self' ${connectSrc}`,
      // pdf.js may spawn workers from blob URLs in some builds
      "worker-src 'self' blob:",
      "manifest-src 'self'",
    ].join(';') + ';';

  response.headers.set('Content-Security-Policy', cspHeaderValue);
  response.headers.set(
    'Permissions-Policy',
    'camera=(self), microphone=(self), display-capture=(self)',
  );

  return response;
}

// SPIKE #2616 (V2): host -> Space map, hardcoded. Throwaway.
const WL_HOSTS: Record<string, string> = {
  'liz.localhost': 'cordoba-ecovillage',
  'hypha-test.gerroza.com': 'ponta-do-sol-energy-community',
};
// Per-deployment Vercel URLs (spike option C: second origin without a custom domain).
const WL_VERCEL_DEPLOY_HOST = /^hypha-[a-z0-9]+-hypha-dao\.vercel\.app$/;
const WL_FRAME_ANCESTORS =
  'frame-ancestors https://pr-2617.preview-app.hypha.earth http://localhost:8080;';
const WL_SECTIONS = /^\/(overview|energy|agreements|members|treasury)(\/.*)?$/;

function whiteLabelRewrite(request: NextRequest): NextResponse | null {
  const hostname = (request.headers.get('host') ?? '').split(':')[0] ?? '';
  const slug =
    WL_HOSTS[hostname] ??
    (WL_VERCEL_DEPLOY_HOST.test(hostname)
      ? 'ponta-do-sol-energy-community'
      : undefined);
  if (!slug) return null;
  const { pathname, search } = request.nextUrl;
  const to = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = search;
    const res = NextResponse.rewrite(url);
    // SPIKE #2616 S5: allow framing by the test parent origins only (hardcoded).
    res.headers.set('Content-Security-Policy', WL_FRAME_ANCESTORS);
    return res;
  };
  if (pathname === '/') return to(`/en/wl/${slug}/overview`);
  if (WL_SECTIONS.test(pathname)) return to(`/en/wl/${slug}${pathname}`);
  const m = pathname.match(/^\/([a-z]{2})\/(wl|dho)\/([^/]+)(\/.*)?$/);
  if (m && m[3] === slug) return to(`/${m[1]}/wl/${slug}${m[4] ?? ''}`);
  // anything else on this host: not the mapped Space -> 404 (Q1.4)
  return to('/en/wl/__blocked/overview');
}

// SPIKE #2616 S2 probe: edge-compatible lookup via internal API fetch (timed).
async function s2Probe(request: NextRequest): Promise<NextResponse | null> {
  if (!request.nextUrl.pathname.startsWith('/__s2')) return null;
  const t0 = Date.now();
  try {
    const res = await fetch(
      `${request.nextUrl.origin}/api/v1/spaces/cordoba-ecovillage`,
      { cache: 'no-store' },
    );
    const body = (await res.json()) as { slug?: string } | null;
    return NextResponse.json({
      ok: true,
      status: res.status,
      ms: Date.now() - t0,
      slug: body?.slug,
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      ms: Date.now() - t0,
      error: String((e as Error)?.message ?? e).slice(0, 300),
    });
  }
}

export async function middleware(request: NextRequest) {
  const probe = await s2Probe(request);
  if (probe) return probe;
  const wl = whiteLabelRewrite(request);
  if (wl) return wl;
  const response = i18nMiddleware(request);

  if (response.status === 301 || response.status === 302) {
    return response;
  }

  return applyCsp(response, request);
}

export const config = {
  matcher: [
    // `_matrix` — inbound Matrix Application Service transaction pushes (#2483).
    // Rewritten in next.config to /api/matrix/appservice; must skip i18n + CSP here.
    '/((?!api|_matrix|signin|placeholder|spike-parent|icon|brand|onesignal|.well-known|geo|_next/static|_next/image|favicon.ico).*)',
  ],
};
