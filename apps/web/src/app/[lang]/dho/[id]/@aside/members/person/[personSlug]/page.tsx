'use client';

import { useCallback, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

import {
  DelegateVotingSection,
  type DelegateVotingSectionHandle,
  MemberDetail,
  MemberPageParams,
  SidePanel,
  useMemberWeb3SpaceIds,
} from '@hypha-platform/epics';
import { useIsDelegate } from '@hypha-platform/core/client';

import { useMemberBySlug } from '@web/hooks/use-member-by-slug';
import { getDhoPathMembers } from '../../../../@tab/members/constants';
import {
  useSpacesByWeb3Ids,
  useSpaceBySlug,
} from '@hypha-platform/core/client';
import { useMembers } from '@web/hooks/use-members';
import { tryDecodeUriPart } from '@hypha-platform/ui-utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';

export default function Member() {
  const router = useRouter();
  const { id, lang, personSlug: personSlugRaw } = useParams<MemberPageParams>();
  const personSlug = tryDecodeUriPart(personSlugRaw);
  const { person, isLoading: isLoadingPersons } = useMemberBySlug(personSlug);
  const { web3SpaceIds, isLoading: isLoadingSpaces } = useMemberWeb3SpaceIds({
    personAddress: person?.address,
  });
  const { spaces } = useSpacesByWeb3Ids(web3SpaceIds ?? []);
  const { space } = useSpaceBySlug(id);
  const { isDelegate } = useIsDelegate({
    spaceId: space?.web3SpaceId as number,
    userAddress: person?.address as `0x${string}`,
  });
  const tMembersTab = useTranslations('MembersTab');

  const membersListPath = getDhoPathMembers(lang, id);
  const delegateSectionRef = useRef<DelegateVotingSectionHandle>(null);
  const [unsavedOpen, setUnsavedOpen] = useState(false);
  const [pendingLeavePath, setPendingLeavePath] = useState<string | null>(null);
  const [isSavingAndLeaving, setIsSavingAndLeaving] = useState(false);

  const navigateToMembersList = useCallback(() => {
    router.push(membersListPath);
  }, [router, membersListPath]);

  const handleCloseRequest = useCallback(() => {
    if (delegateSectionRef.current?.getIsDirty() === true) {
      setPendingLeavePath(membersListPath);
      setUnsavedOpen(true);
      return;
    }
    navigateToMembersList();
  }, [membersListPath, navigateToMembersList]);

  const handleDiscardAndLeave = useCallback(() => {
    delegateSectionRef.current?.resetDirtyBaseline();
    setUnsavedOpen(false);
    setPendingLeavePath(null);
    if (pendingLeavePath) {
      router.push(pendingLeavePath);
    }
  }, [pendingLeavePath, router]);

  const handleSaveAndLeave = useCallback(async () => {
    setIsSavingAndLeaving(true);
    try {
      const ok = await delegateSectionRef.current?.submitPersist();
      if (ok === true && pendingLeavePath) {
        setUnsavedOpen(false);
        router.push(pendingLeavePath);
        setPendingLeavePath(null);
      }
    } finally {
      setIsSavingAndLeaving(false);
    }
  }, [pendingLeavePath, router]);

  return (
    <SidePanel>
      <div className="flex flex-col gap-5">
        <MemberDetail
          closeUrl={membersListPath}
          onCloseRequest={handleCloseRequest}
          closeDisabled={isSavingAndLeaving}
          member={{
            avatarUrl: person?.avatarUrl,
            name: person?.name,
            surname: person?.surname,
            nickname: person?.nickname,
            status: 'active', // TODO: get status
            about: person?.description,
            slug: person?.slug,
            address: person?.address,
          }}
          isLoading={isLoadingPersons || isLoadingSpaces}
          lang={lang}
          spaces={spaces}
        />
        {!isDelegate && (
          <DelegateVotingSection
            ref={delegateSectionRef}
            web3SpaceId={space?.web3SpaceId as number}
            useMembers={useMembers}
            spaceSlug={id}
          />
        )}
      </div>

      <AlertDialog
        open={unsavedOpen}
        onOpenChange={(open) => {
          if (!open && !isSavingAndLeaving) {
            setUnsavedOpen(false);
            setPendingLeavePath(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="m-0 text-[17px] font-medium text-mauve12 text-card-foreground">
              {tMembersTab('memberDetail.unsavedChangesModal.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {tMembersTab('memberDetail.unsavedChangesModal.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-row justify-end gap-[25px] sm:space-x-0">
            <AlertDialogCancel asChild>
              <Button
                type="button"
                variant="outline"
                colorVariant="neutral"
                disabled={isSavingAndLeaving}
                onClick={handleDiscardAndLeave}
              >
                {tMembersTab('memberDetail.unsavedChangesModal.discard')}
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                type="button"
                variant="outline"
                colorVariant="neutral"
                disabled={isSavingAndLeaving}
                onClick={(e) => {
                  e.preventDefault();
                  void handleSaveAndLeave();
                }}
              >
                {isSavingAndLeaving
                  ? tMembersTab('memberDetail.unsavedChangesModal.saving')
                  : tMembersTab('memberDetail.unsavedChangesModal.save')}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidePanel>
  );
}
