import { JoinSpace, SpaceCard, WebLinks } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import {
  Container,
  Card,
  Avatar,
  AvatarImage,
  Separator,
} from '@hypha-platform/ui';
import { Text } from '@radix-ui/themes';
import Image from 'next/image';
import { Carousel, CarouselContent, CarouselItem } from '@hypha-platform/ui';
import Link from 'next/link';
import {
  getAllSpaces,
  findSpaceBySlug,
  findParentSpaceById,
} from '@hypha-platform/core/server';
import { getDhoPathGovernance } from './@tab/governance/constants';
import { ActionButtons } from './_components/action-buttons';
import {
  DEFAULT_SPACE_AVATAR_IMAGE,
  DEFAULT_SPACE_LEAD_IMAGE,
  fetchSpaceDetails,
  fetchSpaceProposalsIds,
} from '@hypha-platform/core/client';
import { notFound } from 'next/navigation';
import { db } from '@hypha-platform/storage-postgres';
import { Breadcrumbs } from './_components/breadcrumbs';

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

  const spaceFromDb = await findSpaceBySlug({ slug: daoSlug }, { db });
  if (!spaceFromDb) {
    return notFound();
  }

  const spaceMembers = await (async () => {
    try {
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

  const spaces = await getAllSpaces();

  return (
    <div className="flex max-w-container-2xl mx-auto">
      <Container className="flex-grow min-w-0">
        <div className="mb-6 flex items-center">
          <Breadcrumbs spaceId={spaceFromDb.id} />
        </div>
        <Card className="relative">
          <Image
            width={768}
            height={270}
            className="rounded-xl min-h-[270px] max-h-[270px] w-full object-cover"
            src={spaceFromDb.leadImage || DEFAULT_SPACE_LEAD_IMAGE}
            alt={spaceFromDb.title}
          ></Image>
          <Avatar className="border-4 w-[128px] h-[128px] absolute bottom-[-35px] left-[15px]">
            <AvatarImage
              src={spaceFromDb.logoUrl || DEFAULT_SPACE_AVATAR_IMAGE}
              alt="logo"
            />
          </Avatar>
        </Card>
        <div className="flex justify-end mt-2 gap-2">
          {typeof spaceFromDb.web3SpaceId === 'number' && (
            <JoinSpace
              web3SpaceId={spaceFromDb.web3SpaceId}
              spaceId={spaceFromDb.id}
            />
          )}
          <ActionButtons web3SpaceId={spaceFromDb.web3SpaceId as number} />
        </div>

        <div className="flex flex-col mt-4 gap-2">
          <Text className="text-7">{spaceFromDb.title}</Text>
          <WebLinks links={spaceFromDb.links} />
        </div>
        <div className="mt-6">
          <Text className="text-2">{spaceFromDb.description}</Text>
        </div>
        <div className="flex gap-2 items-center mt-6">
          <div className="flex">
            <div className="font-bold text-1">{spaceMembers}</div>
            <div className="text-gray-500 ml-1 text-1">Members</div>
          </div>
          <div className="flex ml-3">
            <div className="font-bold text-1">
              {/* @ts-ignore: TODO: infer types from relations */}
              {spaceAgreements}
            </div>
            <div className="text-gray-500 ml-1 text-1">Agreements</div>
          </div>
        </div>
        {tab}
        {children}
        <div className="space-y-9">
          <Separator />
          <div className="border-primary-foreground">
            <Text className="text-4 font-medium">Spaces you might like</Text>
            <Carousel className="my-6">
              <CarouselContent>
                {spaces.map((space) => (
                  <CarouselItem
                    key={space.id}
                    className="w-full sm:w-[454px] max-w-[454px] flex-shrink-0"
                  >
                    <Link
                      className="flex flex-col flex-1"
                      href={getDhoPathGovernance(lang, space.slug as string)}
                    >
                      <SpaceCard
                        description={space.description as string}
                        icon={space.logoUrl || ''}
                        leadImage={space.leadImage || DEFAULT_SPACE_LEAD_IMAGE}
                        members={space.memberCount}
                        agreements={space.documentCount}
                        title={space.title as string}
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
