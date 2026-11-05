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

function isQuestSlugChar(char: string): boolean {
  return (char >= 'a' && char <= 'z') || (char >= '0' && char <= '9');
}

/**
 * Lowercase hyphen slug. A character scan — quantified dash regexes on
 * caller-controlled names are polynomial ReDoS for CodeQL.
 */
export function slugifyQuestName(name: string): string {
  let body = '';
  let pendingSeparator = false;
  for (const char of name.trim().toLowerCase()) {
    if (isQuestSlugChar(char)) {
      if (pendingSeparator && body.length > 0) body += '-';
      pendingSeparator = false;
      body += char;
    } else {
      pendingSeparator = true;
    }
  }
  return body.slice(0, 44) || 'quest';
}

function isMarkerWhitespace(char: string): boolean {
  switch (char) {
    case ' ':
    case '\f':
    case '\n':
    case '\r':
    case '\t':
    case '\v':
    case '\u00a0':
    case '\u1680':
    case '\u2028':
    case '\u2029':
    case '\u202f':
    case '\u205f':
    case '\u3000':
    case '\ufeff':
      return true;
    default: {
      const code = char.codePointAt(0) ?? 0;
      return code >= 0x2000 && code <= 0x200a;
    }
  }
}

/**
 * Drop the first "(you)" viewer marker and the whitespace touching it.
 * Linear scan — `\s*(you)\s*` is polynomial ReDoS on long space runs.
 */
export function stripViewerYouMarker(value: string): string {
  const index = value.toLowerCase().indexOf('(you)');
  if (index === -1) return value;
  let start = index;
  while (start > 0 && isMarkerWhitespace(value[start - 1] ?? '')) start -= 1;
  let end = index + '(you)'.length;
  while (end < value.length && isMarkerWhitespace(value[end] ?? '')) end += 1;
  return value.slice(0, start) + value.slice(end);
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
        m.memberName
          .toLowerCase()
          .startsWith(
            stripViewerYouMarker(draft.leadName).trim().toLowerCase(),
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

function canonicalQuestProposalPayload(payload: EmbeddedQuestProposalPayload) {
  return {
    questSlug: payload.questSlug,
    name: payload.name,
    goal: payload.goal,
    scopeIn: payload.scopeIn,
    scopeOut: payload.scopeOut,
    successCriteria: payload.successCriteria,
    rewards: payload.rewards,
    targetDate: payload.targetDate,
    leadName: payload.leadName,
    milestones: payload.milestones.map((milestone) => ({
      order: milestone.order,
      name: milestone.name,
      description: milestone.description,
      dueDate: milestone.dueDate,
      ownerName: milestone.ownerName,
    })),
    members: payload.members.map((member) => ({
      memberName: member.memberName,
      roleLabel: member.roleLabel ?? null,
      isLead: member.isLead === true,
      responsibilities: member.responsibilities,
    })),
  };
}

function isCompleteQuestProposalPayload(
  payload: EmbeddedQuestProposalPayload,
): payload is EmbeddedQuestProposalPayload & { questSlug: string } {
  return (
    typeof payload.questSlug === 'string' &&
    payload.questSlug.length > 0 &&
    typeof payload.name === 'string' &&
    typeof payload.goal === 'string' &&
    Array.isArray(payload.scopeIn) &&
    payload.scopeIn.every((item) => typeof item === 'string') &&
    Array.isArray(payload.scopeOut) &&
    payload.scopeOut.every((item) => typeof item === 'string') &&
    typeof payload.successCriteria === 'string' &&
    Array.isArray(payload.rewards) &&
    payload.rewards.every(
      (reward) =>
        typeof reward?.amount === 'string' && typeof reward?.token === 'string',
    ) &&
    (payload.targetDate === null || typeof payload.targetDate === 'string') &&
    typeof payload.leadName === 'string' &&
    Array.isArray(payload.milestones) &&
    payload.milestones.every(
      (milestone) =>
        typeof milestone?.order === 'number' &&
        typeof milestone?.name === 'string' &&
        typeof milestone?.description === 'string' &&
        (milestone.dueDate === null || typeof milestone.dueDate === 'string') &&
        (milestone.ownerName === null ||
          typeof milestone.ownerName === 'string'),
    ) &&
    Array.isArray(payload.members) &&
    payload.members.every(
      (member) =>
        typeof member?.memberName === 'string' &&
        Array.isArray(member.responsibilities) &&
        member.responsibilities.every((item) => typeof item === 'string'),
    )
  );
}

/**
 * True when the embedded proposal is the quest voters are being asked to
 * approve: same slug and the same terms, not a reused slug with other content.
 */
export function embeddedQuestProposalMatchesQuest(
  payload: EmbeddedQuestProposalPayload,
  quest: Pick<
    QuestRecord,
    | 'slug'
    | 'name'
    | 'goal'
    | 'scopeIn'
    | 'scopeOut'
    | 'scopeInMarkdown'
    | 'scopeOutMarkdown'
    | 'successCriteria'
    | 'rewards'
    | 'targetDate'
    | 'leadName'
  > & {
    milestones: Array<{
      order: number;
      name: string;
      description: string;
      dueDate: string | null;
      ownerName: string | null;
    }>;
    members: Array<{
      order: number;
      memberName: string;
      roleLabel?: string | null;
      responsibilities: string[];
    }>;
  },
): boolean {
  if (!isCompleteQuestProposalPayload(payload)) return false;
  const expected = buildEmbeddedQuestProposalPayload(
    {
      name: quest.name,
      goal: quest.goal,
      scopeIn: quest.scopeIn,
      scopeOut: quest.scopeOut,
      scopeInMarkdown: quest.scopeInMarkdown,
      scopeOutMarkdown: quest.scopeOutMarkdown,
      successCriteria: quest.successCriteria,
      rewards: quest.rewards,
      targetDate: quest.targetDate,
      leadName: quest.leadName,
      milestones: [...quest.milestones]
        .sort((a, b) => a.order - b.order)
        .map((milestone) => ({
          name: milestone.name,
          description: milestone.description,
          dueDate: milestone.dueDate,
          ownerName: milestone.ownerName,
        })),
      members: [...quest.members]
        .sort((a, b) => a.order - b.order)
        .map((member) => ({
          memberName: member.memberName,
          roleLabel: member.roleLabel,
          responsibilities: member.responsibilities,
        })),
    },
    quest.slug,
  );
  return (
    JSON.stringify(canonicalQuestProposalPayload(payload)) ===
    JSON.stringify(canonicalQuestProposalPayload(expected))
  );
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
  if (!viewer || viewer.id == null) return false;
  if (quest.status === 'archived') return false;
  if (quest.leadPersonId != null && viewer.id === quest.leadPersonId) {
    return true;
  }
  return quest.members.some(
    (m) => m.personId != null && m.personId === viewer.id,
  );
}

export function isViewerQuestLead(
  viewer: { id?: number | null; name?: string | null } | null | undefined,
  quest: Pick<QuestRecord, 'leadPersonId' | 'leadName'>,
): boolean {
  if (!viewer || viewer.id == null || quest.leadPersonId == null) return false;
  return viewer.id === quest.leadPersonId;
}
