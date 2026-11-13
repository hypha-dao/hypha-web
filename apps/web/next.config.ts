import path from 'node:path';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import createWithVercelToolbar from '@vercel/toolbar/plugins/next';
import { routing } from '../../packages/i18n/src/routing';
import {
  WHITE_LABEL_HOST_CONFIG_ENV,
  parseWhiteLabelHostConfig,
} from './src/lib/white-label/config';

const IMAGE_HOSTS = process.env.NEXT_PUBLIC_IMAGE_HOSTS?.split(', ') ?? [];
const LOCALES = routing.locales;

/**
 * Hostnames mapped to a Space (white-label host delivery). A config redirect
 * runs before middleware, so the two root redirects below must skip these
 * hosts: their root is the Space, not the network page. Read at build time, like
 * every env change on Vercel (it applies to a new deployment).
 */
const MAPPED_HOSTNAMES = [
  ...new Set(
    parseWhiteLabelHostConfig(process.env[WHITE_LABEL_HOST_CONFIG_ENV]).flatMap(
      (client) => client.hosts.map((h) => h.host.replace(/:[0-9]+$/, '')),
    ),
  ),
];
const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, (char) => `\\${char}`);
const NOT_MAPPED_HOST = MAPPED_HOSTNAMES.length
  ? [
      {
        type: 'host' as const,
        value: `(${MAPPED_HOSTNAMES.map(escapeRegExp).join('|')})`,
      },
    ]
  : undefined;

/**
 * Path prefixes the middleware matcher (src/middleware.ts) skips.
 * Keep in step with that matcher.
 */
const MIDDLEWARE_SKIPPED_PREFIXES = [
  '_matrix',
  'placeholder',
  'icon',
  'brand',
  'onesignal',
  '.well-known',
  'geo',
  '_next/static',
  '_next/image',
  'favicon.ico',
].join('|');

const withNextIntl = createNextIntlPlugin('../../packages/i18n/src/request.ts');

const nextConfig: NextConfig = {
  // Load matrix-js-sdk from node_modules on the server so it is not duplicated
  // across server chunks (pairs with webpack resolve.alias below). See
  // .agents/references/domain/hypha-matrix-mapping.md — stay on SDK ^40.x.
  // Voice and video call (WebRTC): getUserMedia is not gated by CSP here; if a
  // strict Content-Security-Policy is added, allow TURN/STUN (connect-src) and
  // any recording/CDN origins. See docs/requirements/voice-video-call-phase-0-runbook.md
  // pdf-parse loads its bundled pdf.js by a computed path, which a server chunk
  // cannot resolve; it must stay a direct dependency of apps/web to be external.
  serverExternalPackages: ['matrix-js-sdk', 'pdf-parse'],
  // Unmatched URLs have no root layout once the app lives in the (main) route
  // group; render app/global-not-found.tsx for them instead.
  experimental: {
    globalNotFound: true,
  },
  webpack: (config) => {
    // Single module path for matrix-js-sdk (require.resolve from apps/web needs
    // matrix-js-sdk as a direct dependency). Avoids "Multiple matrix-js-sdk
    // entrypoints detected!" when the SDK initializes from more than one bundle.
    // v40+ does not export `./package.json` from package.json "exports"; derive the
    // install root from the resolved entry (typically …/matrix-js-sdk/lib/…).
    const matrixEntry = require.resolve('matrix-js-sdk');
    const matrixRoot = path.resolve(path.dirname(matrixEntry), '..');
    config.resolve.alias = {
      ...config.resolve.alias,
      // pnpm: deep ESM subpaths (e.g. webrtc/callFeed.js) are not resolvable
      // from the epics source tree without a concrete file path. Used by
      // HumanChatPanelCallStage for CallFeed + CallFeedEvent.
      'matrix-js-sdk/lib/webrtc/callFeed': path.join(
        matrixRoot,
        'lib/webrtc/callFeed.js',
      ),
      'matrix-js-sdk/lib/webrtc/groupCallEventHandler': path.join(
        matrixRoot,
        'lib/webrtc/groupCallEventHandler.js',
      ),
      'matrix-js-sdk/lib/logger': path.join(matrixRoot, 'lib/logger.js'),
      'matrix-js-sdk/lib/http-api/errors': path.join(
        matrixRoot,
        'lib/http-api/errors.js',
      ),
      'matrix-js-sdk': require.resolve('matrix-js-sdk'),
    };
    return config;
  },
  headers: async () => {
    return [
      // `X-Frame-Options` / `frame-ancestors` are set per response in
      // src/middleware.ts (white-label `/embed` must not carry `DENY`). Paths
      // the middleware matcher skips keep the static rule: with
      // `globalNotFound` an unknown URL under them renders a framable HTML 404.
      {
        source: `/:path((?:${MIDDLEWARE_SKIPPED_PREFIXES}).*)`,
        headers: [{ key: 'X-Frame-Options', value: 'DENY' }],
      },
      {
        source: '/onesignal/:path*',
        headers: [
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
    ];
  },
  images: {
    unoptimized: process.env.DISABLE_IMAGE_OPTIMIZATION === 'true',
    remotePatterns: [
      ...new Set([
        ...IMAGE_HOSTS,
        '*.ufs.sh',
        'ufs.sh',
        'utfs.io',
        '*.utfs.io',
        '*.uploadthing.com',
      ]),
    ]
      .filter(Boolean)
      .map((hostname) => ({
        protocol: 'https' as const,
        hostname,
      })),
  },
  redirects: async () => {
    return [
      {
        source: '/',
        destination: `/${routing.defaultLocale}/network`,
        permanent: true,
        missing: NOT_MAPPED_HOST,
      },
      {
        source: `/:lang(${LOCALES.join('|')})`,
        destination: '/:lang/network',
        permanent: true,
        missing: NOT_MAPPED_HOST,
      },
      // The bare space URL lands on the overview tab. Next forwards the query string
      // (`?signal=`, `?msg=`, `?invite=`). Done here rather than with `redirect()` in a
      // `dho/[id]/page.tsx`: a page redirect stays in the layout's `children` slot after a soft
      // navigation and Next replays it on later router updates (#2575).
      {
        source: `/:lang(${LOCALES.join('|')})/dho/:id`,
        destination: '/:lang/dho/:id/overview',
        permanent: false,
      },
    ];
  },
  rewrites: async () => {
    return [
      // Inbound Matrix Application Service API (#2483). Dendrite's AS `url:` is set to
      // `<origin>` (no suffix); it appends the spec path `/_matrix/app/v1/...`. Next.js
      // private-folder convention (`_matrix`) rules out a literal app-router folder, and
      // the i18n/CSP middleware would otherwise intercept it (excluded in middleware.ts),
      // so map it onto a normal API route. Legacy unprefixed variant (`/_matrix/app/...`)
      // is not served — Dendrite uses the v1 path. Main hosts only: the matcher
      // skips `_matrix`, so a mapped host would otherwise reach it unchecked.
      {
        source: '/_matrix/app/v1/:path*',
        destination: '/api/matrix/appservice/:path*',
        missing: NOT_MAPPED_HOST,
      },
    ];
  },
};

const withVercelToolbar = createWithVercelToolbar();

export default withVercelToolbar(withNextIntl(nextConfig));
