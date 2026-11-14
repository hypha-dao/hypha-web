/**
 * CSS `sizes` for the compact DHO hero photo — keep in sync with preload.
 * The lead `<Image>` sits in `inset-[-10%]` (~120% of the banner). HTML
 * `sizes` cannot use `var()`, and the sidebars are not a fixed width
 * (icon rail vs expanded vs overlay, resizable). Request 120% of the
 * viewport minus padding (`px-4` / `sm:px-5`) so the srcset stays sharp.
 */
export const SPACE_BANNER_IMAGE_SIZES =
  '(max-width: 639px) calc(120vw - 2.4rem), calc(120vw - 3rem)';

export const SPACE_BANNER_IMAGE_QUALITY = 70;
