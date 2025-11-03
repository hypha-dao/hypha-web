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
import { WebLinks } from '../../common';
import { RxPencil2 } from 'react-icons/rx';
import { MailIcon, MapPinIcon } from 'lucide-react';
import Link from 'next/link';
import { useAuthentication } from '@hypha-platform/authentication';
import React from 'react';
import {
  ButtonCopyUserId,
  ExportEmbeddedWalletButton,
  ProfileComponentParams,
} from '@hypha-platform/epics';
import {
  DEFAULT_SPACE_AVATAR_IMAGE,
  DEFAULT_SPACE_LEAD_IMAGE,
  useMe,
} from '@hypha-platform/core/client';
import { useParams } from 'next/navigation';
import { formatDate, tryDecodeUriPart } from '@hypha-platform/ui-utils';

export type MemberType = {
  avatar: string;
  name: string;
  surname: string;
  slug: string;
  createdAt: Date;
};

interface PersonHeadProps {
  isLoading?: boolean;
  about: string;
  background: string;
  links: string[];
  location: string;
  email: string;
  onExportEmbeddedWallet?: () => void;
  exportEmbeddedWallet?: boolean;
}

export const PersonHead = ({
  isLoading = false,
  avatar = DEFAULT_SPACE_AVATAR_IMAGE,
  name,
  surname,
  slug,
  createdAt,
  about,
  background,
  links,
  location,
  email,
  onExportEmbeddedWallet,
  exportEmbeddedWallet,
}: PersonHeadProps & MemberType) => {
  const { exportWallet, isEmbeddedWallet } = useAuthentication();
  const { isMe } = useMe();
  const { lang, personSlug: personSlugRaw } =
    useParams<ProfileComponentParams>();
  const personSlug = tryDecodeUriPart(personSlugRaw);

  const signupDate = createdAt ? formatDate(createdAt, true) : null;

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
            src={background || DEFAULT_SPACE_LEAD_IMAGE}
            alt={`Profile Lead Image: ${name} ${surname}`}
          />
        </Skeleton>
        <Avatar style={customLogoStyles}>
          <Skeleton loading={isLoading} width={128} height={128}>
            <AvatarImage
              src={avatar || DEFAULT_SPACE_AVATAR_IMAGE}
              alt={`Profile Avatar Image: ${name} ${surname}`}
            />
          </Skeleton>
        </Avatar>
      </Card>
      <div className="flex flex-col gap-4">
        <div className="flex justify-end gap-2">
          {isMe(slug) && (
            <ExportEmbeddedWalletButton
              isLoading={isLoading}
              isEmbeddedWallet={isEmbeddedWallet || !!onExportEmbeddedWallet}
              onExportEmbeddedWallet={
                exportEmbeddedWallet && isEmbeddedWallet
                  ? exportWallet
                  : onExportEmbeddedWallet
              }
            />
          )}
          <ButtonCopyUserId
            title="Copy user ID"
            slug={slug}
            isLoading={isLoading}
          />
          <Skeleton loading={isLoading} width={120} height={35}>
            <Link
              href={
                isMe(personSlug) ? `/${lang}/profile/${personSlug}/edit` : {}
              }
              scroll={false}
            >
              <Button colorVariant="accent" disabled={!isMe(personSlug)}>
                <RxPencil2 />
                Edit profile
              </Button>
            </Link>
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
              {signupDate ? (
                <span className="flex gap-3">
                  Hypha member since {signupDate}
                </span>
              ) : null}
              {email && isMe(personSlug) ? (
                <span className="flex gap-3">
                  <MailIcon width={16} height={16} />
                  {email}
                </span>
              ) : null}
              {location ? (
                <span className="flex gap-3">
                  <MapPinIcon width={16} height={16} />
                  {location}
                </span>
              ) : null}
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
