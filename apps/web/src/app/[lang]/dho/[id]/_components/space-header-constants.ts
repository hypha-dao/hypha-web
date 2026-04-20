/** Max grapheme clusters for purpose copy (matches truncation helper). */
export const SPACE_HEADER_PURPOSE_MAX_CHARS = 300;

/** Hero card fixed height */
export const SPACE_HEADER_HERO_H =
  'min-h-[320px] max-h-[320px] h-[320px]' as const;

/** Purpose column width cap (readable line length on image) */
export const SPACE_HEADER_PURPOSE_WRAP =
  'w-full min-w-0 max-w-full sm:max-w-[min(28rem,92%)] md:max-w-[min(30rem,50%)] lg:max-w-[min(34rem,48%)]' as const;

/** Morph progress at which the sticky identity strip becomes visible */
export const SPACE_HEADER_IDENTITY_STRIP_SHOW_PROGRESS = 0.04;
