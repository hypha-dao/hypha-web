'use client';

import { useMemo } from 'react';
import { Locale } from '@hypha-platform/i18n';
import { Space } from '@hypha-platform/core/client';
import { useNetworkSharedSpaces } from '../use-network-shared-spaces';
import { useNetworkPulse } from '../use-network-pulse';
import { spaceVisualsFromSpaces } from '../network-pulse';
import { NetworkJourneyIntro } from './network-journey-intro';
import { NetworkPulseFeed } from './network-pulse-feed';
import { NetworkPeopleStrip } from './network-people-strip';

export function NetworkLivingSurface({
  lang,
  spaces,
}: {
  lang: Locale;
  spaces: Space[];
}) {
  const { sharedSpaces, isLoading: isLoadingShared } =
    useNetworkSharedSpaces(spaces);
  const pulseSpaces = useMemo(
    () =>
      sharedSpaces.map((space) => ({
        slug: space.slug as string,
        title: space.title,
        logoUrl: space.logoUrl,
        web3SpaceId: space.web3SpaceId ?? null,
      })),
    [sharedSpaces],
  );
  const spaceVisuals = useMemo(
    () => spaceVisualsFromSpaces(sharedSpaces),
    [sharedSpaces],
  );
  const { stories, people, isLoading } = useNetworkPulse(pulseSpaces);

  return (
    <div className="flex flex-col gap-8">
      <NetworkJourneyIntro />
      <div className="grid items-start gap-6 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8">
          <NetworkPulseFeed
            lang={lang}
            stories={stories}
            isLoading={isLoading || isLoadingShared}
            spaceVisuals={spaceVisuals}
          />
        </div>
        <aside className="lg:col-span-4 lg:sticky lg:top-6 lg:self-start">
          <NetworkPeopleStrip lang={lang} people={people} layout="field" />
        </aside>
      </div>
    </div>
  );
}
