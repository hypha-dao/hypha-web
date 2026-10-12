'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { Locale } from '@hypha-platform/i18n';
import {
  parseCapitalKeys,
  type NetworkExchangeSpace,
} from '@hypha-platform/core/client';
import { useHumanChatPanel } from '../common/human-chat-panel-context';

function overlap(left: NetworkExchangeSpace, right: NetworkExchangeSpace) {
  const seeks = new Set(left.seeks);
  const offers = new Set(left.offers);
  const met = right.offers.filter((key) => seeks.has(key)).length;
  const returned = right.seeks.filter((key) => offers.has(key)).length;
  return met + returned;
}

export function NetworkExchangeView({
  lang,
  spaces,
}: {
  lang: Locale;
  spaces: NetworkExchangeSpace[];
}) {
  const t = useTranslations('NetworkExchange');
  const { openCoherenceChat, openHumanChatPanel } = useHumanChatPanel();
  const [picked, setPicked] = useState(spaces[0]?.slug ?? '');
  const current = spaces.find((space) => space.slug === picked) ?? spaces[0];
  const match = useMemo(() => {
    if (!current) return null;
    return (
      spaces
        .filter((space) => space.slug !== current.slug)
        .map((space) => ({ space, score: overlap(current, space) }))
        .sort((a, b) => b.score - a.score)[0] ?? null
    );
  }, [current, spaces]);

  const openRoom = (space: NetworkExchangeSpace) => {
    if (!space.chatRoomId) return;
    openCoherenceChat(
      space.chatRoomId,
      space.title,
      space.slug,
      space.description,
      space.slug,
    );
    openHumanChatPanel();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
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
      <aside className="border border-border p-4">
        <p className="text-1 uppercase tracking-[0.12em] text-neutral-11">
          {t('bestMatch')}
        </p>
        {current && match && match.score > 0 ? (
          <div className="mt-3">
            <p
              className="text-3"
              style={{ fontFamily: 'var(--font-family-heading)' }}
            >
              {match.space.title}
            </p>
            <p className="mt-2 text-2 text-neutral-11">
              {match.space.description}
            </p>
            <p className="mt-3 text-1 text-neutral-11">
              {t('signals', { count: match.score })}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!match.space.chatRoomId}
                onClick={() => openRoom(match.space)}
                className="border border-foreground bg-foreground px-3 py-2 text-1 uppercase tracking-[0.12em] text-background disabled:opacity-40"
              >
                {match.space.chatRoomId ? t('openRoom') : t('noRoom')}
              </button>
              <Link
                href={`/${lang}/dho/${match.space.slug}/overview`}
                className="border border-border px-3 py-2 text-1 uppercase tracking-[0.12em]"
              >
                {t('visit')}
              </Link>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-2 text-neutral-11">{t('noMatch')}</p>
        )}
      </aside>
    </div>
  );
}
