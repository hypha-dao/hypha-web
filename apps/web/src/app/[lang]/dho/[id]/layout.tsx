import { SpaceCard } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { Container, Separator } from '@hypha-platform/ui';
import { Text } from '@radix-ui/themes';
import { Carousel, CarouselContent, CarouselItem } from '@hypha-platform/ui';
import Link from 'next/link';
import { getAllSpaces, findSpaceBySlug } from '@hypha-platform/core/server';
import { getDhoPathAgreements } from './@tab/agreements/constants';
import { SpaceHeader } from './_components/space-header';
import {
  DEFAULT_SPACE_LEAD_IMAGE,
  fetchSpaceDetails,
  fetchSpaceProposalsIds,
  isSpaceArchived,
} from '@hypha-platform/core/client';
import { notFound } from 'next/navigation';
import { db } from '@hypha-platform/storage-postgres';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';
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
  const tSpaces = await getTranslations('Spaces');

  const spaceFromDb = await findSpaceBySlug({ slug: daoSlug }, { db });
  if (!spaceFromDb) {
    return notFound();
  }

  const spaceMembers = await (async () => {
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
  })();

  const spaceAgreements = await (async () => {
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
        `Failed to get space details for a space ${spaceFromDb.web3SpaceId}:`,
        error,
      );
      return 0;
    }
  })();

  const spaces = await getAllSpaces({ parentOnly: false, omitSandbox: true });
  return (
    <div className="flex max-w-container-2xl mx-auto">
      <Container className="flex-grow min-w-0">
        <SpaceHeader
          lang={lang}
          daoSlug={daoSlug}
          spaceId={spaceFromDb.id}
          web3SpaceId={
            typeof spaceFromDb.web3SpaceId === 'number'
              ? spaceFromDb.web3SpaceId
              : null
          }
          title={spaceFromDb.title as string}
          description={spaceFromDb.description}
          links={spaceFromDb.links}
          logoUrl={spaceFromDb.logoUrl}
          leadImage={spaceFromDb.leadImage}
          createdAt={spaceFromDb.createdAt}
          flags={spaceFromDb.flags}
          spaceMembers={spaceMembers}
          spaceAgreements={spaceAgreements}
        />
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
