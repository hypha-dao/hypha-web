import { JoinSpace, SpaceCardWrapper, WebLinks } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import {
  Container,
  Card,
  Avatar,
  AvatarImage,
  Separator,
} from '@hypha-platform/ui';
import { ChevronLeftIcon } from '@radix-ui/react-icons';
import { Text } from '@radix-ui/themes';
import Image from 'next/image';
import Link from 'next/link';
import { Carousel, CarouselContent, CarouselItem } from '@hypha-platform/ui';
import {
  findAllSpaces,
  findSpaceBySlug,
  getDb,
} from '@hypha-platform/core/server';
import { getDhoPathGovernance } from './@tab/governance/constants';
import { ActionButtons } from './_components/action-buttons';
import { publicClient } from '@hypha-platform/core/client';
import { getSpaceDetails } from '@hypha-platform/core/client';
import { useMembers } from '@web/hooks/use-members';
import { notFound } from 'next/navigation';
import { db } from '@hypha-platform/storage-postgres';

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

  const spaces = await findAllSpaces({
    db,
  });

  if (!spaceFromDb) {
    return notFound();
  }

  const spaceDetails = await publicClient.readContract(
    getSpaceDetails({ spaceId: BigInt(spaceFromDb.web3SpaceId as number) }),
  );
  return (
    <div className="max-w-[--spacing-container-2xl] mx-auto">
      <Container className="flex-grow min-w-0">
        <div className="mb-6 flex items-center">
          <Link
            href={`/${lang}/my-spaces`}
            className="cursor-pointer flex items-center"
          >
            <ChevronLeftIcon width={16} height={16} />
            <Text className="text-sm">My Spaces</Text>
          </Link>
          <Text className="text-sm text-gray-400 ml-1">
            {' '}
            / {spaceFromDb.title}
          </Text>
        </div>
        <Card className="relative">
          <Image
            width={768}
            height={270}
            className="rounded-xl min-h-[270px] max-h-[270px] w-full object-cover"
            src={spaceFromDb.leadImage || '/placeholder/space-lead-image.png'}
            alt={spaceFromDb.title}
          ></Image>
          <Avatar className="border-4 w-[128px] h-[128px] absolute bottom-[-35px] left-[15px]">
            <AvatarImage
              src={spaceFromDb.logoUrl || '/placeholder/space-avatar-image.png'}
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
          <ActionButtons />
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
            <div className="font-bold text-1">
              {spaceDetails[4].length || 0}
            </div>
            <div className="text-gray-500 ml-1 text-1">Members</div>
          </div>
          <div className="flex ml-3">
            <div className="font-bold text-1">
              {/* @ts-ignore: TODO: infer types from relations */}
              {spaceFromDb.documents?.length || 0}
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
                      <SpaceCardWrapper
                        description={space.description as string}
                        icon={space.logoUrl || ''}
                        leadImage={space.leadImage || ''}
                        agreements={space.documentCount}
                        title={space.title as string}
                        spaceSlug={space.slug as string}
                        useMembers={useMembers}
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
