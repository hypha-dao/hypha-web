'use client';

import { Locale } from '@hypha-platform/i18n';
import { getDhoPathGovernance } from '../../../../@tab/governance/constants';
import { useSpaceBySlug } from '@hypha-platform/core/client';
import { useParams } from 'next/navigation';
import { CreateSubspaceForm, SidePanel } from '@hypha-platform/epics';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default function CreateSubspacePage() {
  const { id: spaceSlug, lang } = useParams<{ id: string; lang: Locale }>();
  const { space } = useSpaceBySlug(spaceSlug);
  return (
    <SidePanel>
      <CreateSubspaceForm
        successfulUrl={getDhoPathGovernance(lang as Locale, spaceSlug)}
        parentSpaceId={space?.id}
      />
    </SidePanel>
  );
}
