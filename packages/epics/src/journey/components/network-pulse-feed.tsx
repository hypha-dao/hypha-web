'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Locale } from '@hypha-platform/i18n';
import { Button, Card, CardContent } from '@hypha-platform/ui';
import { Compass } from 'lucide-react';
import {
  NETWORK_PULSE_HOME_STORY_LIMIT,
  storyHref,
  type NetworkStory,
} from '../network-pulse';

export function NetworkPulseFeed({
  lang,
  stories,
  isLoading,
  compact = false,
}: {
  lang: Locale;
  stories: NetworkStory[];
  isLoading?: boolean;
  compact?: boolean;
}) {
  const t = useTranslations('Journey');
  const visible = compact
    ? stories.slice(0, NETWORK_PULSE_HOME_STORY_LIMIT)
    : stories;

  return (
    <Card className="craft-card">
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="[font-family:var(--font-family-heading)] text-4 font-semibold tracking-[-0.015em]">
              {t('pulseTitle')}
            </h2>
            <p className="mt-1 max-w-xl text-2 text-muted-foreground">
              {t('pulseLead')}
            </p>
          </div>
          {compact ? (
            <Button asChild variant="ghost" colorVariant="neutral">
              <Link href={`/${lang}/network`}>
                <Compass className="size-4" aria-hidden />
                {t('networkCta')}
              </Link>
            </Button>
          ) : null}
        </div>
        {isLoading ? (
          <p className="text-2 text-muted-foreground">{t('pulseLoading')}</p>
        ) : visible.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {visible.map((story) => (
              <li key={story.id}>
                <Link
                  href={storyHref(lang, story)}
                  className="flex flex-col rounded-xl px-2 py-2 transition-colors hover:bg-background-3/50"
                >
                  <span className="text-1 text-accent-11">
                    {story.kind === 'vote'
                      ? t('pulseVoteStory', { space: story.spaceTitle })
                      : t('pulseSignalStory', { space: story.spaceTitle })}
                  </span>
                  <span className="text-2 font-medium">{story.title}</span>
                  {story.context ? (
                    <span className="text-1 text-muted-foreground">
                      {story.context}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-2 text-muted-foreground">{t('pulseEmpty')}</p>
        )}
      </CardContent>
    </Card>
  );
}
