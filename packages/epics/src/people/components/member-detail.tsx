'use client';

import { useMemo } from 'react';
import { MemberHead } from './member-head';
import {
  Skeleton,
  Button,
  Separator,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@hypha-platform/ui';
import { RxCross1 } from 'react-icons/rx';
import { ChevronDown, MessageSquare, Phone, Video } from 'lucide-react';
import Link from 'next/link';
import { MemberSpaces } from './member-spaces';
import { Address, Space, useMe } from '@hypha-platform/core/client';
import { Locale } from '@hypha-platform/i18n';
import { useTranslations } from 'next-intl';
import { useMemberDirectoryConnect } from './use-member-directory-connect';

type MemberType = {
  id?: number;
  avatarUrl?: string;
  name?: string;
  surname?: string;
  nickname?: string;
  status?: string;
  about?: string;
  slug?: string;
  address?: string;
};

export type MemberDetailProps = {
  lang: Locale;
  closeUrl: string;
  member: MemberType;
  isLoading: boolean;
  spaces: Space[];
};

export const MemberDetail = ({
  isLoading,
  lang,
  closeUrl,
  member,
  spaces,
}: MemberDetailProps) => {
  const tCommon = useTranslations('Common');
  const tHome = useTranslations('MemberHome');
  const { person: me } = useMe();
  const directoryPerson = useMemo(
    () =>
      member.id == null
        ? []
        : [
            {
              id: member.id,
              name: member.name,
              surname: member.surname,
              nickname: member.nickname,
            },
          ],
    [member.id, member.name, member.nickname, member.surname],
  );
  const { openChat, openCall, openVideo, notice } =
    useMemberDirectoryConnect(directoryPerson);
  const displayName =
    [member.name, member.surname].filter(Boolean).join(' ').trim() ||
    member.nickname ||
    tCommon('memberRoleLabel');
  const canConnect = !isLoading && member.id != null && member.id !== me?.id;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-5 justify-between">
        <MemberHead {...member} lang={lang} isLoading={isLoading} />
        <div className="flex shrink-0 items-start gap-2">
          {canConnect && directoryPerson[0] ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  colorVariant="neutral"
                  className="flex items-center"
                >
                  {tHome('connect')}
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => {
                    const person = directoryPerson[0];
                    if (!person) return;
                    void openChat(person);
                  }}
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  {tHome('chatPerson', { name: displayName })}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    const person = directoryPerson[0];
                    if (!person) return;
                    void openCall(person);
                  }}
                >
                  <Phone className="mr-2 h-4 w-4" />
                  {tHome('callPerson', { name: displayName })}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    const person = directoryPerson[0];
                    if (!person) return;
                    void openVideo(person);
                  }}
                >
                  <Video className="mr-2 h-4 w-4" />
                  {tHome('videoPerson', { name: displayName })}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          <Link href={closeUrl} scroll={false}>
            <Button
              variant="ghost"
              colorVariant="neutral"
              className="flex items-center"
            >
              {tCommon('close')}
              <RxCross1 className="ml-2" />
            </Button>
          </Link>
        </div>
      </div>
      {notice ? (
        <p className="text-1 text-error-11" role="alert">
          {notice}
        </p>
      ) : null}
      <Separator />
      <Skeleton
        width="100%"
        height="100px"
        loading={isLoading}
        className="rounded-lg"
      >
        <div className="text-2 text-neutral-11">{member.about}</div>
      </Skeleton>
      <Separator />
      <MemberSpaces
        spaces={spaces}
        personAddress={member.address as Address | undefined}
        personSlug={member.slug}
      />
      <Separator />
    </div>
  );
};
