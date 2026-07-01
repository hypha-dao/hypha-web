import { describe, expect, it } from 'vitest';
import {
  buildProposalFormStateDirective,
  buildProposalFormStateResponse,
} from '../proposal-form-state';
import { buildGuidanceResponse } from '../proposal-guidance';

describe('proposal form state — issue_new_token', () => {
  it('detects when AI claimed fields are not on screen', () => {
    const state = buildProposalFormStateResponse({
      snapshot: {
        templateSegment: 'issue-new-token',
        formOpen: true,
        resubmitPayload: {
          title: 'Creation of Utility Token',
          description: 'Create a utility token for the space treasury.',
          label: 'Issue New Token',
        },
      },
      proposalType: 'issue_new_token',
      collectedFields: {
        title: 'Creation of Utility Token',
        description: 'Create a utility token for the space treasury.',
        token_type: 'utility',
        token_name: 'Future Token',
        token_symbol: 'FUT',
      },
    });

    expect(state.ok).toBe(true);
    if (!state.ok || !('form_synced' in state)) return;
    expect(state.filled_on_screen).toContain('title');
    expect(state.missing_on_screen).toContain('token_type');
    expect(state.collected_but_not_on_screen).toContain('token_type');
    expect(state.form_synced).toBe(false);
    expect(state.ready_to_publish).toBe(false);
  });

  it('blocks ready_to_publish in guidance when form is out of sync', () => {
    const guidance = buildGuidanceResponse({
      proposalType: 'issue_new_token',
      collectedFields: {
        title: 'Creation of Utility Token',
        description: 'Create a utility token.',
        token_type: 'utility',
        token_name: 'TOK',
        token_symbol: 'TOK',
      },
      formSnapshot: {
        templateSegment: 'issue-new-token',
        formOpen: true,
        resubmitPayload: {
          title: 'Creation of Utility Token',
          description: 'Create a utility token.',
        },
      },
    });

    expect(guidance.ok).toBe(true);
    if (!guidance.ok) return;
    expect(guidance.ready_to_publish).toBe(false);
    expect(guidance.form_state?.form_synced).toBe(false);
    expect(guidance.step_mode).toBe('prepare_now');
    expect(guidance.form_incomplete).toBe(true);
  });

  it('flags empty issue-new-token form as incomplete with blocking directive', () => {
    const state = buildProposalFormStateResponse({
      snapshot: {
        templateSegment: 'issue-new-token',
        formOpen: true,
        liveFields: {},
      },
      proposalType: 'issue_new_token',
    });
    expect(state.ok).toBe(true);
    if (!state.ok || !('missing_on_screen' in state)) return;
    expect(state.missing_on_screen).toContain('title');
    expect(state.missing_on_screen).toContain('token_type');
    expect(state.missing_on_screen).toContain('token_icon_url');
    expect(state.ready_to_publish).toBe(false);

    const directive = buildProposalFormStateDirective({
      templateSegment: 'issue-new-token',
      formOpen: true,
      liveFields: {},
    });
    expect(directive).toMatch(/FORM INCOMPLETE/i);
    expect(directive).toMatch(/FORBIDDEN.*complete/i);
  });

  it('reports ready when required token fields are on screen', () => {
    const state = buildProposalFormStateResponse({
      snapshot: {
        templateSegment: 'issue-new-token',
        formOpen: true,
        resubmitPayload: {
          title: 'Issue Token',
          description: 'Create a utility token for members.',
          issueNewTokenForm: {
            type: 'utility',
            name: 'TOK',
            symbol: 'TOK',
            iconUrl: 'https://example.com/icon.png',
          },
        },
      },
      proposalType: 'issue_new_token',
      collectedFields: {
        title: 'Issue Token',
        description: 'Create a utility token for members.',
        token_type: 'utility',
        token_name: 'TOK',
        token_symbol: 'TOK',
      },
    });

    expect(state.ok).toBe(true);
    if (!state.ok || !('ready_to_publish' in state)) return;
    expect(state.form_synced).toBe(true);
    expect(state.ready_to_publish).toBe(true);
  });
});
