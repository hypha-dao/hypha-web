'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Locale } from '@hypha-platform/i18n';
import {
  useMe,
  useOrganisationSpacesBySingleSlug,
  useSpaceBySlug,
} from '@hypha-platform/core/client';
import { useSpaceEnergy } from '../../treasury/hooks/use-space-energy';
import { useJourneyStore } from '../use-journey-store';
import { averageScore, momentsForScope } from '../wellbeing-model';
import { WellbeingScoreCard } from './wellbeing-score-card';
import { WellbeingInsightsCard } from './wellbeing-insights-card';
import { CaptureMomentDialog } from './capture-moment-dialog';
import { EcosystemWorldMap } from './ecosystem-world-map';
import { SpaceAddonsStrip } from './space-addons-strip';
import { SpaceNextSteps, buildSpaceNextSteps } from './space-next-steps';
import { getDhoPathEcosystem } from '../../common/get-path-function';

export function SpaceJourneyHome({
  lang,
  spaceSlug,
  memberCount,
  agreementCount,
}: {
  lang: Locale;
  spaceSlug: string;
  memberCount: number | null;
  agreementCount: number | null;
}) {
  const t = useTranslations('Journey');
  const { person } = useMe();
  const { space } = useSpaceBySlug(spaceSlug);
  const { data: spaceEnergy } = useSpaceEnergy();
  const journey = useJourneyStore(person?.slug);
  const addons = journey.spaceAddon(spaceSlug);
  const [captureOpen, setCaptureOpen] = useState(false);
  const { spaces: organisationSpaces = [] } =
    useOrganisationSpacesBySingleSlug(spaceSlug);

  const collectiveMoments = useMemo(
    () =>
      momentsForScope(journey.state.moments, {
        scope: 'collective',
        spaceSlug,
      }),
    [journey.state.moments, spaceSlug],
  );
  const ecosystemMoments = useMemo(
    () =>
      momentsForScope(journey.state.moments, {
        scope: 'collective',
      }),
    [journey.state.moments],
  );
  const score = averageScore(collectiveMoments);
  const previousScore = averageScore(collectiveMoments.slice(1));
  const ecosystemScore = averageScore(ecosystemMoments);
  const steps = useMemo(
    () =>
      buildSpaceNextSteps({
        lang,
        spaceSlug,
        memberCount,
        agreementCount,
        wellbeingActivated: addons.wellbeing,
      }),
    [addons.wellbeing, agreementCount, lang, memberCount, spaceSlug],
  );

  const mapSpaces =
    organisationSpaces.length > 0 ? organisationSpaces : space ? [space] : [];

  return (
    <div className="flex flex-col gap-8 py-2">
      <header className="flex flex-col gap-2">
        <p className="text-1 font-medium uppercase tracking-[0.08em] text-accent-11">
          {t('spaceKicker')}
        </p>
        <h2 className="[font-family:var(--font-family-heading)] text-6 font-semibold tracking-[-0.02em]">
          {t('spaceHeading', { title: space?.title ?? '' })}
        </h2>
        <p className="max-w-[46ch] text-2 leading-relaxed text-muted-foreground">
          {t('spaceLead')}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <SpaceNextSteps steps={steps} />
        </div>
        <div className="lg:col-span-6">
          <WellbeingScoreCard
            variant="collective"
            score={score}
            previousScore={previousScore}
            comparisonScore={ecosystemScore ?? 61}
            activated={addons.wellbeing}
            onCapture={() => setCaptureOpen(true)}
            onActivate={() =>
              journey.activateSpaceAddon(spaceSlug, 'wellbeing')
            }
          />
        </div>
      </div>

      <WellbeingInsightsCard
        level="space"
        moments={collectiveMoments}
        previousScore={previousScore}
      />

      <EcosystemWorldMap
        lang={lang}
        spaces={mapSpaces}
        href={getDhoPathEcosystem(lang, spaceSlug)}
      />

      <WellbeingInsightsCard
        level="ecosystem"
        moments={ecosystemMoments}
        previousScore={averageScore(ecosystemMoments.slice(1))}
      />

      <SpaceAddonsStrip
        lang={lang}
        spaceSlug={spaceSlug}
        energyEnabled={Boolean(spaceEnergy?.enabled)}
        addons={addons}
        onActivateWellbeing={() =>
          journey.activateSpaceAddon(spaceSlug, 'wellbeing')
        }
      />

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
