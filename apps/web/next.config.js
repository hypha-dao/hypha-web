//@ts-check

const IMAGE_HOSTS = process.env.NEXT_PUBLIC_IMAGE_HOSTS?.split(', ') ?? [];
const ROOT_URL = process.env.NEXT_PUBLIC_ROOT_URL ?? 'https://hypha.earth';

/** @type {import('next').NextConfig} */
const nextConfig = {
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
    remotePatterns: IMAGE_HOSTS.map((hostname) => ({
      protocol: 'https',
      hostname,
    })),
  },
  redirects: async () => {
    if (process.env.NODE_ENV === 'development') {
      return [];
    } else {
      return [
        {
          source: '/',
          destination: ROOT_URL,
          permanent: true,
        },
        {
          source: '/:lang(en|de)',
          destination: ROOT_URL,
          permanent: true,
        },
      ];
    }
  },
};

export default nextConfig;
