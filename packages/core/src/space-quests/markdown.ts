import type { QuestDraftInput, QuestRecord } from './types';

export const QUEST_PROPOSAL_MARKER_START = '<!-- hypha-quest-proposal:start';
export const QUEST_PROPOSAL_MARKER_END = 'hypha-quest-proposal:end -->';

export type EmbeddedQuestProposalPayload = {
  questSlug?: string;
  name: string;
  goal: string;
  scopeIn: string[];
  scopeOut: string[];
  successCriteria: string;
  rewards: Array<{ amount: string; token: string }>;
  targetDate: string | null;
  leadName: string;
  milestones: Array<{
    order: number;
    name: string;
    description: string;
    dueDate: string | null;
    ownerName: string | null;
  }>;
  members: Array<{
    memberName: string;
    roleLabel?: string | null;
    isLead?: boolean;
    responsibilities: string[];
  }>;
};

export function splitMarkdownLinesToBullets(markdown: string): string[] {
  return markdown
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/^\s*(?:[-*•]|\d+\.)\s+/, '')
        .replace(/^#+\s+/, '')
        .trim(),
    )
    .filter(Boolean);
}

export function bulletsToMarkdownList(items: readonly string[]): string {
  const cleaned = items.map((item) => item.trim()).filter(Boolean);
  if (cleaned.length === 0) return '';
  return cleaned.map((item) => `- ${item}`).join('\n');
}

export function slugifyQuestName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 44);
  return base || 'quest';
}

export function buildEmbeddedQuestProposalPayload(
  draft: QuestDraftInput,
  questSlug?: string,
): EmbeddedQuestProposalPayload {
  const scopeIn =
    draft.scopeIn.length > 0
      ? draft.scopeIn
      : splitMarkdownLinesToBullets(draft.scopeInMarkdown ?? '');
  const scopeOut =
    draft.scopeOut.length > 0
      ? draft.scopeOut
      : splitMarkdownLinesToBullets(draft.scopeOutMarkdown ?? '');

  return {
    ...(questSlug ? { questSlug } : {}),
    name: draft.name.trim() || 'Untitled quest',
    goal: draft.goal.trim(),
    scopeIn,
    scopeOut,
    successCriteria: draft.successCriteria.trim(),
    rewards: (draft.rewards ?? []).filter(
      (r) => r.amount.trim().length > 0 && r.token.trim().length > 0,
    ),
    targetDate: draft.targetDate?.trim() || null,
    leadName: draft.leadName.trim(),
    milestones: (draft.milestones ?? []).map((m, idx) => ({
      order: idx + 1,
      name: m.name.trim() || `Milestone ${idx + 1}`,
      description: m.description.trim(),
      dueDate: m.dueDate?.trim() || null,
      ownerName: m.ownerName?.trim() || null,
    })),
    members: (draft.members ?? []).map((m) => ({
      memberName: m.memberName.trim(),
      roleLabel: m.roleLabel?.trim() || null,
      isLead:
        m.roleLabel?.toLowerCase() === 'lead' ||
        m.memberName.toLowerCase().startsWith(
          draft.leadName
            .replace(/\s*\(you\)\s*/i, '')
            .trim()
            .toLowerCase(),
        ),
      responsibilities: (m.responsibilities ?? [])
        .map((r) => r.trim())
        .filter(Boolean),
    })),
  };
}

/**
 * Build markdown stored in `documents.description` for a Quest proposal.
 * The human-visible snippet comes first (so Agreements grid cards show a clean
 * 1-line summary), followed by an HTML comment marker containing the structured
 * Quest payload rendered by the Quest proposal modal.
 */
export function buildQuestProposalDescription(
  draft: QuestDraftInput,
  questSlug?: string,
): string {
  const payload = buildEmbeddedQuestProposalPayload(draft, questSlug);
  const summary =
    payload.goal ||
    `Quest proposal for ${payload.name} led by ${payload.leadName || 'team'}.`;
  const encoded = encodeURIComponent(JSON.stringify(payload));
  const marker = `${QUEST_PROPOSAL_MARKER_START}\n${encoded}\n${QUEST_PROPOSAL_MARKER_END}`;
  const maxSummary = Math.max(120, 3900 - marker.length - 4);
  return `${summary.slice(0, maxSummary)}\n\n${marker}`;
}

export function parseQuestProposalFromDescription(
  description: string | null | undefined,
): EmbeddedQuestProposalPayload | null {
  if (!description) return null;
  const start = description.indexOf(QUEST_PROPOSAL_MARKER_START);
  if (start === -1) return null;
  const bodyStart = start + QUEST_PROPOSAL_MARKER_START.length;
  const end = description.indexOf(QUEST_PROPOSAL_MARKER_END, bodyStart);
  if (end === -1) return null;
  const raw = description.slice(bodyStart, end).trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(
      decodeURIComponent(raw),
    ) as EmbeddedQuestProposalPayload;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.name !== 'string'
    )
      return null;
    return parsed;
  } catch {
    return null;
  }
}

export function stripQuestProposalMarker(
  description: string | null | undefined,
): string {
  if (!description) return '';
  const start = description.indexOf(QUEST_PROPOSAL_MARKER_START);
  if (start === -1) return description;
  const end = description.indexOf(QUEST_PROPOSAL_MARKER_END, start);
  if (end === -1) return description.slice(0, start).trim();
  return (
    description.slice(0, start) +
    description.slice(end + QUEST_PROPOSAL_MARKER_END.length)
  ).trim();
}

/**
 * Permission helper per SPEC §5:
 * Any Quest member (including Lead) can edit Quest content & Deliverables after pass.
 * Only Lead can edit status, transfer lead, or run danger-zone actions.
 */
export function canMemberEditQuest(
  viewer: { id?: number | null; name?: string | null } | null | undefined,
  quest: Pick<QuestRecord, 'leadPersonId' | 'leadName' | 'members' | 'status'>,
): boolean {
  if (!viewer) return false;
  if (quest.status === 'archived') return false;
  if (viewer.id != null && quest.leadPersonId != null) {
    if (viewer.id === quest.leadPersonId) return true;
  }
  if (
    viewer.id != null &&
    quest.members.some((m) => m.personId != null && m.personId === viewer.id)
  ) {
    return true;
  }
  const viewerName = viewer.name?.trim().toLowerCase();
  if (viewerName) {
    const leadClean = quest.leadName
      .replace(/\s*\(you\)\s*/i, '')
      .trim()
      .toLowerCase();
    if (
      leadClean &&
      (viewerName === leadClean || leadClean.startsWith(viewerName))
    ) {
      return true;
    }
    if (
      quest.members.some((m) => {
        const clean = m.memberName
          .replace(/\s*\(you\)\s*/i, '')
          .trim()
          .toLowerCase();
        return clean === viewerName || clean.startsWith(viewerName);
      })
    ) {
      return true;
    }
  }
  return false;
}

export function isViewerQuestLead(
  viewer: { id?: number | null; name?: string | null } | null | undefined,
  quest: Pick<QuestRecord, 'leadPersonId' | 'leadName'>,
): boolean {
  if (!viewer) return false;
  if (viewer.id != null && quest.leadPersonId != null) {
    return viewer.id === quest.leadPersonId;
  }
  const viewerName = viewer.name?.trim().toLowerCase();
  if (!viewerName) return false;
  const leadClean = quest.leadName
    .replace(/\s*\(you\)\s*/i, '')
    .trim()
    .toLowerCase();
  return Boolean(
    leadClean && (viewerName === leadClean || leadClean.startsWith(viewerName)),
  );
}
