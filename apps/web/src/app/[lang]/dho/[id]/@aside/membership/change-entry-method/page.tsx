'use client';

import { ChangeEntryMethodForm, SidePanel } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { getDhoPathGovernance } from '../../../@tab/governance/constants';
import { useSpaceBySlug } from '@hypha-platform/core/client';
import { useParams } from 'next/navigation';

export default function ChangeEntryMethodPage() {
  const { id: spaceSlug, lang } = useParams<{ id: string; lang: Locale }>();
  const { space } = useSpaceBySlug(spaceSlug);

  return (
    <SidePanel>
      <ChangeEntryMethodForm
        successfulUrl={getDhoPathGovernance(lang as Locale, spaceSlug)}
      />
    </SidePanel>
  );
}
