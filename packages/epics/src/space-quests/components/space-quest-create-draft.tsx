'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import {
  QUEST_DEFAULT_REWARD_TOKENS,
  QUEST_DOCUMENT_LABEL,
  QUEST_STEWARD_STEPS,
  buildQuestProposalDescription,
  bulletsToMarkdownList,
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
import { AtSign, Paperclip, Plus, Send, Smile } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { useConfig } from 'wagmi';
import { SpaceLoadingBackdrop } from '../../spaces/components/space-loading-backdrop';
import {
  createSpaceQuestRequest,
  patchSpaceQuestRequest,
} from '../hooks/use-space-quests';
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

type StewardChatMessage = {
  id: string;
  sender: 'steward' | 'user';
  senderName: string;
  time: string;
  text: string;
};

const LABEL_CLASS =
  'text-[10px] font-bold uppercase tracking-[0.08em] text-neutral-11';

function formatNowTime(): string {
  return new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function stewardQuestionForStep(step: QuestStewardStep): string {
  switch (step) {
    case 'goal':
      return 'Hey, what is the goal of the quest you want to create?';
    case 'scope':
      return "Got it, I've added that as the Goal. What's in scope, and what's explicitly out?";
    case 'success':
      return 'How will we know it succeeded?';
    case 'milestones':
      return "Let's break it into milestones — what are the key checkpoints, dates, and owners?";
    case 'members':
      return "Who's on the quest, and what is each person responsible for?";
    case 'lead':
      return 'Who should lead it?';
    case 'targetDate':
      return "What's the target date?";
    case 'rewards':
      return 'What reward tokens and amounts?';
    case 'name':
      return 'What should we call this quest?';
  }
}

export function SpaceQuestCreateDraft({
  spaceSlug,
  spaceMemberNames = [],
}: {
  spaceSlug: string;
  spaceMemberNames?: string[];
}) {
  const locale = useLocale();
  const tAgreementFlow = useTranslations('AgreementFlow');
  const router = useRouter();
  const { person } = useMe();
  const { jwt } = useJwt();
  const { getAccessToken } = useAuthentication();
  const { space } = useSpaceBySlug(spaceSlug);
  const config = useConfig();

  const viewerDisplayName = useMemo(() => {
    const full = [person?.name, person?.surname]
      .filter(Boolean)
      .join(' ')
      .trim();
    return full || 'You';
  }, [person?.name, person?.surname]);

  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [scopeIn, setScopeIn] = useState<string[]>([]);
  const [scopeOut, setScopeOut] = useState<string[]>([]);
  const [scopeInMarkdown, setScopeInMarkdown] = useState('');
  const [scopeOutMarkdown, setScopeOutMarkdown] = useState('');
  const [successCriteria, setSuccessCriteria] = useState('');
  const [rewards, setRewards] = useState<QuestReward[]>([]);
  const [milestones, setMilestones] = useState<EditableQuestMilestone[]>([]);
  const [leadName, setLeadName] = useState(`${viewerDisplayName} (you)`);
  const [members, setMembers] = useState<EditableQuestMember[]>([]);
  const [targetDate, setTargetDate] = useState<string | null>(null);

  // Steward guided flow state (Goal first, one section per turn, no Priority)
  const [stewardStepIndex, setStewardStepIndex] = useState<number>(0);
  const [activeSection, setActiveSection] = useState<QuestStewardStep>('goal');
  const [chatTab, setChatTab] = useState<'chat' | 'mentions'>('chat');
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<StewardChatMessage[]>([
    {
      id: 'm1',
      sender: 'steward',
      senderName: 'Quest Steward',
      time: formatNowTime(),
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

  const handleSendStewardMessage = () => {
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    setChatInput('');

    const currentStep = QUEST_STEWARD_STEPS[stewardStepIndex] ?? 'goal';
    const nextStepIndex = Math.min(
      QUEST_STEWARD_STEPS.length - 1,
      stewardStepIndex + 1,
    );
    const nextStep = QUEST_STEWARD_STEPS[nextStepIndex] ?? 'name';

    // Apply user message to the current section in the live draft
    if (currentStep === 'goal') {
      setGoal(trimmed);
    } else if (currentStep === 'scope') {
      const parts = trimmed.split(/out\s*:/i);
      const inItems = splitMarkdownLinesToBullets(
        (parts[0] ?? trimmed).replace(/^in\s*:/i, ''),
      );
      const outItems = parts[1]
        ? splitMarkdownLinesToBullets(parts[1])
        : scopeOut;
      if (inItems.length > 0) {
        setScopeIn(inItems);
        setScopeInMarkdown(bulletsToMarkdownList(inItems));
      }
      if (outItems.length > 0) {
        setScopeOut(outItems);
        setScopeOutMarkdown(bulletsToMarkdownList(outItems));
      }
    } else if (currentStep === 'success') {
      const bullets = splitMarkdownLinesToBullets(trimmed);
      setSuccessCriteria(
        bulletsToMarkdownList(bullets.length > 0 ? bullets : [trimmed]),
      );
    } else if (currentStep === 'milestones') {
      setMilestones((prev) => [
        ...prev,
        {
          name: trimmed.slice(0, 60),
          dueDate: 'TBD',
          description: trimmed,
          ownerName: viewerDisplayName,
          status: 'not_started',
        },
      ]);
    } else if (currentStep === 'members') {
      setMembers((prev) => [
        ...prev,
        {
          memberName: trimmed.split(':')[0]?.trim() || trimmed.slice(0, 32),
          roleLabel: 'Member',
          responsibilities: [
            trimmed.split(':')[1]?.trim() || 'Core outcome delivery',
          ],
        },
      ]);
    } else if (currentStep === 'lead') {
      setLeadName(trimmed);
    } else if (currentStep === 'targetDate') {
      setTargetDate(trimmed);
    } else if (currentStep === 'rewards') {
      const match = /(\d[\d,.]*)\s*([A-Za-z]+)/.exec(trimmed);
      if (match && match[1] && match[2]) {
        setRewards((prev) => [
          ...prev,
          { amount: match[1]!, token: match[2]!.toUpperCase() },
        ]);
      }
    } else if (currentStep === 'name') {
      setName(trimmed);
    }

    const reply =
      stewardStepIndex < QUEST_STEWARD_STEPS.length - 1
        ? stewardQuestionForStep(nextStep)
        : "Your quest draft is ready. Click CREATE QUEST whenever you're ready to submit it as a proposal for voting.";

    setStewardStepIndex(nextStepIndex);
    setActiveSection(nextStep);
    setChatMessages((prev) => [
      ...prev,
      {
        id: `u-${Date.now()}`,
        sender: 'user',
        senderName: viewerDisplayName,
        time: formatNowTime(),
        text: trimmed,
      },
      {
        id: `s-${Date.now() + 1}`,
        sender: 'steward',
        senderName: 'Quest Steward',
        time: formatNowTime(),
        text: reply,
      },
    ]);
  };

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
        leadPersonId: person?.id ?? null,
        leadName:
          leadName.replace(/\s*\(you\)\s*/i, '').trim() || viewerDisplayName,
        milestones: milestones.map((m) => ({
          name: m.name,
          description: m.description,
          dueDate: m.dueDate,
          ownerName: m.ownerName,
          status: m.status,
        })),
        members: [
          {
            personId: person?.id ?? null,
            memberName:
              leadName.replace(/\s*\(you\)\s*/i, '').trim() ||
              viewerDisplayName,
            roleLabel: 'Lead',
            responsibilities: ['Overall delivery', 'Unblock reviews'],
          },
          ...members.map((m) => ({
            personId: m.personId ?? null,
            memberName: m.memberName,
            roleLabel: m.roleLabel ?? 'Member',
            responsibilities: m.responsibilities,
          })),
        ],
      };

      // 1. Create the Quest row in `proposed` status (not Active yet)
      let createdQuestSlug: string | undefined;
      try {
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
            leadPersonId: draftPayload.leadPersonId ?? null,
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
        createdQuestSlug = createdQuest.slug;
      } catch {
        // Fallback if unauthenticated in preview mode
      }

      // 2. Submit as an Agreements proposal with label="Quest" when wallet/auth is ready
      const description = buildQuestProposalDescription(
        draftPayload,
        createdQuestSlug,
      );

      if (jwt && space?.id && person?.id) {
        try {
          const createdAgreement = await createAgreement({
            title: draftPayload.name.slice(0, 50),
            description,
            label: QUEST_DOCUMENT_LABEL,
            creatorId: person.id,
            spaceId: space.id,
            ...(typeof space.web3SpaceId === 'number'
              ? { web3SpaceId: space.web3SpaceId }
              : {}),
          });

          if (createdAgreement?.id && createdQuestSlug) {
            await patchSpaceQuestRequest({
              spaceSlug,
              questSlug: createdQuestSlug,
              patch: { proposalDocumentId: createdAgreement.id },
              getAccessToken,
            }).catch(() => undefined);
          }

          if (createdAgreement?.slug) {
            router.push(
              `/${locale}/dho/${spaceSlug}/agreements/proposal/${encodeURIComponent(
                createdAgreement.slug,
              )}`,
            );
            return;
          }
        } catch (chainErr) {
          console.warn('[QuestCreate] On-chain proposal fallback:', chainErr);
        }
      }

      // Navigate to the Quest proposal preview / overview if chain wallet wasn't connected
      if (createdQuestSlug) {
        router.push(
          `/${locale}/dho/${spaceSlug}/quests/${encodeURIComponent(
            createdQuestSlug,
          )}`,
        );
      } else {
        router.push(`/${locale}/dho/${spaceSlug}/quests`);
      }
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
              <div className="h-1.5 w-[140px] overflow-hidden bg-neutral-4">
                <div
                  className="h-full bg-foreground transition-[width]"
                  style={{ width: `${draftCompletionPercent}%` }}
                />
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
                        Not set yet — answer Steward or click to edit
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
                        Not set yet — answer Steward or click to edit
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
                        Not set yet — answer Steward or click to edit
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
                          Not set yet — answer Steward or click to edit
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
                          Not set yet — answer Steward or click to edit
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

          {/* Right Panel: Guided Quest Steward Chat (Figma node 21:2) */}
          <aside className="flex h-[680px] w-full flex-col border border-border bg-background xl:sticky xl:top-4 xl:w-[400px] xl:shrink-0">
            <div className="flex items-center gap-5 border-b border-border px-5">
              <button
                type="button"
                onClick={() => setChatTab('chat')}
                className={cn(
                  'border-b-2 py-3 text-xs font-semibold transition-colors',
                  chatTab === 'chat'
                    ? 'border-[#6b4fd8] text-[#6b4fd8]'
                    : 'border-transparent text-neutral-11',
                )}
              >
                Chat
              </button>
              <button
                type="button"
                onClick={() => setChatTab('mentions')}
                className={cn(
                  'border-b-2 py-3 text-xs font-medium transition-colors',
                  chatTab === 'mentions'
                    ? 'border-[#6b4fd8] text-[#6b4fd8]'
                    : 'border-transparent text-neutral-11',
                )}
              >
                Mentions
              </button>
            </div>

            <div className="narrow-scrollbar flex-1 space-y-4 overflow-y-auto p-5">
              {chatMessages.map((msg) => (
                <div key={msg.id} className="flex items-start gap-2.5">
                  {msg.sender === 'steward' ? (
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#ece8fb] text-[10px] font-bold text-[#6b4fd8]">
                      ✦
                    </span>
                  ) : (
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#d9d3f3] text-[10px] font-bold text-foreground">
                      {(msg.senderName[0] ?? 'U').toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-semibold text-foreground">
                        {msg.senderName}
                      </span>
                      <span className="text-[11px] text-neutral-11">
                        {msg.time}
                      </span>
                    </div>
                    <p className="text-[13px] leading-relaxed text-foreground">
                      {msg.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-border p-3.5">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendStewardMessage();
                }}
                className="flex h-10 items-center gap-2 border border-border bg-background px-3"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type a message…"
                  data-testid="steward-chat-input"
                  className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-neutral-11"
                />
                <Plus className="size-3.5 shrink-0 text-neutral-11" />
                <Smile className="size-3.5 shrink-0 text-neutral-11" />
                <AtSign className="size-3.5 shrink-0 text-neutral-11" />
                <Paperclip className="size-3.5 shrink-0 text-neutral-11" />
                <button
                  type="submit"
                  aria-label="Send message"
                  className="text-neutral-11 hover:text-foreground"
                >
                  <Send className="size-3.5" />
                </button>
              </form>
            </div>
          </aside>
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
          spaceMemberNames={spaceMemberNames}
          onSave={setMilestones}
        />
        <EditQuestLeadModal
          open={editingModal === 'lead'}
          onOpenChange={(open) => !open && setEditingModal(null)}
          leadName={leadName}
          spaceMemberNames={spaceMemberNames}
          onSave={setLeadName}
        />
        <EditQuestMembersModal
          open={editingModal === 'members'}
          onOpenChange={(open) => !open && setEditingModal(null)}
          members={members}
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
