import { JoinSpace, SpaceCard, WebLinks } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import {
  Container,
  Card,
  Avatar,
  AvatarImage,
  Button,
} from '@hypha-platform/ui';
import { Share2Icon, ChevronLeftIcon } from '@radix-ui/react-icons';
import { Text } from '@radix-ui/themes';
import Image from 'next/image';
import Link from 'next/link';
import { Carousel, CarouselContent, CarouselItem } from '@hypha-platform/ui';
import { createSpaceService } from '@hypha-platform/core/server';
import { getDhoPathAgreements } from './@tab/agreements/constants';
import { ActionButtons } from './_components/action-buttons';

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

  const spaceService = createSpaceService();

  const spaceFromDb = await spaceService.getBySlug({ slug: daoSlug });
  const spaces = await spaceService.getAll();

  return (
    <div className="flex">
      <Container>
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
            <JoinSpace spaceId={spaceFromDb.web3SpaceId} />
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
            <div className="font-bold text-1">128</div>
            <div className="text-gray-500 ml-1 text-1">Members</div>
          </div>
          <div className="flex ml-3">
            <div className="font-bold text-1">58</div>
            <div className="text-gray-500 ml-1 text-1">Agreements</div>
          </div>
        </div>
        {tab}
        {children}
        <div className="border-t-2 border-primary-foreground pt-6">
          <Text className="text-4 font-medium">Spaces you might like</Text>
          <Carousel className="my-6">
            <CarouselContent>
              {spaces.map((space) => (
                <CarouselItem
                  key={space.id}
                  className="mb-5 w-full sm:w-[454px] max-w-[454px] flex-shrink-0"
                >
                  <Link
                    className="w-96"
                    href={getDhoPathAgreements(lang, space.slug as string)}
                  >
                    <SpaceCard
                      description={space.description as string}
                      icon={
                        space.logoUrl || '/placeholder/space-avatar-image.png'
                      }
                      leadImage={
                        space.leadImage || '/placeholder/space-lead-image.png'
                      }
                      members={0}
                      agreements={0}
                      title={space.title as string}
                    />
                  </Link>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </div>
      </Container>
      {aside}
    </div>
  );
}
