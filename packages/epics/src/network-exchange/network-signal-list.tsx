'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { Locale } from '@hypha-platform/i18n';
import type { NetworkSharedSignal } from '@hypha-platform/core/client';
import { useHumanChatPanel } from '../common/human-chat-panel-context';

export function NetworkSignalList({
  lang,
  signals,
  empty,
}: {
  lang: Locale;
  signals: NetworkSharedSignal[];
  empty: string;
}) {
  const t = useTranslations('NetworkExchange');
  const { openCoherenceChat, openHumanChatPanel } = useHumanChatPanel();

  if (signals.length === 0) {
    return <p className="text-2 text-neutral-11">{empty}</p>;
  }

  return (
    <ul className="grid gap-3">
      {signals.map((signal) => (
        <li
          key={signal.slug}
          className="border border-border bg-background p-4"
        >
          <p className="text-1 uppercase tracking-[0.12em] text-neutral-11">
            {signal.spaceTitle}
          </p>
          <h2
            className="mt-1 text-3"
            style={{ fontFamily: 'var(--font-family-heading)' }}
          >
            {signal.title}
          </h2>
          <p className="mt-2 line-clamp-3 text-2 leading-relaxed text-neutral-11">
            {signal.description}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="border border-foreground bg-foreground px-3 py-2 text-1 uppercase tracking-[0.12em] text-background"
              onClick={() => {
                if (!signal.spaceChatRoomId) return;
                openCoherenceChat(
                  signal.spaceChatRoomId,
                  signal.spaceTitle,
                  signal.slug,
                  signal.description,
                  signal.spaceSlug,
                );
                openHumanChatPanel();
              }}
              disabled={!signal.spaceChatRoomId}
            >
              {signal.spaceChatRoomId ? t('openRoom') : t('noRoom')}
            </button>
            <Link
              href={`/${lang}/dho/${signal.spaceSlug}/coherence?signal=${signal.slug}`}
              className="border border-border px-3 py-2 text-1 uppercase tracking-[0.12em]"
            >
              {t('visit')}
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
