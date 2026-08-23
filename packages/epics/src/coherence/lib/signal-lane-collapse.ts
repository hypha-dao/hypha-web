const SIGNAL_LANE_COLLAPSE_STORAGE_KEY_PREFIX = 'hypha.signalCollapsedLanes.';

function storageKey(spaceSlug: string): string {
  return `${SIGNAL_LANE_COLLAPSE_STORAGE_KEY_PREFIX}${spaceSlug}`;
}

export function parseCollapsedSignalLanes(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return [
      ...new Set(
        parsed.filter(
          (slug): slug is string =>
            typeof slug === 'string' && slug.trim().length > 0,
        ),
      ),
    ];
  } catch {
    return [];
  }
}

export function toggleCollapsedSignalLane(
  collapsed: readonly string[],
  laneSlug: string,
): string[] {
  return collapsed.includes(laneSlug)
    ? collapsed.filter((slug) => slug !== laneSlug)
    : [...collapsed, laneSlug];
}

export function readCollapsedSignalLanes(spaceSlug: string): string[] {
  if (typeof window === 'undefined' || !spaceSlug) return [];
  try {
    return parseCollapsedSignalLanes(
      localStorage.getItem(storageKey(spaceSlug)),
    );
  } catch {
    return [];
  }
}

export function writeCollapsedSignalLanes(
  spaceSlug: string,
  laneSlugs: readonly string[],
): void {
  if (typeof window === 'undefined' || !spaceSlug) return;
  try {
    localStorage.setItem(storageKey(spaceSlug), JSON.stringify(laneSlugs));
  } catch {
    // ignore quota / privacy mode
  }
}
