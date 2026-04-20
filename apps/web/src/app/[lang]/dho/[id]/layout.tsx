import {
  JoinSpace,
  SalesBanner,
  SpaceCard,
  SpaceEscrowDepositBanners,
  SpaceModeLabel,
  SubscriptionBadge,
  CompactSpaceBanner,
} from '@hypha-platform/epics';
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

  const [spaceMembers, spaceAgreements] = await Promise.all([
    (async () => {
      try {
        if (!canConvertToBigInt(spaceFromDb.web3SpaceId)) {
          return 0;
        }
        const [spaceDetails] = await fetchSpaceDetails({
          spaceIds: [BigInt(spaceFromDb.web3SpaceId as number)],
        });
        return spaceDetails?.members.length ?? 0;
      } catch (error) {
        console.error(
          `Failed to get space details for a space ${spaceFromDb.web3SpaceId}:`,
          error,
        );
        return 0;
      }
    })(),
    (async () => {
      try {
        if (!canConvertToBigInt(spaceFromDb.web3SpaceId)) {
          return 0;
        }
        const [proposals] = await fetchSpaceProposalsIds({
          spaceIds: [BigInt(spaceFromDb.web3SpaceId as number)],
        });
        return proposals?.accepted?.length ?? 0;
      } catch (error) {
        console.error(
          `Failed to get space proposals for a space ${spaceFromDb.web3SpaceId}:`,
          error,
        );
        return 0;
      }
    })(),
  ]);

  const spaces = await getAllSpaces({ parentOnly: false, omitSandbox: true });
  return (
    <div className="mx-auto flex max-w-container-2xl">
      <Container className="min-w-0 flex-grow !px-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 md:gap-x-4">
          <div className="flex min-h-8 min-w-0 flex-1 items-center">
            <Breadcrumbs spaceId={spaceFromDb.id} lang={lang} />
          </div>
          {typeof spaceFromDb.web3SpaceId === 'number' ? (
            <NestedSpacesButton
              web3SpaceId={spaceFromDb.web3SpaceId as number}
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
              {canConvertToBigInt(spaceFromDb.web3SpaceId) && (
                <SubscriptionBadge
                  web3SpaceId={spaceFromDb.web3SpaceId as number}
                  className="rounded-md border-emerald-400/85 bg-transparent text-white hover:border-emerald-300 hover:bg-white/10 [&]:rounded-md [&]:border-emerald-400/85 [&]:text-white"
                />
              )}
              <SpaceModeLabel
                web3SpaceId={
                  typeof spaceFromDb.web3SpaceId === 'number'
                    ? spaceFromDb.web3SpaceId
                    : undefined
                }
                isSandbox={spaceFromDb.flags.includes('sandbox')}
                isDemo={spaceFromDb.flags.includes('demo')}
                isArchived={
                  spaceFromDb.flags.includes('archived') || spaceMembers === 0
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
        <div className="mt-3 flex justify-end gap-2">
          {typeof spaceFromDb.web3SpaceId === 'number' && (
            <JoinSpace
              web3SpaceId={spaceFromDb.web3SpaceId}
              spaceId={spaceFromDb.id}
            />
          )}
          <ActionButtons web3SpaceId={spaceFromDb.web3SpaceId as number} />
        </div>
        <div className="mt-8 flex flex-col gap-3">
          <SalesBanner web3SpaceId={spaceFromDb.web3SpaceId as number} />
          <SpaceEscrowDepositBanners
            web3SpaceId={spaceFromDb.web3SpaceId as number}
            spaceDbId={spaceFromDb.id}
            spaceSlug={daoSlug}
            lang={lang}
          />
        </div>
        {tab}
        {children}
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
