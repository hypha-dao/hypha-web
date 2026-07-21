'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@hypha-platform/ui';
import type { MarketplaceListingItem } from '@hypha-platform/core/client';

type MarketplaceCardProps = {
  item: MarketplaceListingItem;
};

export function MarketplaceCard({ item }: MarketplaceCardProps) {
  const t = useTranslations('HighlightsTab');
  const lang = useLocale();
  const cover = item.coverImageUrl || item.leadImage || item.logoUrl;

  return (
    <Link
      href={`/${lang}/dho/${item.spaceSlug}/highlights`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-background-2 transition hover:border-accent-7"
    >
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover} alt="" className="aspect-[16/9] w-full object-cover" />
      ) : (
        <div className="aspect-[16/9] w-full bg-neutral-3" />
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-3 font-medium text-foreground group-hover:text-accent-11">
            {item.spaceTitle}
          </h3>
          {item.goalAmount && item.goalCurrency ? (
            <Badge colorVariant="accent">
              {t('marketplace.seeking', {
                amount: item.goalAmount,
                currency: item.goalCurrency,
              })}
            </Badge>
          ) : null}
        </div>
        {item.locationLabel ? (
          <p className="text-1 text-neutral-10">{item.locationLabel}</p>
        ) : null}
        {item.summary ? (
          <p className="line-clamp-3 text-2 text-neutral-11">{item.summary}</p>
        ) : null}
        <span className="mt-auto pt-2 text-1 font-medium text-accent-11">
          {t('marketplace.viewHighlights')}
        </span>
      </div>
    </Link>
  );
}
