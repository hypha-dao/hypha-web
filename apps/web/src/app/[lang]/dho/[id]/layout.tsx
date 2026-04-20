import {
  JoinSpace,
  SalesBanner,
  SpaceCard,
  SpaceEscrowDepositBanners,
  SpaceModeLabel,
  SubscriptionBadge,
  CompactSpaceBanner,
  SpaceAccentFromImages,
} from '@hypha-platform/epics';
import './space-accent.css';
import { Locale } from '@hypha-platform/i18n';
import { Container, Separator } from '@hypha-platform/ui';
import { Text } from '@radix-ui/themes';
import { Carousel, CarouselContent, CarouselItem } from '@hypha-platform/ui';
import Link from 'next/link';
import { getAllSpaces, findSpaceBySlug } from '@hypha-platform/core/server';
import { getDhoPathAgreements } from './@tab/agreements/constants';
import { ActionButtons } from './_components/action-buttons';
import { NestedSpacesButton } from './_components/nested-spaces-button';
import {
  DEFAULT_SPACE_AVATAR_IMAGE,
  DEFAULT_SPACE_LEAD_IMAGE,
  fetchSpaceDetails,
  fetchSpaceProposalsIds,
  isSpaceArchived,
} from '@hypha-platform/core/client';
import { notFound } from 'next/navigation';
import { db } from '@hypha-platform/storage-postgres';
import { Breadcrumbs } from './_components/breadcrumbs';
import { canConvertToBigInt, formatDate } from '@hypha-platform/ui-utils';
import { getTranslations } from 'next-intl/server';

async function getSpaceMemberAndAgreementCounts(web3SpaceId: unknown): Promise<{
  members: number;
  agreements: number;
}> {
  if (!canConvertToBigInt(web3SpaceId)) {
    return { members: 0, agreements: 0 };
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
        return 0;
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
        return 0;
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
  const tSpaces = await getTranslations('Spaces');

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

  const spaces = await getAllSpaces({ parentOnly: false, omitSandbox: true });

  const rawLead = spaceFromDb.leadImage?.trim();
  const heroBannerImageHref =
    rawLead && (rawLead.startsWith('/') || /^https?:\/\//i.test(rawLead))
      ? rawLead
      : DEFAULT_SPACE_LEAD_IMAGE;

  const accentLogoHref =
    spaceFromDb.logoUrl?.trim() &&
    (spaceFromDb.logoUrl.startsWith('/') ||
      /^https?:\/\//i.test(spaceFromDb.logoUrl))
      ? spaceFromDb.logoUrl.trim()
      : DEFAULT_SPACE_AVATAR_IMAGE;

  return (
    <div className="mx-auto flex max-w-container-2xl">
      <Container className="min-w-0 flex-grow !px-4">
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
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 md:gap-x-4">
              <div className="flex min-w-0 flex-1 items-center">
                <Breadcrumbs spaceId={spaceFromDb.id} lang={lang} />
              </div>
              {web3SpaceId !== undefined ? (
                <NestedSpacesButton
                  web3SpaceId={web3SpaceId}
                  spaceSlug={daoSlug}
                />
              ) : null}
            </div>
            <CompactSpaceBanner
              title={spaceFromDb.title}
              description={spaceFromDb.description}
              logoUrl={spaceFromDb.logoUrl}
              logoAlt={spaceFromDb.title}
              defaultLogoSrc={DEFAULT_SPACE_AVATAR_IMAGE}
              links={spaceFromDb.links}
              leadImageUrl={spaceFromDb.leadImage}
              defaultLeadImageSrc={DEFAULT_SPACE_LEAD_IMAGE}
              memberCount={spaceMembers}
              agreementCount={spaceAgreements}
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
                      className="rounded-md border-emerald-400/85 bg-transparent text-white hover:border-emerald-300 hover:bg-white/10 [&]:rounded-md [&]:border-emerald-400/85 [&]:text-white"
                    />
                  )}
                  <SpaceModeLabel
                    web3SpaceId={web3SpaceId}
                    isSandbox={spaceFromDb.flags.includes('sandbox')}
                    isDemo={spaceFromDb.flags.includes('demo')}
                    isArchived={
                      spaceFromDb.flags.includes('archived') ||
                      spaceMembers === 0
                    }
                    configPath={`${getDhoPathAgreements(
                      lang,
                      daoSlug,
                    )}/space-configuration`}
                    className="[&_.border-accent-8]:rounded-md [&_.border-accent-8]:border-white/85 [&_.border-accent-8]:bg-transparent [&_.border-accent-8]:text-white [&_.border-accent-8]:hover:border-white [&_.border-accent-8]:hover:bg-white/10 [&_.border-error-8]:rounded-md [&_.border-error-8]:border-white/85 [&_.border-error-8]:bg-transparent [&_.border-error-8]:text-white [&_.border-warning-8]:rounded-md [&_.border-warning-8]:border-amber-200/90 [&_.border-warning-8]:bg-transparent [&_.border-warning-8]:text-white"
                  />
                </>
              }
            />
            <div className="flex justify-end gap-2">
              {web3SpaceId !== undefined && (
                <JoinSpace web3SpaceId={web3SpaceId} spaceId={spaceFromDb.id} />
              )}
              <ActionButtons web3SpaceId={web3SpaceId} />
            </div>
          </div>
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
        <div className="space-y-9">
          <Separator />
          <div className="border-primary-foreground">
            <Text className="text-4 font-medium pb-4 pt-4">
              {tSpaces('spacesYouMightLike')}
            </Text>
            <Carousel className="my-6 mt-6">
              <CarouselContent className="pb-5" showScrollbar>
                {spaces.map((space) => (
                  <CarouselItem
                    key={space.id}
                    className="w-full sm:w-[454px] max-w-[454px] flex-shrink-0"
                  >
                    <Link
                      className="flex flex-col flex-1"
                      href={getDhoPathAgreements(lang, space.slug as string)}
                    >
                      <SpaceCard
                        description={space.description as string}
                        icon={space.logoUrl || ''}
                        leadImage={space.leadImage || DEFAULT_SPACE_LEAD_IMAGE}
                        members={space.memberCount}
                        agreements={space.documentCount}
                        title={space.title as string}
                        isSandbox={space.flags?.includes('sandbox') ?? false}
                        isDemo={space.flags?.includes('demo') ?? false}
                        isArchived={isSpaceArchived(space)}
                        web3SpaceId={space.web3SpaceId as number}
                        configPath={`${getDhoPathAgreements(
                          lang,
                          space.slug,
                        )}/space-configuration`}
                        createdAt={space.createdAt}
                      />
                    </Link>
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
          </div>
        </div>
      </Container>
      {aside}
    </div>
  );
}
