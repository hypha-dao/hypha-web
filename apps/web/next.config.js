//@ts-check

const { composePlugins, withNx } = require('@nx/next');
const { withVercelToolbar } = require('@vercel/toolbar/plugins/next');
const { IMAGE_HOSTS } = require('./src/config/image-hosts');

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
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
    ];
  },
  nx: {
    // Set this to true if you would like to use SVGR
    // See: https://github.com/gregberge/svgr
    svgr: true,
  },
  images: {
    remotePatterns: IMAGE_HOSTS.map((hostname) => ({
      protocol: 'https',
      hostname,
    })),
  },
};

const plugins = [
  // Add more Next.js plugins to this list if needed.
  withNx,
  withVercelToolbar(),
];

module.exports = composePlugins(...plugins)(nextConfig);
