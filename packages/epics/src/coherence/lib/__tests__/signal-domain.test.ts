import { describe, expect, it } from 'vitest';
import type { SignalWorkflowConfig } from '../../../../../core/src/coherence/signal-workflow';
import {
  domainBoardChoices,
  domainDotClass,
  selectedDomainSlug,
} from '../../components/signal-domain';

const workflow: SignalWorkflowConfig = {
  statuses: [],
  boards: [
    { slug: 'general', name: 'General', color: 'neutral', position: 0 },
    { slug: 'outreach', name: 'Outreach', color: 'accent', position: 1 },
    {
      slug: 'old',
      name: 'Old',
      color: 'error',
      position: 2,
      archived: true,
    },
  ],
};

describe('signal domain', () => {
  it('maps each configured color to a solid dot', () => {
    expect(domainDotClass('accent')).toBe('bg-accent-9');
    expect(domainDotClass('warn')).toBe('bg-warning-9');
    expect(domainDotClass('success')).toBe('bg-success-9');
    expect(domainDotClass('error')).toBe('bg-error-9');
    expect(domainDotClass('neutral')).toBe('bg-neutral-9');
    expect(domainDotClass(null)).toBe('bg-neutral-9');
  });

  it('offers active domains and keeps an archived domain already on the signal', () => {
    expect(
      domainBoardChoices(workflow, 'outreach').map((board) => board.slug),
    ).toEqual(['general', 'outreach']);
    expect(
      domainBoardChoices(workflow, 'old').map((board) => board.slug),
    ).toEqual(['general', 'outreach', 'old']);
  });

  it('keeps an archived domain selected when it is still on the signal', () => {
    expect(selectedDomainSlug('old', workflow)).toBe('old');
    expect(selectedDomainSlug('missing', workflow)).toBe('general');
  });
});
