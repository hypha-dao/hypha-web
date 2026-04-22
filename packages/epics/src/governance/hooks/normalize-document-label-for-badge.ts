import { DOCUMENT_LABEL_BADGE_KEYS } from './document-label-badge-keys';

/**
 * UI create flows sometimes persisted `document.label` as the user's locale string
 * instead of the English literal expected by `DOCUMENT_LABEL_BADGE_KEYS`.
 * Maps known localized values back to the canonical label used for badge resolution.
 */
const LOCALIZED_TO_CANONICAL: Record<string, string> = {
  // Collective agreement — `labels.collectiveAgreement` per locale
  'Collective Agreement': 'Collective Agreement',
  'Convenio Colectivo': 'Collective Agreement',
  'Accord collectif': 'Collective Agreement',
  'Acordo Coletivo': 'Collective Agreement',
  'Kollektive Vereinbarung': 'Collective Agreement',
  // Contribution — `labels.contribution` (locale spelling variants)
  Contribución: 'Contribution',
  Contribuição: 'Contribution',
  // Generic agreement fallbacks (legacy / defaultAgreement before type-specific labels)
  Agreement: 'Collective Agreement',
  Acuerdo: 'Collective Agreement',
  Accord: 'Collective Agreement',
  Acordo: 'Collective Agreement',
  Vereinbarung: 'Collective Agreement',
};

export function normalizeDocumentLabelForBadge(
  label: string | null | undefined,
): string {
  const trimmed = (label ?? '').trim();
  if (!trimmed) return '';

  if (DOCUMENT_LABEL_BADGE_KEYS[trimmed]) {
    return trimmed;
  }

  return LOCALIZED_TO_CANONICAL[trimmed] ?? trimmed;
}
