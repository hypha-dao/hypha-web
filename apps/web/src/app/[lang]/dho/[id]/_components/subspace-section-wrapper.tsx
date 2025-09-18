'use client';

import type { Space } from '@hypha-platform/core/client';
import { SubspaceSection } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { useMembers } from '@web/hooks/use-members';

interface SubspaceSectionWrapperProps {
  lang: Locale;
  spaces: Space[];
  currentSpaceId: number;
}

export const SubspaceSectionWrapper = ({
  lang,
  spaces,
  currentSpaceId,
}: SubspaceSectionWrapperProps) => (
  <SubspaceSection
    spaces={spaces}
    lang={lang}
    currentSpaceId={currentSpaceId}
    useMembers={useMembers}
  />
);
