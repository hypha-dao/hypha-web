//@ts-check

const IMAGE_HOSTS = process.env.NEXT_PUBLIC_IMAGE_HOSTS?.split(', ') ?? [];

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
};

export default nextConfig;
