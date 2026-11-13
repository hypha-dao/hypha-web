/**
 * CSS `sizes` for the compact DHO hero photo — keep in sync with preload.
 * The lead `<Image>` sits in `inset-[-10%]` (~120% of the banner). The DHO
 * main column has no max-width; padding is `px-4` / `sm:px-5`.
 */
export const SPACE_BANNER_IMAGE_SIZES =
  '(max-width: 639px) calc(1.2 * (100vw - var(--sidebar-left-width, 0px) - var(--sidebar-right-width, 0px) - 2rem)), calc(1.2 * (100vw - var(--sidebar-left-width, 0px) - var(--sidebar-right-width, 0px) - 2.5rem))';

export const SPACE_BANNER_IMAGE_QUALITY = 70;
