'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import {
  QUEST_DOCUMENT_LABEL,
  QUEST_HELPER_NAME,
  QUEST_PROPOSAL_DESCRIPTION_LIMIT,
  QUEST_STEWARD_STEPS,
  buildQuestProposalDescription,
  bulletsToMarkdownList,
  formatQuestCalendarDate,
  questRecordToProposalDraft,
  readableQuestErrorMessage,
  stripViewerYouMarker,
  withoutPlaceholderLeadDuplicates,
  useCreateAgreementOrchestrator,
  useJwt,
  useMe,
  useSpaceBySlug,
  type QuestDraftInput,
  type QuestReward,
  type QuestStewardStep,
} from '@hypha-platform/core/client';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Check, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useConfig } from 'wagmi';
import {
  useAiPanel,
  useHumanChatPanel,
  type SpaceQuestDraftChatMessage,
} from '../../common/human-chat-panel-context';
import { PersonAvatar } from '../../people/components/person-avatar';
import { SpaceLoadingBackdrop } from '../../spaces/components/space-loading-backdrop';
import { QuestDraftParticipantsCard } from './quest-detail-presentation';
import { QuestSectionMarkdown } from './quest-section-markdown';
import {
  createSpaceQuestRequest,
  deleteQuestDraftRequest,
  deleteSpaceQuestRequest,
  findQuestSpaceMember,
  findQuestSpaceMemberId,
  getQuestDraftRequest,
  patchSpaceQuestRequest,
  saveQuestDraftRequest,
  toQuestSpaceMemberPersons,
  useQuestSpaceMembers,
} from '../hooks/use-space-quests';
import {
  questAssistHistoryEntries,
  questDraftTurnUsesModel,
  questHelperPendingSuggestion,
  questHelperTurnMessage,
  settleCreateDraftTurn,
  type PendingQuestSectionProposal,
  type QuestDraftModelTurn,
  type QuestDraftStateSnapshot,
} from '../utils/quest-draft-assistant';
import { draftParticipantRoleLabel } from '../utils/quest-draft-member-role';
import {
  questHelperTypingAfterTurn,
  questHelperTypingForTurn,
} from '../utils/quest-helper-typing';
import {
  EditQuestDeliverablesModal,
  EditQuestGoalModal,
  EditQuestLeadModal,
  EditQuestMembersModal,
  EditQuestMilestonesModal,
  EditQuestNameModal,
  EditQuestRewardsModal,
  EditQuestScopeModal,
  EditQuestSuccessModal,
  EditQuestTargetDateModal,
  type EditableQuestDeliverable,
  type EditableQuestMember,
  type EditableQuestMilestone,
} from './quest-section-edit-modals';
import { QuestRewardRowsEditor } from './quest-reward-tokens';
import { SpaceQuestChatPanel } from './space-quest-chat-panel';
import {
  STALE_DEPLOYMENT_MESSAGE,
  questPublishFailurePlan,
} from '../utils/quest-create-recovery';
import {
  questCreateDraftIsWorthSaving,
  questCreateDraftPayload,
  questCreateSessionKey,
  readQuestCreateSession,
  writeQuestCreateSession,
  type QuestCreateCheckpoint,
  type QuestCreateSession,
} from '../utils/quest-create-session';

const LABEL_CLASS =
  'text-[10px] font-bold uppercase tracking-[0.08em] text-neutral-11';
const DRAFT_SAVE_STATUS_CLASS =
  'inline-flex h-[16.5px] min-w-[11.5rem] items-center gap-1.5 whitespace-nowrap text-left text-[11px] font-medium';

function DraftResumeSkeleton() {
  const columns = [
    ['NAME', 'GOAL', 'SCOPE', 'SUCCESS CRITERIA', 'QUEST REWARD', 'MILESTONES'],
    ['LEAD', 'PARTICIPANTS', 'TARGET DATE'],
  ];
  return (
    <div
      className="grid grid-cols-1 gap-2.5 lg:grid-cols-[minmax(0,1fr)_330px]"
      data-testid="quest-draft-loading"
      aria-busy="true"
    >
      {columns.map((column) => (
        <div key={column[0]} className="space-y-2.5">
          {column.map((label) => (
            <div
              key={label}
              className="flex w-full flex-col items-start gap-1.5 border border-border bg-background p-3.5"
            >
              <span className={LABEL_CLASS}>{label}</span>
              <span className="h-4 w-2/3 animate-pulse bg-neutral-4" />
              {label === 'GOAL' || label === 'SCOPE' ? (
                <span className="h-4 w-1/2 animate-pulse bg-neutral-4" />
              ) : null}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

type PendingProposalLink = QuestCreateCheckpoint;

function proposalPageHref(
  locale: string,
  spaceSlug: string,
  agreementSlug: string,
) {
  return `/${locale}/dho/${spaceSlug}/agreements/proposal/${encodeURIComponent(
    agreementSlug,
  )}`;
}

function questPageHref(locale: string, spaceSlug: string, questSlug: string) {
  return `/${locale}/dho/${spaceSlug}/quests/${encodeURIComponent(questSlug)}`;
}

function chainProposalId(current: {
  proposalId?: bigint | number | string | null;
  web3ProposalId?: number | null;
}): number | null {
  const raw = current.proposalId;
  if (typeof raw === 'bigint') {
    if (raw <= 0n || raw > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    return Number(raw);
  }
  if (typeof raw === 'number' && Number.isSafeInteger(raw) && raw > 0) {
    return raw;
  }
  if (typeof raw === 'string' && /^[1-9]\d*$/.test(raw)) {
    const parsed = Number(raw);
    if (Number.isSafeInteger(parsed)) return parsed;
  }
  if (
    typeof current.web3ProposalId === 'number' &&
    Number.isSafeInteger(current.web3ProposalId) &&
    current.web3ProposalId > 0
  ) {
    return current.web3ProposalId;
  }
  return null;
}

export function SpaceQuestCreateDraft({
  spaceSlug,
  resumeDraftId = null,
  startFresh = false,
}: {
  spaceSlug: string;
  resumeDraftId?: number | null;
  startFresh?: boolean;
}) {
  const spaceMembers = useQuestSpaceMembers(spaceSlug);
  const spaceMemberNames = useMemo(
    () => spaceMembers.map((m) => m.name),
    [spaceMembers],
  );
  const locale = useLocale();
  const tDrafts = useTranslations('SpaceQuests');
  const tAgreementFlow = useTranslations('AgreementFlow');
  const router = useRouter();
  const { person } = useMe();
  const { jwt } = useJwt();
  const { getAccessToken } = useAuthentication();
  const { space } = useSpaceBySlug(spaceSlug);
  const config = useConfig();
  const { closeAiPanel } = useAiPanel();
  const {
    open: helperPanelOpen,
    questChatRequested,
    panelAvailable,
    closeHumanChatPanel,
    closeCoherenceChat,
    setSpaceQuestDraft,
    requestQuestChat,
    dismissQuestChat,
  } = useHumanChatPanel();

  const viewerDisplayName = useMemo(() => {
    const full = [person?.name, person?.surname]
      .filter(Boolean)
      .join(' ')
      .trim();
    return full || person?.nickname?.trim() || 'You';
  }, [person?.name, person?.nickname, person?.surname]);

  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [scopeIn, setScopeIn] = useState<string[]>([]);
  const [scopeOut, setScopeOut] = useState<string[]>([]);
  const [scopeInMarkdown, setScopeInMarkdown] = useState('');
  const [scopeOutMarkdown, setScopeOutMarkdown] = useState('');
  const [successCriteria, setSuccessCriteria] = useState('');
  const [rewards, setRewards] = useState<QuestReward[]>([]);
  const [milestones, setMilestones] = useState<EditableQuestMilestone[]>([]);
  const [deliverables, setDeliverables] = useState<EditableQuestDeliverable[]>(
    [],
  );
  const [leadNameOverride, setLeadNameOverride] = useState<string | null>(null);
  const leadName = leadNameOverride ?? `${viewerDisplayName} (you)`;
  const [selectedLeadPersonId, setSelectedLeadPersonId] = useState<
    number | null
  >(null);
  const [members, setMembers] = useState<EditableQuestMember[]>([]);
  const [helperInlineOpen, setHelperInlineOpen] = useState(true);
  const [targetDate, setTargetDate] = useState<string | null>(null);

  const spaceMemberPersons = useMemo(
    () =>
      toQuestSpaceMemberPersons(spaceMembers, [
        leadName,
        ...members.map((m) => m.memberName),
        ...milestones.map((m) => m.ownerName),
      ]),
    [leadName, members, milestones, spaceMembers],
  );

  // Guided flow state (Goal first, one section per turn, no Priority)
  const [stewardStepIndex, setStewardStepIndex] = useState<number>(0);
  const [activeSection, setActiveSection] = useState<QuestStewardStep>('goal');
  const [chatInput, setChatInput] = useState('');
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const [chatMessages, setChatMessages] = useState<
    SpaceQuestDraftChatMessage[]
  >(() => [
    {
      id: 'm1',
      role: 'member',
      senderName: QUEST_HELPER_NAME,
      timestamp: new Date(),
      text: 'Hey, what is the goal of the quest you want to create?',
    },
  ]);

  // Edit modals open state
  const [editingModal, setEditingModal] = useState<
    | 'name'
    | 'goal'
    | 'scope'
    | 'success'
    | 'rewards'
    | 'milestones'
    | 'deliverables'
    | 'lead'
    | 'members'
    | 'targetDate'
    | null
  >(null);

  // Confirm modal state ("Are you sure?" — Figma 93:2)
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [draftSaveState, setDraftSaveState] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle');
  const [draftHydrating, setDraftHydrating] = useState(resumeDraftId != null);
  const draftHydratingRef = useRef(resumeDraftId != null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deployReload, setDeployReload] = useState(false);
  const [proposalLinkError, setProposalLinkError] = useState<{
    proposalTitle: string;
    href: string | null;
    questHref: string;
    detail: string;
  } | null>(null);
  const [pendingProposalLink, setPendingProposalLink] =
    useState<PendingProposalLink | null>(null);
  const pendingProposalLinkRef = useRef<PendingProposalLink | null>(null);
  pendingProposalLinkRef.current = pendingProposalLink;
  const chatMessagesRef = useRef(chatMessages);
  chatMessagesRef.current = chatMessages;
  const skipCreateSessionWrite = useRef(true);
  const serverDraftIdRef = useRef<number | null>(resumeDraftId);
  const draftConsumedRef = useRef(false);
  const holdSessionWrite = useRef(startFresh || resumeDraftId != null);
  const getAccessTokenRef = useRef(getAccessToken);
  getAccessTokenRef.current = getAccessToken;
  const pendingProposalRef = useRef<PendingQuestSectionProposal | null>(null);
  const stewardStepIndexRef = useRef(0);
  const turnGenerationRef = useRef(0);
  const draftSnapshotRef = useRef<QuestDraftStateSnapshot>({
    name: '',
    goal: '',
    scopeIn: [],
    scopeOut: [],
    scopeInMarkdown: '',
    scopeOutMarkdown: '',
    successCriteria: '',
    rewards: [],
    milestones: [],
    leadName: '',
    selectedLeadPersonId: null,
    members: [],
    targetDate: null,
    deliverables: [],
  });

  const {
    createAgreement,
    updateAgreementBySlug,
    agreement,
    isPending,
    progress,
    currentAction,
    reset: resetAgreementProgress,
  } = useCreateAgreementOrchestrator({
    authToken: jwt,
    config,
  });
  const agreementRef = useRef(agreement);
  agreementRef.current = agreement;
  draftSnapshotRef.current = {
    name,
    goal,
    scopeIn,
    scopeOut,
    scopeInMarkdown,
    scopeOutMarkdown,
    successCriteria,
    rewards,
    milestones,
    leadName,
    selectedLeadPersonId,
    members,
    targetDate,
    deliverables,
  };
  stewardStepIndexRef.current = stewardStepIndex;

  const commitDraftSnapshot = useCallback(
    (next: QuestDraftStateSnapshot) => {
      const keptDeliverables =
        next.deliverables ?? draftSnapshotRef.current.deliverables ?? [];
      draftSnapshotRef.current = { ...next, deliverables: keptDeliverables };
      setName(next.name);
      setGoal(next.goal);
      setScopeIn(next.scopeIn);
      setScopeOut(next.scopeOut);
      setScopeInMarkdown(next.scopeInMarkdown);
      setScopeOutMarkdown(next.scopeOutMarkdown);
      setSuccessCriteria(next.successCriteria);
      setRewards(next.rewards);
      setMilestones(next.milestones);
      if (next.leadName !== leadName) {
        setLeadNameOverride(next.leadName);
      }
      setSelectedLeadPersonId(next.selectedLeadPersonId);
      setMembers(next.members);
      setTargetDate(next.targetDate);
      setDeliverables(keptDeliverables);
    },
    [leadName],
  );

  const commitDraftRef = useRef(commitDraftSnapshot);
  commitDraftRef.current = commitDraftSnapshot;

  const currentCreateSession = useCallback((): QuestCreateSession => {
    return {
      draft: draftSnapshotRef.current,
      messages: chatMessagesRef.current,
      step: stewardStepIndexRef.current,
      pending: pendingProposalRef.current,
      checkpoint: pendingProposalLinkRef.current,
      draftId: serverDraftIdRef.current,
    };
  }, []);

  const applyCreateSession = useCallback((session: QuestCreateSession) => {
    commitDraftRef.current(session.draft);
    if (session.messages.length > 0) setChatMessages(session.messages);
    setStewardStepIndex(session.step);
    pendingProposalRef.current = session.pending;
    serverDraftIdRef.current = session.draftId;
    pendingProposalLinkRef.current = session.checkpoint;
    setPendingProposalLink(session.checkpoint);
    if (session.draftId) setDraftSaveState('saved');
  }, []);

  const persistCreateSession = useCallback(() => {
    if (typeof window === 'undefined') return;
    writeQuestCreateSession(
      window.sessionStorage,
      questCreateSessionKey(spaceSlug),
      currentCreateSession(),
    );
  }, [currentCreateSession, spaceSlug]);

  const saveGenerationRef = useRef(0);
  const saveDebouncePendingRef = useRef(false);
  const saveInFlightRef = useRef(false);
  const savingVisibleSinceRef = useRef<number | null>(null);
  const showSaving = useCallback(() => {
    if (savingVisibleSinceRef.current == null) {
      savingVisibleSinceRef.current = Date.now();
    }
    setDraftSaveState('saving');
  }, []);
  const settleSaving = useCallback(
    async (generation: number, next: 'saved' | 'error') => {
      const visibleSince = savingVisibleSinceRef.current ?? Date.now();
      const remaining = 400 - (Date.now() - visibleSince);
      if (remaining > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, remaining));
      }
      if (
        saveGenerationRef.current !== generation ||
        saveDebouncePendingRef.current
      ) {
        return;
      }
      savingVisibleSinceRef.current = null;
      setDraftSaveState(next);
    },
    [],
  );
  const saveDraftToServer = useCallback(async () => {
    if (draftHydratingRef.current) return null;
    if (draftConsumedRef.current) return serverDraftIdRef.current;
    const session = currentCreateSession();
    if (!questCreateDraftIsWorthSaving(session)) return null;
    const generation = saveGenerationRef.current + 1;
    saveGenerationRef.current = generation;
    saveInFlightRef.current = true;
    showSaving();
    try {
      const saved = await saveQuestDraftRequest({
        spaceSlug,
        id: serverDraftIdRef.current,
        payload: questCreateDraftPayload(session),
        getAccessToken: getAccessTokenRef.current,
      });
      serverDraftIdRef.current = saved.id;
      persistCreateSession();
      await settleSaving(generation, 'saved');
      return saved.id;
    } catch {
      await settleSaving(generation, 'error');
      return null;
    } finally {
      saveInFlightRef.current = false;
    }
  }, [
    currentCreateSession,
    persistCreateSession,
    settleSaving,
    showSaving,
    spaceSlug,
  ]);

  const saveDraftRef = useRef(saveDraftToServer);
  saveDraftRef.current = saveDraftToServer;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const key = questCreateSessionKey(spaceSlug);
    skipCreateSessionWrite.current = true;
    if (startFresh) {
      window.sessionStorage.removeItem(key);
      serverDraftIdRef.current = null;
      holdSessionWrite.current = false;
      const url = new URL(window.location.href);
      if (url.searchParams.has('fresh')) {
        url.searchParams.delete('fresh');
        window.history.replaceState(
          null,
          '',
          `${url.pathname}${url.search}${url.hash}`,
        );
      }
      return;
    }
    if (resumeDraftId) {
      let cancelled = false;
      void (async () => {
        try {
          const row = await getQuestDraftRequest({
            spaceSlug,
            draftId: resumeDraftId,
            getAccessToken: getAccessTokenRef.current,
          });
          if (cancelled) return;
          const restored = readQuestCreateSession(
            {
              getItem: () =>
                JSON.stringify({ ...row.payload, draftId: row.id }),
            },
            key,
          );
          if (restored) applyCreateSession(restored);
          draftHydratingRef.current = false;
          holdSessionWrite.current = false;
          setDraftHydrating(false);
          persistCreateSession();
        } catch {
          if (cancelled) return;
          const local = readQuestCreateSession(window.sessionStorage, key);
          if (local) applyCreateSession(local);
          draftHydratingRef.current = false;
          holdSessionWrite.current = false;
          setDraftHydrating(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }
    holdSessionWrite.current = false;
    const restored = readQuestCreateSession(window.sessionStorage, key);
    if (!restored) return;
    applyCreateSession(restored);
  }, [
    applyCreateSession,
    persistCreateSession,
    resumeDraftId,
    spaceSlug,
    startFresh,
  ]);

  useEffect(() => {
    if (draftHydratingRef.current || holdSessionWrite.current) return;
    if (skipCreateSessionWrite.current) {
      skipCreateSessionWrite.current = false;
      return;
    }
    persistCreateSession();
    if (draftConsumedRef.current || submitting) {
      saveDebouncePendingRef.current = false;
      return;
    }
    if (!questCreateDraftIsWorthSaving(currentCreateSession())) {
      saveDebouncePendingRef.current = false;
      if (!saveInFlightRef.current) {
        savingVisibleSinceRef.current = null;
        setDraftSaveState((state) =>
          state === 'saving'
            ? serverDraftIdRef.current
              ? 'saved'
              : 'idle'
            : state,
        );
      }
      return;
    }
    saveDebouncePendingRef.current = true;
    showSaving();
    const timer = window.setTimeout(() => {
      saveDebouncePendingRef.current = false;
      void saveDraftRef.current();
    }, 800);
    return () => {
      window.clearTimeout(timer);
      saveDebouncePendingRef.current = false;
    };
  }, [
    chatMessages,
    currentCreateSession,
    goal,
    leadName,
    members,
    milestones,
    name,
    pendingProposalLink,
    persistCreateSession,
    rewards,
    showSaving,
    scopeIn,
    scopeInMarkdown,
    scopeOut,
    scopeOutMarkdown,
    selectedLeadPersonId,
    stewardStepIndex,
    draftHydrating,
    submitting,
    successCriteria,
    targetDate,
  ]);

  useEffect(() => {
    return () => {
      if (draftHydratingRef.current || draftConsumedRef.current) return;
      const session = {
        draft: draftSnapshotRef.current,
        messages: chatMessagesRef.current,
        step: stewardStepIndexRef.current,
        pending: pendingProposalRef.current,
        checkpoint: pendingProposalLinkRef.current,
        draftId: serverDraftIdRef.current,
      };
      if (!questCreateDraftIsWorthSaving(session)) return;
      void saveQuestDraftRequest({
        spaceSlug,
        id: serverDraftIdRef.current,
        payload: questCreateDraftPayload(session),
        getAccessToken: getAccessTokenRef.current,
        keepalive: true,
      }).catch(() => undefined);
    };
  }, [spaceSlug]);

  const handleSendStewardMessage = useCallback(
    async (overridePrompt?: string) => {
      const rawTrimmed = (overridePrompt ?? chatInput).trim();
      if (!rawTrimmed) return;
      if (!overridePrompt) {
        setChatInput('');
      }

      const trimmed = questHelperTurnMessage(rawTrimmed);
      const generation = ++turnGenerationRef.current;
      const readTurnState = () => ({
        draft: draftSnapshotRef.current,
        pending: pendingProposalRef.current,
        currentStep: QUEST_STEWARD_STEPS[stewardStepIndexRef.current] ?? 'goal',
      });

      const now = new Date();
      setChatMessages((prev) => [
        ...prev,
        {
          id: `u-${now.getTime()}`,
          role: 'user',
          senderName: viewerDisplayName,
          avatarUrl: person?.avatarUrl ?? undefined,
          timestamp: now,
          text: rawTrimmed,
        },
      ]);

      const history = chatMessages.slice(-8).map((entry) => ({
        role: entry.role === 'user' ? ('user' as const) : ('agent' as const),
        text: entry.text,
      }));

      const pushHelper = (text: string) => {
        setChatMessages((prev) => [
          ...prev,
          {
            id: `s-${Date.now()}`,
            role: 'member' as const,
            senderName: QUEST_HELPER_NAME,
            timestamp: new Date(),
            text,
          },
        ]);
      };
      const focusStep = (step: QuestStewardStep) => {
        const index = Math.max(0, QUEST_STEWARD_STEPS.indexOf(step));
        stewardStepIndexRef.current = index;
        setStewardStepIndex(index);
        setActiveSection(step);
      };
      const applyTurn = (
        result: NonNullable<Awaited<ReturnType<typeof settleCreateDraftTurn>>>,
      ) => {
        if (turnGenerationRef.current !== generation) return;
        if (result.wrote) commitDraftSnapshot(result.draft);
        pendingProposalRef.current = result.pending;
        focusStep(result.focusStep);
        pushHelper(result.reply);
      };

      const usesModel = questDraftTurnUsesModel(trimmed);
      setIsAgentTyping(questHelperTypingForTurn(usesModel));
      try {
        const settled = await settleCreateDraftTurn({
          message: trimmed,
          history,
          viewerDisplayName,
          spaceMembers,
          readState: readTurnState,
          isCurrent: () => turnGenerationRef.current === generation,
          loadModel: async () => {
            const snapshot = draftSnapshotRef.current;
            const currentStep =
              QUEST_STEWARD_STEPS[stewardStepIndexRef.current] ?? 'goal';
            const pendingNow = pendingProposalRef.current;
            try {
              const token = await getAccessToken?.().catch(() => null);
              if (!token || turnGenerationRef.current !== generation) {
                return null;
              }
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
                  body: JSON.stringify({
                    message: trimmed,
                    currentStep,
                    spaceTitle: space?.title,
                    draft: {
                      name: snapshot.name,
                      goal: snapshot.goal,
                      scopeIn: snapshot.scopeIn,
                      scopeOut: snapshot.scopeOut,
                      successCriteria: snapshot.successCriteria,
                      targetDate: snapshot.targetDate,
                      leadName: snapshot.leadName,
                      rewards: snapshot.rewards,
                      milestones: snapshot.milestones.map((m) => ({
                        name: m.name,
                        dueDate: m.dueDate,
                        description: m.description,
                        ownerName: m.ownerName,
                      })),
                      members: snapshot.members.map((m) => ({
                        memberName: m.memberName,
                        roleLabel: m.roleLabel,
                        responsibilities: m.responsibilities,
                      })),
                    },
                    spaceMembers: spaceMembers.slice(0, 60).map((m) => ({
                      personId: m.personId,
                      name: m.name,
                    })),
                    history: questAssistHistoryEntries(history),
                    pendingSuggestion: questHelperPendingSuggestion(pendingNow),
                  }),
                },
              );
              if (turnGenerationRef.current !== generation || !response.ok) {
                return null;
              }
              return (await response.json()) as QuestDraftModelTurn;
            } catch {
              return null;
            }
          },
        });
        if (settled) applyTurn(settled);
      } finally {
        const typing = questHelperTypingAfterTurn(
          generation,
          turnGenerationRef.current,
        );
        if (typing === false) setIsAgentTyping(false);
      }
    },
    [
      chatInput,
      chatMessages,
      commitDraftSnapshot,
      getAccessToken,
      goal,
      leadName,
      members,
      milestones,
      name,
      person?.avatarUrl,
      rewards,
      scopeIn,
      scopeInMarkdown,
      scopeOut,
      scopeOutMarkdown,
      selectedLeadPersonId,
      space?.title,
      spaceMembers,
      spaceSlug,
      stewardStepIndex,
      successCriteria,
      targetDate,
      viewerDisplayName,
    ],
  );

  const handleSendRef = useRef(handleSendStewardMessage);
  handleSendRef.current = handleSendStewardMessage;
  const triggerSend = useCallback(() => {
    void handleSendRef.current();
  }, []);

  const draftChatSession = useMemo(
    () => ({
      spaceSlug,
      questTitle: name.trim() || 'New quest',
      messages: chatMessages,
      input: chatInput,
      onInputChange: setChatInput,
      onSend: triggerSend,
      isAgentTyping,
      coach: 'quest-helper' as const,
    }),
    [chatInput, chatMessages, isAgentTyping, name, spaceSlug, triggerSend],
  );

  const closeCreateChatRef = useRef({
    dismissQuestChat,
    setSpaceQuestDraft,
  });
  closeCreateChatRef.current = { dismissQuestChat, setSpaceQuestDraft };

  // Keep the helper session ready. The create page has no discussion room
  // yet, so the button opens this helper instead of a Matrix room.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1200) {
      closeAiPanel();
    }
    return () => {
      closeCreateChatRef.current.dismissQuestChat();
      closeCreateChatRef.current.setSpaceQuestDraft(null);
    };
  }, [closeAiPanel]);

  const openedHelperOnArrivalRef = useRef(false);
  useEffect(() => {
    if (draftHydrating) return;
    setSpaceQuestDraft(draftChatSession);
    if (!panelAvailable || openedHelperOnArrivalRef.current) return;
    openedHelperOnArrivalRef.current = true;
    requestQuestChat();
  }, [
    draftChatSession,
    draftHydrating,
    panelAvailable,
    requestQuestChat,
    setSpaceQuestDraft,
  ]);

  const toggleQuestHelper = () => {
    if (!panelAvailable) {
      setHelperInlineOpen((current) => !current);
      return;
    }
    if (questChatRequested && helperPanelOpen) {
      closeHumanChatPanel();
      return;
    }
    requestQuestChat();
  };

  /**
   * Hard Rule #1:
   * CREATE QUEST -> Are you sure? -> YES, CREATE PROPOSAL creates an Agreements
   * proposal immediately (and a Proposed Quest linked to it, not an Active Quest yet).
   */
  const handleConfirmCreateProposal = async () => {
    setSubmitting(true);
    setSubmitError(null);
    setDeployReload(false);
    setProposalLinkError(null);
    setConfirmOpen(false);

    const readProposalLink = () => {
      const current = agreementRef.current as {
        slug?: string | null;
        proposalId?: bigint | number | string | null;
        web3ProposalId?: number | null;
      } | null;
      return {
        slug: current?.slug,
        proposalId: current?.proposalId,
        web3ProposalId: current?.web3ProposalId,
      };
    };

    const persistProposalOnChain = async (agreementSlug: string) => {
      const deadline = Date.now() + 30_000;
      let proposalId: number | null = null;
      while (Date.now() < deadline) {
        const current = readProposalLink();
        const slugMatches = !current.slug || current.slug === agreementSlug;
        if (slugMatches) {
          proposalId = chainProposalId(current);
          if (proposalId) break;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      if (!proposalId) {
        throw new Error(
          'The proposal is not on voting yet. Submit again to retry the link.',
        );
      }
      // Write the chain id onto the proposal before the quest link check.
      // The orchestrator update can fail its client return while the quest
      // link still needs web3ProposalId stored on the document.
      await updateAgreementBySlug({
        slug: agreementSlug,
        web3ProposalId: proposalId,
      });
    };

    const finishLinked = (target: PendingProposalLink) => {
      setPendingProposalLink(null);
      setProposalLinkError(null);
      dismissQuestChat();
      closeCoherenceChat();
      closeHumanChatPanel();
      setSpaceQuestDraft(null);
      router.push(
        target.agreementSlug
          ? proposalPageHref(locale, spaceSlug, target.agreementSlug)
          : questPageHref(locale, spaceSlug, target.questSlug),
      );
    };

    const linkCreatedQuest = async (target: PendingProposalLink) => {
      let persistError: unknown = null;
      if (target.agreementSlug) {
        try {
          await persistProposalOnChain(target.agreementSlug);
        } catch (error) {
          // The chain id may already be stored if the action wrote the row
          // and then failed while returning it. The quest link reads that row.
          persistError = error;
        }
      }
      try {
        await patchSpaceQuestRequest({
          spaceSlug,
          questSlug: target.questSlug,
          patch: { proposalDocumentId: target.agreementId },
          getAccessToken,
        });
      } catch (patchError) {
        if (persistError) throw persistError;
        throw patchError;
      }
      finishLinked(target);
    };

    let linkTarget: PendingProposalLink | null = pendingProposalLink;

    try {
      if (linkTarget) {
        await linkCreatedQuest(linkTarget);
        return;
      }

      const cleanLeadName =
        leadName.replace(/\s*\(you\)\s*/i, '').trim() || viewerDisplayName;
      const leadPersonId =
        selectedLeadPersonId ??
        (cleanLeadName === viewerDisplayName
          ? person?.id ?? null
          : findQuestSpaceMemberId(spaceMembers, cleanLeadName));
      const draftPayload: QuestDraftInput = {
        name: name.trim() || 'Untitled quest',
        goal: goal.trim(),
        scopeIn,
        scopeOut,
        scopeInMarkdown,
        scopeOutMarkdown,
        successCriteria,
        rewards: rewards.filter(
          (r) => r.amount.trim().length > 0 && r.token.trim().length > 0,
        ),
        targetDate,
        leadPersonId,
        leadName: cleanLeadName,
        milestones: milestones.map((m) => ({
          name: m.name,
          description: m.description,
          dueDate: m.dueDate,
          ownerName: m.ownerName,
          status: m.status,
        })),
        members: withoutPlaceholderLeadDuplicates([
          {
            personId: leadPersonId,
            memberName: cleanLeadName,
            roleLabel: 'Lead',
            responsibilities: ['Overall delivery', 'Unblock reviews'],
          },
          ...members.map((m) => ({
            personId:
              m.personId ?? findQuestSpaceMemberId(spaceMembers, m.memberName),
            memberName: m.memberName,
            roleLabel: draftParticipantRoleLabel(m.roleLabel),
            responsibilities: m.responsibilities,
          })),
        ]),
      };

      // The quest slug is unknown until create; reserve room for the longest one.
      const descriptionLength = buildQuestProposalDescription(
        draftPayload,
        'q'.repeat(52),
      ).length;
      if (descriptionLength > QUEST_PROPOSAL_DESCRIPTION_LIMIT) {
        setSubmitError(
          'This quest is too long to publish as a proposal. Shorten the goal, scope, milestones or participants and try again.',
        );
        return;
      }

      if (!(jwt && space?.id && person?.id)) {
        setSubmitError(
          'Your session or space data is not ready. Wait a moment and try again.',
        );
        return;
      }

      if (!draftPayload.leadPersonId) {
        setSubmitError(
          'Select a participant as the Quest Lead before creating the proposal.',
        );
        return;
      }

      // 1. Create the Quest row in `proposed` status (not Active yet)
      const createdQuest = await createSpaceQuestRequest({
        spaceSlug,
        body: {
          name: draftPayload.name,
          goal: draftPayload.goal,
          scopeIn: draftPayload.scopeIn,
          scopeOut: draftPayload.scopeOut,
          scopeInMarkdown: draftPayload.scopeInMarkdown,
          scopeOutMarkdown: draftPayload.scopeOutMarkdown,
          successCriteria: draftPayload.successCriteria,
          rewards: draftPayload.rewards,
          targetDate: draftPayload.targetDate,
          leadPersonId: draftPayload.leadPersonId,
          leadName: draftPayload.leadName,
          status: 'proposed',
          milestones: draftPayload.milestones.map((m) => ({
            name: m.name,
            description: m.description,
            dueDate: m.dueDate,
            ownerName: m.ownerName,
            status: m.status ?? 'not_started',
          })),
          members: draftPayload.members.map((m) => ({
            personId: m.personId ?? null,
            memberName: m.memberName,
            roleLabel: draftParticipantRoleLabel(m.roleLabel),
            responsibilities: m.responsibilities,
          })),
          deliverables: deliverables
            .filter((item) => item.name.trim().length > 0)
            .map((item) => ({
              name: item.name.trim(),
              url: item.url.trim() || null,
              note: item.note.trim() || null,
            })),
        },
        getAccessToken,
      });
      const createdQuestSlug = createdQuest.slug;

      // Describe the saved quest, not the pre-save draft, so the link check
      // compares the proposal payload to the same terms that were stored.
      const description = buildQuestProposalDescription(
        questRecordToProposalDraft(createdQuest),
        createdQuestSlug,
      );
      if (description.length > QUEST_PROPOSAL_DESCRIPTION_LIMIT) {
        await deleteSpaceQuestRequest({
          spaceSlug,
          questSlug: createdQuestSlug,
          getAccessToken,
        }).catch(() => undefined);
        setSubmitError(
          'This quest is too long to publish as a proposal. Shorten the goal, scope, milestones or participants and try again.',
        );
        return;
      }

      let createdAgreement: Awaited<ReturnType<typeof createAgreement>>;
      try {
        createdAgreement = await createAgreement({
          title: draftPayload.name.slice(0, 50),
          description,
          label: QUEST_DOCUMENT_LABEL,
          creatorId: person.id,
          spaceId: space.id,
          ...(typeof space.web3SpaceId === 'number'
            ? { web3SpaceId: space.web3SpaceId }
            : {}),
        });
      } catch (agreementErr) {
        const plan = questPublishFailurePlan(agreementErr, createdQuestSlug);
        if (plan.kind === 'stale' && plan.keepAgreement) {
          linkTarget = {
            questSlug: createdQuestSlug,
            agreementId: plan.keepAgreement.id,
            agreementSlug: plan.keepAgreement.slug,
            proposalTitle: draftPayload.name,
          };
          pendingProposalLinkRef.current = linkTarget;
          setPendingProposalLink(linkTarget);
          throw agreementErr;
        }
        // A proposed quest without a proposal can never be activated.
        await deleteSpaceQuestRequest({
          spaceSlug,
          questSlug: createdQuestSlug,
          getAccessToken,
        }).catch(() => undefined);
        throw agreementErr;
      }

      if (!createdAgreement?.id) {
        await deleteSpaceQuestRequest({
          spaceSlug,
          questSlug: createdQuestSlug,
          getAccessToken,
        }).catch(() => undefined);
        throw new Error('Failed to create quest proposal.');
      }

      linkTarget = {
        questSlug: createdQuestSlug,
        agreementId: createdAgreement.id,
        agreementSlug: createdAgreement.slug ?? null,
        proposalTitle: draftPayload.name,
      };
      pendingProposalLinkRef.current = linkTarget;
      setPendingProposalLink(linkTarget);
      draftConsumedRef.current = true;
      const consumedDraftId = serverDraftIdRef.current;
      serverDraftIdRef.current = null;
      if (consumedDraftId) {
        void deleteQuestDraftRequest({
          spaceSlug,
          draftId: consumedDraftId,
          getAccessToken,
        }).catch(() => undefined);
      }
      persistCreateSession();

      await linkCreatedQuest(linkTarget);
    } catch (err) {
      const plan = questPublishFailurePlan(err, null);
      if (plan.kind === 'stale') {
        resetAgreementProgress();
        persistCreateSession();
        setDeployReload(true);
        setSubmitError(null);
        return;
      }
      if (linkTarget) {
        const raw = readableQuestErrorMessage(
          err instanceof Error ? err.message : '',
        );
        const detail =
          !raw || raw.includes('Server Components') || raw.length > 240
            ? 'Linking did not finish. Open the quest or the proposal, or submit again to retry only the link.'
            : raw;
        setProposalLinkError({
          proposalTitle: linkTarget.proposalTitle,
          href: linkTarget.agreementSlug
            ? proposalPageHref(locale, spaceSlug, linkTarget.agreementSlug)
            : null,
          questHref: questPageHref(locale, spaceSlug, linkTarget.questSlug),
          detail,
        });
      } else {
        setSubmitError(
          readableQuestErrorMessage(
            err instanceof Error
              ? err.message
              : 'Failed to create quest proposal.',
          ),
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const proposalCharacterCount = useMemo(() => {
    const cleanLeadName =
      leadName.replace(/\s*\(you\)\s*/i, '').trim() || viewerDisplayName;
    const leadPersonId =
      selectedLeadPersonId ??
      (cleanLeadName === viewerDisplayName
        ? person?.id ?? null
        : findQuestSpaceMemberId(spaceMembers, cleanLeadName));
    try {
      return buildQuestProposalDescription(
        {
          name: name.trim() || 'Untitled quest',
          goal: goal.trim(),
          scopeIn,
          scopeOut,
          scopeInMarkdown,
          scopeOutMarkdown,
          successCriteria,
          rewards: rewards.filter(
            (reward) =>
              reward.amount.trim().length > 0 && reward.token.trim().length > 0,
          ),
          targetDate,
          leadPersonId,
          leadName: cleanLeadName,
          milestones: milestones.map((milestone) => ({
            name: milestone.name,
            description: milestone.description ?? '',
            dueDate: milestone.dueDate,
            ownerName: milestone.ownerName,
          })),
          members: withoutPlaceholderLeadDuplicates([
            {
              personId: leadPersonId,
              memberName: cleanLeadName,
              roleLabel: 'Lead',
              responsibilities: ['Overall delivery', 'Unblock reviews'],
            },
            ...members.map((member) => ({
              personId:
                member.personId ??
                findQuestSpaceMemberId(spaceMembers, member.memberName),
              memberName: member.memberName,
              roleLabel: draftParticipantRoleLabel(member.roleLabel),
              responsibilities: member.responsibilities,
            })),
          ]),
        },
        'q'.repeat(52),
      ).length;
    } catch {
      return QUEST_PROPOSAL_DESCRIPTION_LIMIT + 1;
    }
  }, [
    goal,
    leadName,
    members,
    milestones,
    name,
    person?.id,
    rewards,
    scopeIn,
    scopeInMarkdown,
    scopeOut,
    scopeOutMarkdown,
    selectedLeadPersonId,
    spaceMembers,
    successCriteria,
    targetDate,
    viewerDisplayName,
  ]);
  const proposalOverLimit =
    proposalCharacterCount > QUEST_PROPOSAL_DESCRIPTION_LIMIT;
  // The title is optional: submit stores "Untitled quest" when it is blank.
  // Goal is the only required field. A draft that is too long to publish is
  // the other block, and that case already explains itself beside the button.
  const createProposalBlocked =
    !pendingProposalLink && (!goal.trim() || proposalOverLimit);

  const questsListHref = `/${locale}/dho/${spaceSlug}/quests`;
  const leaveCreate = () => {
    router.push(questsListHref);
  };
  const requestCancel = () => {
    if (pendingProposalLink) {
      leaveCreate();
      return;
    }
    if (
      serverDraftIdRef.current ||
      questCreateDraftIsWorthSaving(currentCreateSession())
    ) {
      setCancelOpen(true);
      return;
    }
    leaveCreate();
  };
  const keepDraftAndLeave = async () => {
    const savedId = await saveDraftToServer();
    if (
      savedId == null &&
      questCreateDraftIsWorthSaving(currentCreateSession())
    ) {
      setCancelOpen(false);
      return;
    }
    setCancelOpen(false);
    leaveCreate();
  };
  const discardDraftAndLeave = async () => {
    const id = serverDraftIdRef.current;
    draftConsumedRef.current = true;
    serverDraftIdRef.current = null;
    window.sessionStorage.removeItem(questCreateSessionKey(spaceSlug));
    setCancelOpen(false);
    if (id) {
      await deleteQuestDraftRequest({
        spaceSlug,
        draftId: id,
        getAccessToken,
      }).catch(() => undefined);
    }
    leaveCreate();
  };
  const scopeInPreview =
    scopeInMarkdown.trim() || bulletsToMarkdownList(scopeIn);
  const scopeOutPreview =
    scopeOutMarkdown.trim() || bulletsToMarkdownList(scopeOut);
  const cleanLead = stripViewerYouMarker(leadName).trim();
  const leadMember = findQuestSpaceMember(spaceMembers, {
    personId: selectedLeadPersonId ?? person?.id,
    name: cleanLead,
  });
  const viewerIsLead =
    cleanLead.length > 0 &&
    cleanLead.toLowerCase() === viewerDisplayName.trim().toLowerCase();
  const leadAvatarUrl =
    leadMember?.avatarUrl ?? (viewerIsLead ? person?.avatarUrl ?? null : null);
  const leadPersonId =
    leadMember?.personId ?? (viewerIsLead ? person?.id : null);
  return (
    <SpaceLoadingBackdrop
      progress={progress}
      isLoading={isPending}
      fullHeight
      showKeepWindowOpenMessage
      keepWindowOpenMessage={tAgreementFlow('loadingBackdrop.keepWindowOpen')}
      message={<div>{currentAction || 'Creating Quest Proposal…'}</div>}
    >
      <>
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
          {/* Main Draft Column */}
          <div className="min-w-0 flex-1 space-y-5">
            <div
              data-testid="quest-create-intro"
              className="flex flex-col gap-1"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="New quest"
                      aria-label="Quest title"
                      data-testid="quest-create-title"
                      className="w-auto max-w-[min(100%,36rem)] bg-transparent font-display text-[18px] font-semibold leading-none text-foreground outline-none [field-sizing:content] placeholder:text-neutral-11"
                    />
                    <span className="shrink-0 bg-neutral-3 px-2 py-0.5 text-[11px] font-semibold text-foreground">
                      Draft
                    </span>
                  </div>
                  {draftHydrating ? (
                    <div
                      data-testid="quest-draft-save-status"
                      data-state="loading"
                      aria-busy="true"
                      aria-live="polite"
                      className={DRAFT_SAVE_STATUS_CLASS}
                    >
                      <span className="h-3 w-24 bg-neutral-4" aria-hidden />
                    </div>
                  ) : draftSaveState === 'error' ? (
                    <button
                      type="button"
                      onClick={() => void saveDraftToServer()}
                      data-testid="quest-draft-save-status"
                      className={`${DRAFT_SAVE_STATUS_CLASS} text-error-11`}
                    >
                      {tDrafts('drafts.retry')}
                    </button>
                  ) : (
                    <div
                      data-testid="quest-draft-save-status"
                      aria-live="polite"
                      className={DRAFT_SAVE_STATUS_CLASS}
                    >
                      {draftSaveState === 'saving' ? (
                        <>
                          <Loader2
                            className="size-3.5 shrink-0 animate-spin text-neutral-11"
                            aria-hidden
                          />
                          <span className="text-neutral-11">
                            {tDrafts('drafts.saving')}
                          </span>
                        </>
                      ) : draftSaveState === 'saved' ? (
                        <>
                          <Check
                            className="size-3.5 shrink-0 text-success-11"
                            aria-hidden
                          />
                          <span className="text-success-11">
                            {tDrafts('drafts.savedAuto')}
                          </span>
                        </>
                      ) : (
                        <span className="text-neutral-11">
                          {tDrafts('drafts.notSaved')}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      colorVariant="neutral"
                      className="rounded-none"
                      onClick={requestCancel}
                      data-testid="cancel-quest-button"
                    >
                      CANCEL
                    </Button>
                    <Button
                      type="button"
                      disabled={submitting || createProposalBlocked}
                      onClick={() => setConfirmOpen(true)}
                      data-testid="create-quest-button"
                      className="bg-foreground text-background hover:bg-foreground/90"
                    >
                      CREATE PROPOSAL
                    </Button>
                  </div>
                  <button
                    type="button"
                    onClick={toggleQuestHelper}
                    data-testid="open-quest-discussion-button"
                    className="inline-flex items-center gap-1 text-xs font-bold text-foreground underline-offset-2 hover:underline"
                  >
                    Open discussion
                    <span aria-hidden>→</span>
                  </button>
                </div>
              </div>

              <p className="text-xs text-neutral-11">
                Fills in live as you chat · click any section to edit
              </p>
            </div>

            {proposalLinkError ? (
              <div className="border border-error-6 bg-background-2 px-4 py-3 text-xs text-error-11">
                The quest was created.{' '}
                <Link
                  href={proposalLinkError.questHref}
                  className="font-semibold underline"
                >
                  Open quest
                </Link>
                .{' '}
                {proposalLinkError.href ? (
                  <Link
                    href={proposalLinkError.href}
                    className="font-semibold underline"
                  >
                    Open proposal {proposalLinkError.proposalTitle}
                  </Link>
                ) : (
                  <span className="font-semibold">
                    Proposal {proposalLinkError.proposalTitle}
                  </span>
                )}
                . {proposalLinkError.detail} Submitting again only retries the
                link.
              </div>
            ) : null}
            {proposalOverLimit && !pendingProposalLink ? (
              <div className="border border-error-6 bg-background-2 px-4 py-3 text-xs text-error-11">
                This quest is too long to publish as a proposal. Shorten the
                goal, scope, milestones or participants before creating.
              </div>
            ) : null}
            {deployReload ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border border-error-6 bg-background-2 px-4 py-3 text-xs text-error-11">
                <p>{STALE_DEPLOYMENT_MESSAGE}</p>
                <Button
                  type="button"
                  variant="outline"
                  colorVariant="neutral"
                  className="rounded-none"
                  onClick={() => window.location.reload()}
                >
                  Reload
                </Button>
              </div>
            ) : null}
            {submitError ? (
              <div className="border border-error-6 bg-background-2 px-4 py-3 text-xs text-error-11">
                {submitError}
              </div>
            ) : null}

            {/* Two-column draft grid (Figma node 6:2) — NO Priority anywhere */}
            {draftHydrating ? (
              <DraftResumeSkeleton />
            ) : (
              <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-[minmax(0,1fr)_330px]">
                <div className="space-y-2.5">
                  {/* GOAL */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setActiveSection('goal');
                      setEditingModal('goal');
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      setActiveSection('goal');
                      setEditingModal('goal');
                    }}
                    data-testid="draft-section-goal"
                    className={cn(
                      'flex w-full flex-col items-start gap-1.5 border p-3.5 text-left transition-colors',
                      activeSection === 'goal'
                        ? 'border-[#4b4bff] bg-[#f6f5ff] dark:bg-accent-2'
                        : 'border-border bg-background hover:border-foreground/40',
                    )}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className={LABEL_CLASS}>GOAL</span>
                      <span className="text-xs text-neutral-11">✎</span>
                    </div>
                    <QuestSectionMarkdown markdown={goal} />
                  </div>

                  {/* SCOPE */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setActiveSection('scope');
                      setEditingModal('scope');
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      setActiveSection('scope');
                      setEditingModal('scope');
                    }}
                    data-testid="draft-section-scope"
                    className={cn(
                      'flex w-full flex-col items-start gap-1.5 border p-3.5 text-left transition-colors',
                      activeSection === 'scope'
                        ? 'border-[#4b4bff] bg-[#f6f5ff] dark:bg-accent-2'
                        : 'border-border bg-background hover:border-foreground/40',
                    )}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className={LABEL_CLASS}>SCOPE</span>
                      <span className="text-xs text-neutral-11">✎</span>
                    </div>
                    <div className="w-full space-y-2 text-[13px] text-foreground">
                      {!scopeInPreview && !scopeOutPreview ? (
                        <span className="text-neutral-11">
                          Not set yet — reply in chat or click to edit
                        </span>
                      ) : (
                        <>
                          {scopeInPreview ? (
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-neutral-11">
                                In
                              </p>
                              <QuestSectionMarkdown
                                markdown={scopeInPreview}
                                empty=""
                              />
                            </div>
                          ) : null}
                          {scopeOutPreview ? (
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-neutral-11">
                                Out
                              </p>
                              <QuestSectionMarkdown
                                markdown={scopeOutPreview}
                                empty=""
                              />
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>

                  {/* SUCCESS CRITERIA */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setActiveSection('success');
                      setEditingModal('success');
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      setActiveSection('success');
                      setEditingModal('success');
                    }}
                    data-testid="draft-section-success"
                    className={cn(
                      'flex w-full flex-col items-start gap-1.5 border p-3.5 text-left transition-colors',
                      activeSection === 'success'
                        ? 'border-[#4b4bff] bg-[#f6f5ff] dark:bg-accent-2'
                        : 'border-border bg-background hover:border-foreground/40',
                    )}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className={LABEL_CLASS}>SUCCESS CRITERIA</span>
                      <span className="text-xs text-neutral-11">✎</span>
                    </div>
                    <QuestSectionMarkdown markdown={successCriteria} />
                  </div>

                  {/* QUEST REWARD (Node 91:2 — inline editable multi-token amount + select + ADD TOKEN) */}
                  <div
                    data-testid="draft-section-rewards"
                    className={cn(
                      'flex w-full flex-col items-start gap-2.5 border p-3.5 transition-colors',
                      activeSection === 'rewards'
                        ? 'border-[#4b4bff] bg-[#f6f5ff] dark:bg-accent-2'
                        : 'border-border bg-background',
                    )}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className={LABEL_CLASS}>QUEST REWARD</span>
                      <button
                        type="button"
                        onClick={() => setEditingModal('rewards')}
                        className="text-xs text-neutral-11 hover:text-foreground"
                        aria-label="Edit quest reward"
                      >
                        ✎
                      </button>
                    </div>

                    <QuestRewardRowsEditor
                      rows={rewards}
                      onChange={setRewards}
                      spaceSlug={spaceSlug}
                      addTestId="add-reward-token-button"
                    />
                  </div>

                  {/* MILESTONES */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setActiveSection('milestones');
                      setEditingModal('milestones');
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      setActiveSection('milestones');
                      setEditingModal('milestones');
                    }}
                    data-testid="draft-section-milestones"
                    className={cn(
                      'flex w-full flex-col items-start gap-2 border p-3.5 text-left transition-colors',
                      activeSection === 'milestones'
                        ? 'border-[#4b4bff] bg-[#f6f5ff] dark:bg-accent-2'
                        : 'border-border bg-background hover:border-foreground/40',
                    )}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className={LABEL_CLASS}>MILESTONES</span>
                      <span className="text-xs text-neutral-11">✎</span>
                    </div>
                    <div className="w-full space-y-2">
                      {milestones.length === 0 ? (
                        <p className="text-[13px]">
                          <span className="text-neutral-11">
                            Not set yet — reply in chat or click to edit
                          </span>
                        </p>
                      ) : null}
                      {milestones.map((m, idx) => (
                        <div key={idx} className="space-y-0.5 py-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[13px] font-semibold text-foreground">
                              M{idx + 1} · {m.name}
                            </span>
                            <span className="text-xs text-neutral-11">
                              {m.dueDate
                                ? formatQuestCalendarDate(m.dueDate, locale)
                                : '—'}
                            </span>
                          </div>
                          {m.description ? (
                            <QuestSectionMarkdown
                              markdown={m.description}
                              empty=""
                            />
                          ) : null}
                          {m.ownerName ? (
                            <p className="text-[11px] text-neutral-11">
                              Owner · {m.ownerName}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right column: Lead, Participants, Target Date */}
                <div className="space-y-2.5">
                  {/* LEAD */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSection('lead');
                      setEditingModal('lead');
                    }}
                    data-testid="draft-section-lead"
                    className="flex w-full flex-col items-start gap-2 border border-border bg-background p-3.5 text-left hover:border-foreground/40"
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className={LABEL_CLASS}>LEAD</span>
                      <span className="text-xs text-neutral-11">✎</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <PersonAvatar
                        size="sm"
                        shape="circle"
                        showPresence={false}
                        avatarSrc={leadAvatarUrl ?? undefined}
                        userName={cleanLead || leadName}
                        personId={leadPersonId ?? undefined}
                      />
                      <span className="text-[13px] font-semibold text-foreground">
                        {leadName}
                      </span>
                      <span className="text-xs text-neutral-11">Lead</span>
                    </div>
                  </button>

                  <QuestDraftParticipantsCard
                    members={members.map((m) => {
                      const rosterMember = findQuestSpaceMember(spaceMembers, {
                        personId: m.personId,
                        name: m.memberName,
                      });
                      const memberAvatar =
                        m.memberAvatarUrl ??
                        rosterMember?.avatarUrl ??
                        (stripViewerYouMarker(m.memberName)
                          .trim()
                          .toLowerCase() ===
                        viewerDisplayName.trim().toLowerCase()
                          ? person?.avatarUrl
                          : null);
                      return {
                        memberName: m.memberName,
                        roleLabel: draftParticipantRoleLabel(m.roleLabel),
                        responsibilities: m.responsibilities,
                        avatarSrc: memberAvatar ?? undefined,
                        personId:
                          m.personId && m.personId > 0
                            ? m.personId
                            : rosterMember?.personId,
                      };
                    })}
                    onEdit={() => {
                      setActiveSection('members');
                      setEditingModal('members');
                    }}
                  />

                  {/* TARGET DATE (NO Priority section below this!) */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSection('targetDate');
                      setEditingModal('targetDate');
                    }}
                    data-testid="draft-section-target-date"
                    className="flex w-full flex-col items-start gap-1.5 border border-border bg-background p-3.5 text-left hover:border-foreground/40"
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className={LABEL_CLASS}>TARGET DATE</span>
                      <span className="text-xs text-neutral-11">✎</span>
                    </div>
                    <p className="text-[13px] font-semibold text-foreground">
                      {targetDate
                        ? formatQuestCalendarDate(targetDate, locale)
                        : '—'}
                    </p>
                  </button>
                </div>
              </div>
            )}
          </div>

          {!panelAvailable && helperInlineOpen ? (
            <SpaceQuestChatPanel session={draftChatSession} />
          ) : null}
        </div>

        {/* Confirm Dialog ("Are you sure?" — Figma node 93:2) */}
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent
            hideCloseButton
            className="max-w-[480px] rounded-none border border-border bg-background p-6"
          >
            <div className="space-y-4">
              <DialogTitle className="font-display text-[18px] font-bold text-foreground">
                {tDrafts('confirm.title')}
              </DialogTitle>
              <p className="text-[13px] leading-relaxed text-neutral-11">
                {tDrafts('confirm.body', {
                  space: space?.title?.trim() || spaceSlug,
                })}
              </p>
              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  colorVariant="neutral"
                  onClick={() => setConfirmOpen(false)}
                  data-testid="confirm-cancel-button"
                  className="rounded-none"
                >
                  {tDrafts('confirm.cancel')}
                </Button>
                <Button
                  type="button"
                  disabled={createProposalBlocked}
                  onClick={() => void handleConfirmCreateProposal()}
                  data-testid="confirm-create-proposal-button"
                  className="bg-foreground text-background hover:bg-foreground/90"
                >
                  {tDrafts('confirm.submit')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
          <DialogContent
            hideCloseButton
            className="max-w-[480px] rounded-none border border-border bg-background p-6"
          >
            <div className="space-y-4">
              <DialogTitle className="font-display text-[18px] font-bold text-foreground">
                {tDrafts('drafts.keepTitle')}
              </DialogTitle>
              <DialogDescription className="text-[13px] leading-relaxed text-neutral-11">
                {tDrafts('drafts.keepBody')}
              </DialogDescription>
              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  colorVariant="neutral"
                  onClick={() => void discardDraftAndLeave()}
                  data-testid="discard-quest-draft-button"
                  className="rounded-none"
                >
                  {tDrafts('drafts.discard')}
                </Button>
                <Button
                  type="button"
                  onClick={() => void keepDraftAndLeave()}
                  data-testid="keep-quest-draft-button"
                  className="bg-foreground text-background hover:bg-foreground/90"
                >
                  {tDrafts('drafts.keep')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Section Edit Modals */}
        <EditQuestDeliverablesModal
          open={editingModal === 'deliverables'}
          onOpenChange={(open) => !open && setEditingModal(null)}
          deliverables={deliverables}
          onSave={setDeliverables}
        />
        <EditQuestNameModal
          open={editingModal === 'name'}
          onOpenChange={(open) => !open && setEditingModal(null)}
          value={name}
          onSave={setName}
          onLiveChange={setName}
        />
        <EditQuestGoalModal
          open={editingModal === 'goal'}
          onOpenChange={(open) => !open && setEditingModal(null)}
          value={goal}
          onSave={setGoal}
          onLiveChange={setGoal}
        />
        <EditQuestScopeModal
          open={editingModal === 'scope'}
          onOpenChange={(open) => !open && setEditingModal(null)}
          scopeIn={scopeIn}
          scopeOut={scopeOut}
          scopeInMarkdown={scopeInMarkdown}
          scopeOutMarkdown={scopeOutMarkdown}
          onSave={(next) => {
            setScopeIn(next.scopeIn);
            setScopeOut(next.scopeOut);
            setScopeInMarkdown(next.scopeInMarkdown);
            setScopeOutMarkdown(next.scopeOutMarkdown);
          }}
          onLiveChange={(next) => {
            setScopeIn(next.scopeIn);
            setScopeOut(next.scopeOut);
            setScopeInMarkdown(next.scopeInMarkdown);
            setScopeOutMarkdown(next.scopeOutMarkdown);
          }}
        />
        <EditQuestSuccessModal
          open={editingModal === 'success'}
          onOpenChange={(open) => !open && setEditingModal(null)}
          value={successCriteria}
          onSave={setSuccessCriteria}
          onLiveChange={setSuccessCriteria}
        />
        <EditQuestRewardsModal
          open={editingModal === 'rewards'}
          onOpenChange={(open) => !open && setEditingModal(null)}
          rewards={rewards}
          spaceSlug={spaceSlug}
          onSave={setRewards}
          onLiveChange={setRewards}
        />
        <EditQuestMilestonesModal
          open={editingModal === 'milestones'}
          onOpenChange={(open) => !open && setEditingModal(null)}
          milestones={milestones}
          spaceMembers={spaceMemberPersons}
          spaceMemberNames={spaceMemberNames}
          onSave={setMilestones}
          onLiveChange={setMilestones}
        />
        <EditQuestLeadModal
          open={editingModal === 'lead'}
          onOpenChange={(open) => !open && setEditingModal(null)}
          leadName={leadName}
          leadPersonId={selectedLeadPersonId ?? person?.id ?? null}
          spaceMembers={spaceMemberPersons}
          spaceMemberNames={spaceMemberNames}
          onSave={(nextLeadName, nextLeadPersonId) => {
            setLeadNameOverride(nextLeadName);
            setSelectedLeadPersonId(nextLeadPersonId ?? null);
          }}
          onLiveChange={(nextLeadName, nextLeadPersonId) => {
            setLeadNameOverride(nextLeadName);
            setSelectedLeadPersonId(nextLeadPersonId ?? null);
          }}
        />
        <EditQuestMembersModal
          open={editingModal === 'members'}
          onOpenChange={(open) => !open && setEditingModal(null)}
          members={members}
          spaceMembers={spaceMemberPersons}
          spaceMemberNames={spaceMemberNames}
          onSave={setMembers}
          onLiveChange={setMembers}
        />
        <EditQuestTargetDateModal
          open={editingModal === 'targetDate'}
          onOpenChange={(open) => !open && setEditingModal(null)}
          value={targetDate}
          onSave={setTargetDate}
          onLiveChange={setTargetDate}
        />
      </>
    </SpaceLoadingBackdrop>
  );
}
