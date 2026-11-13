'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { mutate as mutateCache } from 'swr';
import {
  HYPHA_ROOM_TYPES,
  useAgreementMutationsWeb2Rsc,
  useJwt,
  useMatrix,
} from '@hypha-platform/core/client';
import { Separator } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

import { matrixAgentSkills } from '../../common/human-chat-panel/matrix-agent-mention';
import { MatrixDiscussionThread } from '../../common/matrix-discussion-thread';

/**
 * In-context Matrix discussion under proposal content in the overlay.
 * Mirrors signal rooms: one Matrix room per document, created lazily.
 */
export function ProposalDiscussionChat({
  documentSlug,
  title,
  initialChatRoomId,
  chatRoomResolved = false,
  spaceSlug,
  className,
}: {
  documentSlug: string;
  title?: string;
  initialChatRoomId?: string | null;
  /** False while the document is still loading, so a missing room id is not "none". */
  chatRoomResolved?: boolean;
  spaceSlug?: string;
  className?: string;
}) {
  const t = useTranslations('ProposalDetails');
  const tChat = useTranslations('HumanChatPanel');
  const tCoherence = useTranslations('CoherenceTab');
  const { jwt: authToken } = useJwt();
  const { isMatrixAvailable } = useMatrix();
  const { updateAgreementBySlug } = useAgreementMutationsWeb2Rsc(authToken);

  const currentTitle = title?.trim();
  const roomTitle = currentTitle
    ? t('discussion.roomTitle', { title: currentTitle })
    : t('discussion.roomTitleFallback');

  const persistRoomId = React.useCallback(
    async (roomId: string) => {
      if (!authToken || !documentSlug) return null;
      await updateAgreementBySlug({ slug: documentSlug, chatRoomId: roomId });
      void mutateCache([`/api/v1/documents/${documentSlug}/`]);
      return roomId;
    },
    [authToken, documentSlug, updateAgreementBySlug],
  );

  const agent = React.useMemo(
    () => ({
      label: tChat('agentMentionLabel'),
      skills: matrixAgentSkills(tChat),
    }),
    [tChat],
  );
  const agentContext = React.useMemo(
    () => ({
      kind: 'proposal' as const,
      documentSlug,
      documentTitle: title,
    }),
    [documentSlug, title],
  );

  if (!isMatrixAvailable) {
    return (
      <section
        className={cn(
          'mt-6 border border-border bg-background-2/40 p-4',
          className,
        )}
      >
        <h3
          className="text-3"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {t('discussion.title')}
        </h3>
        <p className="mt-2 text-1 text-neutral-11">
          {t('discussion.signInHint')}
        </p>
      </section>
    );
  }

  return (
    <section
      className={cn(
        'mt-6 flex flex-col gap-3 border border-border bg-background-2/40 p-4',
        className,
      )}
    >
      <h3
        className="text-3"
        style={{ fontFamily: 'var(--font-family-heading)' }}
      >
        {t('discussion.title')}
      </h3>
      <p className="text-1 text-neutral-11">{t('discussion.subtitle')}</p>
      <Separator />
      <MatrixDiscussionThread
        threadKey={documentSlug}
        initialChatRoomId={initialChatRoomId}
        chatRoomResolved={chatRoomResolved}
        roomTitle={roomTitle}
        roomType={HYPHA_ROOM_TYPES.proposal}
        persistRoomId={persistRoomId}
        spaceSlug={spaceSlug}
        agent={agent}
        agentContext={agentContext}
        placeholder={tCoherence('saySomething')}
        connectingLabel={t('discussion.connecting')}
        unavailableLabel={t('discussion.unavailable')}
        logLabel="ProposalDiscussionChat"
      />
    </section>
  );
}
