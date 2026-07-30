import {
  IBM_Plex_Mono,
  IBM_Plex_Sans,
  Instrument_Sans,
} from 'next/font/google';

/**
 * Hypha type system (next/font → CSS variables on <html>):
 * - Body / UI: IBM Plex Sans → `--font-body`
 * - Titles: Instrument Sans → `--font-heading`
 * - Code / addresses: IBM Plex Mono → `--font-code-face`
 *   (distinct from Tailwind `--font-mono` stack token)
 */
export const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-body',
});

export const instrumentSans = Instrument_Sans({
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
  ibmPlexSans.variable,
  instrumentSans.variable,
  ibmPlexMono.variable,
].join(' ');
