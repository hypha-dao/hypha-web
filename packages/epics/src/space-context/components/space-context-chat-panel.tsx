'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import {
  headingForSectionKey,
  HYPHA_ROOM_TYPES,
  specialistForSectionKey,
  useMatrix,
  useSpaceBySlug,
  type SpaceContextSectionKey,
  type SpaceContextSectionRecord,
} from '@hypha-platform/core/client';
import type { Locale } from '@hypha-platform/i18n';
import { Button, SidebarContent, SidebarHeader } from '@hypha-platform/ui';
import { X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getProposalPath } from '../../common/get-path-function';
import { HumanChatPanelHeader } from '../../common/human-chat-panel/human-chat-panel-header';
import { MatrixDiscussionThread } from '../../common/matrix-discussion-thread';
import { useCanMutateInSpace } from '../../spaces/hooks/use-can-mutate-in-space.web3.rpc';
import {
  discardSpaceContextSuggestionRequest,
  revalidateSpaceContext,
  setSpaceContextRemovalSuggestedRequest,
  storeSpaceContextChatRoomRequest,
  useSpaceContextSection,
} from '../hooks/use-space-context';
import { spaceContextProposeHref } from './propose-href';
import { sectionNotice } from './space-context-card';
import { SpaceContextDraftDialog } from './space-context-dialogs';
import {
  SpaceContextChangeBadge,
  SpaceContextStatusChip,
} from './space-context-status-chip';

function useSectionTitle(
  spaceSlug: string,
  sectionKey: SpaceContextSectionKey,
): string {
  const { detail } = useSpaceContextSection(spaceSlug, sectionKey);
  return detail?.section.sectionKey === sectionKey
    ? detail.section.title
    : headingForSectionKey(sectionKey);
}

/** A Context section inside the shared right panel, where signals and chats open. */
export function SpaceContextSidePanel({
  spaceSlug,
  sectionKey,
  onClose,
}: {
  spaceSlug: string;
  sectionKey: SpaceContextSectionKey;
  onClose: () => void;
}) {
  const locale = useLocale();
  const router = useRouter();
  const { space } = useSpaceBySlug(spaceSlug);
  const { canMutate } = useCanMutateInSpace({ spaceSlug, space });
  const sectionTitle = useSectionTitle(spaceSlug, sectionKey);

  return (
    <>
      <SidebarHeader className="gap-0 bg-page-background p-0 dark:bg-background-2">
        <HumanChatPanelHeader title={sectionTitle} onBack={onClose} />
      </SidebarHeader>
      <SidebarContent className="flex min-h-0 flex-col gap-0 overflow-y-auto bg-page-background dark:bg-background-2">
        <SpaceContextSectionBody
          spaceSlug={spaceSlug}
          spaceTitle={space?.title}
          sectionKey={sectionKey}
          canMutate={canMutate}
          onClose={onClose}
          onPropose={(keys) =>
            router.push(spaceContextProposeHref(locale, spaceSlug, keys))
          }
        />
      </SidebarContent>
    </>
  );
}

/** Same section panel beside the cards, for layouts without the right panel. */
export function SpaceContextChatPanel({
  spaceSlug,
  spaceTitle,
  sectionKey,
  canMutate,
  onClose,
  onPropose,
}: {
  spaceSlug: string;
  spaceTitle?: string;
  sectionKey: SpaceContextSectionKey;
  canMutate: boolean;
  onClose: () => void;
  onPropose: (keys: SpaceContextSectionKey[]) => void;
}) {
  const t = useTranslations('SpaceContext');
  const sectionTitle = useSectionTitle(spaceSlug, sectionKey);

  return (
    <aside className="flex h-full min-h-[40rem] w-full flex-col border border-border/70 bg-background-2 xl:w-[28rem] xl:shrink-0">
      <header className="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-11">
            {t('chat.title')}
          </p>
          <h2 className="mt-1 truncate text-3 font-medium">{sectionTitle}</h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          colorVariant="neutral"
          size="icon"
          aria-label={t('chat.close')}
          onClick={onClose}
        >
          <X className="size-4" strokeWidth={1.25} />
        </Button>
      </header>
      <SpaceContextSectionBody
        spaceSlug={spaceSlug}
        spaceTitle={spaceTitle}
        sectionKey={sectionKey}
        canMutate={canMutate}
        onClose={onClose}
        onPropose={onPropose}
      />
    </aside>
  );
}

function SpaceContextSectionBody({
  spaceSlug,
  spaceTitle,
  sectionKey,
  canMutate,
  onClose,
  onPropose,
}: {
  spaceSlug: string;
  spaceTitle?: string;
  sectionKey: SpaceContextSectionKey;
  canMutate: boolean;
  onClose: () => void;
  onPropose: (keys: SpaceContextSectionKey[]) => void;
}) {
  const t = useTranslations('SpaceContext');
  const tCoherence = useTranslations('CoherenceTab');
  const { getAccessToken } = useAuthentication();
  const { isMatrixAvailable } = useMatrix();
  const { detail, isLoading, error, refresh } = useSpaceContextSection(
    spaceSlug,
    sectionKey,
  );
  const specialist = specialistForSectionKey(sectionKey);
  const sectionTitle =
    detail?.section.sectionKey === sectionKey
      ? detail.section.title
      : headingForSectionKey(sectionKey);
  const [draftOpen, setDraftOpen] = useState(false);

  useEffect(() => {
    setDraftOpen(false);
  }, [sectionKey]);

  const persistRoomId = useCallback(
    (roomId: string) =>
      storeSpaceContextChatRoomRequest({
        spaceSlug,
        sectionKey,
        chatRoomId: roomId,
        getAccessToken,
      }),
    [getAccessToken, sectionKey, spaceSlug],
  );

  const agent = useMemo(
    () => ({
      label: specialist.agentName,
      skills: (['review', 'refine', 'draft', 'fromSource'] as const).map(
        (id) => ({
          id,
          prompt: t(`chat.skills.${id}`, { section: sectionTitle }),
        }),
      ),
    }),
    [specialist.agentName, sectionTitle, t],
  );
  const agentContext = useMemo(
    () => ({ kind: 'space_context' as const, sectionKey }),
    [sectionKey],
  );

  const handleAgentMessage = useCallback(() => {
    void refresh();
  }, [refresh]);

  const section =
    detail?.section.sectionKey === sectionKey ? detail.section : undefined;
  const onVoting = section?.status === 'proposed';
  const canPropose =
    canMutate &&
    !!section &&
    !onVoting &&
    (section.status !== 'ratified' ||
      section.hasDraftChanges ||
      section.pendingChange != null);

  return (
    <>
      {section ? (
        <SectionInfo
          section={section}
          spaceSlug={spaceSlug}
          canMutate={canMutate}
          onWithdrawn={onClose}
        />
      ) : null}

      <div className="space-y-3 border-b border-border/70 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">
            {t('chat.draftLabel')}
          </p>
          <Button
            type="button"
            variant="outline"
            colorVariant="neutral"
            className="h-8 px-2"
            disabled={!section}
            onClick={() => setDraftOpen(true)}
          >
            {t('chat.showDraft')}
          </Button>
        </div>
        {canPropose ? (
          <Button
            type="button"
            disabled={
              !section.markdown.trim() && section.pendingChange !== 'remove'
            }
            onClick={() => onPropose([sectionKey])}
          >
            {t('chat.propose')}
          </Button>
        ) : null}
      </div>
      {section ? (
        <SpaceContextDraftDialog
          open={draftOpen}
          onOpenChange={setDraftOpen}
          spaceSlug={spaceSlug}
          sectionKey={sectionKey}
          sectionTitle={sectionTitle}
          markdown={section.markdown}
          canEdit={canMutate}
          onVoting={onVoting}
        />
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-3">
        {error ? (
          <p className="text-2 text-neutral-11">{t('chat.loadError')}</p>
        ) : !canMutate ? (
          <p className="text-2 text-neutral-11">{t('chat.membersOnly')}</p>
        ) : !isMatrixAvailable ? (
          <p className="text-2 text-neutral-11">{t('chat.signInHint')}</p>
        ) : isLoading || !detail ? (
          <p className="text-2 text-neutral-11">{t('chat.connecting')}</p>
        ) : (
          <MatrixDiscussionThread
            key={`${spaceSlug}:${sectionKey}`}
            threadKey={`${spaceSlug}:${sectionKey}`}
            initialChatRoomId={detail.section.chatRoomId}
            chatRoomResolved
            roomTitle={t('chat.roomTitle', {
              section: sectionTitle,
              space: spaceTitle?.trim() || spaceSlug,
            })}
            roomType={HYPHA_ROOM_TYPES.context}
            persistRoomId={persistRoomId}
            spaceSlug={spaceSlug}
            agent={agent}
            agentContext={agentContext}
            onAgentMessage={handleAgentMessage}
            placeholder={tCoherence('saySomething')}
            connectingLabel={t('chat.connecting')}
            unavailableLabel={t('chat.unavailable')}
            logLabel="SpaceContextChatPanel"
            messagesClassName="flex min-h-[14rem] flex-1 flex-col"
          />
        )}
      </div>
    </>
  );
}

/** Suggested additions or removals, and the proposal link while on voting. */
function SectionInfo({
  section,
  spaceSlug,
  canMutate,
  onWithdrawn,
}: {
  section: SpaceContextSectionRecord;
  spaceSlug: string;
  canMutate: boolean;
  onWithdrawn: () => void;
}) {
  const t = useTranslations('SpaceContext');
  const locale = useLocale() as Locale;
  const { getAccessToken } = useAuthentication();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const notice = sectionNotice(section, t);
  const onVoting = section.status === 'proposed';
  const showStatus = section.status !== 'ratified';
  const proposalHref =
    onVoting && section.proposalSlug
      ? getProposalPath(locale, spaceSlug, section.proposalSlug)
      : null;
  const canSuggestRemoval =
    canMutate && !onVoting && section.pendingChange !== 'add';
  const canWithdrawAddition =
    canMutate && !onVoting && section.pendingChange === 'add';

  const run = async (action: () => Promise<unknown>, done: string) => {
    setActionError(null);
    setMessage(null);
    setBusy(true);
    try {
      await action();
      setMessage(done);
      await revalidateSpaceContext(spaceSlug);
      return true;
    } catch {
      setActionError(t('error.change'));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const toggleRemoval = () =>
    run(
      () =>
        setSpaceContextRemovalSuggestedRequest({
          spaceSlug,
          sectionKey: section.sectionKey,
          suggested: section.pendingChange !== 'remove',
          getAccessToken,
        }),
      section.pendingChange === 'remove'
        ? t('success.removalWithdrawn')
        : t('success.removalSuggested'),
    );

  const withdrawAddition = async () => {
    const done = await run(
      () =>
        discardSpaceContextSuggestionRequest({
          spaceSlug,
          sectionKey: section.sectionKey,
          getAccessToken,
        }),
      t('success.additionWithdrawn'),
    );
    if (done) onWithdrawn();
  };

  if (
    !showStatus &&
    !section.pendingChange &&
    !canSuggestRemoval &&
    !canWithdrawAddition &&
    !message &&
    !actionError
  ) {
    return null;
  }

  return (
    <div className="space-y-3 border-b border-border/70 px-4 py-3">
      {showStatus || section.pendingChange ? (
        <div className="flex flex-wrap items-center gap-2">
          {showStatus ? (
            <SpaceContextStatusChip status={section.status} />
          ) : null}
          <SpaceContextChangeBadge change={section.pendingChange} />
        </div>
      ) : null}

      {notice ? (
        <p className="border border-dashed border-neutral-6 px-3 py-2 text-1 text-neutral-11">
          {notice}
        </p>
      ) : null}

      {proposalHref ? (
        <Link
          href={proposalHref}
          scroll={false}
          className="text-1 font-semibold text-foreground underline-offset-2 hover:underline"
        >
          {t('card.viewProposal')}
        </Link>
      ) : null}

      {canSuggestRemoval || canWithdrawAddition ? (
        <div className="flex flex-wrap gap-2">
          {canSuggestRemoval ? (
            <Button
              type="button"
              variant="outline"
              colorVariant="neutral"
              className="h-8 px-2"
              disabled={busy}
              onClick={() => void toggleRemoval()}
            >
              {section.pendingChange === 'remove'
                ? t('reader.cancelRemoval')
                : t('reader.suggestRemoval')}
            </Button>
          ) : null}
          {canWithdrawAddition ? (
            <Button
              type="button"
              variant="outline"
              colorVariant="neutral"
              className="h-8 px-2"
              disabled={busy}
              onClick={() => void withdrawAddition()}
            >
              {t('reader.withdrawAddition')}
            </Button>
          ) : null}
        </div>
      ) : null}

      {actionError ? (
        <p className="text-2 text-error-11" role="alert">
          {actionError}
        </p>
      ) : message ? (
        <p className="text-2 text-neutral-11" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
