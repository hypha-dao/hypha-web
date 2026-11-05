'use client';

import {
  calledSpecialistIds,
  specialistById,
  useMe,
  useSpaceBySlug,
} from '@hypha-platform/core/client';
import { SidebarContent, SidebarHeader } from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useCallback, useMemo, useState } from 'react';
import {
  HumanChatPanelChatBar,
  HumanChatPanelErrorBoundary,
  HumanChatPanelHeader,
  HumanChatPanelMembers,
  HumanChatPanelMessages,
  HumanChatPanelTabs,
  type ChatDraftAttachment,
  type ChatMentionCandidate,
  type ChatPanelTab,
} from '../../common/human-chat-panel';
import { AgentMentionLabelProvider } from '../../common/human-chat-panel/agent-mention-label-context';
import { HumanChatPanelTypingIndicator } from '../../common/human-chat-panel/human-chat-panel-typing-indicator';
import {
  matrixAgentSkills,
  withMatrixAgentMention,
} from '../../common/human-chat-panel/matrix-agent-mention';
import { messagesChannelGlyph } from '../../common/human-chat-panel/messages-channel-glyph';
import type { SpaceQuestDraftPanelSession } from '../../common/human-chat-panel-context';
import type { UseMembers } from '../../spaces/hooks/types';
import { resolveSpaceDisplayLogoUrl } from '../../spaces/utils/resolve-space-display-logo-url';
import { useQuestSpaceMembers } from '../hooks/use-space-quests';

function SpaceQuestChatBody({
  session,
  activeTab,
  useMembers,
}: {
  session: SpaceQuestDraftPanelSession;
  activeTab: ChatPanelTab;
  useMembers?: UseMembers;
}) {
  const tChat = useTranslations('HumanChatPanel');
  const tCoherence = useTranslations('CoherenceTab');
  const { resolvedTheme } = useTheme();
  const { person: me } = useMe();
  const { space } = useSpaceBySlug(session.spaceSlug);
  const spaceMembers = useQuestSpaceMembers(session.spaceSlug);
  const [draftAttachments, setDraftAttachments] = useState<
    ChatDraftAttachment[]
  >([]);

  const currentUserAvatarUrl = me?.avatarUrl?.trim() || undefined;
  const calledIds = useMemo(
    () => calledSpecialistIds(session.messages),
    [session.messages],
  );

  const defaultSpecialist = specialistById('operations');
  const defaultSpecialistRole = defaultSpecialist
    ? tCoherence(defaultSpecialist.roleKey)
    : tChat('agentMentionLabel');

  const panelMessages = useMemo(
    () =>
      session.messages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        parts: [{ type: 'text' as const, text: msg.text }],
        ...(msg.senderName ? { senderName: msg.senderName } : {}),
        ...(msg.avatarUrl ? { avatarUrl: msg.avatarUrl } : {}),
        ...(msg.agentSpecialistId
          ? { agentSpecialistId: msg.agentSpecialistId }
          : {}),
        timestamp: msg.timestamp,
      })),
    [session.messages],
  );

  const mentionCandidates = useMemo((): ChatMentionCandidate[] => {
    const roster: ChatMentionCandidate[] = spaceMembers
      .filter((member) => member.personId !== me?.id)
      .map((member) => ({
        userId: `@member_${member.personId}:hypha.local`,
        displayLabel: member.name,
        avatarUrl: member.avatarUrl ?? undefined,
      }));
    const logoUrl = resolveSpaceDisplayLogoUrl(
      space,
      resolvedTheme === 'dark' ? 'dark' : 'light',
    );
    return withMatrixAgentMention(
      roster,
      tChat('agentMentionLabel'),
      matrixAgentSkills(tChat),
      {
        kind: 'space',
        logoUrl,
      },
    );
  }, [me?.id, resolvedTheme, space, spaceMembers, tChat]);

  const getMentionComposerLabel = useCallback(
    (member: ChatMentionCandidate, resolvedComposerLabel?: string) =>
      resolvedComposerLabel?.trim() || member.displayLabel,
    [],
  );

  if (activeTab === 'members' && useMembers) {
    return (
      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
        role="tabpanel"
        id="chat-tabpanel-members"
        aria-labelledby="chat-tab-members"
      >
        <HumanChatPanelMembers
          useMembers={useMembers}
          spaceSlug={session.spaceSlug}
          roomScoped={false}
          calledSpecialistIds={calledIds}
        />
      </div>
    );
  }

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      role="tabpanel"
      id="chat-tabpanel-chat"
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <HumanChatPanelErrorBoundary key="quest-draft-messages">
          <HumanChatPanelMessages
            messages={panelMessages}
            currentUserId={null}
            currentUserAvatarUrl={currentUserAvatarUrl}
          />
        </HumanChatPanelErrorBoundary>
      </div>
      <HumanChatPanelTypingIndicator
        peers={
          session.isAgentTyping
            ? [{ userId: 'agent', name: defaultSpecialistRole }]
            : []
        }
      />
      <HumanChatPanelErrorBoundary key="quest-draft-composer">
        <HumanChatPanelChatBar
          value={session.input}
          onChange={session.onInputChange}
          onSend={session.onSend}
          placeholder={tChat('placeholder')}
          mentionCandidates={mentionCandidates}
          mentionPickerEnabled={mentionCandidates.length > 0}
          getMentionComposerLabel={getMentionComposerLabel}
          draftAttachments={draftAttachments}
          onDraftAttachmentsChange={setDraftAttachments}
        />
      </HumanChatPanelErrorBoundary>
    </div>
  );
}

/** Quest chat hosted inside the shared right side panel (`HumanRightPanel`). */
export function SpaceQuestSidePanel({
  session,
  useMembers,
  onClose,
}: {
  session: SpaceQuestDraftPanelSession;
  useMembers?: UseMembers;
  onClose?: () => void;
}) {
  const tChat = useTranslations('HumanChatPanel');
  const tConnections = useTranslations('Connections');
  const [activeTab, setActiveTab] = useState<ChatPanelTab>('chat');
  const title = session.questTitle.trim() || 'New quest';

  return (
    <AgentMentionLabelProvider value={tChat('agentMentionLabel')}>
      <SidebarHeader className="gap-0 bg-page-background p-0 dark:bg-background-2">
        <HumanChatPanelHeader
          title={title}
          onBack={onClose}
          channelIcon={messagesChannelGlyph('quest') ?? undefined}
          channelIconLabel={tConnections('inbox.tagQuest')}
        />
        <HumanChatPanelTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          chatTabLabel={tChat('tabChatQuest')}
        />
      </SidebarHeader>
      <SidebarContent
        className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden bg-page-background dark:bg-background-2"
        data-hypha-chat-panel=""
      >
        <SpaceQuestChatBody
          session={session}
          activeTab={activeTab}
          useMembers={useMembers}
        />
      </SidebarContent>
    </AgentMentionLabelProvider>
  );
}

/** Fallback right panel for layouts where `HumanRightPanel` is not mounted. */
export function SpaceQuestChatPanel({
  session,
}: {
  session: SpaceQuestDraftPanelSession;
}) {
  const tChat = useTranslations('HumanChatPanel');
  const tConnections = useTranslations('Connections');
  const [activeTab, setActiveTab] = useState<ChatPanelTab>('chat');
  const title = session.questTitle.trim() || 'New quest';

  return (
    <AgentMentionLabelProvider value={tChat('agentMentionLabel')}>
      <aside
        className="flex h-[680px] w-full flex-col border border-border/70 bg-page-background dark:bg-background-2 xl:sticky xl:top-4 xl:w-[20rem] xl:shrink-0"
        data-hypha-chat-panel=""
      >
        <div className="shrink-0">
          <HumanChatPanelHeader
            title={title}
            channelIcon={messagesChannelGlyph('quest') ?? undefined}
            channelIconLabel={tConnections('inbox.tagQuest')}
          />
          <HumanChatPanelTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            chatTabLabel={tChat('tabChatQuest')}
          />
        </div>
        <SpaceQuestChatBody session={session} activeTab={activeTab} />
      </aside>
    </AgentMentionLabelProvider>
  );
}
