import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { routing } from '../../packages/i18n/src/routing';

const IMAGE_HOSTS = process.env.NEXT_PUBLIC_IMAGE_HOSTS?.split(', ') ?? [];
const LOCALES = routing.locales;

const withNextIntl = createNextIntlPlugin('../../packages/i18n/src/request.ts');

const nextConfig: NextConfig = {
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

export default withNextIntl(nextConfig);
