import en from '@emoji-mart/data/i18n/en.json';
import es from '@emoji-mart/data/i18n/es.json';
import fr from '@emoji-mart/data/i18n/fr.json';
import de from '@emoji-mart/data/i18n/de.json';
import pt from '@emoji-mart/data/i18n/pt.json';

/** Bundled i18n so emoji-mart does not fetch from CDN (blocked/offline → empty picker). */
const byLocale: Record<string, typeof en> = {
  en,
  es,
  fr,
  de,
  pt,
};

export function getEmojiMartI18n(locale: string): typeof en {
  return byLocale[locale] ?? en;
}
