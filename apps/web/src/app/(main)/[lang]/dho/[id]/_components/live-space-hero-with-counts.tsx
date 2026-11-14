import { Suspense } from 'react';
import {
  LiveSpaceHero,
  type LiveSpaceHeroBannerProps,
} from './live-space-hero';
import { resolveHeroMemberAndAgreementCounts } from './space-hero-counts';

async function LiveSpaceHeroWithCounts({
  web3SpaceId,
  ...hero
}: LiveSpaceHeroBannerProps & { web3SpaceId: unknown }) {
  const { members, agreements } = await resolveHeroMemberAndAgreementCounts(
    hero.spaceSlug,
    web3SpaceId,
  );

  return (
    <LiveSpaceHero
      {...hero}
      memberCount={members}
      agreementCount={agreements}
    />
  );
}

/** Banner paints immediately; on-chain member/agreement counts stream in. */
export function LiveSpaceHeroBanner({
  web3SpaceId,
  ...hero
}: LiveSpaceHeroBannerProps & { web3SpaceId: unknown }) {
  const pendingHero = {
    ...hero,
    memberCount: null,
    agreementCount: null,
  };

  return (
    <Suspense fallback={<LiveSpaceHero {...pendingHero} />}>
      <LiveSpaceHeroWithCounts web3SpaceId={web3SpaceId} {...hero} />
    </Suspense>
  );
}
