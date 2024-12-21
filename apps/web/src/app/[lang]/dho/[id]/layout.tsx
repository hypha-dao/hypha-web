import {
  getAccessToken,
  getDaoDetail,
  getDaoList,
} from '@hypha-platform/graphql/rsc';
import { ButtonProfile, CardOrganisation } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { Footer, MenuTop } from '@hypha-platform/ui/server';
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
  PersonIcon,
  ChevronLeftIcon,
} from '@radix-ui/react-icons';
import { Text } from '@radix-ui/themes';
import { faXTwitter } from '@fortawesome/free-brands-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Image from 'next/image';
import Link from 'next/link';
import { Carousel, CarouselContent, CarouselItem } from '@hypha-platform/ui';
import { getDhoPathAgreements } from './constants';

const customLogoStyles: React.CSSProperties = {
  width: '128px',
  height: '128px',
  position: 'absolute',
  bottom: '-35px',
  left: '15px',
};

const alreadyMember = true;

export default async function DhoLayout(props: {
  children: React.ReactNode;
  params: Promise<{ id: string; lang: Locale }>;
}) {
  const params = await props.params;

  const { id: daoSlug, lang } = params;

  const { children } = props;

  const newtoken = await getAccessToken();
  const dao = await getDaoDetail({ token: newtoken.accessJWT, daoSlug });
  const daos = await getDaoList({ token: newtoken.accessJWT });
  return (
    <div className="flex flex-grow w-full h-full">
      <MenuTop
        withLogo={true}
        navItems={[
          {
            label: 'Network',
            href: `/${lang}/network`,
          },
          {
            label: 'My Spaces',
            href: `/${lang}/my-spaces`,
          },
          {
            label: 'Wallet',
            href: `/${lang}/wallet`,
          },
        ]}
      >
        <MenuTop.RightSlot>
          <ButtonProfile
            avatarSrc="https://images.unsplash.com/photo-1544005313-94ddf0286df2?&w=64&h=64&dpr=2&q=70&crop=faces&fit=crop"
            userName="Jane Doe"
          />
        </MenuTop.RightSlot>
      </MenuTop>
      <div className="fixed bottom-0 right-0 flex-grow overflow-y-auto top-9 w-full bg-background/5">
        <Container>
          <div className="mb-6 flex items-center">
            <Link
              href={`/${lang}/my-spaces`}
              className="cursor-pointer flex items-center"
            >
              <ChevronLeftIcon width={16} height={16} />
              <Text className="text-sm">My Spaces</Text>
            </Link>
            <Text className="text-sm text-gray-400 ml-1"> / {dao.title}</Text>
          </div>
          <Card className="relative">
            <Image
              width={768}
              height={270}
              className="rounded-xl max-h-[270px] w-full object-cover"
              src={dao.logo}
              alt={dao.title}
            ></Image>
            <Avatar style={customLogoStyles} className="border-4">
              <AvatarImage src={dao.logo} alt="logo" />
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
            <Button
              disabled={alreadyMember}
              className="ml-2 rounded-lg"
              colorVariant={alreadyMember ? 'neutral' : 'accent'}
              variant={alreadyMember ? 'outline' : 'default'}
            >
              <PersonIcon className="mr-2" width={16} height={16} />
              {alreadyMember ? 'Already member' : 'Become member'}
            </Button>
          </div>
          <div className="mt-4">
            <Text className="text-7">{dao.title}</Text>
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
            <Text className="text-2">{dao.description}</Text>
          </div>
          <div className="flex flex-grow gap-2 items-center mt-6">
            <div className="flex">
              <div className="font-bold text-1">128</div>
              <div className="text-gray-500 ml-1 text-1">Members</div>
            </div>
            <div className="flex ml-3">
              <div className="font-bold text-1">58</div>
              <div className="text-gray-500 ml-1 text-1">
                Completed projects
              </div>
            </div>
          </div>
          {children}
          <div className="border-t-2 border-primary-foreground pt-6">
            <Text className="text-4 font-medium">Spaces you might like</Text>
            <Carousel className="my-6">
              <CarouselContent>
                {daos.map((dao) => (
                  <CarouselItem
                    key={dao.name}
                    className="mb-5 w-full sm:w-[454px] max-w-[454px] flex-shrink-0"
                  >
                    <Link
                      className="w-96"
                      href={getDhoPathAgreements(lang, dao.url as string)}
                    >
                      <CardOrganisation
                        createdDate={dao.date}
                        description={dao.description as string}
                        icon={dao.logo}
                        members={0}
                        agreements={0}
                        title={dao.title as string}
                      />
                    </Link>
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
          </div>
        </Container>
        <Footer />
      </div>
    </div>
  );
}
