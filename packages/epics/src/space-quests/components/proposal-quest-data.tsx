'use client';

import {
  parseQuestProposalFromDescription,
  slugifyQuestName,
  splitMarkdownLinesToBullets,
  type EmbeddedQuestProposalPayload,
} from '@hypha-platform/core/client';
import { Button } from '@hypha-platform/ui';
import { ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { useMemo, useState } from 'react';
import { useSpaceQuests } from '../hooks/use-space-quests';

const SECTION_LABEL_CLASS =
  'text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-11';

function buildFallbackPayloadFromTitleAndText(
  title: string | undefined,
  content: string | undefined,
): EmbeddedQuestProposalPayload {
  const name = title?.trim() || 'Quest';
  return {
    questSlug: slugifyQuestName(name),
    name,
    goal: content?.trim() ?? '',
    scopeIn: [],
    scopeOut: [],
    successCriteria: '',
    rewards: [],
    targetDate: null,
    leadName: '',
    milestones: [],
    members: [],
  };
}

export function ProposalQuestOverviewLink({
  spaceSlug,
  documentId,
  content,
}: {
  spaceSlug: string;
  documentId?: number;
  content?: string;
}) {
  const locale = useLocale();
  const { overview } = useSpaceQuests(spaceSlug);
  const parsed = useMemo(
    () => parseQuestProposalFromDescription(content),
    [content],
  );

  const matchedQuest = useMemo(() => {
    const quests = overview?.quests ?? [];
    if (documentId != null) {
      const byDoc = quests.find((q) => q.proposalDocumentId === documentId);
      if (byDoc) return byDoc;
    }
    // The embedded slug only counts while that quest is not linked elsewhere.
    if (parsed?.questSlug) {
      const bySlug = quests.find(
        (q) => q.slug === parsed.questSlug && q.proposalDocumentId == null,
      );
      if (bySlug) return bySlug;
    }
    return null;
  }, [documentId, overview?.quests, parsed?.questSlug]);

  if (!matchedQuest) return null;

  const overviewHref = `/${locale}/dho/${spaceSlug}/quests/${encodeURIComponent(
    matchedQuest.slug,
  )}`;

  return (
    <div
      className="flex flex-wrap items-center gap-3"
      data-testid="quest-proposal-overview-link-row"
    >
      <Button
        asChild
        variant="outline"
        colorVariant="neutral"
        className="h-10 gap-2 rounded-none px-4 text-[11px] font-semibold uppercase tracking-[0.12em]"
      >
        <Link href={overviewHref}>
          <span>VIEW QUEST OVERVIEW</span>
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </Button>
      <p className="min-w-0 flex-1 text-[11px] text-neutral-11">
        See milestones, members, and more on the quest page.
      </p>
    </div>
  );
}

/**
 * Structured Quest Proposal content (Figma node 62:2 — 06-quest-proposal-on-voting.png):
 * GOAL -> SCOPE -> SUCCESS -> QUEST REWARD -> MILESTONES -> MEMBERS (expandable).
 * Hard Rule #5: No Why propose; no Proposal details footer; structured body is full content.
 */
export function ProposalQuestData({
  title,
  content,
}: {
  title?: string;
  content?: string;
}) {
  const parsed = useMemo(
    () => parseQuestProposalFromDescription(content),
    [content],
  );

  // Voters see the submitted document only, never the live quest record.
  const payload = useMemo(
    (): EmbeddedQuestProposalPayload =>
      parsed ?? buildFallbackPayloadFromTitleAndText(title, content),
    [content, parsed, title],
  );

  const [expandedMemberIdx, setExpandedMemberIdx] = useState<number | null>(0);
  const successLines = splitMarkdownLinesToBullets(payload.successCriteria);

  return (
    <div
      className="flex flex-col gap-3"
      data-testid="quest-proposal-structured-body"
    >
      {/* GOAL */}
      <section className="space-y-1.5 border border-border bg-background-2 p-3">
        <p className={SECTION_LABEL_CLASS}>GOAL</p>
        <p className="text-xs leading-relaxed text-foreground">
          {payload.goal}
        </p>
      </section>

      {/* SCOPE (vertical bullets) */}
      <section className="space-y-1.5 border border-border bg-background-2 p-3">
        <p className={SECTION_LABEL_CLASS}>SCOPE</p>
        <div className="space-y-1 text-xs text-foreground">
          {payload.scopeIn.map((item, idx) => (
            <p key={`in-${idx}`}>• {item}</p>
          ))}
          {payload.scopeOut.length > 0 ? (
            <div className="pt-1 text-neutral-11">
              {payload.scopeOut.map((item, idx) => (
                <p key={`out-${idx}`}>• Out: {item}</p>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {/* SUCCESS */}
      <section className="space-y-1.5 border border-border bg-background-2 p-3">
        <p className={SECTION_LABEL_CLASS}>SUCCESS</p>
        {successLines.length > 1 ? (
          <div className="space-y-1 text-xs text-foreground">
            {successLines.map((line, idx) => (
              <p key={idx}>• {line}</p>
            ))}
          </div>
        ) : (
          <p className="text-xs leading-relaxed text-foreground">
            {payload.successCriteria}
          </p>
        )}
      </section>

      {/* QUEST REWARD (Node 91:36 — read-only multi-token rows, no treasury meta) */}
      <section className="space-y-1.5 border border-border bg-background-2 p-3">
        <p className={SECTION_LABEL_CLASS}>QUEST REWARD</p>
        {payload.rewards.length === 0 ? (
          <p className="text-xs text-neutral-11">No token reward specified</p>
        ) : (
          <div className="space-y-1">
            {payload.rewards.map((reward, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2.5 py-1 text-foreground"
              >
                <span className="font-mono text-[13px] font-medium">
                  {reward.amount}
                </span>
                <span className="text-xs font-semibold">{reward.token}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* MILESTONES */}
      <section className="space-y-1.5 border border-border bg-background-2 p-3">
        <p className={SECTION_LABEL_CLASS}>MILESTONES</p>
        <div className="divide-y divide-border/70">
          {payload.milestones.map((m, idx) => {
            const num = String(idx + 1).padStart(2, '0');
            return (
              <div
                key={idx}
                className="flex items-center gap-2.5 py-2 first:pt-1 last:pb-0"
              >
                <span className="text-[10px] font-medium text-neutral-11">
                  {num}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground">
                    {m.name}
                  </p>
                  {m.ownerName ? (
                    <p className="text-[10px] text-neutral-11">
                      Owner · {m.ownerName}
                    </p>
                  ) : null}
                </div>
                {m.dueDate ? (
                  <span className="shrink-0 text-[10px] text-neutral-11">
                    {m.dueDate}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      {/* MEMBERS */}
      <section className="space-y-1.5 border border-border bg-background-2 p-3">
        <p className={SECTION_LABEL_CLASS}>MEMBERS</p>
        <div className="divide-y divide-border/70 pt-1">
          {payload.members.map((member, idx) => {
            const expanded = expandedMemberIdx === idx;
            const initial = (member.memberName.trim()[0] ?? 'M').toUpperCase();
            const count = member.responsibilities.length;
            const roleText = [
              member.roleLabel || (member.isLead ? 'Lead' : 'Member'),
              `${count} ${count === 1 ? 'responsibility' : 'responsibilities'}`,
            ].join(' · ');

            return (
              <div key={idx} className="py-2 first:pt-1">
                <button
                  type="button"
                  onClick={() => setExpandedMemberIdx(expanded ? null : idx)}
                  className="flex w-full items-center gap-2.5 text-left"
                >
                  <span className="grid size-6 shrink-0 place-items-center bg-foreground text-[10px] font-bold text-background">
                    {initial}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-foreground">
                      {member.memberName}
                    </p>
                    <p className="text-[10px] text-neutral-11">{roleText}</p>
                  </div>
                  {expanded ? (
                    <ChevronUp className="size-3.5 text-neutral-11" />
                  ) : (
                    <ChevronDown className="size-3.5 text-neutral-11" />
                  )}
                </button>
                {expanded && member.responsibilities.length > 0 ? (
                  <div className="mt-2 space-y-1 pl-8">
                    <p className={SECTION_LABEL_CLASS}>RESPONSIBILITY</p>
                    {member.responsibilities.map((item, rIdx) => (
                      <p
                        key={rIdx}
                        className="flex gap-1.5 text-xs text-foreground"
                      >
                        <span className="text-neutral-11">•</span>
                        <span>{item}</span>
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        <p className="pt-1 text-[10px] text-neutral-11">
          Expand a member to see responsibilities
        </p>
      </section>
    </div>
  );
}
