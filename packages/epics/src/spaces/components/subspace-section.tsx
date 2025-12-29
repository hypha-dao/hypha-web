'use client';

import { Text } from '@radix-ui/themes';
import { PlusIcon } from '@radix-ui/react-icons';
import type { Space } from '@hypha-platform/core/client';
import type { Locale } from '@hypha-platform/i18n';
import { InnerSpaceCardList } from './inner-space-card-list';
import { AuthenticatedLinkButton } from '../../common';
import type { UseMembers } from '../hooks';

interface SubspaceSectionProps {
  spaces: Space[];
  lang: Locale;
  currentSpaceId: number;
  useMembers: UseMembers;
}

export const SubspaceSection = ({
  spaces,
  lang,
  currentSpaceId,
  useMembers,
}: SubspaceSectionProps) => {
  return (
    <div className="flex flex-col gap-4">
      <div className="justify-between items-center flex">
        <Text className="text-4">Organisation Spaces | {spaces.length}</Text>
        <div className="flex items-center">
          <AuthenticatedLinkButton href="#">
            <PlusIcon />
            Add Space (Under Maintenance)
          </AuthenticatedLinkButton>
        </div>
      </div>
      {!spaces.length ? (
        <span className="text-2 text-center text-neutral-11"> No spaces</span>
      ) : (
        <InnerSpaceCardList
          lang={lang}
          spaces={spaces}
          pageSize={15}
          currentSpaceId={currentSpaceId}
          useMembers={useMembers}
        />
      )}
    </div>
  );
};
