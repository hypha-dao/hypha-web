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
 * Eyebrow → large title stack. 10px gap matches energy-community page-intro
 * (`margin-top: 10px`). Use this everywhere so home, Ask, and tab screens
 * share the same vertical rhythm — no craft-page-header (its gap-1 fights).
 */
export const MEMBER_TITLE_STACK =
  'flex w-full flex-col items-start gap-2.5 text-left';
