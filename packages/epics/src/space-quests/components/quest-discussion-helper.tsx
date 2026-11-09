'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import {
  QUEST_HELPER_NAME,
  QUEST_STEWARD_STEPS,
  canMemberEditQuest,
  useMe,
} from '@hypha-platform/core/client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SpaceQuestDraftChatMessage } from '../../common/human-chat-panel-context';
import {
  patchSpaceQuestRequest,
  useQuestSpaceMembers,
  useSpaceQuestDetail,
} from '../hooks/use-space-quests';
import {
  questAssistHistoryEntries,
  questDraftTurnUsesModel,
  questHelperPendingSuggestion,
  questHelperTurnMessage,
  type PendingQuestSectionProposal,
  type QuestDraftModelTurn,
  type QuestDraftStateSnapshot,
} from '../utils/quest-draft-assistant';
import {
  questHelperTypingAfterTurn,
  questHelperTypingForTurn,
} from '../utils/quest-helper-typing';
import {
  questHelperSessionKey,
  readQuestHelperSession,
  writeQuestHelperSession,
} from '../utils/quest-helper-session';
import {
  SAVED_QUEST_HELPER_INTRO,
  questHelperDraftAssistBody,
  questRecordToDraftSnapshot,
  runSavedQuestHelperTurn,
} from '../utils/quest-saved-helper';
import { SpaceQuestChatBody } from './space-quest-chat-panel';

function helperIntro(): SpaceQuestDraftChatMessage {
  return {
    id: 'helper-m1',
    role: 'member',
    senderName: QUEST_HELPER_NAME,
    timestamp: new Date(),
    text: SAVED_QUEST_HELPER_INTRO,
  };
}

/**
 * Saved-quest Helper inside the quest's Matrix discussion.
 * Editors see it in that room's chat view. It does not open a second panel.
 */
export function QuestDiscussionHelper({
  spaceSlug,
  questSlug,
}: {
  spaceSlug: string;
  questSlug: string;
}) {
  const { person } = useMe();
  const { getAccessToken } = useAuthentication();
  const { quest, refresh } = useSpaceQuestDetail(spaceSlug, questSlug);
  const spaceMembers = useQuestSpaceMembers(spaceSlug);
  const sessionKey = questHelperSessionKey(spaceSlug, questSlug);
  const [messages, setMessages] = useState<SpaceQuestDraftChatMessage[]>(() => [
    helperIntro(),
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const draftRef = useRef<QuestDraftStateSnapshot | null>(null);
  const pendingRef = useRef<PendingQuestSectionProposal | null>(null);
  const stepRef = useRef(0);
  const turnRef = useRef(0);
  const sendRef = useRef<(overridePrompt?: string) => void>(() => {});
  const sessionKeyRef = useRef(sessionKey);
  const skipSessionWrite = useRef(true);

  const viewer = person
    ? {
        id: person.id,
        name: [person.name, person.surname].filter(Boolean).join(' '),
      }
    : null;
  const canEdit =
    !!quest &&
    (quest.status === 'active' || quest.status === 'paused') &&
    canMemberEditQuest(viewer, quest);

  useEffect(() => {
    const restored =
      typeof window === 'undefined'
        ? null
        : readQuestHelperSession(window.sessionStorage, sessionKey);
    sessionKeyRef.current = sessionKey;
    skipSessionWrite.current = true;
    setMessages(restored?.messages ?? [helperIntro()]);
    setInput('');
    setTyping(false);
    pendingRef.current = restored?.pending ?? null;
    stepRef.current = restored?.step ?? 0;
    turnRef.current += 1;
  }, [sessionKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessionKeyRef.current !== sessionKey) return;
    if (skipSessionWrite.current) {
      skipSessionWrite.current = false;
      return;
    }
    writeQuestHelperSession(window.sessionStorage, sessionKey, {
      messages,
      pending: pendingRef.current,
      step: stepRef.current,
    });
  }, [messages, sessionKey]);

  useEffect(() => {
    draftRef.current = quest ? questRecordToDraftSnapshot(quest) : null;
  }, [quest]);

  const send = useCallback(
    async (overridePrompt?: string) => {
      const rawTrimmed = (overridePrompt ?? input).trim();
      if (!rawTrimmed || !canEdit || !quest) return;
      if (!overridePrompt) setInput('');
      const snapshot = draftRef.current;
      if (!snapshot) return;

      const trimmed = questHelperTurnMessage(rawTrimmed);
      const generation = ++turnRef.current;
      const readTurnState = () => ({
        draft: draftRef.current ?? snapshot,
        pending: pendingRef.current,
        currentStep: QUEST_STEWARD_STEPS[stepRef.current] ?? 'goal',
      });
      const viewerName = viewer?.name?.trim() || 'Participant';
      const now = new Date();
      setMessages((prev) => [
        ...prev,
        {
          id: `hu-${now.getTime()}`,
          role: 'user',
          senderName: viewerName,
          avatarUrl: person?.avatarUrl ?? undefined,
          timestamp: now,
          text: rawTrimmed,
        },
      ]);
      const history = messages.slice(-8).map((entry) => ({
        role: entry.role === 'user' ? ('user' as const) : ('agent' as const),
        text: entry.text,
      }));
      const usesModel = questDraftTurnUsesModel(trimmed);
      setTyping(questHelperTypingForTurn(usesModel));
      try {
        const outcome = await runSavedQuestHelperTurn({
          message: trimmed,
          history,
          viewerDisplayName: viewerName,
          spaceMembers,
          readState: readTurnState,
          isCurrent: () => turnRef.current === generation,
          saveSection: async (patch) => {
            try {
              const updated = await patchSpaceQuestRequest({
                spaceSlug,
                questSlug: quest.slug,
                patch,
                getAccessToken,
              });
              await refresh(updated, { revalidate: false });
              draftRef.current = questRecordToDraftSnapshot(updated);
              return true;
            } catch {
              return false;
            }
          },
          loadModel: async () => {
            const currentSnapshot = draftRef.current;
            if (!currentSnapshot) return null;
            const token = await getAccessToken?.().catch(() => null);
            if (!token || turnRef.current !== generation) return null;
            const currentStep = QUEST_STEWARD_STEPS[stepRef.current] ?? 'goal';
            const pendingNow = pendingRef.current;
            try {
              const response = await fetch(
                `/api/v1/spaces/${encodeURIComponent(
                  spaceSlug,
                )}/quests/draft-assist`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify(
                    questHelperDraftAssistBody({
                      message: trimmed,
                      currentStep,
                      spaceTitle: quest.spaceTitle,
                      draft: currentSnapshot,
                      spaceMembers,
                      history: questAssistHistoryEntries(history),
                      pendingSuggestion:
                        questHelperPendingSuggestion(pendingNow),
                    }),
                  ),
                },
              );
              if (turnRef.current !== generation || !response.ok) return null;
              return (await response.json()) as QuestDraftModelTurn;
            } catch {
              return null;
            }
          },
        });
        if (!outcome || turnRef.current !== generation) return;
        pendingRef.current = outcome.pending;
        stepRef.current = Math.max(
          0,
          QUEST_STEWARD_STEPS.indexOf(outcome.focusStep),
        );
        setMessages((prev) => [
          ...prev,
          {
            id: `hs-${Date.now()}`,
            role: 'member',
            senderName: QUEST_HELPER_NAME,
            timestamp: new Date(),
            text: outcome.reply,
          },
        ]);
      } finally {
        const nextTyping = questHelperTypingAfterTurn(
          generation,
          turnRef.current,
        );
        if (nextTyping === false) setTyping(false);
      }
    },
    [
      canEdit,
      getAccessToken,
      input,
      messages,
      person?.avatarUrl,
      quest,
      refresh,
      spaceMembers,
      spaceSlug,
      viewer?.name,
    ],
  );

  sendRef.current = (overridePrompt?: string) => {
    void send(overridePrompt);
  };
  const triggerSend = useCallback(() => {
    sendRef.current();
  }, []);

  if (!canEdit || !quest) return null;

  return (
    <section
      data-testid="quest-discussion-helper"
      aria-label="Quest Helper"
      className="flex h-[min(280px,46%)] min-h-[160px] shrink-0 flex-col overflow-hidden border-b border-border"
    >
      <SpaceQuestChatBody
        session={{
          spaceSlug,
          questTitle: quest.name,
          messages,
          input,
          onInputChange: setInput,
          onSend: triggerSend,
          isAgentTyping: typing,
          coach: 'quest-helper',
        }}
        activeTab="chat"
      />
    </section>
  );
}
