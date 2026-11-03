type ProbabilityMatrix = Record<string, Record<string, number>>;

function cell(
  matrix: ProbabilityMatrix,
  trackSlug: string,
  stageSlug: string,
): number | undefined {
  const existing = matrix[trackSlug];
  if (!existing || Array.isArray(existing)) return undefined;
  const value = existing[stageSlug];
  return typeof value === 'number' ? value : undefined;
}

export function migrateMatrixSlug(
  matrix: ProbabilityMatrix,
  tracks: { slug: string }[],
  fromSlug: string,
  adoptedSlug: string,
  seed: (trackSlug: string, stageSlug: string) => number,
): ProbabilityMatrix {
  const updated: ProbabilityMatrix = {};
  for (const track of tracks) {
    const existing = matrix[track.slug];
    const lane = {
      ...(existing && !Array.isArray(existing) ? existing : {}),
    };
    lane[adoptedSlug] =
      cell(matrix, track.slug, adoptedSlug) ??
      cell(matrix, track.slug, fromSlug) ??
      seed(track.slug, adoptedSlug);
    if (fromSlug !== adoptedSlug) {
      delete lane[fromSlug];
    }
    updated[track.slug] = lane;
  }
  return updated;
}
