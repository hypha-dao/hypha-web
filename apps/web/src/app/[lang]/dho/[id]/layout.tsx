import {
  JoinSpace,
  SalesBanner,
  SpaceEscrowDepositBanners,
  SpaceModeLabel,
  SubscriptionBadge,
  CompactSpaceBanner,
  SpaceAccentFromImages,
  SpaceAccentPortalBridge,
} from '@hypha-platform/epics';
import './space-accent.css';
import { Locale } from '@hypha-platform/i18n';
import { Container } from '@hypha-platform/ui';
import { findSpaceBySlug } from '@hypha-platform/core/server';
import { getDhoPathAgreements } from './@tab/agreements/constants';
import { ActionButtons } from './_components/action-buttons';
import { NestedSpacesButton } from './_components/nested-spaces-button';
import {
  DEFAULT_SPACE_AVATAR_IMAGE,
  DEFAULT_SPACE_LEAD_IMAGE,
  fetchSpaceDetails,
  fetchSpaceProposalsIds,
} from '@hypha-platform/core/client';
import { notFound } from 'next/navigation';
import { db } from '@hypha-platform/storage-postgres';
import { Breadcrumbs } from './_components/breadcrumbs';
import { DhoStickySpaceChrome } from './_components/dho-sticky-space-chrome';
import { canConvertToBigInt, formatDate } from '@hypha-platform/ui-utils';
import { getTranslations } from 'next-intl/server';

async function getSpaceMemberAndAgreementCounts(web3SpaceId: unknown): Promise<{
  /** null when enrichment failed — do not treat as “zero members” */
  members: number | null;
  agreements: number | null;
}> {
  if (!canConvertToBigInt(web3SpaceId)) {
    return { members: null, agreements: null };
  }
  const id = BigInt(web3SpaceId as number);
  const [members, agreements] = await Promise.all([
    (async () => {
      try {
        const [spaceDetails] = await fetchSpaceDetails({
          spaceIds: [id],
        });
        return spaceDetails?.members.length ?? 0;
      } catch (error) {
        console.error(
          `Failed to get space details for a space ${web3SpaceId}:`,
          error,
        );
        return null;
      }
    })(),
    (async () => {
      try {
        const [proposals] = await fetchSpaceProposalsIds({
          spaceIds: [id],
        });
        return proposals?.accepted?.length ?? 0;
      } catch (error) {
        console.error(
          `Failed to get space proposals for a space ${web3SpaceId}:`,
          error,
        );
        return null;
      }
    })(),
  ]);
  return { members, agreements };
}

export default async function DhoLayout({
  aside,
  children,
  tab,
  params,
}: {
  aside: React.ReactNode;
  children: React.ReactNode;
  tab: React.ReactNode;
  params: Promise<{ id: string; lang: Locale }>;
}) {
  const { id: daoSlug, lang } = await params;
  const tCommon = await getTranslations('Common');

  const spaceFromDb = await findSpaceBySlug({ slug: daoSlug }, { db });
  if (!spaceFromDb) {
    return notFound();
  }

  const web3SpaceId =
    typeof spaceFromDb.web3SpaceId === 'number'
      ? spaceFromDb.web3SpaceId
      : undefined;
  const hasWeb3Id = canConvertToBigInt(spaceFromDb.web3SpaceId);

  const { members: spaceMembers, agreements: spaceAgreements } =
    await getSpaceMemberAndAgreementCounts(spaceFromDb.web3SpaceId);

  const rawLead = spaceFromDb.leadImage?.trim();
  const heroBannerImageHref =
    rawLead &&
    ((rawLead.startsWith('/') && !rawLead.startsWith('//')) ||
      /^https?:\/\//i.test(rawLead))
      ? rawLead
      : DEFAULT_SPACE_LEAD_IMAGE;

  const rawLogo = spaceFromDb.logoUrl?.trim();
  const accentLogoHref =
    rawLogo &&
    ((rawLogo.startsWith('/') && !rawLogo.startsWith('//')) ||
      /^https?:\/\//i.test(rawLogo))
      ? rawLogo
      : DEFAULT_SPACE_AVATAR_IMAGE;

  const compactBannerSpaceArchived =
    spaceFromDb.flags.includes('archived') ||
    (spaceMembers !== null && spaceMembers === 0);

  return (
    <SpaceAccentPortalBridge>
      <div className="mx-auto flex max-w-container-2xl">
        <Container className="min-w-0 flex-grow !px-4">
          {/* React 19+: link rel="preload" is hoisted to document head */}
          {heroBannerImageHref ? (
            <link
              rel="preload"
              as="image"
              href={heroBannerImageHref}
              fetchPriority="high"
            />
          ) : null}
          <SpaceAccentFromImages
            bannerSrc={heroBannerImageHref}
            logoSrc={accentLogoHref}
          >
            {/* gap-4 (16px) matches mt-4 above SalesBanner: breadcrumb→banner and banner→actions */}
            <DhoStickySpaceChrome
              breadcrumbsRow={
                <Breadcrumbs spaceId={spaceFromDb.id} lang={lang} />
              }
              banner={
                <CompactSpaceBanner
                  title={spaceFromDb.title}
                  description={spaceFromDb.description}
                  logoUrl={accentLogoHref}
                  logoAlt={spaceFromDb.title}
                  defaultLogoSrc={DEFAULT_SPACE_AVATAR_IMAGE}
                  links={spaceFromDb.links}
                  leadImageUrl={heroBannerImageHref}
                  defaultLeadImageSrc={DEFAULT_SPACE_LEAD_IMAGE}
                  memberCount={spaceMembers ?? 0}
                  agreementCount={spaceAgreements ?? 0}
                  createdOnText={tCommon('createdOn', {
                    date: formatDate(spaceFromDb.createdAt, true),
                  })}
                  membersLabel={tCommon('Members')}
                  agreementsLabel={tCommon('Agreements')}
                  footerTrailing={
                    <>
                      {hasWeb3Id && web3SpaceId !== undefined && (
                        <SubscriptionBadge
                          web3SpaceId={web3SpaceId}
                          className="rounded-md !border-accent-8 bg-transparent text-white hover:!border-accent-9 hover:bg-white/10"
                        />
                      )}
                      <SpaceModeLabel
                        web3SpaceId={web3SpaceId}
                        isSandbox={spaceFromDb.flags.includes('sandbox')}
                        isDemo={spaceFromDb.flags.includes('demo')}
                        isArchived={compactBannerSpaceArchived}
                        configPath={`${getDhoPathAgreements(
                          lang,
                          daoSlug,
                        )}/space-configuration`}
                        className={
                          compactBannerSpaceArchived
                            ? '[&_.border-error-8]:rounded-md [&_.border-error-8]:!border-error-8 [&_.border-error-8]:bg-transparent [&_.border-error-8]:text-white [&_.border-error-8]:hover:!border-error-9 [&_.border-error-8]:hover:bg-white/10'
                            : '[&_.border-accent-8]:rounded-md [&_.border-accent-8]:!border-accent-8 [&_.border-accent-8]:bg-transparent [&_.border-accent-8]:text-white [&_.border-accent-8]:hover:!border-accent-9 [&_.border-accent-8]:hover:bg-white/10'
                        }
                      />
                    </>
                  }
                />
              }
              actionsSlot={
                <>
                  {web3SpaceId !== undefined && (
                    <JoinSpace
                      web3SpaceId={web3SpaceId}
                      spaceId={spaceFromDb.id}
                    />
                  )}
                  <ActionButtons web3SpaceId={web3SpaceId} />
                </>
              }
              nestedSpacesSlot={
                web3SpaceId !== undefined ? (
                  <NestedSpacesButton
                    web3SpaceId={web3SpaceId}
                    spaceSlug={daoSlug}
                  />
                ) : null
              }
              title={spaceFromDb.title}
              logoUrl={accentLogoHref}
              logoAlt={spaceFromDb.title}
              defaultLogoSrc={DEFAULT_SPACE_AVATAR_IMAGE}
            />
            <div className="mt-4 flex flex-col gap-3">
              <SalesBanner web3SpaceId={web3SpaceId} />
              <SpaceEscrowDepositBanners
                web3SpaceId={web3SpaceId}
                spaceDbId={spaceFromDb.id}
                spaceSlug={daoSlug}
                lang={lang}
              />
            </div>
            {tab}
            {children}
          </SpaceAccentFromImages>
        </Container>
        {aside}
      </div>
    </SpaceAccentPortalBridge>
  );
}
