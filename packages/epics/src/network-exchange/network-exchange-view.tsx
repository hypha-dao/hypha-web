'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Locale } from '@hypha-platform/i18n';
import {
  parseCapitalKeys,
  type NetworkExchangeSpace,
} from '@hypha-platform/core/client';
import { NetworkRightColumn } from './network-right-cards';

export function NetworkExchangeView({
  lang,
  spaces,
}: {
  lang: Locale;
  spaces: NetworkExchangeSpace[];
}) {
  const t = useTranslations('NetworkExchange');
  const [picked, setPicked] = useState(spaces[0]?.slug ?? '');
  const current = spaces.find((space) => space.slug === picked) ?? spaces[0];

  const railSpaces = spaces.map((space) => ({
    slug: space.slug,
    title: space.title,
    description: space.description,
    place: space.place,
    leadImage: space.leadImage,
    chatRoomId: space.chatRoomId,
    seeks: space.seeks,
    offers: space.offers,
  }));

  return (
    <div className="network-side-grid grid min-w-0 items-start gap-6">
      <div>
        <h1
          className="text-5"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {t('exchangeTitle')}
        </h1>
        <p className="mt-2 max-w-[52ch] text-2 leading-relaxed text-neutral-11">
          {t('exchangeBody')}
        </p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {spaces.map((space) => {
            const selected = space.slug === current?.slug;
            return (
              <li key={space.slug}>
                <button
                  type="button"
                  onClick={() => setPicked(space.slug)}
                  className={
                    selected
                      ? 'h-full w-full border border-foreground p-4 text-left'
                      : 'h-full w-full border border-border p-4 text-left'
                  }
                >
                  <p className="text-2">{space.title}</p>
                  <p className="mt-1 line-clamp-2 text-1 text-neutral-11">
                    {space.description}
                  </p>
                  <p className="mt-3 text-1 text-neutral-11">
                    {t('seeks')}:{' '}
                    {parseCapitalKeys(space.seeks).length
                      ? parseCapitalKeys(space.seeks)
                          .map((key) => t(`capitals.${key}`))
                          .join(', ')
                      : t('noneYet')}
                  </p>
                  <p className="text-1 text-neutral-11">
                    {t('offers')}:{' '}
                    {parseCapitalKeys(space.offers).length
                      ? parseCapitalKeys(space.offers)
                          .map((key) => t(`capitals.${key}`))
                          .join(', ')
                      : t('noneYet')}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {current ? (
        <NetworkRightColumn
          lang={lang}
          variant="exchange"
          spaces={railSpaces}
          selectedSlug={current.slug}
        />
      ) : null}
    </div>
  );
}
