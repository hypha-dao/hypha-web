import { NextResponse, type NextRequest } from 'next/server';
import { middleware as i18nMiddleware, routing } from '@hypha-platform/i18n';
import { matrixTurnConnectSourcesFromEnv } from './lib/matrix-connect-src';
import {
  API_PREFIX,
  DENY_FRAMING,
  HOST_FRAMING,
  INTERNAL_NOT_FOUND_PATH,
  WL_AUTH_HEADER,
  WL_CLIENT_HEADER,
  WL_LOCALE_COOKIE,
  WL_MODE_HEADER,
  WL_NOT_FOUND_HEADER,
  WL_SPACE_HEADER,
  embedFraming,
  getWhiteLabelConfig,
  isMappedHost,
  localeForPath,
  resolve,
  privyHostOrigins,
  serializeAuthConfig,
  stripWhiteLabelHeaders,
  withPrivyHostOrigins,
  type FramingPolicy,
} from './lib/white-label';

/** Header next-intl reads to pick the request locale. */
const INTL_LOCALE_HEADER = 'X-NEXT-INTL-LOCALE';

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

function applyCsp(
  response: NextResponse,
  request: NextRequest,
  framing: FramingPolicy = DENY_FRAMING,
  /** Extra Privy origins of a mapped host (its own cookie host), exact, per request. */
  extraPrivyOrigins: readonly string[] = [],
): NextResponse {
  if (
    process.env.NODE_ENV === 'development' &&
    process.env.ENABLE_LOCALHOST_CSP !== 'true'
  ) {
    // Local dev has no CSP, but a framed response still carries its allowlist.
    if (framing.frameAncestors !== DENY_FRAMING.frameAncestors) {
      response.headers.set(
        'Content-Security-Policy',
        `frame-ancestors ${framing.frameAncestors};`,
      );
    }
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
      `frame-ancestors ${framing.frameAncestors}`,
      `child-src https://auth.privy.io https://privy.hypha.earth https://verify.walletconnect.com https://verify.walletconnect.org ${SIGNAL_VIDEO_FRAME_HOSTS} ${UPLOADTHING_FILE_HOSTS}`,
      `frame-src https://auth.privy.io https://privy.hypha.earth https://verify.walletconnect.com https://verify.walletconnect.org https://challenges.cloudflare.com https://vercel.live https://docs.google.com https://drive.google.com ${SIGNAL_VIDEO_FRAME_HOSTS} ${UPLOADTHING_FILE_HOSTS}`,
      `connect-src 'self' ${connectSrc}`,
      // pdf.js may spawn workers from blob URLs in some builds
      "worker-src 'self' blob:",
      "manifest-src 'self'",
    ].join(';') + ';';

  response.headers.set(
    'Content-Security-Policy',
    withPrivyHostOrigins(cspHeaderValue, extraPrivyOrigins),
  );
  response.headers.set(
    'Permissions-Policy',
    'camera=(self), microphone=(self), display-capture=(self)',
  );

  return response;
}

/**
 * Framing is set per response (it used to be a static rule in next.config):
 * the main app, unknown hosts and the internal tree get `DENY`; `/embed` gets
 * none and relies on CSP `frame-ancestors` for its Space's origins.
 */
function applyFramingHeaders(
  response: NextResponse,
  framing: FramingPolicy,
): NextResponse {
  if (framing.xFrameOptions) {
    response.headers.set('X-Frame-Options', framing.xFrameOptions);
  } else {
    response.headers.delete('X-Frame-Options');
  }
  return response;
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isApi =
    pathname === `/${API_PREFIX}` || pathname.startsWith(`/${API_PREFIX}/`);
  const host = request.headers.get('host');
  const config = getWhiteLabelConfig();

  // White label: the resolver decides, this function only applies it.
  const whiteLabelOptions = {
    locales: routing.locales,
    defaultLocale: routing.defaultLocale,
    acceptLanguage: request.headers.get('accept-language'),
    localeCookie: request.cookies.get(WL_LOCALE_COOKIE)?.value ?? null,
    method: request.method,
  };
  const decision = resolve(host, pathname, config, whiteLabelOptions);

  if (decision.kind === 'api-allow') {
    // A read a mapped host may call: the route runs unchanged.
    return NextResponse.next({
      request: { headers: stripWhiteLabelHeaders(request.headers) },
    });
  }

  if (decision.kind === 'rewrite') {
    const headers = stripWhiteLabelHeaders(request.headers);
    headers.set(WL_SPACE_HEADER, decision.spaceSlug);
    headers.set(WL_MODE_HEADER, decision.mode);
    headers.set(INTL_LOCALE_HEADER, decision.locale);
    if (decision.mode === 'host') {
      headers.set(WL_CLIENT_HEADER, decision.clientId);
      if (decision.authConfig) {
        headers.set(WL_AUTH_HEADER, serializeAuthConfig(decision.authConfig));
      }
    }
    const url = request.nextUrl.clone();
    url.pathname = decision.pathname;
    const framing =
      decision.mode === 'host'
        ? HOST_FRAMING
        : embedFraming(decision.framingOrigins);
    const rewrite = NextResponse.rewrite(url, { request: { headers } });
    // The locale may come from Accept-Language (and, on a host, the cookie):
    // caches must not share it.
    rewrite.headers.append(
      'Vary',
      decision.mode === 'host' ? 'Accept-Language, Cookie' : 'Accept-Language',
    );
    if (
      decision.mode === 'host' &&
      decision.localeFromPath &&
      whiteLabelOptions.localeCookie !== decision.locale
    ) {
      // First party on a host: remember the language the visitor chose.
      rewrite.cookies.set(WL_LOCALE_COOKIE, decision.locale, {
        path: '/',
        sameSite: 'lax',
        secure: request.nextUrl.protocol === 'https:',
        maxAge: 60 * 60 * 24 * 365,
      });
    }
    return applyFramingHeaders(
      applyCsp(
        rewrite,
        request,
        framing,
        decision.mode === 'host' ? privyHostOrigins(decision.authConfig) : [],
      ),
      framing,
    );
  }

  if (decision.kind === 'not-found') {
    // An API path is answered here: no page, no body.
    if (isApi) {
      return new NextResponse(null, {
        status: 404,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    // Unmatched internal path plus a marker: global-not-found renders the bare shell.
    const headers = stripWhiteLabelHeaders(request.headers);
    headers.set(WL_NOT_FOUND_HEADER, '1');
    headers.set(
      INTL_LOCALE_HEADER,
      localeForPath(pathname, whiteLabelOptions, isMappedHost(config, host)),
    );
    const url = request.nextUrl.clone();
    url.pathname = INTERNAL_NOT_FOUND_PATH;
    url.search = '';
    return applyFramingHeaders(
      applyCsp(NextResponse.rewrite(url, { request: { headers } }), request),
      DENY_FRAMING,
    );
  }

  // Main host (or feature off): `/api` behaves as before the matcher included
  // it, except that the internal white-label headers are dropped so a caller
  // can never smuggle them to a route.
  if (isApi) {
    return NextResponse.next({
      request: { headers: stripWhiteLabelHeaders(request.headers) },
    });
  }

  const response = i18nMiddleware(request);

  if (response.status === 301 || response.status === 302) {
    return applyFramingHeaders(response, DENY_FRAMING);
  }

  return applyFramingHeaders(applyCsp(response, request), DENY_FRAMING);
}

export const config = {
  matcher: [
    // `/api` is included so a mapped host can be narrowed (allowlist in
    // lib/white-label); on the main host the middleware returns `next()` for it.
    // `_matrix` — inbound Matrix Application Service transaction pushes (#2483).
    // Rewritten in next.config to /api/matrix/appservice; must skip i18n + CSP here.
    '/((?!_matrix|placeholder|icon|brand|onesignal|.well-known|geo|_next/static|_next/image|favicon.ico).*)',
  ],
};
