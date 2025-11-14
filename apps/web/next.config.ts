import type { NextConfig } from 'next';
import { i18nConfig } from '../../packages/i18n/src/i18n-config';

const IMAGE_HOSTS = process.env.NEXT_PUBLIC_IMAGE_HOSTS?.split(', ') ?? [];
const LOCALES = i18nConfig.locales;
const isDevelop = process.env.NODE_ENV === 'development';

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
        destination: `/${i18nConfig.defaultLocale}/network`,
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

export default nextConfig;
