'use client';

import { useMemo } from 'react';
import { Locale } from '@hypha-platform/i18n';
import { Space } from '@hypha-platform/core/client';
import { useNetworkSharedSpaces } from '../use-network-shared-spaces';
import { useNetworkPulse } from '../use-network-pulse';
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
      })),
    [sharedSpaces],
  );
  const { stories, people, isLoading } = useNetworkPulse(pulseSpaces);

  return (
    <div className="flex flex-col gap-6">
      <NetworkJourneyIntro />
      <NetworkPulseFeed
        lang={lang}
        stories={stories}
        isLoading={isLoading || isLoadingShared}
      />
      <NetworkPeopleStrip lang={lang} people={people} />
    </div>
  );
}
