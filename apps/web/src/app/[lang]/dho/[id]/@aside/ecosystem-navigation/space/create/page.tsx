'use client';

import {
  CreateSubspaceForm,
  ProposalOverlayShell,
} from '@hypha-platform/epics';
import { useSpaceBySlug } from '@hypha-platform/core/client';
import { useParams, usePathname } from 'next/navigation';
import { PATH_SELECT_SETTINGS_ACTION } from '@web/app/constants';

export default function CreateSubspacePage() {
  const { id: spaceSlug } = useParams<{ id: string }>();
  const pathname = usePathname();
  const { space } = useSpaceBySlug(spaceSlug);
  const successfulUrl = (() => {
    const segment = '/space/create';
    if (pathname.endsWith(segment)) {
      return pathname.slice(0, -segment.length) || '/';
    }
    if (pathname.endsWith(`${segment}/`)) {
      return pathname.slice(0, -(segment.length + 1)) || '/';
    }
    if (pathname.includes(`${segment}/`)) {
      return pathname.replace(`${segment}/`, '/');
    }
    return pathname.replace(segment, '') || '/';
  })();

  return (
    <ProposalOverlayShell>
      <CreateSubspaceForm
        successfulUrl={successfulUrl}
        backUrl={`${successfulUrl}${PATH_SELECT_SETTINGS_ACTION}`}
        parentSpaceId={space?.id ?? null}
        parentSpaceSlug={space?.slug ?? ''}
      />
    </ProposalOverlayShell>
  );
}
