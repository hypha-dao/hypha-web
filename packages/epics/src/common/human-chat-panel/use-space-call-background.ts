'use client';

import React from 'react';
import { renderSpaceCallBackground } from './space-call-background';

/**
 * Draws the call's space background (#2563) while `enabled` (the "space" effect is chosen in a
 * call) and returns it as a `blob:` URL, or null. Redrawn when the space or its images change;
 * old URLs are revoked. Nothing is fetched or drawn while disabled.
 */
export function useSpaceCallBackground({
  enabled,
  spaceSlug,
  leadImage,
  logoUrl,
}: {
  enabled: boolean;
  spaceSlug: string | null;
  leadImage: string | null;
  logoUrl: string | null;
}): string | null {
  const [url, setUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!enabled || !spaceSlug) {
      setUrl(null);
      return;
    }
    // Until this space is drawn, the effect runs as strong blur (not the previous space).
    setUrl(null);
    let cancelled = false;
    let created: string | null = null;
    void renderSpaceCallBackground({ leadImage, logoUrl })
      .then((blob) => {
        if (cancelled) return;
        created = URL.createObjectURL(blob);
        setUrl(created);
      })
      .catch((err) => {
        if (process.env.NODE_ENV === 'development') {
          console.debug('[hypha.group_call] space background failed', err);
        }
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
      if (created) {
        const toRevoke = created;
        // The processor decodes the image on switch; revoke after it had the chance.
        setTimeout(() => URL.revokeObjectURL(toRevoke), 10_000);
      }
    };
  }, [enabled, spaceSlug, leadImage, logoUrl]);

  return url;
}
