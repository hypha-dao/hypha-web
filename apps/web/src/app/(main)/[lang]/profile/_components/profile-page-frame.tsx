'use client';

import type { ReactNode } from 'react';
import { Text } from '@radix-ui/themes';
import { Container } from '@hypha-platform/ui';
import {
  MemberSpacePageTitle,
  useMemberExperience,
} from '@hypha-platform/epics';
import { useTranslations } from 'next-intl';
import { ProfileBackLink } from '@web/components/profile-back-link';
import { MemberPageShell } from '../../_components/member-page-shell';

/**
 * Members: same title geometry as Messages (eyebrow + sentence) with a
 * top-right back control to the latest visited space.
 * Builders/funders: existing breadcrumb under Container.
 */
export function ProfilePageFrame({
  lang,
  children,
}: {
  lang: string;
  children: ReactNode;
}) {
  const { isMember } = useMemberExperience();
  const tProfile = useTranslations('Profile');

  if (isMember) {
    return (
      <div className="w-full min-w-0 overflow-x-clip">
        <MemberPageShell>
          <MemberSpacePageTitle
            title={tProfile('profilePage')}
            screen="profile"
            actions={<ProfileBackLink lang={lang} variant="action" />}
          />
          {children}
        </MemberPageShell>
      </div>
    );
  }

  return (
    <Container className="w-full">
      <div className="mb-6 flex w-full items-center">
        <ProfileBackLink lang={lang} />
        <Text className="ml-1 text-sm text-neutral-11">
          / {tProfile('profilePage')}
        </Text>
      </div>
      {children}
    </Container>
  );
}
