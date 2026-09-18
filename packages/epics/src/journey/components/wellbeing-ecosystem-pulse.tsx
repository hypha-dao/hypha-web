'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@hypha-platform/ui';
import { useMe } from '@hypha-platform/core/client';
import { useJourneyStore } from '../use-journey-store';
import { averageScore, momentsForScope } from '../wellbeing-model';
import { WellbeingGauge } from './wellbeing-gauge';
import { WellbeingInsightsCard } from './wellbeing-insights-card';
import '../wellbeing-accents.css';

export function WellbeingEcosystemPulse() {
  const t = useTranslations('Wellbeing');
  const { person } = useMe();
  const journey = useJourneyStore(person?.slug);
  const ecosystemMoments = useMemo(
    () =>
      momentsForScope(journey.state.moments, {
        scope: 'collective',
      }),
    [journey.state.moments],
  );
  const personalMoments = useMemo(
    () =>
      momentsForScope(journey.state.moments, {
        scope: 'personal',
        personSlug: person?.slug,
      }),
    [journey.state.moments, person?.slug],
  );
  const score = averageScore(ecosystemMoments);
  const comparisonScore = averageScore(personalMoments);
  const activated = ecosystemMoments.length > 0 || personalMoments.length > 0;

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <Card className="wb-scope craft-card overflow-hidden lg:col-span-6">
        <CardContent className="flex flex-col gap-4 p-5">
          <div>
            <p className="text-1 font-medium uppercase tracking-[0.08em] text-accent-11">
              {t('collectiveKicker')}
            </p>
            <h3 className="mt-1 [font-family:var(--font-family-heading)] text-4 font-semibold tracking-[-0.015em]">
              {t('insightsTitle.ecosystem')}
            </h3>
          </div>
          <WellbeingGauge
            score={score}
            comparisonScore={comparisonScore}
            activated={activated}
            innerLabel={t('collectiveScore')}
            outerLabel={t('fieldArcLabel')}
          />
          <p className="text-2 leading-relaxed text-muted-foreground">
            {t('fractalLead')}
          </p>
        </CardContent>
      </Card>
      <WellbeingInsightsCard
        className="lg:col-span-6"
        level="ecosystem"
        moments={ecosystemMoments}
        previousScore={averageScore(ecosystemMoments.slice(1))}
      />
    </div>
  );
}
