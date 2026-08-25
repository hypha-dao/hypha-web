'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  Address,
  Space,
  isSpaceArchived,
  useMe,
  usePendingRewards,
} from '@hypha-platform/core/client';
import { Locale } from '@hypha-platform/i18n';
import { Button, Card, CardContent, Container } from '@hypha-platform/ui';
import { ArrowRight, Compass, Sparkles, Wallet } from 'lucide-react';
import { useAuthentication } from '@hypha-platform/authentication';
import { useMemberWeb3SpaceIds } from '../../spaces/hooks/use-member-web3-space-ids';
import { filterSpaces } from '../../spaces/components/my-filtered-spaces';
import { useFilterSpacesListWithDiscoverability } from '../../spaces/hooks/use-spaces-discoverability-batch';
import { SpaceCardContainer } from '../../spaces/components/space-card.container';
import { CreateSpaceButton } from '../../spaces/components/create-space-button';
import { getOnboardingPath } from '../../common/get-path-function';
import { useJourneyStore } from '../use-journey-store';
import {
  averageScore,
  momentsForScope,
  recentMoments,
} from '../wellbeing-model';
import { WellbeingScoreCard } from './wellbeing-score-card';
import { CaptureMomentDialog } from './capture-moment-dialog';
import { EcosystemWorldMap } from './ecosystem-world-map';

function greetingKey(
  date = new Date(),
):
  | 'greetingMorning'
  | 'greetingAfternoon'
  | 'greetingEvening'
  | 'greetingNight' {
  const hour = date.getHours();
  if (hour < 5) return 'greetingNight';
  if (hour < 12) return 'greetingMorning';
  if (hour < 17) return 'greetingAfternoon';
  if (hour < 21) return 'greetingEvening';
  return 'greetingNight';
}

function firstName(
  person?: { name?: string; nickname?: string } | null,
): string {
  const name = person?.name?.trim();
  if (name) return name.split(' ')[0] ?? name;
  return person?.nickname?.trim() ?? '';
}

export function HomeDashboard({
  lang,
  spaces,
}: {
  lang: Locale;
  spaces: Space[];
}) {
  const t = useTranslations('Journey');
  const { isAuthenticated } = useAuthentication();
  const { person, isLoading: isLoadingPerson } = useMe();
  const { web3SpaceIds, isLoading: isLoadingMemberSpaceIds } =
    useMemberWeb3SpaceIds({
      personAddress: person?.address as Address | undefined,
    });
  const { pendingRewards } = usePendingRewards({
    user: person?.address as Address | undefined,
  });
  const hasRewards =
    typeof pendingRewards === 'bigint'
      ? pendingRewards > 0n
      : Boolean(pendingRewards);
  const journey = useJourneyStore(person?.slug);
  const [captureOpen, setCaptureOpen] = useState(false);

  const memberSpaces = useMemo(
    () => filterSpaces(spaces, person?.slug, web3SpaceIds),
    [person?.slug, spaces, web3SpaceIds],
  );
  const { filteredSpaces, isLoading: isDiscoverabilityLoading } =
    useFilterSpacesListWithDiscoverability({
      spaces: memberSpaces,
      useGeneralState: false,
    });
  const mySpaces = useMemo(
    () => filteredSpaces.filter((space) => !isSpaceArchived(space)),
    [filteredSpaces],
  );
  const isLoadingSpaces =
    isLoadingPerson ||
    (Boolean(person?.address) && isLoadingMemberSpaceIds) ||
    isDiscoverabilityLoading;

  const personalMoments = useMemo(
    () =>
      momentsForScope(journey.state.moments, {
        scope: 'personal',
        personSlug: person?.slug,
      }),
    [journey.state.moments, person?.slug],
  );
  const score = averageScore(personalMoments);
  const previousScore = averageScore(personalMoments.slice(1));
  const name = firstName(person);
  const greeting = t(greetingKey());
  const recent = recentMoments(journey.state.moments, 4);

  return (
    <Container className="flex min-w-0 flex-col gap-10 py-8 md:py-10">
      <header className="flex flex-col gap-3">
        <p className="text-1 font-medium uppercase tracking-[0.08em] text-accent-11">
          {t('homeKicker')}
        </p>
        <h1 className="craft-page-title max-w-[18ch] text-balance [font-family:var(--font-family-heading)] text-7 font-semibold tracking-[-0.02em] md:text-8">
          {name
            ? t('homeTitleNamed', { greeting, name })
            : t('homeTitle', { greeting })}
        </h1>
        <p className="max-w-[42ch] text-3 leading-relaxed text-muted-foreground">
          {t('homeLead')}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <WellbeingScoreCard
            variant="personal"
            score={score}
            previousScore={previousScore}
            comparisonScore={57}
            activated={journey.state.personalActivated}
            onCapture={() => setCaptureOpen(true)}
            onActivate={journey.activatePersonal}
          />
        </div>
        <div className="flex flex-col gap-4 lg:col-span-5">
          <Card className="craft-card flex-1">
            <CardContent className="flex h-full flex-col justify-between gap-4 p-5">
              <div>
                <h2 className="[font-family:var(--font-family-heading)] text-4 font-semibold tracking-[-0.015em]">
                  {t('createTitle')}
                </h2>
                <p className="mt-2 text-2 leading-relaxed text-muted-foreground">
                  {t('createLead')}
                </p>
              </div>
              <CreateSpaceButton
                lang={lang}
                isAuthenticated={isAuthenticated}
              />
            </CardContent>
          </Card>
          <Card className="craft-card">
            <CardContent className="flex items-center justify-between gap-3 p-5">
              <div>
                <h2 className="text-2 font-semibold">{t('profileTitle')}</h2>
                <p className="mt-1 text-1 text-muted-foreground">
                  {t('profileLead')}
                </p>
              </div>
              <Button asChild variant="outline" colorVariant="neutral">
                <Link
                  href={
                    person?.slug
                      ? `/${lang}/profile/${person.slug}`
                      : `/${lang}/profile`
                  }
                >
                  {t('profileCta')}
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="[font-family:var(--font-family-heading)] text-5 font-semibold tracking-[-0.015em]">
              {t('spacesTitle')}
            </h2>
            <p className="mt-1 text-2 text-muted-foreground">
              {t('spacesLead')}
            </p>
          </div>
          <Button asChild variant="ghost" colorVariant="neutral">
            <Link href={`/${lang}/my-spaces`}>{t('viewAllSpaces')}</Link>
          </Button>
        </div>
        {isLoadingSpaces ? (
          <p className="text-2 text-muted-foreground">{t('loading')}</p>
        ) : mySpaces.length > 0 ? (
          <SpaceCardContainer
            lang={lang}
            spaces={mySpaces.slice(0, 6)}
            gridClassName="sm:grid-cols-2 xl:grid-cols-3"
          />
        ) : (
          <Card className="craft-card">
            <CardContent className="flex flex-col items-start gap-3 p-5">
              <p className="text-2 text-muted-foreground">{t('spacesEmpty')}</p>
              <p className="text-1 text-muted-foreground">
                {t('spacesEmptyHint')}
              </p>
              <div className="flex flex-wrap gap-2">
                <CreateSpaceButton
                  lang={lang}
                  isAuthenticated={isAuthenticated}
                />
                <Button asChild variant="outline" colorVariant="neutral">
                  <Link href={`/${lang}/network`}>{t('networkCta')}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="craft-card">
          <CardContent className="flex h-full flex-col justify-between gap-4 p-5">
            <div>
              <p className="inline-flex items-center gap-2 text-1 font-medium uppercase tracking-[0.08em] text-muted-foreground">
                <Wallet className="size-3.5" aria-hidden />
                {t('walletTitle')}
              </p>
              <p className="mt-2 text-2 leading-relaxed text-muted-foreground">
                {t('walletLead')}
              </p>
              {hasRewards ? (
                <p className="mt-3 text-2 text-foreground">
                  {t('walletRewards')}
                </p>
              ) : (
                <p className="mt-3 text-2 text-muted-foreground">
                  {t('walletEmpty')}
                </p>
              )}
            </div>
            <Button asChild className="self-start rounded-xl">
              <Link href={`/${lang}/my-wallet`}>{t('walletCta')}</Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="craft-card">
          <CardContent className="flex h-full flex-col gap-3 p-5">
            <p className="text-1 font-medium uppercase tracking-[0.08em] text-muted-foreground">
              {t('activityTitle')}
            </p>
            <p className="text-2 text-muted-foreground">{t('activityLead')}</p>
            {recent.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {recent.map((moment) => (
                  <li
                    key={moment.id}
                    className="flex items-start justify-between gap-3 text-2"
                  >
                    <span className="min-w-0 truncate text-foreground">
                      {moment.title}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {moment.score}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-2 text-muted-foreground">
                {t('activityEmpty')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="[font-family:var(--font-family-heading)] text-5 font-semibold tracking-[-0.015em]">
              {t('networkTitle')}
            </h2>
            <p className="mt-1 max-w-xl text-2 text-muted-foreground">
              {t('networkLead')}
            </p>
          </div>
          <Button asChild variant="outline" colorVariant="neutral">
            <Link href={`/${lang}/network`}>
              <Compass className="size-4" aria-hidden />
              {t('networkCta')}
            </Link>
          </Button>
        </div>
        <EcosystemWorldMap
          lang={lang}
          spaces={spaces}
          href={`/${lang}/network`}
        />
      </section>

      <Card className="craft-card">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 size-4 text-accent-11" aria-hidden />
            <div>
              <p className="text-2 font-semibold">{t('nextMoveCreate')}</p>
              <p className="text-1 text-muted-foreground">
                {t('nextMoveCreateHint')}
              </p>
            </div>
          </div>
          <Button asChild variant="ghost" colorVariant="neutral">
            <Link href={getOnboardingPath(lang)}>
              {t('createCta')}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </CardContent>
      </Card>

      {person?.slug ? (
        <CaptureMomentDialog
          open={captureOpen}
          onOpenChange={setCaptureOpen}
          scope="personal"
          personSlug={person.slug}
          onSave={journey.addMoment}
        />
      ) : null}
    </Container>
  );
}
