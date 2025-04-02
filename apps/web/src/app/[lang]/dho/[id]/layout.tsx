import { JoinSpace, SpaceCard } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import {
  Container,
  Card,
  Avatar,
  AvatarImage,
  Button,
} from '@hypha-platform/ui';
import {
  Link2Icon,
  LinkedInLogoIcon,
  Share2Icon,
  ChevronLeftIcon,
} from '@radix-ui/react-icons';
import { Text } from '@radix-ui/themes';
import { faXTwitter } from '@fortawesome/free-brands-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Image from 'next/image';
import Link from 'next/link';
import { Carousel, CarouselContent, CarouselItem } from '@hypha-platform/ui';
import { getDhoPathAgreements } from './agreements/constants';
import { createSpaceService } from '@hypha-platform/core/server';

const customLogoStyles: React.CSSProperties = {
  width: '128px',
  height: '128px',
  position: 'absolute',
  bottom: '-35px',
  left: '15px',
};

export default async function DhoLayout({
  children,
  aside,
  params,
}: {
  children: React.ReactNode;
  aside: React.ReactNode;
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
          <Avatar style={customLogoStyles} className="border-4">
            <AvatarImage
              src={spaceFromDb.logoUrl || '/placeholder/space-avatar-image.png'}
              alt="logo"
            />
          </Avatar>
        </Card>
        <div className="flex justify-end mt-2">
          <Button
            asChild
            variant="ghost"
            colorVariant="neutral"
            className="rounded-lg justify-start p-1 cursor-pointer"
          >
            <Share2Icon width={28} height={28} />
          </Button>
          {typeof spaceFromDb.web3SpaceId === 'number' && (
            <JoinSpace spaceId={spaceFromDb.web3SpaceId} />
          )}
        </div>
        <div className="mt-4">
          <Text className="text-7">{spaceFromDb.title}</Text>
        </div>
        <div className="flex gap-6">
          <Button
            asChild
            variant="ghost"
            className="rounded-lg justify-start text-gray-400 px-0 cursor-pointer"
          >
            <div>
              <LinkedInLogoIcon width={16} height={16} />
              <Text className="ml-1 text-1">HyphaDAO</Text>
            </div>
          </Button>
          <Button
            asChild
            variant="ghost"
            className="rounded-lg justify-start text-gray-400 px-0 cursor-pointer"
          >
            <div>
              <FontAwesomeIcon
                className="w-4"
                color="bg-primary-foreground"
                icon={faXTwitter}
              />
              <Text className="ml-1 text-1">@HyphaDAO</Text>
            </div>
          </Button>
          <Button
            asChild
            variant="ghost"
            className="rounded-lg justify-start text-gray-400 px-0 cursor-pointer"
          >
            <div>
              <Link2Icon width={16} height={16} />
              <Text className="ml-1 text-1">hypha.earth</Text>
            </div>
          </Button>
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
            <div className="text-gray-500 ml-1 text-1">Completed projects</div>
          </div>
        </div>
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
