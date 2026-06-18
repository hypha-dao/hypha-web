'use client';

import { Text } from '@radix-ui/themes';
import { PlusIcon } from '@radix-ui/react-icons';
import type { Space } from '@hypha-platform/core/client';
import type { Locale } from '@hypha-platform/i18n';
import { InnerSpaceCardList } from './inner-space-card-list';
import { Button } from '@hypha-platform/ui';
import type { UseMembers } from '../hooks';
import { useCanMutateInSpace } from '../hooks/use-can-mutate-in-space.web3.rpc';
import Link from 'next/link';

interface SubspaceSectionProps {
  spaces: Space[];
  lang: Locale;
  currentSpaceId: number;
  currentSpaceWeb3Id?: number;
  currentSpaceSlug?: string;
  useMembers: UseMembers;
}

export const SubspaceSection = ({
  spaces,
  lang,
  currentSpaceId,
  currentSpaceWeb3Id,
  currentSpaceSlug,
  useMembers,
}: SubspaceSectionProps) => {
  const { canMutate, isLoading } = useCanMutateInSpace({
    spaceId: currentSpaceWeb3Id,
    spaceSlug: currentSpaceSlug,
  });
  const isDisabled = isLoading || !canMutate;

  return (
    <div className="flex flex-col gap-4">
      <div className="justify-between items-center flex">
        <Text className="text-4">Organisation Spaces | {spaces.length}</Text>
        <div className="flex items-center">
          <Link
            href={canMutate && !isLoading ? 'space/create' : '#'}
            className={isDisabled ? 'cursor-not-allowed' : ''}
            title={
              isLoading
                ? 'Loading...'
                : !canMutate
                ? 'You must be a space member to add spaces to this organization.'
                : 'Add Space'
            }
          >
            <Button
              variant="default"
              size="default"
              colorVariant="accent"
              disabled={isDisabled}
            >
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
