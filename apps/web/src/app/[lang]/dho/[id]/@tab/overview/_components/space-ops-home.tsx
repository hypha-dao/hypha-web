'use client';

import { Locale } from '@hypha-platform/i18n';
import { useSpaceBySlug } from '@hypha-platform/core/client';
import { SpaceJourneyHome } from '@hypha-platform/epics';
import { HomeTokenHoldingsDashboardLazy } from './home-token-holdings-dashboard-lazy';

export function SpaceOpsHome({
  lang,
  spaceSlug,
}: {
  lang: Locale;
  spaceSlug: string;
}) {
  const { space } = useSpaceBySlug(spaceSlug);

  return (
    <div className="flex flex-col gap-8 py-4 md:gap-10">
      <SpaceJourneyHome
        lang={lang}
        spaceSlug={spaceSlug}
        memberCount={space?.memberCount ?? null}
        agreementCount={space?.documentCount ?? null}
      />
      <HomeTokenHoldingsDashboardLazy spaceSlug={spaceSlug} />
    </div>
  );
}
