import localFont from 'next/font/local';

/**
 * Hypha type system (self-hosted → CSS variables on <html>):
 * - Body / UI: Manrope → `--font-body`
 * - Titles: Sora → `--font-heading`
 * - Code / addresses: IBM Plex Mono → `--font-code-face`
 *   (distinct from Tailwind `--font-mono` stack token)
 *
 * Latin files live in `./fonts` (SIL OFL). Preview builds were failing in
 * `next/font/google` when Google Fonts returned extensionless `/l/font?kit=`
 * URLs (`Cannot read properties of null (reading '1')` in loader.js).
 * Same pairing as https://io.hypha.earth/website.
 *
 * `unicode-range` is inlined: next/font only accepts literal loader options.
 */

export const manrope = localFont({
  src: './fonts/manrope-latin.woff2',
  display: 'swap',
  weight: '300 700',
  variable: '--font-body',
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
    },
  ],
});

export const sora = localFont({
  src: './fonts/sora-latin.woff2',
  display: 'swap',
  weight: '300 700',
  variable: '--font-heading',
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
    },
  ],
});

export const ibmPlexMono = localFont({
  src: [
    {
      path: './fonts/ibm-plex-mono-latin-400.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: './fonts/ibm-plex-mono-latin-500.woff2',
      weight: '500',
      style: 'normal',
    },
  ],
  display: 'swap',
  variable: '--font-code-face',
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
    },
  ],
});

/** Apply on `<Html className={…}>` in root + signin layouts. */
export const hyphaFontVariables = [
  manrope.variable,
  sora.variable,
  ibmPlexMono.variable,
].join(' ');
