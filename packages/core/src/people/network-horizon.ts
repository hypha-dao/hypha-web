import type { MemberSpaceLogo } from './member-intelligence';

/** The dashboard stays on the member's spaces, or also listens outward. */
export type NetworkHorizon = 'spaces' | 'network';

/** Why a shared signal was kept. Later ranking can refine these, not replace them. */
export type NetworkRelevanceReason = 'location' | 'interest' | 'experience';

export const NETWORK_HORIZON_FEED_LIMIT = 6;
/** Pool read before ranking. The feed itself stays at the limit above. */
export const NETWORK_HORIZON_CANDIDATE_LIMIT = 48;

/** Needs and opportunities are what the network offers. Other types stay in their space. */
export const NETWORK_SIGNAL_TYPES = ['Need', 'Opportunity'] as const;

const RELEVANCE_WEIGHT: Record<NetworkRelevanceReason, number> = {
  location: 3,
  interest: 2,
  experience: 1,
};

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'that',
  'this',
  'your',
  'you',
  'are',
  'was',
  'were',
  'have',
  'has',
  'not',
  'but',
  'into',
  'about',
  'their',
  'they',
  'our',
  'can',
  'will',
  'who',
  'what',
  'when',
  'where',
  'how',
  'all',
  'any',
  'its',
  'than',
  'then',
  'them',
  'been',
  'being',
  'also',
  'just',
  'more',
  'some',
  'such',
  'only',
  'over',
  'under',
  'other',
  'space',
  'spaces',
  'need',
  'needs',
  'community',
]);

export type NetworkHorizonCandidate = {
  id: number;
  slug: string | null;
  title: string;
  type: string;
  description: string | null;
  tags: string[];
  updatedAt: string;
  spaceSlug: string;
  spaceTitle: string;
  spaceDescription: string | null;
  spaceLocation: string | null;
  spaceLogo?: MemberSpaceLogo | null;
  creatorId: number | null;
  creatorName: string | null;
  creatorAvatarUrl: string | null;
};

export type NetworkHorizonSignal = NetworkHorizonCandidate & {
  relevance: {
    score: number;
    reasons: NetworkRelevanceReason[];
  };
};

/** What the member already is, used to keep the outward feed relevant. */
export type MemberHorizonProfile = {
  location: string | null;
  /** Free text on the profile. Treated as interest until a dedicated field exists. */
  description: string | null;
  /** Titles of spaces they belong to. */
  spaceTitles: string[];
  /** Descriptions of those spaces. Only longer words are kept, so a bio does not flood the feed. */
  spaceDescriptions: string[];
  /** Tags on signals in their spaces. */
  interestTags: string[];
};

function plain(value: string | null | undefined): string {
  return (value ?? '').replace(/<[^>]+>/g, ' ');
}

function tokens(
  value: string | null | undefined,
  minLength: number,
): Set<string> {
  const found = new Set<string>();
  for (const part of plain(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/i)) {
    const token = part.trim();
    if (token.length < minLength || STOP_WORDS.has(token)) continue;
    found.add(token);
  }
  return found;
}

function overlaps(
  left: ReadonlySet<string>,
  right: ReadonlySet<string>,
): boolean {
  for (const token of left) {
    if (right.has(token)) return true;
  }
  return false;
}

function takeDiverse(
  ranked: NetworkHorizonSignal[],
  limit: number,
): NetworkHorizonSignal[] {
  const cap = Math.max(limit, 0);
  const picked: NetworkHorizonSignal[] = [];
  const seenSpaces = new Set<string>();
  for (const item of ranked) {
    if (picked.length >= cap) break;
    if (seenSpaces.has(item.spaceSlug)) continue;
    seenSpaces.add(item.spaceSlug);
    picked.push(item);
  }
  if (picked.length < cap) {
    const pickedIds = new Set(picked.map((item) => item.id));
    for (const item of ranked) {
      if (picked.length >= cap) break;
      if (pickedIds.has(item.id)) continue;
      picked.push(item);
    }
  }
  return picked;
}

/**
 * Rank shared needs and opportunities for one member.
 * A signal with no location, interest, or experience overlap is left out.
 * One space cannot fill the feed, and the list is capped.
 */
export function rankNetworkHorizonSignals(
  profile: MemberHorizonProfile,
  candidates: readonly NetworkHorizonCandidate[],
  limit = NETWORK_HORIZON_FEED_LIMIT,
): NetworkHorizonSignal[] {
  const location = tokens(profile.location, 2);
  const interests = new Set<string>([
    ...tokens(profile.description, 3),
    ...profile.interestTags.flatMap((tag) => [...tokens(tag, 3)]),
  ]);
  const experience = new Set<string>([
    ...profile.spaceTitles.flatMap((title) => [...tokens(title, 3)]),
    ...profile.spaceDescriptions.flatMap((text) => [...tokens(text, 5)]),
  ]);

  const ranked: NetworkHorizonSignal[] = [];
  for (const candidate of candidates) {
    if (!(NETWORK_SIGNAL_TYPES as readonly string[]).includes(candidate.type)) {
      continue;
    }
    const reasons: NetworkRelevanceReason[] = [];
    if (
      location.size > 0 &&
      overlaps(location, tokens(candidate.spaceLocation, 2))
    ) {
      reasons.push('location');
    }
    const signalText = tokens(
      [
        candidate.title,
        candidate.description,
        candidate.tags.join(' '),
        candidate.spaceTitle,
      ].join(' '),
      3,
    );
    if (interests.size > 0 && overlaps(interests, signalText)) {
      reasons.push('interest');
    }
    const experienceText = tokens(
      [
        candidate.title,
        candidate.description,
        candidate.spaceTitle,
        candidate.spaceDescription,
      ].join(' '),
      3,
    );
    if (experience.size > 0 && overlaps(experience, experienceText)) {
      reasons.push('experience');
    }
    if (reasons.length === 0) continue;
    const score = reasons.reduce(
      (sum, reason) => sum + RELEVANCE_WEIGHT[reason],
      0,
    );
    ranked.push({
      ...candidate,
      relevance: { score, reasons },
    });
  }

  ranked.sort((left, right) => {
    if (left.relevance.score !== right.relevance.score) {
      return right.relevance.score - left.relevance.score;
    }
    if (left.updatedAt !== right.updatedAt) {
      return left.updatedAt < right.updatedAt ? 1 : -1;
    }
    return left.id - right.id;
  });

  return takeDiverse(ranked, limit);
}
