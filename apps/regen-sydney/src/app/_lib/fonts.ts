import { Cormorant_Garamond, Lato, Oswald } from 'next/font/google';

/**
 * Mirrors the Squarespace theme on regen.sydney:
 *   --heading-font: Oswald 500, uppercase, -0.01em
 *   --body-font:    Cormorant Garamond 600, 1.4em
 * Lato carries small UI text, which their theme also uses.
 */
export const oswald = Oswald({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-rs-heading',
});

export const cormorantGaramond = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-rs-body',
});

export const lato = Lato({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
  variable: '--font-rs-ui',
});

export const regenSydneyFontVariables = [
  oswald.variable,
  cormorantGaramond.variable,
  lato.variable,
].join(' ');
