'use client';

import { type Space, isSpaceArchived } from '@hypha-platform/core/client';
import { SubspaceSection } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { useMembers } from '@web/hooks/use-members';
import { useMemo } from 'react';

interface SubspaceSectionWrapperProps {
  lang: Locale;
  spaces: Space[];
  currentSpaceId: number;
  currentSpaceWeb3Id?: number;
  currentSpaceSlug?: string;
}

export const SubspaceSectionWrapper = ({
  lang,
  spaces,
  currentSpaceId,
  currentSpaceWeb3Id,
  currentSpaceSlug,
}: SubspaceSectionWrapperProps) => {
  const nonArchivedSpaces = useMemo(
    () => spaces.filter((s) => !isSpaceArchived(s)),
    [spaces],
  );

  return (
    <SubspaceSection
      spaces={nonArchivedSpaces}
      lang={lang}
      currentSpaceId={currentSpaceId}
      currentSpaceWeb3Id={currentSpaceWeb3Id}
      currentSpaceSlug={currentSpaceSlug}
      useMembers={useMembers}
    />
  );
};
