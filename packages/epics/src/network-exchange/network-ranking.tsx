'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Locale } from '@hypha-platform/i18n';
import type { NetworkSpaceRank } from '@hypha-platform/core/client';
import { useOpenSpacePublicChat } from '../common/use-open-space-public-chat';

type Metric = 'need' | 'action' | 'impact';

export function NetworkRanking({
  lang,
  ranks,
  onSelect,
}: {
  lang: Locale;
  ranks: NetworkSpaceRank[];
  onSelect?: (space: NetworkSpaceRank) => void;
}) {
  const t = useTranslations('NetworkExchange');
  const { openPublicChat } = useOpenSpacePublicChat();
  const [metric, setMetric] = useState<Metric>('impact');
  const ranked = useMemo(
    () =>
      [...ranks].sort((a, b) => b[metric] - a[metric] || b.impact - a.impact),
    [metric, ranks],
  );
  const maximum = Math.max(1, ...ranked.map((space) => space[metric]));

  if (ranks.length === 0) {
    return (
      <section className="border border-border p-4">
        <h2
          className="text-3"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {t('ranking')}
        </h2>
        <p className="mt-2 text-2 text-neutral-11">{t('emptyRank')}</p>
      </section>
    );
  }

  const openRoom = (space: NetworkSpaceRank) => {
    void openPublicChat({
      slug: space.spaceSlug,
      title: space.spaceTitle,
    }).then((opened) => {
      if (!opened) {
        window.location.assign(`/${lang}/dho/${space.spaceSlug}/overview`);
      }
    });
  };

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          className="text-3"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {t('ranking')}
        </h2>
        <div className="grid grid-cols-3 border border-border">
          {(['need', 'action', 'impact'] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMetric(item)}
              className={
                metric === item
                  ? 'bg-foreground px-3 py-2 text-1 uppercase tracking-[0.12em] text-background'
                  : 'px-3 py-2 text-1 uppercase tracking-[0.12em] text-neutral-11'
              }
            >
              {t(
                item === 'need'
                  ? 'byNeeds'
                  : item === 'action'
                  ? 'byAction'
                  : 'byImpact',
              )}
            </button>
          ))}
        </div>
      </div>
      <ol className="mt-4 divide-y divide-border border-b border-border">
        {ranked.slice(0, 12).map((space, index) => (
          <li key={space.spaceId}>
            <button
              type="button"
              onClick={() => (onSelect ? onSelect(space) : openRoom(space))}
              className="grid w-full grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 py-3 text-left"
            >
              <span className="text-3 text-neutral-11">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-2">
                  {space.spaceTitle}
                </span>
                <span className="block truncate text-1 text-neutral-11">
                  {space.place || t('visit')}
                </span>
                <span className="mt-2 block h-1.5 bg-neutral-4">
                  <span
                    className="block h-full bg-foreground"
                    style={{
                      width: `${Math.max(4, (space[metric] / maximum) * 100)}%`,
                    }}
                  />
                </span>
              </span>
              <span className="text-right text-1 text-neutral-11">
                {t('signals', { count: space[metric] })}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
