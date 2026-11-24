/**
 * Member experience type scale — class names from craft.css.
 * Prefer these over ad-hoc text-[NNpx] / font-semibold on member surfaces.
 */
export const MEMBER_EYEBROW = 'member-eyebrow';
export const MEMBER_PAGE_TITLE = 'member-page-title';
export const MEMBER_SECTION_TITLE = 'member-section-title';
export const MEMBER_ROW_TITLE = 'member-row-title';
export const MEMBER_BODY = 'member-body';
export const MEMBER_KPI = 'member-kpi';
export const MEMBER_KPI_SM = 'member-kpi-sm';

/**
 * One gap for the whole title rhythm: eyebrow → large title, and large title →
 * first content. Keep screen stacks and filters on this same token so home /
 * wallet / members don't drift. 8px — tight enough without feeling cramped.
 */
export const MEMBER_TITLE_GAP = 'gap-2';

/** Space below the title block when margin is easier than a flex gap. */
export const MEMBER_TITLE_AFTER = 'mt-2';

/**
 * Eyebrow → large title. Use with a parent that also uses MEMBER_TITLE_GAP /
 * MEMBER_TITLE_AFTER so the gap under the title matches.
 */
export const MEMBER_TITLE_STACK = `flex w-full flex-col items-start ${MEMBER_TITLE_GAP} text-left`;
