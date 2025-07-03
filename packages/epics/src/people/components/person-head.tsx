'use client';

import { Text } from '@radix-ui/themes';
import {
  Image,
  Card,
  Avatar,
  AvatarImage,
  Button,
  Skeleton,
} from '@hypha-platform/ui';
import { CopyIcon } from '@radix-ui/react-icons';
import { WebLinks } from '../../common';
import { RxDownload, RxPencil2 } from 'react-icons/rx';
import { MailIcon, MapPinIcon } from 'lucide-react';
import Link from 'next/link';

export type MemberType = {
  avatar: string;
  name: string;
  surname: string;
};

interface PersonHeadProps {
  isLoading?: boolean;
  about: string;
  background: string;
  links: string[];
  location: string;
  email: string;
  onExportEmbeededWallet?: () => void;
}

export const PersonHead = ({
  isLoading = false,
  avatar = '/placeholder/space-avatar-image.png',
  name,
  surname,
  about,
  background,
  links,
  location,
  email,
  onExportEmbeededWallet,
}: PersonHeadProps & MemberType) => {
  const customLogoStyles: React.CSSProperties = {
    width: '128px',
    height: '128px',
    position: 'absolute',
    bottom: '-35px',
    left: '15px',
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className="relative">
        <Skeleton height={270} width={768} loading={isLoading}>
          <Image
            width={768}
            height={270}
            className="rounded-xl max-h-[270px] min-h-[270px] w-full object-cover"
            src={background || '/placeholder/space-lead-image.png'}
            alt={`Profile Lead Image: ${name} ${surname}`}
          />
        </Skeleton>
        <Avatar style={customLogoStyles}>
          <Skeleton loading={isLoading} width={128} height={128}>
            <AvatarImage
              src={avatar || '/placeholder/space-avatar-image.png'}
              alt={`Profile Avatar Image: ${name} ${surname}`}
            />
          </Skeleton>
        </Avatar>
      </Card>
      <div className="flex flex-col gap-4">
        <div className="flex justify-end gap-2">
          {onExportEmbeededWallet ? (
            <Skeleton loading={isLoading} width={120} height={35}>
              <Button variant="ghost" onClick={onExportEmbeededWallet}>
                <RxDownload />
                Export Keys
              </Button>
            </Skeleton>
          ) : null}
          <Skeleton loading={isLoading} width={120} height={35}>
            <Button variant="outline" colorVariant="accent">
              <CopyIcon />
              Copy user ID
            </Button>
          </Skeleton>
          <Skeleton loading={isLoading} width={120} height={35}>
            <Button asChild colorVariant="accent">
              <Link href={`/profile/edit`} scroll={false}>
                <RxPencil2 />
                Edit profile
              </Link>
            </Button>
          </Skeleton>
        </div>
        <Skeleton loading={isLoading} width={180} height={32}>
          <Text className="text-7">
            {name} {surname}
          </Text>
        </Skeleton>
        <div className="flex flex-col gap-7">
          <div className="flex flex-col gap-4">
            <WebLinks links={links} />
            <div className="flex gap-5 text-1">
              <span className="flex gap-3">
                <MailIcon width={16} height={16} />
                {email}
              </span>
              <span className="flex gap-3">
                <MapPinIcon width={16} height={16} />
                {location}
              </span>
            </div>
          </div>
          <Skeleton loading={isLoading} height={72} width={768}>
            <Text className="text-2">{about}</Text>
          </Skeleton>
        </div>
      </div>
    </div>
  );
};
