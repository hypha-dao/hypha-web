'use client';

import {
  QUEST_HELPER_NAME,
  calledSpecialistIds,
  specialistById,
  useMe,
  useSpaceBySlug,
} from '@hypha-platform/core/client';
import { SidebarContent, SidebarHeader } from '@hypha-platform/ui';
import { Search, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useCallback, useMemo, useState } from 'react';
import {
  getAgentAvatarInitials,
  tagGroupAccentClass,
} from '../../common/ai-agent-competencies';
import {
  HumanChatPanelChatBar,
  HumanChatPanelErrorBoundary,
  HumanChatPanelHeader,
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
  matrixAgentUserId,
  withMatrixAgentMention,
} from '../../common/human-chat-panel/matrix-agent-mention';
import { messagesChannelGlyph } from '../../common/human-chat-panel/messages-channel-glyph';
import type { SpaceQuestDraftPanelSession } from '../../common/human-chat-panel-context';
import { PersonAvatar } from '../../people/components/person-avatar';
import type { UseMembers } from '../../spaces/hooks/types';
import { resolveSpaceDisplayLogoUrl } from '../../spaces/utils/resolve-space-display-logo-url';
import { useQuestSpaceMembers } from '../hooks/use-space-quests';

const FALLBACK_AGENT_MXID = '@hypha_bot_preview:matrix.hypha.earth';

const QUICK_DRAFT_PROMPTS = [
  {
    id: 'draft-all',
    label: 'Draft sections from goal',
    prompt:
      '@AI Agents Draft the Scope, Success Criteria, and Milestones sections from our goal.',
  },
  {
    id: 'suggest-scope',
    label: 'Suggest scope & criteria',
    prompt:
      '@AI Agents Suggest concrete In Scope, Out of Scope, and Success Criteria bullets for this quest.',
  },
  {
    id: 'suggest-milestones',
    label: 'Suggest milestones',
    prompt:
      '@AI Agents Propose 3 concrete milestones with target dates and descriptions for this quest.',
  },
] as const;

export function SpaceQuestChatBody({
  session,
  activeTab,
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
  const [memberQuery, setMemberQuery] = useState('');

  const isQuestHelper = session.coach === 'quest-helper';
  const agentLabel = isQuestHelper
    ? QUEST_HELPER_NAME
    : tChat('agentMentionLabel');
  const botMxid = matrixAgentUserId() ?? FALLBACK_AGENT_MXID;
  const currentUserAvatarUrl = me?.avatarUrl?.trim() || undefined;
  const calledIds = useMemo(
    () => calledSpecialistIds(session.messages),
    [session.messages],
  );
  const calledSpecialists = useMemo(
    () =>
      calledIds.flatMap((id) => {
        const sp = specialistById(id);
        return sp ? [sp] : [];
      }),
    [calledIds],
  );

  const panelMessages = useMemo(
    () =>
      session.messages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        parts: [{ type: 'text' as const, text: msg.text }],
        senderName:
          msg.role === 'member'
            ? msg.senderName?.trim() || agentLabel
            : msg.senderName,
        ...(msg.role === 'member'
          ? { senderMatrixId: msg.senderMatrixId ?? botMxid }
          : {}),
        ...(msg.avatarUrl ? { avatarUrl: msg.avatarUrl } : {}),
        timestamp: msg.timestamp,
      })),
    [agentLabel, botMxid, session.messages],
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
    if (isQuestHelper) return roster;
    const skills = [
      ...matrixAgentSkills(tChat),
      {
        id: 'quest-draft-all',
        prompt:
          'Draft the Scope, Success Criteria, and Milestones sections from our goal.',
      },
    ];
    const withAgent = withMatrixAgentMention(roster, agentLabel, skills, {
      kind: 'space',
      logoUrl,
    });
    if (withAgent.some((c) => c.rowKey === 'agent')) {
      return withAgent;
    }
    return [
      {
        userId: botMxid,
        displayLabel: agentLabel,
        rowKey: 'agent',
        skills,
        agentIcon: { kind: 'space', logoUrl },
      },
      ...roster,
    ];
  }, [
    agentLabel,
    botMxid,
    isQuestHelper,
    me?.id,
    resolvedTheme,
    space,
    spaceMembers,
    tChat,
  ]);

  const getMentionComposerLabel = useCallback(
    (member: ChatMentionCandidate, resolvedComposerLabel?: string) =>
      resolvedComposerLabel?.trim() || member.displayLabel,
    [],
  );

  const visibleMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    if (!q) return spaceMembers;
    return spaceMembers.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.nickname && m.nickname.toLowerCase().includes(q)),
    );
  }, [memberQuery, spaceMembers]);

  const showAgentInMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    if (!q) return true;
    return agentLabel.toLowerCase().includes(q);
  }, [agentLabel, memberQuery]);

  if (activeTab === 'members') {
    const totalCount =
      spaceMembers.length + 1 + (isQuestHelper ? 0 : calledSpecialists.length);
    return (
      <div
        className="narrow-scrollbar flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-3"
        role="tabpanel"
        id="chat-tabpanel-members"
        aria-labelledby="chat-tab-members"
        data-testid="chat-panel-members"
      >
        <div className="px-1 pb-2 text-xs font-medium text-muted-foreground">
          {`${totalCount} ${totalCount === 1 ? 'participant' : 'participants'}`}
        </div>
        <label className="relative mb-2 min-w-0">
          <span className="sr-only">Search participants</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-9"
            strokeWidth={1.5}
            aria-hidden
          />
          <input
            value={memberQuery}
            onChange={(event) => setMemberQuery(event.target.value)}
            placeholder="Search participants"
            data-testid="chat-panel-members-search"
            className="h-10 w-full rounded-none border border-border bg-background pr-3 pl-10 text-2 text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
          />
        </label>

        {showAgentInMembers ? (
          <div
            className="flex items-center gap-3 rounded-none px-2 py-1.5"
            data-testid="chat-panel-member-item"
          >
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center text-[11px] font-semibold ${tagGroupAccentClass(
                'operations',
              )}`}
              aria-hidden
            >
              {getAgentAvatarInitials(agentLabel)}
            </div>
            <span className="truncate text-sm font-medium text-foreground">
              {agentLabel}
            </span>
          </div>
        ) : null}

        {!isQuestHelper
          ? calledSpecialists.map((specialist) => {
              const role = tCoherence(specialist.roleKey);
              return (
                <div
                  key={specialist.id}
                  className="flex items-center gap-3 rounded-none px-2 py-1.5"
                  data-testid="chat-panel-member-item"
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center text-[11px] font-semibold ${tagGroupAccentClass(
                      specialist.id,
                    )}`}
                    aria-hidden
                  >
                    {getAgentAvatarInitials(role)}
                  </div>
                  <span className="truncate text-sm text-foreground">
                    {role}
                  </span>
                </div>
              );
            })
          : null}

        {visibleMembers.map((member) => (
          <div
            key={member.personId}
            className="flex items-center gap-3 rounded-none px-2 py-1.5 transition-colors hover:bg-foreground/[0.04]"
            data-testid="chat-panel-member-item"
          >
            <PersonAvatar
              avatarSrc={member.avatarUrl ?? undefined}
              userName={member.name}
              size="md"
              className="rounded-full"
              personId={member.personId}
            />
            <span className="truncate text-sm text-foreground">
              {member.name}
              {me?.id && member.personId === me.id ? ` (${tChat('you')})` : ''}
            </span>
          </div>
        ))}
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

      {isQuestHelper ? null : (
        <div
          className="flex flex-wrap items-center gap-1.5 border-t border-border/60 px-3 py-2"
          data-testid="quest-chat-agent-assist-bar"
        >
          <button
            type="button"
            data-testid="quest-chat-agent-chip"
            onClick={() => {
              const prefix = `@${agentLabel} `;
              if (!session.input.startsWith(prefix)) {
                session.onInputChange(`${prefix}${session.input}`);
              }
            }}
            className="inline-flex items-center gap-1 border border-foreground/50 bg-background px-2 py-0.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-neutral-3"
          >
            <Sparkles className="size-3" aria-hidden />
            <span>@{agentLabel}</span>
          </button>
          {QUICK_DRAFT_PROMPTS.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={session.isAgentTyping}
              onClick={() => {
                if (session.onQuickPrompt) {
                  session.onQuickPrompt(item.prompt);
                } else {
                  session.onInputChange(item.prompt);
                }
              }}
              className="inline-flex items-center border border-border bg-background-2 px-2 py-0.5 text-[11px] text-neutral-11 transition-colors hover:border-foreground/40 hover:text-foreground disabled:opacity-50"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      <HumanChatPanelTypingIndicator
        peers={
          session.isAgentTyping ? [{ userId: botMxid, name: agentLabel }] : []
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
  const { resolvedTheme } = useTheme();
  const { space } = useSpaceBySlug(session.spaceSlug);
  const [activeTab, setActiveTab] = useState<ChatPanelTab>('chat');
  const title = session.questTitle.trim() || 'New quest';
  const spaceLogoUrl = resolveSpaceDisplayLogoUrl(
    space,
    resolvedTheme === 'dark' ? 'dark' : 'light',
  );

  return (
    <AgentMentionLabelProvider
      value={
        session.coach === 'quest-helper'
          ? QUEST_HELPER_NAME
          : tChat('agentMentionLabel')
      }
    >
      <SidebarHeader className="gap-0 bg-page-background p-0 dark:bg-background-2">
        <HumanChatPanelHeader
          title={title}
          onBack={onClose}
          titleStart={
            spaceLogoUrl ? (
              <img
                src={spaceLogoUrl}
                alt=""
                aria-hidden
                className="h-full w-full rounded-full object-cover"
              />
            ) : undefined
          }
          channelIcon={messagesChannelGlyph('quest') ?? undefined}
          channelIconLabel={tConnections('inbox.tagQuest')}
        />
        <HumanChatPanelTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          chatTabLabel={tChat('tabChatQuest')}
          membersTabLabel="Participants"
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
    <AgentMentionLabelProvider
      value={
        session.coach === 'quest-helper'
          ? QUEST_HELPER_NAME
          : tChat('agentMentionLabel')
      }
    >
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
            membersTabLabel="Participants"
          />
        </div>
        <SpaceQuestChatBody session={session} activeTab={activeTab} />
      </aside>
    </AgentMentionLabelProvider>
  );
}
