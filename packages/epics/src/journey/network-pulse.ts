/**
 * Network pulse uses space-level discoverability as the share-to-network
 * opt-in. PUBLIC (0) and NETWORK (1) spaces chose to be found outside
 * their membership.
 *
 * There is no per-signal “share to network” column today. Coherence
 * `source` is the community-app ingest id, `tags` are topic labels, and
 * `board` is an in-space lane — none of them mean “publish this signal
 * to the network.” A real per-signal flag would need a schema migration.
 *
 * TODO: when a per-signal share/discoverability column exists, filter
 * stories on that flag instead of inheriting the space’s discoverability.
 */
export const NETWORK_PULSE_SPACE_LIMIT = 10;
export const NETWORK_PULSE_CANDIDATE_LIMIT = 24;
export const NETWORK_PULSE_STORY_LIMIT = 8;
export const NETWORK_PULSE_HOME_STORY_LIMIT = 3;
export const NETWORK_PULSE_PEOPLE_LIMIT = 8;
export const NETWORK_PULSE_PEOPLE_SPACE_LIMIT = 4;
export const NETWORK_PULSE_CONTEXT_MAX = 140;

export const NETWORK_SHARED_DISCOVERABILITY = {
  PUBLIC: 0,
  NETWORK: 1,
} as const;

export type NetworkStoryKind = 'vote' | 'signal';

export type NetworkStory = {
  id: string;
  kind: NetworkStoryKind;
  title: string;
  spaceSlug: string;
  spaceTitle: string;
  spaceLogoUrl?: string | null;
  targetSlug: string | null;
  context: string | null;
};

export type NetworkSpaceVisual = {
  logoUrl?: string | null;
  leadImage?: string | null;
};

export function spaceVisualsFromSpaces(
  spaces: Array<{
    slug?: string | null;
    logoUrl?: string | null;
    leadImage?: string | null;
  }>,
): Record<string, NetworkSpaceVisual> {
  const visuals: Record<string, NetworkSpaceVisual> = {};
  for (const space of spaces) {
    if (!space.slug) continue;
    visuals[space.slug] = {
      logoUrl: space.logoUrl,
      leadImage: space.leadImage,
    };
  }
  return visuals;
}

export type NetworkPulseCandidate = {
  slug?: string | null;
  web3SpaceId?: number | null;
  flags?: string[] | null;
};

export type NetworkPerson = {
  slug: string;
  name: string;
  avatarUrl?: string | null;
};

export function isNetworkSharedDiscoverability(
  level: number | undefined,
): boolean {
  return (
    level === NETWORK_SHARED_DISCOVERABILITY.PUBLIC ||
    level === NETWORK_SHARED_DISCOVERABILITY.NETWORK
  );
}

export function selectNetworkPulseCandidates<T extends NetworkPulseCandidate>(
  spaces: T[],
  limit = NETWORK_PULSE_CANDIDATE_LIMIT,
): T[] {
  return spaces
    .filter((space) => {
      if (!space.slug || space.web3SpaceId == null) return false;
      const flags = space.flags ?? [];
      // Sandbox spaces are configured for private testing, not network discovery.
      return !flags.includes('archived') && !flags.includes('sandbox');
    })
    .slice(0, limit);
}

export function storyContext(
  text?: string | null,
  max = NETWORK_PULSE_CONTEXT_MAX,
): string | null {
  if (!text) return null;
  const plain = text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!plain) return null;
  if (plain.length <= max) return plain;
  return `${plain.slice(0, max - 1).trimEnd()}…`;
}

export function storyHref(lang: string, story: NetworkStory): string {
  if (story.kind === 'vote' && story.targetSlug) {
    return `/${lang}/dho/${story.spaceSlug}/agreements/proposal/${story.targetSlug}`;
  }
  if (story.kind === 'signal' && story.targetSlug) {
    return `/${lang}/dho/${
      story.spaceSlug
    }/coherence?signal=${encodeURIComponent(story.targetSlug)}`;
  }
  return `/${lang}/dho/${story.spaceSlug}/${
    story.kind === 'vote' ? 'agreements' : 'coherence'
  }`;
}

export function uniquePeople(
  people: NetworkPerson[],
  excludeSlug?: string | null,
): NetworkPerson[] {
  const seen = new Set<string>();
  const next: NetworkPerson[] = [];
  for (const person of people) {
    if (!person.slug || seen.has(person.slug)) continue;
    if (excludeSlug && person.slug === excludeSlug) continue;
    seen.add(person.slug);
    next.push(person);
    if (next.length >= NETWORK_PULSE_PEOPLE_LIMIT) break;
  }
  return next;
}
