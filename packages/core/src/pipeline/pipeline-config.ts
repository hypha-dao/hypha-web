import {
  DEFAULT_PIPELINE_ITEM_PLURAL,
  DEFAULT_PIPELINE_ITEM_SINGULAR,
  DEFAULT_PIPELINE_PAGE_TITLE,
  DEFAULT_PIPELINE_REGIONS,
  DEFAULT_PIPELINE_STAGES,
  DEFAULT_PIPELINE_TRACKS,
  getProbabilityCell,
  PIPELINE_PROBABILITY,
  seedStageProbability,
  terminalProbabilityForStage,
  type PipelineStageDefinition,
  type PipelineStageTerminal,
  type PipelineTrackDefinition,
} from './constants';

/** Success probability (%) per track slug × stage slug. */
export type ProbabilityMatrix = Record<string, Record<string, number>>;

export type PipelineConfig = {
  /** Page heading. Defaults to "Pipeline". */
  pageTitle: string;
  /** Singular item label. Defaults to "Opportunity". */
  itemSingular: string;
  /** Plural item label. Defaults to "Opportunities". */
  itemPlural: string;
  /** Configurable territory / owning-team labels for deals. */
  regions: string[];
  /** Preferred default when creating deals (must be in regions when set). */
  defaultRegion: string;
  /** Ordered tracks (swimlanes). Defaults keep Sales / Investors / … */
  tracks: PipelineTrackDefinition[];
  /** Ordered stages. Defaults keep Identified → Lost. */
  stages: PipelineStageDefinition[];
  /**
   * Stage default success rates (%) per track. Seeds a deal's
   * successRate when it enters a stage; deals can override per deal.
   */
  probabilities: ProbabilityMatrix;
};

const LABEL_MAX = 80;
const SLUG_MAX = 64;
const SLUG_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

function normalizeLabel(
  value: unknown,
  fallback: string,
  max = LABEL_MAX,
): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) return fallback;
  return trimmed.slice(0, max);
}

function slugifyName(value: string): string {
  const lower = value.trim().toLowerCase();
  let normalized = '';
  let lastWasUnderscore = false;
  for (const char of lower) {
    const code = char.charCodeAt(0);
    const isSlugChar =
      (code >= 97 && code <= 122) || (code >= 48 && code <= 57) || char === '_';
    if (isSlugChar) {
      normalized += char;
      lastWasUnderscore = char === '_';
      continue;
    }
    if (!lastWasUnderscore && normalized.length > 0) {
      normalized += '_';
      lastWasUnderscore = true;
    }
  }
  return normalized.replace(/^_+|_+$/g, '').slice(0, SLUG_MAX) || 'item';
}

function reserveUniqueSlug(base: string, used: Set<string>): string {
  const candidate = SLUG_PATTERN.test(base) ? base : slugifyName(base);
  if (!used.has(candidate)) {
    used.add(candidate);
    return candidate;
  }
  let counter = 2;
  while (used.has(`${candidate}_${counter}`)) {
    counter += 1;
  }
  const next = `${candidate}_${counter}`.slice(0, SLUG_MAX);
  used.add(next);
  return next;
}

function reindexPositions<T extends { position?: number }>(items: T[]): T[] {
  return items.map((item, index) => ({ ...item, position: index }));
}

function normalizeTerminal(value: unknown): PipelineStageTerminal | undefined {
  if (value === 'won' || value === 'lost') return value;
  return undefined;
}

function normalizeTracks(raw: unknown): PipelineTrackDefinition[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_PIPELINE_TRACKS.map((track) => ({ ...track }));
  }

  const used = new Set<string>();
  const tracks: PipelineTrackDefinition[] = [];
  raw.slice(0, 20).forEach((item, index) => {
    const source =
      item && typeof item === 'object' && !Array.isArray(item)
        ? (item as Record<string, unknown>)
        : {};
    const name = normalizeLabel(
      source.name ?? source.slug,
      `Track ${index + 1}`,
    );
    const slug = reserveUniqueSlug(
      typeof source.slug === 'string' && source.slug.trim()
        ? source.slug.trim()
        : name,
      used,
    );
    tracks.push({
      slug,
      name,
      position:
        typeof source.position === 'number' && Number.isFinite(source.position)
          ? source.position
          : index,
    });
  });

  return tracks.length > 0
    ? reindexPositions(
        tracks.sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
      )
    : DEFAULT_PIPELINE_TRACKS.map((track) => ({ ...track }));
}

function normalizeStages(raw: unknown): PipelineStageDefinition[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_PIPELINE_STAGES.map((stage) => ({ ...stage }));
  }

  const used = new Set<string>();
  const stages: PipelineStageDefinition[] = [];
  raw.slice(0, 20).forEach((item, index) => {
    const source =
      item && typeof item === 'object' && !Array.isArray(item)
        ? (item as Record<string, unknown>)
        : {};
    const name = normalizeLabel(
      source.name ?? source.slug,
      `Stage ${index + 1}`,
    );
    const slug = reserveUniqueSlug(
      typeof source.slug === 'string' && source.slug.trim()
        ? source.slug.trim()
        : name,
      used,
    );
    const terminal =
      normalizeTerminal(source.terminal) ??
      (slug === 'Won' ? 'won' : slug === 'Lost' ? 'lost' : undefined);
    stages.push({
      slug,
      name,
      position:
        typeof source.position === 'number' && Number.isFinite(source.position)
          ? source.position
          : index,
      ...(terminal ? { terminal } : {}),
    });
  });

  // At most one won and one lost terminal — first occurrence wins.
  let sawWon = false;
  let sawLost = false;
  const deduped = stages.map((stage) => {
    if (stage.terminal === 'won') {
      if (sawWon) {
        const { terminal: _terminal, ...rest } = stage;
        return rest;
      }
      sawWon = true;
    }
    if (stage.terminal === 'lost') {
      if (sawLost) {
        const { terminal: _terminal, ...rest } = stage;
        return rest;
      }
      sawLost = true;
    }
    return stage;
  });

  return deduped.length > 0
    ? reindexPositions(
        deduped.sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
      )
    : DEFAULT_PIPELINE_STAGES.map((stage) => ({ ...stage }));
}

function normalizeRegionName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed || trimmed.length > 80) return null;
  return trimmed;
}

function normalizeProbability(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, Math.round(n)));
}

export function defaultProbabilityMatrix(
  tracks: readonly PipelineTrackDefinition[] = DEFAULT_PIPELINE_TRACKS,
  stages: readonly PipelineStageDefinition[] = DEFAULT_PIPELINE_STAGES,
): ProbabilityMatrix {
  return normalizeProbabilityMatrix(PIPELINE_PROBABILITY, tracks, stages);
}

/**
 * Normalizes a raw probability matrix against the space's tracks and stages.
 * Terminal stages are absolute: won=100, lost=0.
 */
export function normalizeProbabilityMatrix(
  raw: unknown,
  tracks: readonly PipelineTrackDefinition[] = DEFAULT_PIPELINE_TRACKS,
  stages: readonly PipelineStageDefinition[] = DEFAULT_PIPELINE_STAGES,
): ProbabilityMatrix {
  const source =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const sourceMatrix = source as ProbabilityMatrix;
  const matrix: ProbabilityMatrix = {};
  for (const track of tracks) {
    const rawLane =
      source[track.slug] &&
      typeof source[track.slug] === 'object' &&
      !Array.isArray(source[track.slug])
        ? (source[track.slug] as Record<string, unknown>)
        : {};
    const lane: Record<string, number> = {};
    for (const stage of stages) {
      const terminal = terminalProbabilityForStage(stage);
      if (terminal !== undefined) {
        lane[stage.slug] = terminal;
        continue;
      }
      lane[stage.slug] =
        normalizeProbability(
          getProbabilityCell(sourceMatrix, track.slug, stage.slug) ??
            rawLane[stage.slug],
        ) ?? seedStageProbability(track.slug, stage.slug);
    }
    // Keep cells for stages that were removed so a later re-add of the same
    // slug restores this track's value instead of a seed or another track.
    for (const [stageSlug, value] of Object.entries(rawLane)) {
      if (lane[stageSlug] !== undefined) continue;
      const kept = normalizeProbability(value);
      if (kept !== null) lane[stageSlug] = kept;
    }
    matrix[track.slug] = lane;
  }
  return matrix;
}

export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  pageTitle: DEFAULT_PIPELINE_PAGE_TITLE,
  itemSingular: DEFAULT_PIPELINE_ITEM_SINGULAR,
  itemPlural: DEFAULT_PIPELINE_ITEM_PLURAL,
  regions: [...DEFAULT_PIPELINE_REGIONS],
  defaultRegion: 'Benelux',
  tracks: DEFAULT_PIPELINE_TRACKS.map((track) => ({ ...track })),
  stages: DEFAULT_PIPELINE_STAGES.map((stage) => ({ ...stage })),
  probabilities: defaultProbabilityMatrix(),
};

export function normalizePipelineConfig(raw: unknown): PipelineConfig {
  const source =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const fromArray = Array.isArray(source.regions)
    ? source.regions
        .map(normalizeRegionName)
        .filter((name): name is string => Boolean(name))
    : [];

  // Dedupe case-insensitively, keep first casing.
  const seen = new Set<string>();
  const regions: string[] = [];
  for (const name of fromArray) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    regions.push(name);
  }

  const resolvedRegions =
    regions.length > 0 ? regions : [...DEFAULT_PIPELINE_REGIONS];

  const defaultCandidate = normalizeRegionName(source.defaultRegion);
  const defaultRegion =
    defaultCandidate &&
    resolvedRegions.some(
      (r) => r.toLowerCase() === defaultCandidate.toLowerCase(),
    )
      ? resolvedRegions.find(
          (r) => r.toLowerCase() === defaultCandidate.toLowerCase(),
        )!
      : resolvedRegions.includes('Benelux')
      ? 'Benelux'
      : resolvedRegions.includes('Global')
      ? 'Global'
      : resolvedRegions[0]!;

  const tracks = normalizeTracks(source.tracks);
  const stages = normalizeStages(source.stages);

  return {
    pageTitle: normalizeLabel(source.pageTitle, DEFAULT_PIPELINE_PAGE_TITLE),
    itemSingular: normalizeLabel(
      source.itemSingular,
      DEFAULT_PIPELINE_ITEM_SINGULAR,
      40,
    ),
    itemPlural: normalizeLabel(
      source.itemPlural,
      DEFAULT_PIPELINE_ITEM_PLURAL,
      40,
    ),
    regions: resolvedRegions,
    defaultRegion,
    tracks,
    stages,
    probabilities: normalizeProbabilityMatrix(
      source.probabilities,
      tracks,
      stages,
    ),
  };
}

export type PipelineConfigPatch = {
  pageTitle?: string;
  itemSingular?: string;
  itemPlural?: string;
  regions?: string[];
  defaultRegion?: string;
  tracks?: PipelineTrackDefinition[];
  stages?: PipelineStageDefinition[];
  probabilities?: ProbabilityMatrix;
};

/**
 * Merges a partial config update onto the current config and normalizes.
 * Sections not present in the patch are preserved.
 */
export function mergePipelineConfig(
  current: unknown,
  patch: PipelineConfigPatch,
): PipelineConfig {
  const base = normalizePipelineConfig(current);
  const tracks = patch.tracks ? normalizeTracks(patch.tracks) : base.tracks;
  const stages = patch.stages ? normalizeStages(patch.stages) : base.stages;
  const probabilities = normalizeProbabilityMatrix(
    patch.probabilities
      ? mergeProbabilities(base.probabilities, patch.probabilities)
      : base.probabilities,
    tracks,
    stages,
  );

  return normalizePipelineConfig({
    pageTitle: patch.pageTitle ?? base.pageTitle,
    itemSingular: patch.itemSingular ?? base.itemSingular,
    itemPlural: patch.itemPlural ?? base.itemPlural,
    regions: patch.regions ?? base.regions,
    defaultRegion: patch.defaultRegion ?? base.defaultRegion,
    tracks,
    stages,
    probabilities,
  });
}

function mergeProbabilities(
  base: ProbabilityMatrix,
  patch: ProbabilityMatrix,
): ProbabilityMatrix {
  const merged: ProbabilityMatrix = {};
  const trackSlugs = new Set([...Object.keys(base), ...Object.keys(patch)]);
  for (const trackSlug of trackSlugs) {
    const baseLane =
      base[trackSlug] && !Array.isArray(base[trackSlug]) ? base[trackSlug] : {};
    const patchLane =
      patch[trackSlug] && !Array.isArray(patch[trackSlug])
        ? patch[trackSlug]
        : {};
    merged[trackSlug] = { ...baseLane, ...patchLane };
  }
  return merged;
}

export function findTrackName(
  tracks: readonly PipelineTrackDefinition[],
  slug: string,
): string {
  return tracks.find((track) => track.slug === slug)?.name ?? slug;
}

export function findStageName(
  stages: readonly PipelineStageDefinition[],
  slug: string,
): string {
  return stages.find((stage) => stage.slug === slug)?.name ?? slug;
}
