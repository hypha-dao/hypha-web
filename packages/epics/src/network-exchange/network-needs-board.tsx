'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  parseCapitalKeys,
  type CapitalKey,
  type NetworkOpenNeed,
} from '@hypha-platform/core/client';
import { useHumanChatPanel } from '../common/human-chat-panel-context';

function capitalKey(value: string | null): CapitalKey | null {
  if (!value) return null;
  return parseCapitalKeys([value])[0] ?? null;
}

function CapitalMark({ capital }: { capital: CapitalKey }) {
  if (capital === 'material') {
    return (
      <span className="inline-block size-2 border border-current" aria-hidden />
    );
  }
  if (capital === 'financial') {
    return (
      <span
        className="inline-block size-2 rotate-45 border border-current"
        aria-hidden
      />
    );
  }
  return (
    <span
      className="inline-block size-1.5 rounded-full border border-current"
      aria-hidden
    />
  );
}

function NeedPhoto({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <div className="aspect-[16/10] w-full bg-neutral-3" />;
  }
  return (
    <img
      src={src}
      alt={alt}
      className="aspect-[16/10] w-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

export function NetworkNeedsBoard({
  needs,
  empty,
}: {
  needs: NetworkOpenNeed[];
  empty: string;
}) {
  const t = useTranslations('NetworkExchange');
  const { openCoherenceChat, openHumanChatPanel } = useHumanChatPanel();
  const spaceCount = useMemo(
    () => new Set(needs.map((need) => need.spaceSlug)).size,
    [needs],
  );

  const openRoom = (need: NetworkOpenNeed) => {
    if (!need.spaceChatRoomId) return;
    openCoherenceChat(
      need.spaceChatRoomId,
      need.spaceTitle,
      need.slug,
      need.description,
      need.spaceSlug,
    );
    openHumanChatPanel();
  };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-1 uppercase tracking-[0.16em] text-neutral-11">
          {t('readFromSignals')}
        </p>
        <h1
          className="mt-2 text-8"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {t('needsTitle')}
        </h1>
        {needs.length > 0 ? (
          <p className="mt-2 max-w-[62ch] text-2 leading-relaxed text-neutral-11">
            {t('needsSummary', { needs: needs.length, spaces: spaceCount })}
          </p>
        ) : null}
      </header>
      {needs.length === 0 ? (
        <p className="text-2 text-neutral-11">{empty}</p>
      ) : (
        <ul className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
          {needs.map((need) => {
            const capital = capitalKey(need.capital);
            const when = t('ongoing');
            return (
              <li key={need.slug} className="flex">
                <article className="flex w-full flex-col border border-border bg-background">
                  <div className="flex flex-1 flex-col gap-3 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="bg-foreground px-2 py-0.5 text-1 uppercase tracking-[0.12em] text-background">
                        {t('filterNeed')}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-1 text-neutral-11">
                        {capital ? <CapitalMark capital={capital} /> : null}
                        {capital
                          ? t('capitalStatus', {
                              capital: t(`capitals.${capital}`),
                              status: when,
                            })
                          : when}
                      </span>
                    </div>
                    <NeedPhoto src={need.leadImage} alt={need.title} />
                    <h2
                      className="line-clamp-2 text-3 leading-snug"
                      style={{ fontFamily: 'var(--font-family-heading)' }}
                    >
                      {need.title}
                    </h2>
                    <p className="text-1 uppercase tracking-[0.14em] text-neutral-11">
                      {need.spaceTitle}
                    </p>
                    <p className="text-1 text-neutral-11">
                      {t('proofsLine', {
                        action: need.actionCount,
                        impact: need.impactCount,
                      })}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 border-t border-border">
                    <button
                      type="button"
                      disabled
                      title={t('resourceLater')}
                      aria-label={`${t('resource')}. ${t('resourceLater')}`}
                      className="bg-foreground px-3 py-3 text-1 uppercase tracking-[0.12em] text-background disabled:opacity-100"
                    >
                      {t('resource')}
                    </button>
                    <button
                      type="button"
                      disabled={!need.spaceChatRoomId}
                      title={need.spaceChatRoomId ? undefined : t('noRoom')}
                      onClick={() => openRoom(need)}
                      className="border-l border-border bg-background px-3 py-3 text-1 uppercase tracking-[0.12em] disabled:opacity-40"
                    >
                      {t('connect')}
                    </button>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
