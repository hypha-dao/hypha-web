'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import {
  QUEST_DOCUMENT_LABEL,
  QUEST_HELPER_NAME,
  QUEST_PROPOSAL_DESCRIPTION_LIMIT,
  QUEST_STEWARD_STEPS,
  buildQuestProposalDescription,
  bulletsToMarkdownList,
  limitQuestPatchToStep,
  resolveQuestDraftTarget,
  questRecordToProposalDraft,
  stripViewerYouMarker,
  withoutPlaceholderLeadDuplicates,
  splitMarkdownLinesToBullets,
  useCreateAgreementOrchestrator,
  useJwt,
  useMe,
  useSpaceBySlug,
  type QuestDraftInput,
  type QuestReward,
  type QuestStewardStep,
} from '@hypha-platform/core/client';
import { Button, Dialog, DialogContent, DialogTitle } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useConfig } from 'wagmi';
import {
  useAiPanel,
  useHumanChatPanel,
  type SpaceQuestDraftChatMessage,
} from '../../common/human-chat-panel-context';
import { PersonAvatar } from '../../people/components/person-avatar';
import { SpaceLoadingBackdrop } from '../../spaces/components/space-loading-backdrop';
import { QuestSectionMarkdown } from './quest-section-markdown';
import {
  createSpaceQuestRequest,
  deleteSpaceQuestRequest,
  findQuestSpaceMember,
  findQuestSpaceMemberId,
  patchSpaceQuestRequest,
  toQuestSpaceMemberPersons,
  useQuestSpaceMembers,
} from '../hooks/use-space-quests';
import {
  applyPatchToQuestDraftState,
  buildLocalQuestDraftPatch,
  decideNewQuestDraftTurn,
  isQuestSectionRewriteRequest,
  messageSuppliesSectionContent,
  nextQuestStepAfterUpdate,
  questSectionCoachReply,
  questStepSectionLabel,
  replyWithSectionApprovalAsk,
  stewardQuestionForStep,
  type PendingQuestSectionProposal,
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
import { QuestRewardRowsEditor } from './quest-reward-tokens';
import { SpaceQuestChatPanel } from './space-quest-chat-panel';

const LABEL_CLASS =
  'text-[10px] font-bold uppercase tracking-[0.08em] text-neutral-11';

type PendingProposalLink = {
  questSlug: string;
  agreementId: number;
  agreementSlug: string | null;
  proposalTitle: string;
};

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

function stripAgentMentionPrefix(text: string): string {
  const helper = QUEST_HELPER_NAME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text
    .replace(new RegExp(`^@(?:${helper}|AI[\\s_-]*Agents)\\b[,:\\s]*`, 'i'), '')
    .trim();
}

const QUEST_READY_REPLY =
  "Your quest draft is ready. Click CREATE QUEST whenever you're ready to submit it as a proposal for voting.";

function bulkCoachReply(step: QuestStewardStep): string {
  return `We'll take one section at a time. ${stewardQuestionForStep(step)}`;
}

export function SpaceQuestCreateDraft({ spaceSlug }: { spaceSlug: string }) {
  const spaceMembers = useQuestSpaceMembers(spaceSlug);
  const spaceMemberNames = useMemo(
    () => spaceMembers.map((m) => m.name),
    [spaceMembers],
  );
  const locale = useLocale();
  const tAgreementFlow = useTranslations('AgreementFlow');
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
    | 'lead'
    | 'members'
    | 'targetDate'
    | null
  >(null);

  // Confirm modal state ("Are you sure?" — Figma 93:2)
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [proposalLinkError, setProposalLinkError] = useState<{
    proposalTitle: string;
    href: string | null;
    questHref: string;
    detail: string;
  } | null>(null);
  const [pendingProposalLink, setPendingProposalLink] =
    useState<PendingProposalLink | null>(null);
  const pendingProposalRef = useRef<PendingQuestSectionProposal | null>(null);

  const {
    createAgreement,
    updateAgreementBySlug,
    agreement,
    isPending,
    progress,
    currentAction,
  } = useCreateAgreementOrchestrator({
    authToken: jwt,
    config,
  });
  const agreementRef = useRef(agreement);
  agreementRef.current = agreement;

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

      const trimmed = stripAgentMentionPrefix(rawTrimmed) || rawTrimmed;

      const currentStep = QUEST_STEWARD_STEPS[stewardStepIndex] ?? 'goal';
      const draftTarget = resolveQuestDraftTarget(trimmed, currentStep);
      const stepToWrite = draftTarget.step;
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

      const turn = decideNewQuestDraftTurn({
        message: trimmed,
        currentStep,
        targetStep: stepToWrite,
        bulk: draftTarget.bulk,
        pending: pendingProposalRef.current,
      });

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
        setStewardStepIndex(Math.max(0, QUEST_STEWARD_STEPS.indexOf(step)));
        setActiveSection(step);
      };

      if (turn.kind === 'bulk') {
        pendingProposalRef.current = null;
        focusStep(currentStep);
        pushHelper(bulkCoachReply(currentStep));
        return;
      }

      if (turn.kind === 'coach') {
        pendingProposalRef.current = null;
        focusStep(turn.step);
        pushHelper(questSectionCoachReply(turn.step));
        return;
      }

      if (turn.kind === 'apply') {
        const limited = limitQuestPatchToStep(turn.patch, turn.step);
        const { next, updatedLabels } = applyPatchToQuestDraftState({
          current: currentSnapshot,
          patch: limited,
          spaceMembers,
          viewerDisplayName,
        });
        commitDraftSnapshot(next);
        pendingProposalRef.current = null;
        const advance = nextQuestStepAfterUpdate({
          draft: next,
          currentStep: turn.step,
          updatedLabels,
        });
        focusStep(advance.step);
        pushHelper(
          advance.complete
            ? QUEST_READY_REPLY
            : `Added that to the ${questStepSectionLabel(
                turn.step,
              )}. ${stewardQuestionForStep(advance.step)}`,
        );
        return;
      }

      setIsAgentTyping(true);
      let llmHandled = false;
      try {
        const token = await getAccessToken?.().catch(() => null);
        if (token) {
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
                currentStep: stepToWrite,
                spaceTitle: space?.title,
                draft: {
                  name: currentSnapshot.name,
                  goal: currentSnapshot.goal,
                  scopeIn: currentSnapshot.scopeIn,
                  scopeOut: currentSnapshot.scopeOut,
                  successCriteria: currentSnapshot.successCriteria,
                  targetDate: currentSnapshot.targetDate,
                  leadName: currentSnapshot.leadName,
                  rewards: currentSnapshot.rewards,
                  milestones: currentSnapshot.milestones.map((m) => ({
                    name: m.name,
                    dueDate: m.dueDate,
                    description: m.description,
                    ownerName: m.ownerName,
                  })),
                  members: currentSnapshot.members.map((m) => ({
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
          if (response.ok) {
            const data = (await response.json()) as {
              ok?: boolean;
              patch?: QuestDraftPatchInput | null;
              reply?: string | null;
              specialistId?: string;
            };
            const hasAiPatch = Boolean(
              data.patch && Object.keys(data.patch).length > 0,
            );
            if (hasAiPatch || data.reply?.trim()) {
              llmHandled = true;
              const rewrite = isQuestSectionRewriteRequest(trimmed);
              const modelPatch = limitQuestPatchToStep(
                hasAiPatch ? data.patch! : {},
                stepToWrite,
              );
              const localPatch = messageSuppliesSectionContent(trimmed)
                ? limitQuestPatchToStep(
                    buildLocalQuestDraftPatch({
                      message: trimmed,
                      currentStep: stepToWrite,
                      draft: currentSnapshot,
                      viewerDisplayName,
                    }),
                    stepToWrite,
                  )
                : {};
              const effectivePatch =
                rewrite && Object.keys(modelPatch).length > 0
                  ? modelPatch
                  : Object.keys(localPatch).length > 0
                  ? localPatch
                  : modelPatch;
              const hasProposal = Object.keys(effectivePatch).length > 0;
              if (hasProposal) {
                pendingProposalRef.current = {
                  step: stepToWrite,
                  patch: effectivePatch,
                };
                focusStep(stepToWrite);
                pushHelper(
                  replyWithSectionApprovalAsk(
                    rewrite ? data.reply : null,
                    stepToWrite,
                    effectivePatch,
                  ),
                );
              } else {
                focusStep(stepToWrite);
                pushHelper(
                  data.reply?.trim() || questSectionCoachReply(stepToWrite),
                );
              }
            }
          }
        }
      } catch {
        // Fall through to deterministic local draft assistant when offline
      } finally {
        setIsAgentTyping(false);
      }

      if (!llmHandled) {
        const localPatch = messageSuppliesSectionContent(trimmed)
          ? limitQuestPatchToStep(
              buildLocalQuestDraftPatch({
                message: trimmed,
                currentStep: stepToWrite,
                draft: currentSnapshot,
                viewerDisplayName,
              }),
              stepToWrite,
            )
          : {};
        if (Object.keys(localPatch).length > 0) {
          pendingProposalRef.current = {
            step: stepToWrite,
            patch: localPatch,
          };
          focusStep(stepToWrite);
          pushHelper(
            replyWithSectionApprovalAsk(null, stepToWrite, localPatch),
          );
        } else {
          focusStep(stepToWrite);
          pushHelper(questSectionCoachReply(stepToWrite));
        }
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
            roleLabel: m.roleLabel ?? 'Member',
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
          'This quest is too long to publish as a proposal. Shorten the goal, scope, milestones or members and try again.',
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
          'This quest is too long to publish as a proposal. Shorten the goal, scope, milestones or members and try again.',
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
      setPendingProposalLink(linkTarget);

      await linkCreatedQuest(linkTarget);
    } catch (err) {
      if (linkTarget) {
        const raw = err instanceof Error ? err.message : '';
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
          err instanceof Error
            ? err.message
            : 'Failed to create quest proposal.',
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
              roleLabel: member.roleLabel ?? 'Member',
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

  const questsListHref = `/${locale}/dho/${spaceSlug}/quests`;
  const successBullets = splitMarkdownLinesToBullets(successCriteria);
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
                  disabled={
                    submitting ||
                    (!pendingProposalLink &&
                      (!name.trim() || !goal.trim() || proposalOverLimit))
                  }
                  onClick={() => setConfirmOpen(true)}
                  data-testid="create-quest-button"
                  className="h-9 rounded-none bg-foreground px-3.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-background hover:bg-foreground/90"
                >
                  CREATE QUEST
                </Button>
              </div>
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
                goal, scope, milestones or members before creating.
              </div>
            ) : null}
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
                            {m.dueDate || '—'}
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
                      return (
                        <div
                          key={idx}
                          className="flex items-start gap-2 py-2.5 first:pt-1 last:pb-0"
                        >
                          <PersonAvatar
                            size="sm"
                            shape="circle"
                            showPresence={false}
                            avatarSrc={memberAvatar ?? undefined}
                            userName={m.memberName}
                            personId={
                              m.personId && m.personId > 0
                                ? m.personId
                                : rosterMember?.personId
                            }
                          />
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
                  disabled={
                    !pendingProposalLink &&
                    (proposalOverLimit || !name.trim() || !goal.trim())
                  }
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
          spaceSlug={spaceSlug}
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
