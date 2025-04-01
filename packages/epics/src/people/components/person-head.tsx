import { MemberType } from '@hypha-platform/graphql/rsc';
import { Text } from '@radix-ui/themes';
import {
  Image,
  Card,
  Avatar,
  AvatarImage,
  Button,
  Skeleton,
} from '@hypha-platform/ui';
import {
  Share2Icon,
  CopyIcon,
  Pencil1Icon,
  LinkedInLogoIcon,
  Link2Icon,
} from '@radix-ui/react-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXTwitter } from '@fortawesome/free-brands-svg-icons';

export interface Socials {
  LinkedIn: string;
  X: string;
  Website: string;
}

interface PersonHeadProps {
  isLoading?: boolean;
  about: string;
  background: string;
  socials: Socials;
}

export const PersonHead = ({
  isLoading = false,
  avatar = '/placeholder/space-avatar-image.png',
  name,
  surname,
  about,
  background = '/placeholder/space-lead-image.png',
  socials,
}: PersonHeadProps & MemberType) => {
  const customLogoStyles: React.CSSProperties = {
    width: '128px',
    height: '128px',
    position: 'absolute',
    bottom: '-35px',
    left: '15px',
  };

  return (
    <div className="flex flex-col">
      <Card className="relative">
        <Skeleton height={270} width={768} loading={isLoading}>
          <Image
            width={768}
            height={270}
            className="rounded-xl max-h-[270px] w-full object-cover"
            src={background}
            alt={`Profile Lead Image: ${name} ${surname}`}
          />
        </Skeleton>
        <Avatar style={customLogoStyles}>
          <Skeleton loading={isLoading} width={128} height={128}>
            <AvatarImage
              src={avatar}
              alt={`Profile Avatar Image: ${name} ${surname}`}
            />
          </Skeleton>
        </Avatar>
      </Card>
      <div className="flex justify-end mt-2">
        <Skeleton loading={isLoading} height={28} width={28}>
          <Button
            asChild
            variant="ghost"
            colorVariant="neutral"
            className="rounded-lg justify-start p-1 cursor-pointer"
          >
            <Share2Icon width={28} height={28} />
          </Button>
        </Skeleton>
        <Skeleton className="ml-2" loading={isLoading} width={120} height={35}>
          <Button
            asChild
            variant="ghost"
            colorVariant="accent"
            className="rounded-lg justify-start cursor-pointer ml-2 bg-accent-3"
          >
            <div>
              <Pencil1Icon className="mr-2" width={16} height={16} />
              Edit profile
            </div>
          </Button>
        </Skeleton>
        <Skeleton className="ml-2" loading={isLoading} width={120} height={35}>
          <Button
            asChild
            variant="default"
            colorVariant="accent"
            className="rounded-lg justify-start cursor-pointer ml-2"
          >
            <div>
              <CopyIcon className="mr-2" width={16} height={16} />
              Copy user ID
            </div>
          </Button>
        </Skeleton>
      </div>
      <div className="mt-4">
        <Skeleton loading={isLoading} width={180} height={32}>
          <Text className="text-7">
            {name} {surname}
          </Text>
        </Skeleton>
      </div>
      <div className="flex gap-6 mt-2">
        <Skeleton loading={isLoading} width={120} height={35}>
          <Button
            asChild
            variant="ghost"
            className="rounded-lg justify-start text-neutral-11 px-0 cursor-pointer"
          >
            <div>
              <LinkedInLogoIcon width={16} height={16} />
              <Text className="ml-1 text-1">{socials.LinkedIn}</Text>
            </div>
          </Button>
        </Skeleton>
        <Skeleton className="ml-2" loading={isLoading} width={120} height={35}>
          <Button
            asChild
            variant="ghost"
            className="rounded-lg justify-start text-neutral-11 px-0 cursor-pointer"
          >
            <div>
              <FontAwesomeIcon
                className="w-4"
                color="bg-primary-foreground"
                icon={faXTwitter}
              />
              <Text className="ml-1 text-1">{socials.X}</Text>
            </div>
          </Button>
        </Skeleton>
        <Skeleton className="ml-2" loading={isLoading} width={120} height={35}>
          <Button
            asChild
            variant="ghost"
            className="rounded-lg justify-start text-neutral-11 px-0 cursor-pointer"
          >
            <div>
              <Link2Icon width={16} height={16} />
              <Text className="ml-1 text-1">{socials.Website}</Text>
            </div>
          </Button>
        </Skeleton>
      </div>
      <div className="mt-6">
        <Skeleton loading={isLoading} height={72} width={768}>
          <Text className="text-2">{about}</Text>
        </Skeleton>
      </div>
    </div>
  );
};
