import { DEFAULT_PIPELINE_REGIONS } from './constants';

export type PipelineConfig = {
  /** Configurable territory / owning-team labels for deals. */
  regions: string[];
  /** Preferred default when creating deals (must be in regions when set). */
  defaultRegion: string;
};

export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  regions: [...DEFAULT_PIPELINE_REGIONS],
  defaultRegion: 'Benelux',
};

function normalizeRegionName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed || trimmed.length > 80) return null;
  return trimmed;
}

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

  return {
    regions: resolvedRegions,
    defaultRegion,
  };
}

export function sanitizePipelineConfig(input: {
  regions: string[];
  defaultRegion?: string;
}): PipelineConfig {
  return normalizePipelineConfig(input);
}
