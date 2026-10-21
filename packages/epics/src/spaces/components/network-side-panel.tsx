'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { ArrowUpRight, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { RxCross1 } from 'react-icons/rx';
import { Button } from '@hypha-platform/ui';
import type { Locale } from '@hypha-platform/i18n';
import {
  collapseCategoriesToGroups,
  DEFAULT_SPACE_LEAD_IMAGE,
  getCategoryGroupLabel,
  parseCapitalKeys,
  type Space,
  type NetworkSpaceRank,
} from '@hypha-platform/core/client';
import { NetworkRanking } from '../../network-exchange';
import { useHumanChatPanel } from '../../common/human-chat-panel-context';

function stripTags(value: string) {
  let out = '';
  let index = 0;
  while (index < value.length) {
    const open = value.indexOf('<', index);
    if (open === -1) {
      out += value.slice(index);
      break;
    }
    out += value.slice(index, open);
    const close = value.indexOf('>', open + 1);
    if (close === -1) {
      out += value.slice(open);
      break;
    }
    out += ' ';
    index = close + 1;
  }
  return out;
}

function excerpt(value: string | null | undefined) {
  const text = stripTags(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= 220) return text;
  return `${text.slice(0, 219).trimEnd()}…`;
}

function leadImageSrc(value: string | null | undefined) {
  const trimmed = value?.trim() ?? '';
  if (trimmed.startsWith('/') || trimmed.startsWith('https://')) return trimmed;
  return DEFAULT_SPACE_LEAD_IMAGE;
}

function readablePlace(label: string) {
  const match = /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/.exec(label);
  if (!match) return label;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return label;
  const north = latitude >= 0 ? 'N' : 'S';
  const east = longitude >= 0 ? 'E' : 'W';
  return `${Math.abs(latitude).toFixed(2)}° ${north}, ${Math.abs(
    longitude,
  ).toFixed(2)}° ${east}`;
}

function CapitalList({
  keys,
  empty,
}: {
  keys: ReturnType<typeof parseCapitalKeys>;
  empty: string;
}) {
  const t = useTranslations('NetworkExchange');
  if (keys.length === 0) {
    return <p className="mt-2 text-2 text-neutral-11">{empty}</p>;
  }
  return (
    <ul className="mt-2 grid gap-1.5">
      {keys.map((key) => (
        <li key={key} className="flex items-center gap-2 text-1">
          <span className="size-1.5 shrink-0 bg-foreground" aria-hidden />
          {t(`capitals.${key}`)}
        </li>
      ))}
    </ul>
  );
}

export function NetworkSidePanel({
  lang,
  selectedSpace,
  circles = [],
  capitals,
  onClose,
  onSelectRank,
  ranks,
}: {
  lang: Locale;
  selectedSpace: Space | null;
  circles?: Space[];
  capitals?: { seeks: string[]; offers: string[] } | null;
  onClose: () => void;
  onSelectRank: (rank: NetworkSpaceRank) => void;
  ranks: NetworkSpaceRank[];
}) {
  const t = useTranslations('NetworkExchange');
  const tCommon = useTranslations('Common');
  const { openCoherenceChat, setFocusedSpaceChat } = useHumanChatPanel();
  const panelRef = useRef<HTMLDivElement>(null);
  const seeks = parseCapitalKeys(capitals?.seeks);
  const offers = parseCapitalKeys(capitals?.offers);
  const summary = excerpt(selectedSpace?.description);
  const place = readablePlace(selectedSpace?.locationLabel?.trim() ?? '');
  const groups = collapseCategoriesToGroups(selectedSpace?.categories ?? []);
  const eyebrow = groups.length
    ? `${t('projectSpace')} · ${groups
        .map((id) => getCategoryGroupLabel(id))
        .join(' · ')}`
    : t('projectSpace');
  const spaceHref = selectedSpace?.slug
    ? `/${lang}/dho/${selectedSpace.slug}/overview`
    : null;
  const focusedRoomId = selectedSpace?.chatRoomId?.trim() || null;
  const focusedSlug = selectedSpace?.slug?.trim() || '';
  const focusedTitle = selectedSpace?.title ?? '';
  const focusedDescription = selectedSpace?.description?.trim()
    ? selectedSpace.description.trim()
    : null;

  useEffect(() => {
    if (!focusedSlug) {
      setFocusedSpaceChat(null);
      return;
    }
    setFocusedSpaceChat({
      roomId: focusedRoomId,
      title: focusedTitle,
      slug: focusedSlug,
      description: focusedDescription,
    });
    panelRef.current?.scrollTo({ top: 0 });
  }, [
    focusedDescription,
    focusedRoomId,
    focusedSlug,
    focusedTitle,
    setFocusedSpaceChat,
  ]);

  useEffect(() => {
    return () => setFocusedSpaceChat(null);
  }, [setFocusedSpaceChat]);

  const openSpaceRoom = () => {
    if (!focusedSlug) return;
    // Empty coherence slug: open the space Matrix room as chat, not a signal
    // thread (Signal Team / turn-into-proposal chrome).
    openCoherenceChat(
      focusedRoomId,
      focusedTitle,
      '',
      focusedDescription,
      focusedSlug,
    );
  };

  return (
    <div
      ref={panelRef}
      aria-label={t('navNetwork')}
      className="narrow-scrollbar flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto border border-border bg-background"
    >
      {selectedSpace ? (
        <section>
          <div className="relative h-40 overflow-hidden bg-neutral-3">
            <img
              src={leadImageSrc(selectedSpace.leadImage)}
              alt=""
              className="h-full w-full object-cover"
            />
            <button
              type="button"
              onClick={onClose}
              aria-label={tCommon('close')}
              className="craft-icon-box absolute right-3 top-3 z-10 border-white/45 bg-background/70 text-foreground hover:border-white/70 hover:bg-background/90 hover:text-foreground"
            >
              <RxCross1 aria-hidden />
            </button>
          </div>
          <div className="px-4 pt-4">
            <p className="text-1 uppercase tracking-[0.12em] text-neutral-11">
              {eyebrow}
            </p>
            <h2
              className="mt-1 text-4 leading-tight tracking-[-0.02em] text-foreground"
              style={{ fontFamily: 'var(--font-family-heading)' }}
            >
              {selectedSpace.title}
            </h2>
            {place ? (
              <p className="mt-1 text-1 text-neutral-11">{place}</p>
            ) : null}
          </div>
          {summary ? (
            <p className="px-4 pt-3 text-2 leading-relaxed text-neutral-11">
              {summary}
            </p>
          ) : null}
          {circles.length > 0 ? (
            <div className="mt-4 border-t border-border px-4 py-4">
              <p className="flex items-center gap-2 text-1 uppercase tracking-[0.12em] text-neutral-11">
                <Users className="size-3.5" aria-hidden />
                {t('governanceCircles')}
              </p>
              <ul className="mt-2">
                {circles.map((circle) => (
                  <li
                    key={circle.id}
                    className="flex items-baseline justify-between gap-3 border-b border-border py-2 last:border-b-0"
                  >
                    <span className="min-w-0 truncate text-2">
                      {circle.title}
                    </span>
                    {circle.onChainDataMissing ? null : (
                      <span className="shrink-0 text-1 text-neutral-11">
                        {t('circleMembers', {
                          count: circle.memberCount ?? 0,
                        })}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="grid grid-cols-2 border-t border-border">
            <div className="px-4 py-4">
              <p className="text-1 uppercase tracking-[0.12em] text-neutral-11">
                {t('seeks')}
              </p>
              <CapitalList keys={seeks} empty={t('noneYet')} />
            </div>
            <div className="border-l border-border px-4 py-4">
              <p className="text-1 uppercase tracking-[0.12em] text-neutral-11">
                {t('offers')}
              </p>
              <CapitalList keys={offers} empty={t('noneYet')} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-4">
            <Button
              type="button"
              className="h-10 w-fit"
              onClick={openSpaceRoom}
            >
              {t('connect')}
            </Button>
            {spaceHref ? (
              <Button asChild className="h-10 w-fit">
                <Link href={spaceHref}>
                  {t('visit')}
                  <ArrowUpRight className="size-3.5" aria-hidden />
                </Link>
              </Button>
            ) : null}
            <Button
              type="button"
              disabled
              variant="outline"
              colorVariant="neutral"
              title={t('resourceLater')}
              aria-label={`${t('resource')}. ${t('resourceLater')}`}
              className="h-10 w-fit"
            >
              {t('resource')}
            </Button>
          </div>
        </section>
      ) : null}
      {ranks.length > 0 ? (
        <section className="border-t border-border p-4">
          <NetworkRanking lang={lang} ranks={ranks} onSelect={onSelectRank} />
        </section>
      ) : null}
    </div>
  );
}
