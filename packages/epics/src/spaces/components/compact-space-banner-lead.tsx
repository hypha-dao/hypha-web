'use client';

import * as React from 'react';
import Image from 'next/image';
import { cn } from '@hypha-platform/ui-utils';

type Props = {
  src: string;
};

/**
 * Hero lead image with stable branded placeholder + fade-in.
 * Avoids the grey flash from CSS background-image decoding on first paint.
 */
export function CompactSpaceBannerLead({ src }: Props) {
  const [ready, setReady] = React.useState(false);

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit]">
      {/* Same atmosphere as no-lead fallback — visible until decode */}
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_140%_100%_at_12%_-5%,rgb(41,115,78)_0%,rgb(14,54,38)_42%,rgb(7,38,26)_68%,rgb(2,14,10)_100%)]"
        aria-hidden
      />
      <Image
        src={src}
        alt=""
        fill
        priority
        sizes="(max-width: 1280px) 100vw, min(1280px, 100vw)"
        className={cn(
          'object-cover object-center transition-opacity duration-500 ease-out',
          ready ? 'opacity-100' : 'opacity-0',
        )}
        onLoadingComplete={() => setReady(true)}
      />
    </div>
  );
}
