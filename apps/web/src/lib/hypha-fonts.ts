import { IBM_Plex_Mono, Manrope, Sora } from 'next/font/google';

/**
 * Hypha type system (next/font → CSS variables on <html>):
 * - Body / UI: Manrope → `--font-body`
 * - Titles: Sora → `--font-heading`
 * - Code / addresses: IBM Plex Mono → `--font-code-face`
 *   (distinct from Tailwind `--font-mono` stack token)
 *
 * Same pairing as https://io.hypha.earth/website.
 */
export const manrope = Manrope({
  subsets: ['latin'],
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-body',
});

export const sora = Sora({
  subsets: ['latin'],
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-heading',
});

export const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500'],
  variable: '--font-code-face',
});

/** Apply on `<Html className={…}>` in root + signin layouts. */
export const hyphaFontVariables = [
  manrope.variable,
  sora.variable,
  ibmPlexMono.variable,
].join(' ');
