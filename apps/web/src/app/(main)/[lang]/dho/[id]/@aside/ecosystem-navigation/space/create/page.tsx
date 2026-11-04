'use client';

import {
  CreateSubspaceForm,
  ProposalOverlayShell,
  SpaceMemberAsideGuard,
} from '@hypha-platform/epics';
import { useSpaceBySlug } from '@hypha-platform/core/client';
import { LoadingBackdrop } from '@hypha-platform/ui/server';
import { useParams, usePathname } from 'next/navigation';
import { PATH_SELECT_SETTINGS_ACTION } from '@web/app/constants';
import { useTranslations } from 'next-intl';

export default function CreateSubspacePage() {
  const { id: spaceSlug } = useParams<{ id: string }>();
  const pathname = usePathname();
  const { space, isLoading } = useSpaceBySlug(spaceSlug);
  const tAgreementFlow = useTranslations('AgreementFlow');
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

  if (isLoading || !space) {
    return (
      <ProposalOverlayShell>
        <LoadingBackdrop
          showKeepWindowOpenMessage={true}
          keepWindowOpenMessage={tAgreementFlow(
            'loadingBackdrop.keepWindowOpen',
          )}
          fullHeight={true}
          progress={0}
          isLoading={true}
          message={<></>}
        >
          <div />
        </LoadingBackdrop>
      </ProposalOverlayShell>
    );
  }

  return (
    <ProposalOverlayShell>
      <SpaceMemberAsideGuard spaceSlug={spaceSlug ?? ''} space={space}>
        <CreateSubspaceForm
          successfulUrl={successfulUrl}
          backUrl={`${successfulUrl}${PATH_SELECT_SETTINGS_ACTION}`}
          parentSpaceId={space.id}
          parentSpaceSlug={space.slug}
        />
      </SpaceMemberAsideGuard>
    </ProposalOverlayShell>
  );
}
