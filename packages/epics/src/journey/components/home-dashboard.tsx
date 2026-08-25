'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import {
  Address,
  DEFAULT_SPACE_AVATAR_IMAGE,
  Space,
  isSpaceArchived,
  useMe,
  usePendingRewards,
} from '@hypha-platform/core/client';
import { Locale } from '@hypha-platform/i18n';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Card,
  CardContent,
  Container,
} from '@hypha-platform/ui';
import { ArrowRight, Bell, Compass, Vote, Wallet } from 'lucide-react';
import { useAuthentication } from '@hypha-platform/authentication';
import { useMemberWeb3SpaceIds } from '../../spaces/hooks/use-member-web3-space-ids';
import { filterSpaces } from '../../spaces/components/my-filtered-spaces';
import { useFilterSpacesListWithDiscoverability } from '../../spaces/hooks/use-spaces-discoverability-batch';
import { CreateSpaceButton } from '../../spaces/components/create-space-button';
import {
  getDhoPathDefaultLanding,
  getOnboardingPath,
  getProposalPath,
} from '../../common/get-path-function';
import { useUserAssets } from '../../treasury/hooks';
import { useJourneyStore } from '../use-journey-store';
import { averageScore, momentsForScope } from '../wellbeing-model';
import { useHomeActivity } from '../use-home-activity';
import { useNetworkSharedSpaces } from '../use-network-shared-spaces';
import { useNetworkPulse } from '../use-network-pulse';
import { WellbeingScoreCard } from './wellbeing-score-card';
import { CaptureMomentDialog } from './capture-moment-dialog';
import { EcosystemWorldMap } from './ecosystem-world-map';
import { NetworkPulseFeed } from './network-pulse-feed';

const SPACE_PREVIEW_LIMIT = 5;
const WALLET_PREVIEW_LIMIT = 3;
const MIN_REWARD_CLAIM_VALUE = 0.01;

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

function spaceInitial(title: string): string {
  return title.trim().slice(0, 1).toUpperCase() || 'S';
}

export function HomeDashboard({
  lang,
  spaces,
}: {
  lang: Locale;
  spaces: Space[];
}) {
  const t = useTranslations('Journey');
  const format = useFormatter();
  const { isAuthenticated } = useAuthentication();
  const { person, isLoading: isLoadingPerson } = useMe();
  const { web3SpaceIds, isLoading: isLoadingMemberSpaceIds } =
    useMemberWeb3SpaceIds({
      personAddress: person?.address as Address | undefined,
    });
  const {
    assets,
    balance,
    isLoading: isLoadingWallet,
  } = useUserAssets({
    personSlug: person?.slug,
  });
  const { pendingRewards } = usePendingRewards({
    user: person?.address as Address | undefined,
  });
  const parsedRewardValue =
    pendingRewards !== undefined ? Number(pendingRewards) / 1e18 : 0;
  const hasRewards = parsedRewardValue >= MIN_REWARD_CLAIM_VALUE;
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

  const activitySpaces = useMemo(
    () =>
      mySpaces
        .filter((space): space is Space & { slug: string } =>
          Boolean(space.slug),
        )
        .map((space) => ({
          slug: space.slug,
          title: space.title,
        })),
    [mySpaces],
  );
  const {
    votes,
    signals,
    isLoading: isLoadingActivity,
  } = useHomeActivity(activitySpaces);
  const { sharedSpaces, isLoading: isLoadingShared } =
    useNetworkSharedSpaces(spaces);
  const pulseSpaces = useMemo(
    () =>
      sharedSpaces.map((space) => ({
        slug: space.slug as string,
        title: space.title,
      })),
    [sharedSpaces],
  );
  const { stories, isLoading: isLoadingPulse } = useNetworkPulse(pulseSpaces);

  const previewSpaces = mySpaces.slice(0, SPACE_PREVIEW_LIMIT);
  const hiddenSpaceCount = Math.max(mySpaces.length - previewSpaces.length, 0);
  const previewAssets = useMemo(
    () =>
      [...assets]
        .filter((asset) => asset.value > 0)
        .sort((a, b) => b.usdEqual - a.usdEqual)
        .slice(0, WALLET_PREVIEW_LIMIT),
    [assets],
  );

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

  return (
    <Container className="flex min-w-0 flex-col gap-8 py-8 md:py-10">
      <header className="flex flex-col gap-3">
        <p className="text-1 font-medium uppercase tracking-[0.08em] text-accent-11">
          {t('homeKicker')}
        </p>
        <h1 className="craft-page-title max-w-[18ch] text-balance [font-family:var(--font-family-heading)] text-7 font-semibold tracking-[-0.02em] md:text-8">
          {name
            ? t('homeTitleNamed', { greeting, name })
            : t('homeTitle', { greeting })}
        </h1>
        <p className="max-w-[46ch] text-3 leading-relaxed text-muted-foreground">
          {t('homeLead')}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="craft-card lg:col-span-7">
          <CardContent className="flex h-full flex-col gap-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="[font-family:var(--font-family-heading)] text-4 font-semibold tracking-[-0.015em]">
                  {t('spacesTitle')}
                </h2>
                <p className="mt-1 text-2 text-muted-foreground">
                  {isLoadingSpaces
                    ? t('loading')
                    : t('spacesCount', { count: mySpaces.length })}
                </p>
              </div>
              <Button asChild variant="ghost" colorVariant="neutral">
                <Link href={`/${lang}/my-spaces`}>{t('viewAllSpaces')}</Link>
              </Button>
            </div>
            {isLoadingSpaces ? null : mySpaces.length > 0 ? (
              <ul className="flex flex-col gap-1">
                {previewSpaces.map((space) => (
                  <li key={space.id}>
                    <Link
                      href={getDhoPathDefaultLanding(
                        lang,
                        space.slug as string,
                      )}
                      className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-background-3/50"
                    >
                      <Avatar className="size-9 rounded-chrome">
                        <AvatarImage
                          src={space.logoUrl ?? DEFAULT_SPACE_AVATAR_IMAGE}
                          alt=""
                        />
                        <AvatarFallback className="rounded-chrome text-1">
                          {spaceInitial(space.title)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 truncate text-2 font-medium">
                        {space.title}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-start gap-3">
                <p className="text-2 text-muted-foreground">
                  {t('spacesEmpty')}
                </p>
                <p className="text-1 text-muted-foreground">
                  {t('spacesEmptyHint')}
                </p>
                <CreateSpaceButton
                  lang={lang}
                  isAuthenticated={isAuthenticated}
                />
              </div>
            )}
            {hiddenSpaceCount > 0 ? (
              <Link
                href={`/${lang}/my-spaces`}
                className="text-1 text-muted-foreground hover:text-foreground"
              >
                {t('moreSpaces', { count: hiddenSpaceCount })}
              </Link>
            ) : null}
          </CardContent>
        </Card>

        <Card className="craft-card lg:col-span-5">
          <CardContent className="flex h-full flex-col justify-between gap-4 p-5">
            <div>
              <p className="inline-flex items-center gap-2 text-1 font-medium uppercase tracking-[0.08em] text-muted-foreground">
                <Wallet className="size-3.5" aria-hidden />
                {t('walletTitle')}
              </p>
              {isLoadingWallet ? (
                <p className="mt-3 text-2 text-muted-foreground">
                  {t('loading')}
                </p>
              ) : (
                <>
                  <p className="mt-3 [font-family:var(--font-family-heading)] text-6 font-semibold tracking-[-0.02em]">
                    {t('walletBalance', {
                      amount: format.number(balance, {
                        style: 'currency',
                        currency: 'USD',
                        maximumFractionDigits: 0,
                      }),
                    })}
                  </p>
                  <p className="mt-1 text-2 text-muted-foreground">
                    {t('walletLead')}
                  </p>
                  {previewAssets.length > 0 ? (
                    <ul className="mt-4 flex flex-col gap-2">
                      {previewAssets.map((asset) => (
                        <li
                          key={asset.slug || asset.symbol}
                          className="flex items-center justify-between gap-3 text-2"
                        >
                          <span className="min-w-0 truncate">
                            {asset.symbol}
                          </span>
                          <span className="shrink-0 text-muted-foreground">
                            {format.number(asset.value, {
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-4 text-2 text-muted-foreground">
                      {t('walletAssetsEmpty')}
                    </p>
                  )}
                  {hasRewards ? (
                    <p className="mt-3 text-2 text-foreground">
                      {t('walletRewards')}
                    </p>
                  ) : null}
                </>
              )}
            </div>
            <Button asChild className="self-start rounded-xl">
              <Link href={`/${lang}/my-wallet`}>{t('walletCta')}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="craft-card">
          <CardContent className="flex h-full flex-col gap-3 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="inline-flex items-center gap-2 text-1 font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  <Vote className="size-3.5" aria-hidden />
                  {t('activityVotes')}
                </p>
                <p className="mt-1 text-2 text-muted-foreground">
                  {t('activityLead')}
                </p>
              </div>
            </div>
            {isLoadingActivity ? (
              <p className="text-2 text-muted-foreground">
                {t('activityLoading')}
              </p>
            ) : votes.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {votes.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={getProposalPath(
                        lang,
                        item.spaceSlug,
                        item.proposalSlug,
                      )}
                      className="flex flex-col rounded-xl px-2 py-2 transition-colors hover:bg-background-3/50"
                    >
                      <span className="text-2 font-medium">{item.title}</span>
                      <span className="text-1 text-muted-foreground">
                        {item.spaceTitle}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-2 text-muted-foreground">
                {t('activityEmptyVotes')}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="craft-card">
          <CardContent className="flex h-full flex-col gap-3 p-5">
            <p className="inline-flex items-center gap-2 text-1 font-medium uppercase tracking-[0.08em] text-muted-foreground">
              <Bell className="size-3.5" aria-hidden />
              {t('activitySignals')}
            </p>
            {isLoadingActivity ? (
              <p className="text-2 text-muted-foreground">
                {t('activityLoading')}
              </p>
            ) : signals.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {signals.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={
                        item.signalSlug
                          ? `/${lang}/dho/${
                              item.spaceSlug
                            }/coherence?signal=${encodeURIComponent(
                              item.signalSlug,
                            )}`
                          : `/${lang}/dho/${item.spaceSlug}/coherence`
                      }
                      className="flex flex-col rounded-xl px-2 py-2 transition-colors hover:bg-background-3/50"
                    >
                      <span className="text-2 font-medium">{item.title}</span>
                      <span className="text-1 text-muted-foreground">
                        {item.spaceTitle}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-2 text-muted-foreground">
                {t('activityEmptySignals')}
              </p>
            )}
          </CardContent>
        </Card>
      </section>

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
        <Card className="craft-card lg:col-span-5">
          <CardContent className="flex h-full flex-col justify-between gap-4 p-5">
            <div>
              <h2 className="[font-family:var(--font-family-heading)] text-4 font-semibold tracking-[-0.015em]">
                {t('createTitle')}
              </h2>
              <p className="mt-2 text-2 leading-relaxed text-muted-foreground">
                {t('createLead')}
              </p>
            </div>
            <Button asChild variant="ghost" colorVariant="neutral">
              <Link href={getOnboardingPath(lang)}>
                {t('createCta')}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
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
        <NetworkPulseFeed
          lang={lang}
          stories={stories}
          isLoading={isLoadingShared || isLoadingPulse}
          compact
        />
        <EcosystemWorldMap
          lang={lang}
          spaces={spaces}
          href={`/${lang}/network`}
        />
      </section>

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
