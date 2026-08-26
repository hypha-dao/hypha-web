'use client';

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
import { ArrowRight, Bell, Vote } from 'lucide-react';
import {
  getProposalPath,
  getSignalChatPath,
} from '../../common/get-path-function';
import { useHumanChatPanel } from '../../common/human-chat-panel-context';
import { attentionSeeAllHref, type HomeAttentionItem } from '../home-activity';

export function HomeAttentionList({
  lang,
  items,
  isLoading,
  fallbackSpaces,
}: {
  lang: Locale;
  items: HomeAttentionItem[];
  isLoading?: boolean;
  fallbackSpaces: Array<{ slug?: string | null }>;
}) {
  const t = useTranslations('Journey');
  const format = useFormatter();
  const { openHumanChatPanel } = useHumanChatPanel();
  const seeAllHref = attentionSeeAllHref(lang, items, fallbackSpaces);
  const now = new Date();

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="[font-family:var(--font-family-heading)] text-4 font-semibold tracking-[-0.015em]">
            {t('activityTitle')}
          </h2>
          <p className="mt-1 text-2 text-muted-foreground">
            {t('activityLead')}
          </p>
        </div>
        <Button asChild variant="ghost" colorVariant="neutral">
          <Link href={seeAllHref}>
            {t('attentionSeeAll')}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Button>
      </div>
      <Card className="craft-card">
        <CardContent className="flex flex-col gap-1 p-3">
          {isLoading ? (
            <p className="px-2 py-3 text-2 text-muted-foreground">
              {t('activityLoading')}
            </p>
          ) : items.length > 0 ? (
            <ul className="flex flex-col gap-0.5">
              {items.map((item) => {
                const href =
                  item.kind === 'vote'
                    ? getProposalPath(lang, item.spaceSlug, item.proposalSlug)
                    : item.signalSlug
                    ? getSignalChatPath(lang, item.spaceSlug, item.signalSlug)
                    : `/${lang}/dho/${item.spaceSlug}`;
                return (
                  <li key={`${item.kind}:${item.id}`}>
                    <div className="flex items-center gap-2 rounded-xl px-2 py-2">
                      <Link
                        href={href}
                        onClick={() => {
                          if (item.kind === 'signal') openHumanChatPanel();
                        }}
                        className="craft-row-interactive flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-1"
                      >
                        <Avatar className="size-10 rounded-chrome">
                          <AvatarImage
                            src={
                              item.spaceLogoUrl ?? DEFAULT_SPACE_AVATAR_IMAGE
                            }
                            alt=""
                          />
                          <AvatarFallback className="rounded-chrome text-1">
                            {item.spaceTitle.slice(0, 1).toUpperCase() || 'S'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-x-1.5 text-1 text-muted-foreground">
                            {item.kind === 'vote' ? (
                              <Vote
                                className="size-3 text-accent-11"
                                aria-hidden
                              />
                            ) : (
                              <Bell
                                className="size-3 text-accent-11"
                                aria-hidden
                              />
                            )}
                            <span className="text-accent-11">
                              {item.kind === 'vote'
                                ? t('attentionVoteKind')
                                : t('attentionSignalKind')}
                            </span>
                            <span aria-hidden>·</span>
                            <span className="truncate">{item.spaceTitle}</span>
                            {item.happenedAt > 0 ? (
                              <>
                                <span aria-hidden>·</span>
                                <time
                                  dateTime={new Date(
                                    item.happenedAt,
                                  ).toISOString()}
                                >
                                  {format.relativeTime(
                                    new Date(item.happenedAt),
                                    now,
                                  )}
                                </time>
                              </>
                            ) : null}
                          </span>
                          <span className="block truncate text-2 font-medium">
                            {item.title}
                          </span>
                        </span>
                      </Link>
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        colorVariant="neutral"
                        className="shrink-0 rounded-xl"
                      >
                        <Link
                          href={href}
                          onClick={() => {
                            if (item.kind === 'signal') openHumanChatPanel();
                          }}
                        >
                          {item.kind === 'vote'
                            ? t('attentionVote')
                            : t('attentionOpen')}
                        </Link>
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-2 py-3 text-2 text-muted-foreground">
              {t('activityEmpty')}
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
