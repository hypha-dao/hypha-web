'use client';

import { CreateSubspaceForm, SidePanel } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { useSpaceBySlug } from '@hypha-platform/core/client';
import { useParams } from 'next/navigation';
import { PATH_SELECT_SETTINGS_ACTION } from '@web/app/constants';
import { getDhoPathMembership } from '../../../../@tab/membership/constants';

export default function CreateSubspacePage() {
  const { id: spaceSlug, lang } = useParams<{ id: string; lang: Locale }>();
  const { space } = useSpaceBySlug(spaceSlug);
  const successfulUrl = getDhoPathMembership(lang as Locale, spaceSlug);

  return (
    <SidePanel>
      <CreateSubspaceForm
        successfulUrl={successfulUrl}
        backUrl={`${successfulUrl}${PATH_SELECT_SETTINGS_ACTION}`}
        parentSpaceId={space?.id ?? null}
      />
    </SidePanel>
  );
}
