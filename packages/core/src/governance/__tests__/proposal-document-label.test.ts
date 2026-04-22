import { describe, expect, it } from 'vitest';
import { normalizeProposalDocumentLabel } from '../proposal-document-label';

describe('normalizeProposalDocumentLabel', () => {
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
