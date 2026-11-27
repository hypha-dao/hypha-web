/**
 * Order and visibility of the screens in a space.
 * Pipeline activation is `spaces.pipeline_enabled`, not a hidden flag.
 * Overview stays visible. Energy and memory are omitted by their own gates.
 */

export const SPACE_SCREEN_LAYOUT_KEYS = [
  'overview',
  'energy',
  'context',
  'coherence',
  'calendar',
  'quests',
  'pipeline',
  'agreements',
  'treasury',
  'members',
  'memory',
] as const;

export type SpaceScreenLayoutKey = (typeof SPACE_SCREEN_LAYOUT_KEYS)[number];

export type SpaceScreenLayoutInput = {
  order?: readonly string[] | null;
  hidden?: readonly string[] | null;
  /** False hides the space photo and name. Missing means shown. */
  showBanner?: boolean | null;
};

export type SpaceScreenLayout = {
  order: SpaceScreenLayoutKey[];
  hidden: SpaceScreenLayoutKey[];
  showBanner: boolean;
};

/** The space photo and name stay on unless this space turned them off. */
export function spaceScreenShowsBanner(
  layout?: SpaceScreenLayoutInput | null,
): boolean {
  return layout?.showBanner !== false;
}

const KEY_SET = new Set<string>(SPACE_SCREEN_LAYOUT_KEYS);

/** Screens a space cannot turn off from this setting. Pipeline uses its own switch. */
const LOCKED_VISIBLE = new Set<SpaceScreenLayoutKey>(['overview', 'pipeline']);

export const DEFAULT_SPACE_SCREEN_ORDER: readonly SpaceScreenLayoutKey[] =
  SPACE_SCREEN_LAYOUT_KEYS;

export function isSpaceScreenLayoutKey(
  value: string,
): value is SpaceScreenLayoutKey {
  return KEY_SET.has(value);
}

/**
 * Saved order first. Screens missing from a saved list slot back into the
 * default sequence relative to the screens already placed.
 */
export function resolveSpaceScreenOrder(
  order?: readonly string[] | null,
): SpaceScreenLayoutKey[] {
  const result: SpaceScreenLayoutKey[] = [];
  const seen = new Set<SpaceScreenLayoutKey>();
  for (const key of order ?? []) {
    if (!isSpaceScreenLayoutKey(key) || seen.has(key)) continue;
    seen.add(key);
    result.push(key);
  }
  if (result.length === 0) {
    return [...DEFAULT_SPACE_SCREEN_ORDER];
  }
  for (const key of DEFAULT_SPACE_SCREEN_ORDER) {
    if (seen.has(key)) continue;
    const defaultIndex = DEFAULT_SPACE_SCREEN_ORDER.indexOf(key);
    let insertAt = 0;
    for (let index = 0; index < result.length; index += 1) {
      const placed = result[index];
      if (!placed) continue;
      if (DEFAULT_SPACE_SCREEN_ORDER.indexOf(placed) < defaultIndex) {
        insertAt = index + 1;
      }
    }
    result.splice(insertAt, 0, key);
    seen.add(key);
  }
  return result;
}

export function sanitizeSpaceScreenHidden(
  hidden?: readonly string[] | null,
): SpaceScreenLayoutKey[] {
  const result: SpaceScreenLayoutKey[] = [];
  const seen = new Set<SpaceScreenLayoutKey>();
  for (const key of hidden ?? []) {
    if (
      !isSpaceScreenLayoutKey(key) ||
      LOCKED_VISIBLE.has(key) ||
      seen.has(key)
    ) {
      continue;
    }
    seen.add(key);
    result.push(key);
  }
  return result;
}

export function normalizeSpaceScreenLayout(
  layout?: SpaceScreenLayoutInput | null,
): SpaceScreenLayout {
  return {
    order: resolveSpaceScreenOrder(layout?.order),
    hidden: sanitizeSpaceScreenHidden(layout?.hidden),
    showBanner: spaceScreenShowsBanner(layout),
  };
}

/** Screens the configuration list can show. Energy and memory follow their gates. */
export function spaceScreenEditorKeys(options: {
  order?: readonly string[] | null;
  energyEnabled: boolean;
  memoryEnabled: boolean;
}): SpaceScreenLayoutKey[] {
  return resolveSpaceScreenOrder(options.order).filter((key) => {
    if (key === 'energy') return options.energyEnabled;
    if (key === 'memory') return options.memoryEnabled;
    return true;
  });
}

export function moveVisibleSpaceScreen(
  order: readonly string[] | null | undefined,
  visible: readonly SpaceScreenLayoutKey[],
  key: SpaceScreenLayoutKey,
  direction: -1 | 1,
): SpaceScreenLayoutKey[] {
  const resolved = resolveSpaceScreenOrder(order);
  const visibleSet = new Set(visible);
  const currentVisible = resolved.filter((item) => visibleSet.has(item));
  const index = currentVisible.indexOf(key);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= currentVisible.length) {
    return resolved;
  }
  const swapped = [...currentVisible];
  const moved = swapped[index];
  if (!moved) return resolved;
  swapped.splice(index, 1);
  swapped.splice(nextIndex, 0, moved);
  let cursor = 0;
  return resolved.map((item) =>
    visibleSet.has(item) ? swapped[cursor++] ?? item : item,
  );
}

export function setSpaceScreenHidden(
  hidden: readonly string[] | null | undefined,
  key: SpaceScreenLayoutKey,
  hiddenNext: boolean,
): SpaceScreenLayoutKey[] {
  const current = sanitizeSpaceScreenHidden(hidden);
  if (LOCKED_VISIBLE.has(key)) return current;
  if (!hiddenNext) return current.filter((item) => item !== key);
  if (current.includes(key)) return current;
  return [...current, key];
}
