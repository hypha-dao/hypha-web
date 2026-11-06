import type { MetadataRoute } from 'next';

/**
 * Home Screen / install manifest. Without `display: "standalone"`, iOS "Add to
 * Home Screen" opens a Safari web-clip with browser chrome (X | host | menu)
 * that covers MenuTop; dismissing that chrome drops the user back to whatever
 * tab was underneath (often Messages).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Hypha',
    short_name: 'Hypha',
    description:
      "Hypha's complete DAO toolkit helps individuals, projects, and organizations achieve more together",
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#fbfaf8',
    theme_color: '#fbfaf8',
    icons: [
      {
        src: '/icon/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}
