'use client';

import { Text } from '@radix-ui/themes';
import { Button } from '@hypha-platform/ui';
import Link from 'next/link';
import { PlusIcon } from '@radix-ui/react-icons';
import { UseMembers } from '@hypha-platform/epics';
import { Space } from '@hypha-platform/core/client';
import { Locale } from '@hypha-platform/i18n';
import { InnerSpaceCardList } from './inner-space-card-list';

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
        <Text className="text-4">Spaces | {spaces.length}</Text>
        <div className="flex items-center">
          <Link href={`membership/space/create`} scroll={false}>
            <Button className="ml-2">
              <PlusIcon />
              Add Space
            </Button>
          </Link>
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
