'use client';

import {
  parseQuestProposalFromDescription,
  questHtmlHasVisibleText,
} from '@hypha-platform/core/client';
import { useAuthentication } from '@hypha-platform/authentication';
import { Button } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import {
  seedSpaceQuestDetailCache,
  useSpaceQuests,
} from '../hooks/use-space-quests';
import { QuestSectionMarkdown } from './quest-section-markdown';

function QuestOverviewNavLink({ href }: { href: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    router.prefetch(href);
  }, [href, router]);

  return (
    <Button
      asChild
      variant="outline"
      colorVariant="neutral"
      className={cn(
        'gap-2 rounded-none',
        pending && 'pointer-events-none opacity-70',
      )}
    >
      <Link
        href={href}
        prefetch={true}
        onClick={() => setPending(true)}
        aria-busy={pending}
        data-pending={pending ? 'true' : undefined}
      >
        <span>VIEW QUEST OVERVIEW</span>
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <ArrowRight className="size-3.5" aria-hidden />
        )}
      </Link>
    </Button>
  );
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
  const { user, isLoading: authLoading } = useAuthentication();
  const viewerKey = authLoading ? null : user?.id ?? 'anonymous';
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

  useEffect(() => {
    if (!matchedQuest || !viewerKey) return;
    void seedSpaceQuestDetailCache(spaceSlug, [matchedQuest], viewerKey);
  }, [matchedQuest, spaceSlug, viewerKey]);

  if (!matchedQuest) return null;

  const overviewHref = `/${locale}/dho/${spaceSlug}/quests/${encodeURIComponent(
    matchedQuest.slug,
  )}`;

  return (
    <div
      className="flex flex-wrap items-center gap-3"
      data-testid="quest-proposal-overview-link-row"
    >
      <QuestOverviewNavLink href={overviewHref} />
      <p className="min-w-0 flex-1 text-[11px] text-neutral-11">
        See milestones, participants, and more on the quest page.
      </p>
    </div>
  );
}

/**
 * Quest body inside the shared proposal panel (`proposal-detail`).
 * Other proposals show one prose description there. The stored quest
 * description still holds the full payload for voting and sync; this
 * view shows only the goal, using the same safe markdown renderer as
 * the quest page. Scope, success, milestones, members, and rewards
 * stay on that page, behind the overview link.
 */
export function ProposalQuestData({
  content,
}: {
  /** Proposal title. The panel header already shows it. */
  title?: string;
  content?: string;
}) {
  const parsed = useMemo(
    () => parseQuestProposalFromDescription(content),
    [content],
  );
  const goal = parsed?.goal ?? '';
  if (!questHtmlHasVisibleText(goal)) return null;

  return (
    <section
      className="flex min-w-0 flex-col gap-1"
      data-testid="quest-proposal-structured-body"
    >
      <h2 className="text-1 uppercase tracking-wide text-neutral-10">Goal</h2>
      <div className="max-h-64 min-w-0 overflow-y-auto">
        <QuestSectionMarkdown markdown={goal} empty="" />
      </div>
    </section>
  );
}
