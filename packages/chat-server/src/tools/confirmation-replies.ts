const EXACT_CONFIRMATIONS = new Set([
  'yes',
  'y',
  'yep',
  'yeah',
  'sure',
  'ok',
  'okay',
  'sounds good',
  'go ahead',
  'proceed',
  'do it',
  'oui',
  'ouais',
  'si',
  'sí',
  'sim',
  'ja',
  'genau',
  "d'accord",
  'dacord',
  'bien sûr',
  'bien sur',
  'parfait',
  'vale',
  'claro',
  'certo',
  'está bem',
  'está bien',
  'de acuerdo',
  'einverstanden',
]);

const PLAIN_CONFIRMATION_PREFIX_RE =
  /^(?:yes|yep|yeah|y|sure|ok|okay|sounds good|go ahead|proceed|do it|oui|ouais|si|sí|sim|ja|genau|d'accord|dacord|bien sûr|bien sur|parfait|vale|claro|certo|está bem|está bien|de acuerdo|einverstanden)(?:[.!?,\s]|$)/i;

/** Short affirmative replies across Hypha UI locales (en, fr, pt, es, de). */
export function isPlainConfirmationReply(
  text: string | null | undefined,
): boolean {
  if (!text?.trim()) return false;
  const normalized = text.trim().toLowerCase();
  const normalizedCompact = normalized
    .replace(/[.,!?;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (/^confirm\b/.test(normalizedCompact)) return true;
  if (EXACT_CONFIRMATIONS.has(normalizedCompact)) return true;
  return PLAIN_CONFIRMATION_PREFIX_RE.test(normalizedCompact);
}
