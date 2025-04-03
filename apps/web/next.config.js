//@ts-check

 
const { composePlugins, withNx } = require('@nx/next');
const { withVercelToolbar } = require('@vercel/toolbar/plugins/next');

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  nx: {
    // Set this to true if you would like to use SVGR
    // See: https://github.com/gregberge/svgr
    svgr: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'hypha.infura-ipfs.io',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 's3-alpha-sig.figma.com',
      },
      {
        protocol: 'https',
        hostname: 'github.com',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
      },
      {
        protocol: 'https',
        hostname: 'loremflickr.com',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'cdn.jsdelivr.net',
      },
      {
        protocol: 'https',
        hostname: 'a.storyblok.com',
      },
      {
        protocol: 'https',
        hostname: 'private-user-images.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'media.licdn.com',
      },
      {
        protocol: 'https',
        hostname: 'utfs.io',
      },
      {
        protocol: 'https',
        hostname: 'static.licdn.com',
      },
      {
        protocol: 'http',
        hostname: 'bovzk9ehhu.ufs.sh',
      },
      {
        protocol: 'https',
        hostname: 'utfs.io',
      }
    ],
  },
  webpack: (config) => {
    return {
      ...config,
      resolve: {
        ...config.resolve,
        alias: {
          ...config.resolve.alias,
          crypto: 'empty-module',
        },
      },
    };
  },
};

const plugins = [
  // Add more Next.js plugins to this list if needed.
  withNx,
  withVercelToolbar(),
];

module.exports = composePlugins(...plugins)(nextConfig);
