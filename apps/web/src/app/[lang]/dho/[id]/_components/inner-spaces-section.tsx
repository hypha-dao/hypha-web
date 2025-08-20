'use client';

import { Space } from '@hypha-platform/core/client';
import { SubspaceSection } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { useMembers } from '@web/hooks/use-members';
import { getDhoPathGovernance } from '../@tab/governance/constants';

interface InnerSpacesSectionProps {
  spaces: Space[];
  lang: Locale;
}

export function InnerSpacesSection({ spaces, lang }: InnerSpacesSectionProps) {
  return (
    <SubspaceSection
      spaces={spaces}
      lang={lang}
      getSpaceDetailLink={getDhoPathGovernance}
      useMembers={useMembers}
    />
  );
}
