import { describe, expect, it } from 'vitest';

import {
  buildProposalAcceptanceDirective,
  extractOfferedProposalTitle,
} from '../proposal-acceptance-directive';

describe('extractOfferedProposalTitle', () => {
  it('extracts title from a suggestion with quotes', () => {
    expect(
      extractOfferedProposalTitle(
        "I'd suggest calling this proposal 'Issue New Token.' Does that work for you?",
      ),
    ).toBe('Issue New Token.');
  });

  it('extracts title from how-about phrasing', () => {
    expect(
      extractOfferedProposalTitle(
        "How about we title this proposal 'Issue New Token'? Does that sound good to you?",
      ),
    ).toBe('Issue New Token');
  });
});

describe('buildProposalAcceptanceDirective', () => {
  it('forces prepare when user confirms offered title (issue new token loop)', () => {
    const directive = buildProposalAcceptanceDirective({
      userText: 'yes yes',
      assistantText:
        "I'd suggest calling this proposal 'Issue New Token.' Does that work for you?",
      spaceSlug: 'football-ecosystem',
    });

    expect(directive).toMatch(/CRITICAL/i);
    expect(directive).toMatch(/Issue New Token/);
    expect(directive).toMatch(/prepare_governance_proposal/i);
    expect(directive).toMatch(/Do NOT ask/i);
  });

  it('forces prepare when user confirms entry method recommendation', () => {
    const directive = buildProposalAcceptanceDirective({
      userText: 'yes',
      assistantText:
        'I recommend Open Access — anyone can join freely. How does that sound?',
      spaceSlug: 'football-ecosystem',
    });

    expect(directive).toMatch(/entry_method/i);
    expect(directive).toMatch(/open_access/);
    expect(directive).toMatch(/prepare_governance_proposal/i);
  });

  it('forces prepare when user confirms with oui (French UI)', () => {
    const directive = buildProposalAcceptanceDirective({
      userText: 'oui',
      assistantText:
        'Je recommande Open Access — tout le monde peut rejoindre librement. Quelle option souhaitez-vous ?',
      spaceSlug: 'titi',
    });

    expect(directive).toMatch(/entry_method/i);
    expect(directive).toMatch(/open_access/);
    expect(directive).toMatch(/prepare_governance_proposal/i);
  });

  it('returns null when user is not confirming', () => {
    const directive = buildProposalAcceptanceDirective({
      userText: 'maybe later',
      assistantText:
        "I'd suggest calling this proposal 'Issue New Token.' Does that work for you?",
      spaceSlug: 'football-ecosystem',
    });

    expect(directive).toBeNull();
  });

  it('returns null when title is already on the form', () => {
    const directive = buildProposalAcceptanceDirective({
      userText: 'yes',
      assistantText:
        "I'd suggest calling this proposal 'Issue New Token.' Does that work for you?",
      spaceSlug: 'football-ecosystem',
      formSnapshot: {
        formOpen: true,
        templateSegment: 'issue-new-token',
        resubmitPayload: { title: 'Issue New Token' },
      },
    });

    expect(directive).toBeNull();
  });
});
