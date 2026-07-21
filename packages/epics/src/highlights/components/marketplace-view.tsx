'use client';

import { useTranslations } from 'next-intl';
import { Skeleton } from '@hypha-platform/ui';
import { useMarketplaceListings } from '../hooks/use-marketplace-listings';
import { MarketplaceCard } from './marketplace-card';

export function MarketplaceView() {
  const t = useTranslations('HighlightsTab');
  const { items, isLoading, error } = useMarketplaceListings(true);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[4/5] w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="py-8 text-2 text-neutral-11">
        {t('marketplace.loadError')}
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <p className="py-8 text-2 text-neutral-11">{t('marketplace.empty')}</p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <MarketplaceCard key={item.spaceSlug} item={item} />
      ))}
    </div>
  );
}
