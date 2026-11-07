import { isQuestMilestoneStatus, type QuestMilestoneStatus } from './constants';
import type { QuestDraftInput, QuestRecord } from './types';

export const QUEST_PROPOSAL_MARKER_START = '<!-- hypha-quest-proposal:start';
export const QUEST_PROPOSAL_MARKER_END = 'hypha-quest-proposal:end -->';
/** Agreements stores `documents.description` with a 4000 character cap. */
export const QUEST_PROPOSAL_DESCRIPTION_LIMIT = 4000;

const PLACEHOLDER_LEAD_RESPONSIBILITIES = [
  'Overall delivery',
  'Unblock reviews',
] as const;

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
  const index = value.search(/\(you\)/i);
  if (index === -1) return value;
  let start = index;
  while (start > 0 && isMarkerWhitespace(value[start - 1] ?? '')) start -= 1;
  let end = index + '(you)'.length;
  while (end < value.length && isMarkerWhitespace(value[end] ?? '')) end += 1;
  return value.slice(0, start) + value.slice(end);
}

const PLACEHOLDER_LEAD_RESPONSIBILITY_SET = new Set<string>(
  PLACEHOLDER_LEAD_RESPONSIBILITIES,
);

/**
 * True when every duty is one of the invented Lead placeholders
 * ("Overall delivery", "Unblock reviews"), including a subset of them.
 * An empty list is a real assignment with no duties yet.
 */
export function isPlaceholderLeadResponsibilityList(
  items: readonly string[] | null | undefined,
): boolean {
  const cleaned = (items ?? []).map((item) => item.trim()).filter(Boolean);
  return (
    cleaned.length > 0 &&
    cleaned.every((item) => PLACEHOLDER_LEAD_RESPONSIBILITY_SET.has(item))
  );
}

function isSyntheticPlaceholderLead(member: {
  roleLabel?: string | null;
  responsibilities?: readonly string[] | null;
}): boolean {
  return (
    member.roleLabel?.trim().toLowerCase() === 'lead' &&
    isPlaceholderLeadResponsibilityList(member.responsibilities)
  );
}

function positivePersonId(personId: number | null | undefined): number | null {
  return personId != null && personId > 0 ? personId : null;
}

function sameQuestMemberIdentity(
  left: { personId?: number | null; memberName: string },
  right: { personId?: number | null; memberName: string },
): boolean {
  const leftId = positivePersonId(left.personId);
  const rightId = positivePersonId(right.personId);
  // Two known people are the same only when their ids match. A shared
  // display name must not collapse them, or a placeholder Lead can be
  // dropped against a different person.
  if (leftId != null && rightId != null) return leftId === rightId;
  const leftName = left.memberName.trim().toLowerCase();
  const rightName = right.memberName.trim().toLowerCase();
  return leftName.length > 0 && leftName === rightName;
}

/**
 * Drop a synthetic Lead row whose only duties are the placeholder bullets
 * (or a subset of them) when that person already has a real assignment.
 * If that synthetic Lead is the only row, keep the person and clear the
 * invented duties. Safe to run on stored quests and on new drafts.
 */
export function withoutPlaceholderLeadDuplicates<
  T extends {
    personId?: number | null;
    memberName: string;
    roleLabel?: string | null;
    responsibilities?: readonly string[] | null;
  },
>(members: readonly T[]): T[] {
  const synthetic = members.map((member) => isSyntheticPlaceholderLead(member));
  const keptLoneLead = new Set<string>();

  return members.flatMap((member, index) => {
    if (!synthetic[index]) return [member];
    const hasRealAssignment = members.some(
      (other, otherIndex) =>
        otherIndex !== index &&
        !synthetic[otherIndex] &&
        sameQuestMemberIdentity(member, other),
    );
    if (hasRealAssignment) return [];
    const personKey =
      member.personId != null && member.personId > 0
        ? `id:${member.personId}`
        : `name:${member.memberName.trim().toLowerCase()}`;
    if (keptLoneLead.has(personKey)) return [];
    keptLoneLead.add(personKey);
    return [{ ...member, responsibilities: [] as string[] } as T];
  });
}

export type RefinedQuestMilestone = {
  id?: number;
  name: string;
  description: string;
  dueDate: string | null;
  ownerName: string | null;
  ownerPersonId: number | null;
  status: QuestMilestoneStatus;
};

export type RefinedQuestMember = {
  id?: number;
  personId: number | null;
  memberName: string;
  memberAvatarUrl: string | null;
  roleLabel: string;
  responsibilities: string[];
};

/**
 * Overlay an assistant milestone list onto the saved milestones.
 * Matched rows keep id, status, and owner person when the owner name
 * did not change. Unmentioned saved milestones stay, so a partial
 * refine does not reset progress.
 */
export function mergeRefinedQuestMilestones(
  existing: readonly {
    id?: number;
    name: string;
    description?: string | null;
    dueDate?: string | null;
    ownerName?: string | null;
    ownerPersonId?: number | null;
    status?: string | null;
  }[],
  incoming: readonly {
    name: string;
    description?: string | null;
    dueDate?: string | null;
    ownerName?: string | null;
  }[],
  resolveOwnerId: (name: string | null | undefined) => number | null,
): RefinedQuestMilestone[] {
  const used = new Set<number>();
  const overlay = (
    current: (typeof existing)[number] | undefined,
    next: (typeof incoming)[number] | undefined,
  ): RefinedQuestMilestone => {
    const name = (next?.name ?? current?.name ?? '').trim();
    const description = (
      next?.description ??
      current?.description ??
      ''
    ).trim();
    const dueDate =
      next && next.dueDate !== undefined
        ? next.dueDate?.trim() || null
        : current?.dueDate?.trim() || null;
    const ownerName =
      next && next.ownerName !== undefined
        ? next.ownerName?.trim() || null
        : current?.ownerName?.trim() || null;
    const ownerChanged =
      next != null &&
      next.ownerName !== undefined &&
      (next.ownerName?.trim().toLowerCase() ?? '') !==
        (current?.ownerName?.trim().toLowerCase() ?? '');
    const ownerPersonId = ownerChanged
      ? resolveOwnerId(ownerName)
      : current?.ownerPersonId ?? resolveOwnerId(ownerName);
    const rawStatus = current?.status;
    return {
      ...(typeof current?.id === 'number' ? { id: current.id } : {}),
      name,
      description,
      dueDate,
      ownerName,
      ownerPersonId: ownerPersonId ?? null,
      status: isQuestMilestoneStatus(rawStatus) ? rawStatus : 'not_started',
    };
  };

  const merged = existing.map((current) => {
    const index = incoming.findIndex(
      (item, itemIndex) =>
        !used.has(itemIndex) &&
        item.name.trim().toLowerCase() === current.name.trim().toLowerCase(),
    );
    if (index === -1) return overlay(current, undefined);
    used.add(index);
    return overlay(current, incoming[index]);
  });
  incoming.forEach((item, index) => {
    if (!used.has(index)) merged.push(overlay(undefined, item));
  });
  return merged.filter((item) => item.name.length > 0);
}

/**
 * Overlay an assistant member list onto the saved roster. Existing
 * person ids and roles survive a refine, and members the assistant
 * did not mention stay so the quest room is not kicked.
 */
export function mergeRefinedQuestMembers(
  existing: readonly {
    id?: number;
    personId?: number | null;
    memberName: string;
    memberAvatarUrl?: string | null;
    roleLabel?: string | null;
    responsibilities?: readonly string[] | null;
  }[],
  incoming: readonly {
    memberName: string;
    roleLabel?: string | null;
    responsibilities?: readonly string[] | null;
  }[],
  resolvePersonId: (name: string | null | undefined) => number | null,
): RefinedQuestMember[] {
  const used = new Set<number>();
  const merged = existing.map((current) => {
    const index = incoming.findIndex(
      (item, itemIndex) =>
        !used.has(itemIndex) &&
        item.memberName.trim().toLowerCase() ===
          current.memberName.trim().toLowerCase(),
    );
    const next = index === -1 ? undefined : incoming[index];
    if (index !== -1) used.add(index);
    const personId =
      current.personId != null && current.personId > 0
        ? current.personId
        : resolvePersonId(next?.memberName ?? current.memberName);
    return {
      ...(typeof current.id === 'number' ? { id: current.id } : {}),
      personId: personId ?? null,
      memberName: (next?.memberName ?? current.memberName).trim(),
      memberAvatarUrl: current.memberAvatarUrl ?? null,
      roleLabel:
        current.roleLabel?.trim() || next?.roleLabel?.trim() || 'Member',
      responsibilities: next?.responsibilities
        ? [...next.responsibilities]
        : [...(current.responsibilities ?? [])],
    };
  });
  incoming.forEach((item, index) => {
    if (used.has(index)) return;
    merged.push({
      personId: resolvePersonId(item.memberName),
      memberName: item.memberName.trim(),
      memberAvatarUrl: null,
      roleLabel: item.roleLabel?.trim() || 'Member',
      responsibilities: [...(item.responsibilities ?? [])],
    });
  });
  return merged.filter((item) => item.memberName.length > 0);
}

export function questRecordToProposalDraft(
  quest: Pick<
    QuestRecord,
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
      personId?: number | null;
      memberName: string;
      roleLabel?: string | null;
      responsibilities: string[];
    }>;
  },
): QuestDraftInput {
  return {
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
    members: withoutPlaceholderLeadDuplicates(
      [...quest.members].sort((a, b) => a.order - b.order),
    ).map((member) => ({
      memberName: member.memberName,
      roleLabel: member.roleLabel,
      responsibilities: [...(member.responsibilities ?? [])],
    })),
  };
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
    members: withoutPlaceholderLeadDuplicates(draft.members ?? []).map((m) => ({
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
    questRecordToProposalDraft(quest),
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
