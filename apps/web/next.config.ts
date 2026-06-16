import path from 'node:path';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import createWithVercelToolbar from '@vercel/toolbar/plugins/next';
import { routing } from '../../packages/i18n/src/routing';

const IMAGE_HOSTS = process.env.NEXT_PUBLIC_IMAGE_HOSTS?.split(', ') ?? [];
const LOCALES = routing.locales;

const withNextIntl = createNextIntlPlugin('../../packages/i18n/src/request.ts');

const nextConfig: NextConfig = {
  // Load matrix-js-sdk from node_modules on the server so it is not duplicated
  // across server chunks (pairs with webpack resolve.alias below). See
  // .agents/references/domain/hypha-matrix-mapping.md — stay on SDK ^40.x.
  // Voice and video call (WebRTC): getUserMedia is not gated by CSP here; if a
  // strict Content-Security-Policy is added, allow TURN/STUN (connect-src) and
  // any recording/CDN origins. See docs/requirements/voice-video-call-phase-0-runbook.md
  serverExternalPackages: ['matrix-js-sdk'],
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
      {
        source: '/:path((?!api).*)*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
        ],
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
    remotePatterns: IMAGE_HOSTS.map((hostname) => ({
      protocol: 'https',
      hostname,
    })),
  },
  redirects: async () => {
    return [
      {
        source: '/',
        destination: `/${routing.defaultLocale}/network`,
        permanent: true,
      },
      {
        source: `/:lang(${LOCALES.join('|')})`,
        destination: '/:lang/network',
        permanent: true,
      },
    ];
  },
};

const withVercelToolbar = createWithVercelToolbar();

export default withVercelToolbar(withNextIntl(nextConfig));
