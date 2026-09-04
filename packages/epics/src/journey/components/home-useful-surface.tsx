'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import { DEFAULT_SPACE_AVATAR_IMAGE } from '@hypha-platform/core/client';
import { Locale } from '@hypha-platform/i18n';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Card,
  CardContent,
} from '@hypha-platform/ui';
import { ArrowRight, Compass, Sparkles } from 'lucide-react';
import {
  getOnboardingPath,
  getProposalPath,
  getSignalChatPath,
} from '../../common/get-path-function';
import { useHumanChatPanel } from '../../common/human-chat-panel-context';
import { cn } from '@hypha-platform/ui-utils';
import { attentionSeeAllHref, type HomeAttentionItem } from '../home-activity';
import { UsefulHarvestArt } from './journey-mark';

function itemKey(item: HomeAttentionItem) {
  return `${item.kind}:${item.id}`;
}

function itemHref(lang: Locale, item: HomeAttentionItem) {
  if (item.kind === 'vote') {
    return getProposalPath(lang, item.spaceSlug, item.proposalSlug);
  }
  if (item.signalSlug) {
    return getSignalChatPath(lang, item.spaceSlug, item.signalSlug);
  }
  return `/${lang}/dho/${item.spaceSlug}`;
}

function openClosesAt(item: HomeAttentionItem, nowMs: number): number | null {
  if (item.kind !== 'vote' || item.closesAt == null) return null;
  return item.closesAt > nowMs ? item.closesAt : null;
}

export function HomeUsefulSurface({
  lang,
  items,
  isLoading,
  fallbackSpaces,
  firstName,
  onCapture,
  className,
}: {
  lang: Locale;
  items: HomeAttentionItem[];
  isLoading?: boolean;
  fallbackSpaces: Array<{ slug?: string | null }>;
  firstName?: string;
  onCapture?: () => void;
  className?: string;
}) {
  const t = useTranslations('Journey');
  const format = useFormatter();
  const { openHumanChatPanel } = useHumanChatPanel();
  const [skipped, setSkipped] = useState<string[]>([]);
  const [pinnedKey, setPinnedKey] = useState<string | null>(null);
  const now = new Date();
  const nowMs = now.getTime();

  const visible = useMemo(
    () => items.filter((item) => !skipped.includes(itemKey(item))),
    [items, skipped],
  );
  const featured = useMemo(() => {
    if (pinnedKey) {
      const pinned = visible.find((item) => itemKey(item) === pinnedKey);
      if (pinned) return pinned;
    }
    return visible[0] ?? null;
  }, [pinnedKey, visible]);
  const queue = useMemo(
    () =>
      featured
        ? visible.filter((item) => itemKey(item) !== itemKey(featured))
        : visible,
    [featured, visible],
  );
  const seeAllHref = attentionSeeAllHref(lang, items, fallbackSpaces);
  const remaining = Math.max(visible.length - 1, 0);
  const featuredClosesAt = featured ? openClosesAt(featured, nowMs) : null;
  const featuredRelative = featuredClosesAt
    ? format.relativeTime(new Date(featuredClosesAt), now)
    : null;

  const openItem = (item: HomeAttentionItem) => {
    if (item.kind === 'signal') openHumanChatPanel();
  };

  const skipFeatured = () => {
    if (!featured) return;
    const key = itemKey(featured);
    setSkipped((current) =>
      current.includes(key) ? current : [...current, key],
    );
    setPinnedKey(null);
  };

  const urgency = (() => {
    if (!featured) return null;
    if (featuredRelative) {
      return remaining > 0
        ? t('usefulUrgencyClosing', {
            time: featuredRelative,
            count: remaining,
          })
        : t('usefulUrgencyClosingLast', { time: featuredRelative });
    }
    return remaining > 0
      ? t('usefulUrgencyOpen', { count: remaining })
      : t('usefulUrgencyOpenLast');
  })();

  const body = (() => {
    if (!featured) return null;
    const name = firstName?.trim();
    const title = featured.title;
    const space = featured.spaceTitle;
    if (featured.kind === 'vote') {
      if (featuredRelative) {
        const closes = t('usefulCloses', { time: featuredRelative });
        return name
          ? t('usefulBodyVoteClosingNamed', { name, title, space, closes })
          : t('usefulBodyVoteClosing', { title, space, closes });
      }
      return name
        ? t('usefulBodyVoteNamed', { name, title, space })
        : t('usefulBodyVote', { title, space });
    }
    return name
      ? t('usefulBodySignalNamed', { name, title, space })
      : t('usefulBodySignal', { title, space });
  })();

  return (
    <Card className={cn('craft-card flex min-h-0 flex-1 flex-col', className)}>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <UsefulHarvestArt className="mb-3 h-14 w-[8.5rem]" />
            <h2 className="[font-family:var(--font-family-heading)] text-5 font-semibold tracking-[-0.015em]">
              {t('usefulTitle')}
            </h2>
          </div>
          {urgency ? (
            <p className="max-w-[22ch] text-right text-1 font-medium uppercase tracking-[0.08em] text-muted-foreground">
              {urgency}
            </p>
          ) : null}
        </div>

        {isLoading ? (
          <p className="text-2 text-muted-foreground">{t('usefulLoading')}</p>
        ) : featured ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <span
                className="mt-2 size-2.5 shrink-0 rounded-full bg-success-9"
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-3 font-medium leading-snug">
                  {featured.title}
                </p>
                <p className="mt-1 text-1 text-muted-foreground">
                  <span>{featured.spaceTitle}</span>
                  <span aria-hidden> · </span>
                  <span>
                    {featured.kind === 'vote'
                      ? t('usefulKindVote')
                      : t('usefulKindSignal')}
                  </span>
                  {featuredRelative ? (
                    <>
                      <span aria-hidden> · </span>
                      <span className="text-warning-11">
                        {t('usefulCloses', { time: featuredRelative })}
                      </span>
                    </>
                  ) : null}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button asChild className="rounded-xl">
                <Link
                  href={itemHref(lang, featured)}
                  onClick={() => openItem(featured)}
                >
                  {t('usefulWeighIn')}
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                colorVariant="neutral"
                className="rounded-xl"
                onClick={skipFeatured}
              >
                {t('usefulNotNow')}
              </Button>
            </div>

            {body ? (
              <p className="max-w-[46ch] text-2 leading-relaxed text-muted-foreground">
                {body}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="[font-family:var(--font-family-heading)] text-4 font-semibold tracking-[-0.015em]">
              {t('usefulEmptyTitle')}
            </p>
            <p className="max-w-[46ch] text-2 leading-relaxed text-muted-foreground">
              {t('usefulEmptyLead')}
            </p>
            <div className="flex flex-wrap gap-2">
              {onCapture ? (
                <Button
                  type="button"
                  className="rounded-xl"
                  onClick={onCapture}
                >
                  <Sparkles className="size-4" aria-hidden />
                  {t('usefulEmptyCapture')}
                </Button>
              ) : null}
              <Button asChild variant="outline" colorVariant="neutral">
                <Link href={getOnboardingPath(lang)}>
                  {t('usefulEmptyCreate')}
                </Link>
              </Button>
              <Button asChild variant="outline" colorVariant="neutral">
                <Link href={`/${lang}/network`}>
                  <Compass className="size-4" aria-hidden />
                  {t('usefulEmptyExplore')}
                </Link>
              </Button>
            </div>
          </div>
        )}

        {queue.length > 0 ? (
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <p className="text-1 font-medium uppercase tracking-[0.08em] text-muted-foreground">
              {t('usefulQueueTitle')}
            </p>
            <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
              {queue.map((item) => {
                const closesAt = openClosesAt(item, nowMs);
                const relative = closesAt
                  ? format.relativeTime(new Date(closesAt), now)
                  : null;
                return (
                  <li key={itemKey(item)}>
                    <button
                      type="button"
                      onClick={() => setPinnedKey(itemKey(item))}
                      className="craft-row-interactive flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left"
                    >
                      <Avatar className="size-9 shrink-0 rounded-chrome">
                        <AvatarImage
                          src={item.spaceLogoUrl ?? DEFAULT_SPACE_AVATAR_IMAGE}
                          alt=""
                        />
                        <AvatarFallback className="rounded-chrome text-1">
                          {item.spaceTitle.slice(0, 1).toUpperCase() || 'S'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-2 font-medium">
                          {item.title}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-1 text-muted-foreground">
                          <span>{item.spaceTitle}</span>
                          <span aria-hidden>·</span>
                          <span>
                            {item.kind === 'vote'
                              ? t('usefulKindVote')
                              : t('usefulKindSignal')}
                          </span>
                          {relative ? (
                            <>
                              <span aria-hidden>·</span>
                              <span className="text-warning-11">
                                {t('usefulCloses', { time: relative })}
                              </span>
                            </>
                          ) : null}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <div className="mt-auto flex justify-end">
          <Button asChild variant="ghost" colorVariant="neutral">
            <Link href={seeAllHref}>
              {t('attentionSeeAll')}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
