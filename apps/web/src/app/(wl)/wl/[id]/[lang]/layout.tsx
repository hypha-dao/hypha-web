import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { routing } from '@hypha-platform/i18n';
import {
  SpaceAccentPortalBridge,
  SpaceCreatedOnText,
  isSafeImageUrl,
} from '@hypha-platform/epics';
import { findSpaceBySlug } from '@hypha-platform/core/server';
import {
  DEFAULT_SPACE_AVATAR_IMAGE,
  DEFAULT_SPACE_LEAD_IMAGE,
  fetchSpaceDetails,
  fetchSpaceProposalsIds,
} from '@hypha-platform/core/client';
import {
  getEnableCoherence,
  getEnableSpaceMemory,
} from '@hypha-platform/feature-flags';
import { db } from '@hypha-platform/storage-postgres';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';

import { LiveSpaceHero } from '@web/app/(main)/[lang]/dho/[id]/_components/live-space-hero';
import { WL_SPACE_HEADER } from '@web/lib/white-label';
import { WhiteLabelSectionNav } from '@web/components/white-label/section-nav';

import '@web/app/(main)/[lang]/_shared/space-accent.css';

async function getCounts(web3SpaceId: unknown): Promise<{
  members: number | null;
  agreements: number | null;
}> {
  if (!canConvertToBigInt(web3SpaceId)) {
    return { members: null, agreements: null };
  }
  const id = BigInt(web3SpaceId);
  const [members, agreements] = await Promise.all([
    fetchSpaceDetails({ spaceIds: [id] })
      .then(([details]) => details?.members?.length ?? null)
      .catch(() => null),
    fetchSpaceProposalsIds({ spaceIds: [id] })
      .then(([proposals]) => proposals?.accepted?.length ?? 0)
      .catch(() => null),
  ]);
  return { members, agreements };
}

/**
 * Space frame of the white-label tree: hero and section menu only. No
 * settings, subscription, call banner, membership CTA or aside panel.
 */
export default async function WhiteLabelSpaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string; lang: string }>;
}) {
  const { id: slug, lang } = await params;
  const requestHeaders = await headers();
  // The URL must name the Space middleware resolved, and a locale we serve.
  if (
    slug !== requestHeaders.get(WL_SPACE_HEADER) ||
    !routing.locales.includes(lang as (typeof routing.locales)[number])
  ) {
    notFound();
  }

  const space = await findSpaceBySlug({ slug }, { db });
  if (!space) notFound();

  const [tCommon, coherenceEnabled, memoryEnabled, counts] = await Promise.all([
    getTranslations('Common'),
    getEnableCoherence(),
    getEnableSpaceMemory(),
    getCounts(space.web3SpaceId),
  ]);

  const rawLead = space.leadImage?.trim();
  const leadImage =
    rawLead && isSafeImageUrl(rawLead) ? rawLead : DEFAULT_SPACE_LEAD_IMAGE;
  const rawLogo = space.logoUrl?.trim();
  const logo =
    rawLogo && isSafeImageUrl(rawLogo) ? rawLogo : DEFAULT_SPACE_AVATAR_IMAGE;

  return (
    <SpaceAccentPortalBridge>
      <div className="flex w-full min-w-0">
        <div className="mt-[2px] min-w-0 flex-1 px-4 md:mt-[6px] sm:px-5">
          <div className="relative z-[1]">
            <LiveSpaceHero
              spaceSlug={slug}
              title={space.title}
              description={space.description}
              logoUrl={logo}
              logoAlt={space.title}
              defaultLogoSrc={DEFAULT_SPACE_AVATAR_IMAGE}
              links={space.links}
              leadImageUrl={leadImage}
              defaultLeadImageSrc={DEFAULT_SPACE_LEAD_IMAGE}
              memberCount={counts.members}
              agreementCount={counts.agreements}
              createdOnText={<SpaceCreatedOnText createdAt={space.createdAt} />}
              membersLabel={tCommon('Members')}
              agreementsLabel={tCommon('Agreements')}
              descriptionLabel={tCommon('spaceBannerDescriptionAria', {
                title: space.title,
              })}
              revealMetaLabel={tCommon('spaceBannerRevealMeta')}
            />
            <WhiteLabelSectionNav
              spaceSlug={slug}
              coherenceEnabled={coherenceEnabled}
              memoryEnabled={memoryEnabled}
            />
            {children}
          </div>
        </div>
      </div>
    </SpaceAccentPortalBridge>
  );
}
