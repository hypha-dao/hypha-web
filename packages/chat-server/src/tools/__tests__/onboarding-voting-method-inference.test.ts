import { describe, expect, it } from 'vitest';

import {
  buildPostCreateVotingMethodDirective,
  inferVotingMethodFromConversation,
  inferVotingMethodFromText,
  isPlainConfirmationReply,
  shouldOpenVotingMethodProposalFromConversation,
} from '../onboarding-voting-method-inference';

describe('onboarding voting method inference', () => {
  it('parses explicit voting method phrases', () => {
    expect(inferVotingMethodFromText('one member 14')).toBe('1m1v');
    expect(inferVotingMethodFromText('one member one vote')).toBe('1m1v');
    expect(inferVotingMethodFromText('voice-weighted')).toBe('1v1v');
    expect(inferVotingMethodFromText('token weighted')).toBe('1t1v');
  });

  it('treats short affirmatives as confirmation', () => {
    expect(isPlainConfirmationReply('yes')).toBe(true);
    expect(isPlainConfirmationReply('yes so')).toBe(true);
    expect(isPlainConfirmationReply('sounds good!')).toBe(true);
    expect(isPlainConfirmationReply('oui')).toBe(true);
    expect(isPlainConfirmationReply("d'accord")).toBe(true);
    expect(isPlainConfirmationReply('sim')).toBe(true);
  });

  it('infers method from assistant recommendation when user confirms', () => {
    expect(
      inferVotingMethodFromConversation({
        userText: 'yes',
        assistantText:
          'I recommend one member one vote for equal participation. Shall I proceed?',
      }),
    ).toBe('1m1v');
  });

  it('detects when the voting method proposal should open', () => {
    expect(
      shouldOpenVotingMethodProposalFromConversation({
        userText: 'yes',
        assistantText:
          'One member one vote keeps things fair. Does this sound good?',
        votingMethodAlreadySet: false,
      }),
    ).toBe(true);
  });

  it('builds a directive to call prepare_governance_proposal', () => {
    const directive = buildPostCreateVotingMethodDirective({
      userText: 'yes',
      assistantText: 'I recommend one member one vote.',
      spaceSlug: 'my-space',
      votingMethodAlreadySet: false,
    });
    expect(directive).toContain('prepare_governance_proposal');
    expect(directive).toContain('change_voting_method');
    expect(directive).toContain('1m1v');
    expect(directive).toContain('proposal_guidance');
    expect(directive).toContain('Do NOT');
    expect(directive).not.toContain('click Publish');
  });
});
