'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  DEFAULT_SPACE_AVATAR_IMAGE,
  DEFAULT_SPACE_LEAD_IMAGE,
} from '@hypha-platform/core/client';
import { Locale } from '@hypha-platform/i18n';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Card,
  CardContent,
} from '@hypha-platform/ui';
import { Compass, Radio, Vote } from 'lucide-react';
import {
  NETWORK_PULSE_HOME_STORY_LIMIT,
  storyHref,
  type NetworkSpaceVisual,
  type NetworkStory,
} from '../network-pulse';
import { JourneyMark } from './journey-mark';
import '../journey-surface.css';

function spaceVisualFor(
  story: NetworkStory,
  visuals?: Record<string, NetworkSpaceVisual>,
): NetworkSpaceVisual {
  const fromMap = visuals?.[story.spaceSlug];
  return {
    logoUrl: fromMap?.logoUrl ?? story.spaceLogoUrl,
    leadImage: fromMap?.leadImage,
  };
}

export function NetworkPulseFeed({
  lang,
  stories,
  isLoading,
  compact = false,
  spaceVisuals,
}: {
  lang: Locale;
  stories: NetworkStory[];
  isLoading?: boolean;
  compact?: boolean;
  spaceVisuals?: Record<string, NetworkSpaceVisual>;
}) {
  const t = useTranslations('Journey');
  const visible = compact
    ? stories.slice(0, NETWORK_PULSE_HOME_STORY_LIMIT)
    : stories;
  const featured = !compact && visible[0] ? visible[0] : null;
  const rest = featured ? visible.slice(1) : visible;

  return (
    <div className="flex flex-col gap-4">
      {compact ? null : (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <JourneyMark kind="pulse" />
            <div>
              <h2 className="[font-family:var(--font-family-heading)] text-4 font-semibold tracking-[-0.015em]">
                {t('pulseTitle')}
              </h2>
              <p className="mt-1 max-w-xl text-2 text-muted-foreground">
                {t('pulseLead')}
              </p>
            </div>
          </div>
        </div>
      )}

      {featured ? (
        <FeaturedStory
          lang={lang}
          story={featured}
          visual={spaceVisualFor(featured, spaceVisuals)}
        />
      ) : null}

      {compact || rest.length > 0 || isLoading || !featured ? (
        <Card className="craft-card">
          <CardContent className="flex flex-col gap-3 p-4 sm:p-5">
            {compact ? (
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="[font-family:var(--font-family-heading)] text-4 font-semibold tracking-[-0.015em]">
                    {t('pulseTitle')}
                  </h3>
                  <p className="mt-1 max-w-xl text-2 text-muted-foreground">
                    {t('pulseLead')}
                  </p>
                </div>
                <Button asChild variant="ghost" colorVariant="neutral">
                  <Link href={`/${lang}/network`}>
                    <Compass className="size-4" aria-hidden />
                    {t('networkCta')}
                  </Link>
                </Button>
              </div>
            ) : null}
            {isLoading ? (
              <p className="text-2 text-muted-foreground">
                {t('pulseLoading')}
              </p>
            ) : rest.length > 0 ? (
              <ul className="flex flex-col gap-0.5">
                {rest.map((story) => {
                  const visual = spaceVisualFor(story, spaceVisuals);
                  return (
                    <li key={story.id}>
                      <Link
                        href={storyHref(lang, story)}
                        className="craft-row-interactive flex items-center gap-3 rounded-xl px-2 py-2"
                      >
                        <Avatar className="size-10 rounded-chrome">
                          <AvatarImage
                            src={visual.logoUrl ?? DEFAULT_SPACE_AVATAR_IMAGE}
                            alt=""
                          />
                          <AvatarFallback className="rounded-chrome text-1">
                            {story.spaceTitle.slice(0, 1).toUpperCase() || 'S'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 text-1 text-accent-11">
                            {story.kind === 'vote' ? (
                              <Vote className="size-3" aria-hidden />
                            ) : (
                              <Radio className="size-3" aria-hidden />
                            )}
                            {story.kind === 'vote'
                              ? t('pulseVoteStory', { space: story.spaceTitle })
                              : t('pulseSignalStory', {
                                  space: story.spaceTitle,
                                })}
                          </span>
                          <span className="block truncate text-2 font-medium">
                            {story.title}
                          </span>
                          {story.context ? (
                            <span className="line-clamp-1 text-1 text-muted-foreground">
                              {story.context}
                            </span>
                          ) : null}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : !featured ? (
              <p className="text-2 text-muted-foreground">{t('pulseEmpty')}</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function FeaturedStory({
  lang,
  story,
  visual,
}: {
  lang: Locale;
  story: NetworkStory;
  visual: NetworkSpaceVisual;
}) {
  const t = useTranslations('Journey');

  return (
    <Link
      href={storyHref(lang, story)}
      className="craft-card-interactive overflow-hidden"
    >
      <div className="relative h-40 overflow-hidden sm:h-48">
        <img
          src={visual.leadImage || DEFAULT_SPACE_LEAD_IMAGE}
          alt=""
          className="size-full object-cover"
        />
      </div>
      <div className="flex items-start gap-3 px-4 pb-4 pt-3 sm:px-5">
        <Avatar className="-mt-8 size-14 shrink-0 rounded-chrome border border-background-2">
          <AvatarImage
            src={visual.logoUrl ?? DEFAULT_SPACE_AVATAR_IMAGE}
            alt=""
          />
          <AvatarFallback className="rounded-chrome text-2">
            {story.spaceTitle.slice(0, 1).toUpperCase() || 'S'}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 pt-6">
          <p className="flex items-center gap-1.5 text-1 font-medium text-accent-11">
            {story.kind === 'vote' ? (
              <Vote className="size-3" aria-hidden />
            ) : (
              <Radio className="size-3" aria-hidden />
            )}
            {story.kind === 'vote'
              ? t('pulseVoteStory', { space: story.spaceTitle })
              : t('pulseSignalStory', { space: story.spaceTitle })}
          </p>
          <p className="mt-1 [font-family:var(--font-family-heading)] text-5 font-semibold tracking-[-0.015em]">
            {story.title}
          </p>
          {story.context ? (
            <p className="mt-1 line-clamp-2 text-2 text-muted-foreground">
              {story.context}
            </p>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
