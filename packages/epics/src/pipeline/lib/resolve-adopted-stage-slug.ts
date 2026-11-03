type StageSlugSource = {
  slug: string;
  name: string;
  terminal?: 'won' | 'lost';
};

type AdoptStageSlugInput = {
  stage: Pick<StageSlugSource, 'slug' | 'terminal'>;
  name: string;
  siblingSlugs: readonly string[];
  unsavedPlaceholderSlugs: ReadonlySet<string>;
  defaultStages: readonly Pick<StageSlugSource, 'slug' | 'name'>[];
};

/**
 * Default slugs are only adopted by unsaved placeholder rows. Saved stages
 * keep their slug when renamed so deals and success rates stay attached.
 */
export function resolveAdoptedStageSlug({
  stage,
  name,
  siblingSlugs,
  unsavedPlaceholderSlugs,
  defaultStages,
}: AdoptStageSlugInput): string {
  if (stage.terminal || !unsavedPlaceholderSlugs.has(stage.slug)) {
    return stage.slug;
  }
  const match = defaultStages.find(
    (item) => item.name.toLowerCase() === name.trim().toLowerCase(),
  );
  if (!match || siblingSlugs.includes(match.slug)) {
    return stage.slug;
  }
  return match.slug;
}
