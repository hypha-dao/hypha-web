import { IBM_Plex_Mono, Outfit, Plus_Jakarta_Sans } from 'next/font/google';

/**
 * Hypha type system (next/font → CSS variables on <html>):
 * - Body / UI: Plus Jakarta Sans → `--font-body`
 * - Titles: Outfit → `--font-heading`
 * - Code / addresses: IBM Plex Mono → `--font-code-face`
 *   (distinct from Tailwind `--font-mono` stack token)
 */
export const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-body',
});

export const outfit = Outfit({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700'],
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
  plusJakartaSans.variable,
  outfit.variable,
  ibmPlexMono.variable,
].join(' ');
