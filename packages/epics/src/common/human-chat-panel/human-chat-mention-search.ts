export type MentionSearchCandidate = {
  userId: string;
  displayLabel: string;
  nickname?: string | null;
  slug?: string | null;
  prompt?: string;
  skills?: readonly { prompt: string }[];
};

function labelRank(label: string, query: string): 'start' | 'contains' | null {
  if (!label) return null;
  if (label.startsWith(query)) return 'start';
  const words = label.split(/[\s._'-]+/);
  if (words.some((word) => word.startsWith(query))) return 'start';
  if (label.includes(query)) return 'contains';
  return null;
}

/** Display name, username (slug), nickname, and MXID localpart. */
export function mentionCandidateSearchFields(
  candidate: MentionSearchCandidate,
  resolvedLabel?: string,
): string[] {
  const local = candidate.userId.startsWith('@')
    ? candidate.userId.slice(1).split(':')[0] ?? ''
    : '';
  return [
    resolvedLabel,
    candidate.displayLabel,
    candidate.nickname,
    candidate.slug,
    candidate.userId,
    local,
    candidate.prompt,
    ...(candidate.skills ?? []).map((skill) => skill.prompt),
  ]
    .map((part) => part?.trim().toLowerCase() ?? '')
    .filter(Boolean);
}

export function mentionCandidateMatchRank(
  candidate: MentionSearchCandidate,
  query: string,
  resolvedLabel?: string,
): 'start' | 'contains' | null {
  const q = query.trim().toLowerCase();
  if (!q) return 'start';
  let best: 'start' | 'contains' | null = null;
  for (const field of mentionCandidateSearchFields(candidate, resolvedLabel)) {
    const rank = labelRank(field, q);
    if (rank === 'start') return 'start';
    if (rank === 'contains') best = 'contains';
  }
  return best;
}
