'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import {
  QUEST_DEFAULT_REWARD_TOKENS,
  QUEST_DOCUMENT_LABEL,
  QUEST_STEWARD_STEPS,
  buildQuestProposalDescription,
  selectSpecialistForQuestion,
  specialistById,
  splitMarkdownLinesToBullets,
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
  DialogTitle,
  Input,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useConfig } from 'wagmi';
import { recordMobilizedAiAgentsForQuestion } from '../../common/ai-agent-competencies';
import {
  useAiPanel,
  useHumanChatPanel,
  type SpaceQuestDraftChatMessage,
} from '../../common/human-chat-panel-context';
import { SpaceLoadingBackdrop } from '../../spaces/components/space-loading-backdrop';
import {
  createSpaceQuestRequest,
  deleteSpaceQuestRequest,
  findQuestSpaceMemberId,
  patchSpaceQuestRequest,
  toQuestSpaceMemberPersons,
  useQuestSpaceMembers,
} from '../hooks/use-space-quests';
import {
  applyPatchToQuestDraftState,
  buildLocalQuestDraftPatch,
  findNextUnfilledQuestStep,
  stewardQuestionForStep,
  type QuestDraftPatchInput,
  type QuestDraftStateSnapshot,
} from '../utils/quest-draft-assistant';
import {
  EditQuestGoalModal,
  EditQuestLeadModal,
  EditQuestMembersModal,
  EditQuestMilestonesModal,
  EditQuestNameModal,
  EditQuestRewardsModal,
  EditQuestScopeModal,
  EditQuestSuccessModal,
  EditQuestTargetDateModal,
  type EditableQuestMember,
  type EditableQuestMilestone,
} from './quest-section-edit-modals';
import { SpaceQuestChatPanel } from './space-quest-chat-panel';

const LABEL_CLASS =
  'text-[10px] font-bold uppercase tracking-[0.08em] text-neutral-11';

function stripAgentMentionPrefix(text: string, agentLabel: string): string {
  const escaped = agentLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text
    .replace(
      new RegExp(`^@(?:${escaped}|AI[\\s_-]*Agents)\\b[,:\\s]*`, 'i'),
      '',
    )
    .trim();
}

export function SpaceQuestCreateDraft({ spaceSlug }: { spaceSlug: string }) {
  const spaceMembers = useQuestSpaceMembers(spaceSlug);
  const spaceMemberNames = useMemo(
    () => spaceMembers.map((m) => m.name),
    [spaceMembers],
  );
  const locale = useLocale();
  const tAgreementFlow = useTranslations('AgreementFlow');
  const tChat = useTranslations('HumanChatPanel');
  const router = useRouter();
  const { person } = useMe();
  const { jwt } = useJwt();
  const { getAccessToken } = useAuthentication();
  const { space } = useSpaceBySlug(spaceSlug);
  const config = useConfig();
  const { closeAiPanel } = useAiPanel();
  const {
    open: rightPanelOpen,
    panelAvailable,
    openHumanChatPanel,
    setSpaceQuestDraft,
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
  const [leadNameOverride, setLeadNameOverride] = useState<string | null>(null);
  const leadName = leadNameOverride ?? `${viewerDisplayName} (you)`;
  const [selectedLeadPersonId, setSelectedLeadPersonId] = useState<
    number | null
  >(null);
  const [members, setMembers] = useState<EditableQuestMember[]>([]);
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

  const agentLabel = tChat('agentMentionLabel');

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
      agentSpecialistId: 'operations',
      senderName: agentLabel,
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
    | 'lead'
    | 'members'
    | 'targetDate'
    | null
  >(null);

  // Confirm modal state ("Are you sure?" — Figma 93:2)
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { createAgreement, isPending, progress, currentAction } =
    useCreateAgreementOrchestrator({
      authToken: jwt,
      config,
    });

  const commitDraftSnapshot = useCallback(
    (next: QuestDraftStateSnapshot) => {
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
    },
    [leadName],
  );

  const handleSendStewardMessage = useCallback(
    async (overridePrompt?: string) => {
      const rawTrimmed = (overridePrompt ?? chatInput).trim();
      if (!rawTrimmed) return;
      if (!overridePrompt) {
        setChatInput('');
      }

      const trimmed =
        stripAgentMentionPrefix(rawTrimmed, agentLabel) || rawTrimmed;
      recordMobilizedAiAgentsForQuestion(spaceSlug, trimmed);

      const currentStep = QUEST_STEWARD_STEPS[stewardStepIndex] ?? 'goal';
      const currentSnapshot: QuestDraftStateSnapshot = {
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
      };

      // 1. Apply local multi-section extraction / synthesis immediately so the draft form updates live
      const localPatch = buildLocalQuestDraftPatch({
        message: trimmed,
        currentStep,
        draft: currentSnapshot,
        viewerDisplayName,
      });
      const { next: afterLocal, updatedLabels: localUpdated } =
        applyPatchToQuestDraftState({
          current: currentSnapshot,
          patch: localPatch,
          spaceMembers,
          viewerDisplayName,
        });
      commitDraftSnapshot(afterLocal);

      const nextUnfilled = findNextUnfilledQuestStep(afterLocal, currentStep);
      const nextStep: QuestStewardStep = nextUnfilled ?? 'name';
      const nextStepIndex = Math.max(0, QUEST_STEWARD_STEPS.indexOf(nextStep));
      setStewardStepIndex(nextStepIndex);
      setActiveSection(nextStep);

      const specialist =
        selectSpecialistForQuestion(trimmed) ?? specialistById('operations');
      const specialistId = specialist?.id ?? 'operations';

      const fallbackReply = nextUnfilled
        ? localUpdated.length > 1
          ? `Updated ${localUpdated.join(
              ', ',
            )} in your quest draft. ${stewardQuestionForStep(nextUnfilled)}`
          : stewardQuestionForStep(nextUnfilled)
        : "Your quest draft is ready. Click CREATE QUEST whenever you're ready to submit it as a proposal for voting.";

      const now = new Date();
      const replyId = `s-${now.getTime() + 1}`;
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
        {
          id: replyId,
          role: 'member',
          agentSpecialistId: specialistId,
          senderName: agentLabel,
          timestamp: new Date(now.getTime() + 1),
          text: fallbackReply,
        },
      ]);

      // 2. Ask the shared platform agent on the server to refine/expand the draft sections
      setIsAgentTyping(true);
      try {
        const token = await getAccessToken?.().catch(() => null);
        if (!token) return;
        const response = await fetch(
          `/api/v1/spaces/${encodeURIComponent(spaceSlug)}/quests/draft-assist`,
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
                name: afterLocal.name,
                goal: afterLocal.goal,
                scopeIn: afterLocal.scopeIn,
                scopeOut: afterLocal.scopeOut,
                successCriteria: afterLocal.successCriteria,
                targetDate: afterLocal.targetDate,
                leadName: afterLocal.leadName,
                rewards: afterLocal.rewards,
                milestones: afterLocal.milestones.map((m) => ({
                  name: m.name,
                  dueDate: m.dueDate,
                  description: m.description,
                  ownerName: m.ownerName,
                })),
                members: afterLocal.members.map((m) => ({
                  memberName: m.memberName,
                  roleLabel: m.roleLabel,
                  responsibilities: m.responsibilities,
                })),
              },
              spaceMembers: spaceMembers.slice(0, 60).map((m) => ({
                personId: m.personId,
                name: m.name,
              })),
              history: chatMessages.slice(-8).map((m) => ({
                role: m.role === 'user' ? 'user' : 'assistant',
                text: m.text,
              })),
            }),
          },
        );
        if (!response.ok) return;
        const data = (await response.json()) as {
          ok?: boolean;
          patch?: QuestDraftPatchInput | null;
          reply?: string | null;
          specialistId?: string;
        };
        if (data.patch && Object.keys(data.patch).length > 0) {
          const { next: afterAi } = applyPatchToQuestDraftState({
            current: afterLocal,
            patch: data.patch,
            spaceMembers,
            viewerDisplayName,
          });
          commitDraftSnapshot(afterAi);
          const aiNextUnfilled = findNextUnfilledQuestStep(
            afterAi,
            currentStep,
          );
          if (aiNextUnfilled) {
            setStewardStepIndex(
              Math.max(0, QUEST_STEWARD_STEPS.indexOf(aiNextUnfilled)),
            );
            setActiveSection(aiNextUnfilled);
          }
        }
        if (data.reply?.trim()) {
          setChatMessages((prev) =>
            prev.map((m) =>
              m.id === replyId
                ? {
                    ...m,
                    text: data.reply!.trim(),
                    agentSpecialistId: data.specialistId ?? m.agentSpecialistId,
                  }
                : m,
            ),
          );
        }
      } catch {
        // Keep the immediate local draft update and reply when offline
      } finally {
        setIsAgentTyping(false);
      }
    },
    [
      agentLabel,
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
  const triggerQuickPrompt = useCallback((prompt: string) => {
    void handleSendRef.current(prompt);
  }, []);

  const draftChatSession = useMemo(
    () => ({
      spaceSlug,
      questTitle: name.trim() || 'New quest',
      messages: chatMessages,
      input: chatInput,
      onInputChange: setChatInput,
      onSend: triggerSend,
      onQuickPrompt: triggerQuickPrompt,
      isAgentTyping,
    }),
    [
      chatInput,
      chatMessages,
      isAgentTyping,
      name,
      spaceSlug,
      triggerQuickPrompt,
      triggerSend,
    ],
  );

  // Open the shared right side panel on mount and host the Quest chat there.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1200) {
      closeAiPanel();
    }
    openHumanChatPanel();
    return () => {
      setSpaceQuestDraft(null);
    };
  }, [closeAiPanel, openHumanChatPanel, setSpaceQuestDraft]);

  useEffect(() => {
    setSpaceQuestDraft(draftChatSession);
  }, [draftChatSession, setSpaceQuestDraft]);

  /**
   * Hard Rule #1:
   * CREATE QUEST -> Are you sure? -> YES, CREATE PROPOSAL creates an Agreements
   * proposal immediately (and a Proposed Quest linked to it, not an Active Quest yet).
   */
  const handleConfirmCreateProposal = async () => {
    setSubmitting(true);
    setSubmitError(null);
    setConfirmOpen(false);

    try {
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
        members: [
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
            roleLabel: m.roleLabel ?? 'Member',
            responsibilities: m.responsibilities,
          })),
        ],
      };

      // The quest slug is unknown until create; reserve room for the longest one.
      const descriptionLimit = 4000;
      if (
        buildQuestProposalDescription(draftPayload, 'q'.repeat(52)).length >
        descriptionLimit
      ) {
        setSubmitError(
          'This quest is too long to submit as a proposal. Shorten the goal, scope, milestones or members and try again.',
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
          'Select a space member as the Quest Lead before creating the proposal.',
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
            roleLabel: m.roleLabel ?? 'Member',
            responsibilities: m.responsibilities,
          })),
        },
        getAccessToken,
      });
      const createdQuestSlug = createdQuest.slug;

      // 2. Submit as an Agreements proposal with label="Quest"
      const description = buildQuestProposalDescription(
        draftPayload,
        createdQuestSlug,
      );

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

      await patchSpaceQuestRequest({
        spaceSlug,
        questSlug: createdQuestSlug,
        patch: { proposalDocumentId: createdAgreement.id },
        getAccessToken,
      });

      if (createdAgreement.slug) {
        router.push(
          `/${locale}/dho/${spaceSlug}/agreements/proposal/${encodeURIComponent(
            createdAgreement.slug,
          )}`,
        );
        return;
      }

      router.push(
        `/${locale}/dho/${spaceSlug}/quests/${encodeURIComponent(
          createdQuestSlug,
        )}`,
      );
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Failed to create quest proposal.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const questsListHref = `/${locale}/dho/${spaceSlug}/quests`;
  const successBullets = splitMarkdownLinesToBullets(successCriteria);
  const leadInitial = (leadName.trim()[0] ?? 'Q').toUpperCase();
  const draftCompletionPercent = Math.max(
    4,
    Math.round(
      ([
        name.trim(),
        goal.trim(),
        scopeIn.length > 0 || scopeOut.length > 0,
        successBullets.length > 0,
        rewards.length > 0,
        milestones.length > 0,
        members.length > 0,
        leadName.trim(),
        targetDate,
      ].filter(Boolean).length /
        9) *
        100,
    ),
  );

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
            {/* Top header bar: New quest [Draft] + CANCEL / CREATE QUEST */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h1 className="font-display text-[18px] font-semibold text-foreground">
                  New quest
                </h1>
                <span className="bg-neutral-3 px-2 py-0.5 text-[11px] font-semibold text-foreground">
                  Draft
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  asChild
                  variant="outline"
                  colorVariant="neutral"
                  className="h-9 rounded-none px-3.5 text-[11px] font-semibold uppercase tracking-[0.06em]"
                >
                  <Link href={questsListHref}>CANCEL</Link>
                </Button>
                <Button
                  type="button"
                  disabled={submitting || !name.trim() || !goal.trim()}
                  onClick={() => setConfirmOpen(true)}
                  data-testid="create-quest-button"
                  className="h-9 rounded-none bg-foreground px-3.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-background hover:bg-foreground/90"
                >
                  CREATE QUEST
                </Button>
              </div>
            </div>

            {submitError ? (
              <div className="border border-error-6 bg-background-2 px-4 py-3 text-xs text-error-11">
                {submitError}
              </div>
            ) : null}

            {/* Quest draft subheader + progress bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-[18px] font-semibold text-foreground">
                  Quest draft
                </h2>
                <p className="text-xs text-neutral-11">
                  Fills in live as you chat · click any section to edit
                </p>
              </div>
              <div className="flex items-center gap-3">
                {panelAvailable && !rightPanelOpen ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        typeof window !== 'undefined' &&
                        window.innerWidth < 1200
                      ) {
                        closeAiPanel();
                      }
                      openHumanChatPanel();
                    }}
                    className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-foreground underline-offset-2 hover:underline"
                  >
                    Open discussion
                    <span aria-hidden>→</span>
                  </button>
                ) : null}
                <div className="h-1.5 w-[140px] overflow-hidden bg-neutral-4">
                  <div
                    className="h-full bg-foreground transition-[width]"
                    style={{ width: `${draftCompletionPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Two-column draft grid (Figma node 6:2) — NO Priority anywhere */}
            <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-[minmax(0,1fr)_330px]">
              {/* Left column: Name, Goal, Scope, Success Criteria, Quest Reward, Milestones */}
              <div className="space-y-2.5">
                {/* NAME */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveSection('name');
                    setEditingModal('name');
                  }}
                  data-testid="draft-section-name"
                  className={cn(
                    'flex w-full flex-col items-start gap-1.5 border p-3.5 text-left transition-colors',
                    activeSection === 'name'
                      ? 'border-[#4b4bff] bg-[#f6f5ff] dark:bg-accent-2'
                      : 'border-border bg-background hover:border-foreground/40',
                  )}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className={LABEL_CLASS}>NAME</span>
                    <span className="text-xs text-neutral-11">✎</span>
                  </div>
                  <p className="font-display text-base font-semibold text-foreground">
                    {name || (
                      <span className="text-neutral-11">Untitled quest</span>
                    )}
                  </p>
                </button>

                {/* GOAL */}
                <button
                  type="button"
                  onClick={() => {
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
                  <p className="text-[13px] text-foreground">
                    {goal || (
                      <span className="text-neutral-11">
                        Not set yet — reply in chat or click to edit
                      </span>
                    )}
                  </p>
                </button>

                {/* SCOPE */}
                <button
                  type="button"
                  onClick={() => {
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
                  <div className="space-y-0.5 text-[13px] text-foreground">
                    {scopeIn.length === 0 && scopeOut.length === 0 ? (
                      <span className="text-neutral-11">
                        Not set yet — reply in chat or click to edit
                      </span>
                    ) : (
                      <>
                        <p>In: {scopeIn.join(', ') || '—'}</p>
                        <p>Out: {scopeOut.join(', ') || '—'}</p>
                      </>
                    )}
                  </div>
                </button>

                {/* SUCCESS CRITERIA */}
                <button
                  type="button"
                  onClick={() => {
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
                  <div className="space-y-0.5 text-[13px] text-foreground">
                    {successBullets.length === 0 ? (
                      <span className="text-neutral-11">
                        Not set yet — reply in chat or click to edit
                      </span>
                    ) : null}
                    {successBullets.map((item, idx) => (
                      <p key={idx}>• {item}</p>
                    ))}
                  </div>
                </button>

                {/* QUEST REWARD (Node 91:2 — inline editable multi-token amount + select + ADD TOKEN) */}
                <div
                  data-testid="draft-section-rewards"
                  className={cn(
                    'flex w-full flex-col items-start gap-2 border p-3.5 transition-colors',
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

                  <div className="w-full space-y-2">
                    {rewards.map((row, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Input
                          value={row.amount}
                          onChange={(e) => {
                            const next = [...rewards];
                            next[idx] = { ...row, amount: e.target.value };
                            setRewards(next);
                          }}
                          placeholder="0"
                          className="h-9 w-[180px] rounded-none bg-background-2 font-mono text-[13px]"
                        />
                        <select
                          value={row.token}
                          onChange={(e) => {
                            const next = [...rewards];
                            next[idx] = { ...row, token: e.target.value };
                            setRewards(next);
                          }}
                          className="h-9 w-[120px] border border-border bg-background-2 px-2.5 text-xs font-semibold text-foreground"
                        >
                          {QUEST_DEFAULT_REWARD_TOKENS.map((tok) => (
                            <option key={tok} value={tok}>
                              {tok}
                            </option>
                          ))}
                        </select>
                        <div className="flex-1" />
                        <button
                          type="button"
                          onClick={() =>
                            setRewards(rewards.filter((_, i) => i !== idx))
                          }
                          className="text-sm text-neutral-11 hover:text-foreground"
                          aria-label={`Remove ${row.token}`}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setRewards([
                        ...rewards,
                        {
                          amount: '',
                          token:
                            QUEST_DEFAULT_REWARD_TOKENS.find(
                              (t) => !rewards.some((r) => r.token === t),
                            ) ?? 'HYPHA',
                        },
                      ])
                    }
                    data-testid="add-reward-token-button"
                    className="inline-flex h-8 items-center border border-border bg-background px-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground hover:bg-neutral-3"
                  >
                    + ADD TOKEN
                  </button>
                </div>

                {/* MILESTONES */}
                <button
                  type="button"
                  onClick={() => {
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
                            {m.dueDate || '—'}
                          </span>
                        </div>
                        {m.description ? (
                          <p className="text-xs text-neutral-11">
                            {m.description}
                          </p>
                        ) : null}
                        {m.ownerName ? (
                          <p className="text-[11px] text-neutral-11">
                            Owner · {m.ownerName}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </button>
              </div>

              {/* Right column: Lead, Members (with RESPONSIBILITY bullets), Target Date */}
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
                    <span className="grid size-5.5 place-items-center rounded-full bg-foreground text-[9px] font-bold text-background">
                      {leadInitial}
                    </span>
                    <span className="text-[13px] font-semibold text-foreground">
                      {leadName}
                    </span>
                    <span className="text-xs text-neutral-11">Lead</span>
                  </div>
                </button>

                {/* MEMBERS */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveSection('members');
                    setEditingModal('members');
                  }}
                  data-testid="draft-section-members"
                  className="flex w-full flex-col items-start gap-2 border border-border bg-background p-3.5 text-left hover:border-foreground/40"
                >
                  <div className="flex w-full items-center justify-between">
                    <span className={LABEL_CLASS}>MEMBERS</span>
                    <span className="text-xs text-neutral-11">✎</span>
                  </div>
                  <div className="w-full divide-y divide-border/70">
                    {members.length === 0 ? (
                      <p className="text-[13px]">
                        <span className="text-neutral-11">
                          Not set yet — reply in chat or click to edit
                        </span>
                      </p>
                    ) : null}
                    {members.map((m, idx) => {
                      const initial = (
                        m.memberName.trim()[0] ?? 'M'
                      ).toUpperCase();
                      return (
                        <div
                          key={idx}
                          className="flex items-start gap-2 py-2.5 first:pt-1 last:pb-0"
                        >
                          <span className="grid size-5.5 shrink-0 place-items-center bg-foreground text-[9px] font-bold text-background">
                            {initial}
                          </span>
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="text-[13px] font-semibold text-foreground">
                              {m.memberName}
                            </p>
                            <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-neutral-11">
                              RESPONSIBILITY
                            </p>
                            <div className="space-y-0.5 text-xs text-foreground">
                              {m.responsibilities.map((r, rIdx) => (
                                <p key={rIdx} className="flex gap-1.5">
                                  <span className="text-neutral-11">•</span>
                                  <span>{r}</span>
                                </p>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </button>

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
                    {targetDate || '—'}
                  </p>
                </button>
              </div>
            </div>
          </div>

          {!panelAvailable ? (
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
                Are you sure?
              </DialogTitle>
              <p className="text-[13px] leading-relaxed text-neutral-11">
                Creating this quest submits it as a proposal to Hypha for voting
                right away. Name, goal, scope, success, milestones, members and
                Quest Reward will be published as shown.
              </p>
              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  colorVariant="neutral"
                  onClick={() => setConfirmOpen(false)}
                  data-testid="confirm-cancel-button"
                  className="h-10 rounded-none px-4 text-[11px] font-semibold uppercase tracking-[0.1em]"
                >
                  CANCEL
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleConfirmCreateProposal()}
                  data-testid="confirm-create-proposal-button"
                  className="h-10 rounded-none bg-foreground px-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-background hover:bg-foreground/90"
                >
                  YES, CREATE PROPOSAL
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Section Edit Modals */}
        <EditQuestNameModal
          open={editingModal === 'name'}
          onOpenChange={(open) => !open && setEditingModal(null)}
          value={name}
          onSave={setName}
        />
        <EditQuestGoalModal
          open={editingModal === 'goal'}
          onOpenChange={(open) => !open && setEditingModal(null)}
          value={goal}
          onSave={setGoal}
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
        />
        <EditQuestSuccessModal
          open={editingModal === 'success'}
          onOpenChange={(open) => !open && setEditingModal(null)}
          value={successCriteria}
          onSave={setSuccessCriteria}
        />
        <EditQuestRewardsModal
          open={editingModal === 'rewards'}
          onOpenChange={(open) => !open && setEditingModal(null)}
          rewards={rewards}
          onSave={setRewards}
        />
        <EditQuestMilestonesModal
          open={editingModal === 'milestones'}
          onOpenChange={(open) => !open && setEditingModal(null)}
          milestones={milestones}
          spaceMembers={spaceMemberPersons}
          spaceMemberNames={spaceMemberNames}
          onSave={setMilestones}
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
        />
        <EditQuestMembersModal
          open={editingModal === 'members'}
          onOpenChange={(open) => !open && setEditingModal(null)}
          members={members}
          spaceMembers={spaceMemberPersons}
          spaceMemberNames={spaceMemberNames}
          onSave={setMembers}
        />
        <EditQuestTargetDateModal
          open={editingModal === 'targetDate'}
          onOpenChange={(open) => !open && setEditingModal(null)}
          value={targetDate}
          onSave={setTargetDate}
        />
      </>
    </SpaceLoadingBackdrop>
  );
}
