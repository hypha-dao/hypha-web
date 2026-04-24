import { describe, expect, it } from 'vitest';
import { DOCUMENT_LABEL_BADGE_KEYS } from '../document-label-badge-keys';
import { normalizeProposalDocumentLabel } from '../proposal-document-label';

describe('normalizeProposalDocumentLabel', () => {
  it('returns empty string for null, undefined, or whitespace-only input', () => {
    expect(normalizeProposalDocumentLabel(null)).toBe('');
    expect(normalizeProposalDocumentLabel(undefined)).toBe('');
    expect(normalizeProposalDocumentLabel('')).toBe('');
    expect(normalizeProposalDocumentLabel('   ')).toBe('');
  });

  it('passes through known badge keys from DOCUMENT_LABEL_BADGE_KEYS', () => {
    expect(normalizeProposalDocumentLabel('Invite')).toBe('Invite');
    expect(normalizeProposalDocumentLabel('Buy Hypha Tokens')).toBe(
      'Buy Hypha Tokens',
    );
    expect(DOCUMENT_LABEL_BADGE_KEYS['Invite']).toBeDefined();
  });

  it('returns canonical English for known literals', () => {
    expect(normalizeProposalDocumentLabel('Contribution')).toBe('Contribution');
  });

  it('maps localized collective agreement labels', () => {
    expect(normalizeProposalDocumentLabel('Convenio Colectivo')).toBe(
      'Collective Agreement',
    );
  });

  it('maps localized contribution spellings', () => {
    expect(normalizeProposalDocumentLabel('Contribución')).toBe('Contribution');
  });

  it('maps English UI variant for buy Hypha tokens', () => {
    expect(normalizeProposalDocumentLabel('Buy Hypha Tokens (Rewards)')).toBe(
      'Buy Hypha Tokens',
    );
  });

  it('passes through unknown custom labels', () => {
    expect(normalizeProposalDocumentLabel('Custom proposal type')).toBe(
      'Custom proposal type',
    );
  });
});
