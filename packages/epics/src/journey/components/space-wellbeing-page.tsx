'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Locale } from '@hypha-platform/i18n';
import { useMe } from '@hypha-platform/core/client';
import { useJourneyStore } from '../use-journey-store';
import {
  averageScore,
  momentsForScope,
  recentMoments,
} from '../wellbeing-model';
import { WellbeingScoreCard } from './wellbeing-score-card';
import { WellbeingInsightsCard } from './wellbeing-insights-card';
import { CaptureMomentDialog } from './capture-moment-dialog';
import { momentMode } from '../wellbeing-model';

export function SpaceWellbeingPage({
  spaceSlug,
}: {
  lang: Locale;
  spaceSlug: string;
}) {
  const t = useTranslations('Wellbeing');
  const tJourney = useTranslations('Journey');
  const { person } = useMe();
  const journey = useJourneyStore(person?.slug);
  const addons = journey.spaceAddon(spaceSlug);
  const [captureOpen, setCaptureOpen] = useState(false);

  const moments = useMemo(
    () =>
      momentsForScope(journey.state.moments, {
        scope: 'collective',
        spaceSlug,
      }),
    [journey.state.moments, spaceSlug],
  );
  const score = averageScore(moments);
  const previousScore = averageScore(moments.slice(1));
  const comparisonScore = averageScore(
    momentsForScope(journey.state.moments, {
      scope: 'personal',
      personSlug: person?.slug,
    }),
  );

  return (
    <div className="flex flex-col gap-6 py-4">
      <header>
        <p className="text-1 font-medium uppercase tracking-[0.08em] text-accent-11">
          {t('collectiveKicker')}
        </p>
        <h2 className="mt-1 [font-family:var(--font-family-heading)] text-6 font-semibold tracking-[-0.02em]">
          {tJourney('addon.wellbeing')}
        </h2>
        <p className="mt-2 max-w-[46ch] text-2 text-muted-foreground">
          {t('collectiveLead')}
        </p>
      </header>
      <WellbeingScoreCard
        variant="collective"
        score={score}
        previousScore={previousScore}
        comparisonScore={comparisonScore ?? 61}
        activated={addons.wellbeing}
        onCapture={() => setCaptureOpen(true)}
        onActivate={() => journey.activateSpaceAddon(spaceSlug, 'wellbeing')}
      />
      {addons.wellbeing ? (
        <WellbeingInsightsCard
          level="space"
          moments={moments}
          previousScore={previousScore}
        />
      ) : null}
      {addons.wellbeing && moments.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {recentMoments(moments, 12).map((moment) => (
            <li
              key={moment.id}
              className="flex items-center justify-between rounded-xl border border-border/70 bg-background-2 px-3 py-3 text-2"
            >
              <span className="min-w-0 truncate">
                <span className="mr-2 text-1 uppercase tracking-[0.08em] text-muted-foreground">
                  {t(`mode.${momentMode(moment)}`)}
                </span>
                {moment.title}
              </span>
              <span className="shrink-0 text-muted-foreground">
                {moment.score}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {person?.slug ? (
        <CaptureMomentDialog
          open={captureOpen}
          onOpenChange={setCaptureOpen}
          scope="collective"
          personSlug={person.slug}
          spaceSlug={spaceSlug}
          onSave={journey.addMoment}
        />
      ) : null}
    </div>
  );
}
