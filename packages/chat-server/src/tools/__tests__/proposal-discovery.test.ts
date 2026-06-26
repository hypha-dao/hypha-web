import { describe, expect, it } from 'vitest';
import {
  getProposalCatalogEntry,
  pickOptionalDiscoveryPrompts,
  orderFieldsForDiscovery,
  buildResubmitPayload,
} from '../proposal-catalog';
import { buildGuidanceResponse } from '../proposal-guidance';

describe('proposal discovery — change_voting_method', () => {
  const entry = getProposalCatalogEntry('change_voting_method')!;

  it('defers quorum and voting period to chain defaults in prepare (not chat)', () => {
    const prompts = orderFieldsForDiscovery(
      pickOptionalDiscoveryPrompts(entry, { voting_method: '1m1v' }),
    );
    const keys = prompts.map((field) => field.key);
    expect(keys).not.toContain('quorum_percent');
    expect(keys).not.toContain('unity_percent');
    expect(keys).not.toContain('auto_execution');
    expect(keys).not.toContain('voting_duration_seconds');
  });

  it('starts with title (form order top-to-bottom)', () => {
    const guidance = buildGuidanceResponse({
      proposalType: 'change_voting_method',
      collectedFields: {},
    });
    expect(guidance.ok).toBe(true);
    if (!guidance.ok) return;
    expect(guidance.next_question_field).toBe('title');
    expect(guidance.remaining_field_order?.[0]).toBe('title');
  });

  it('asks voting method after title and description', () => {
    const guidance = buildGuidanceResponse({
      proposalType: 'change_voting_method',
      collectedFields: {
        title: 'Change Voting Method',
        description: 'Switch to one member one vote.',
      },
    });
    expect(guidance.ok).toBe(true);
    if (!guidance.ok) return;
    expect(guidance.next_question_field).toBe('voting_method');
    expect(guidance.interaction_hint).toMatch(/list EVERY option/i);
    expect(guidance.form_sync?.call_prepare_governance_proposal).toBe(true);
    expect(guidance.filled_fields).toEqual(['title', 'description']);
  });

  it('does not re-ask filled fields', () => {
    const guidance = buildGuidanceResponse({
      proposalType: 'change_voting_method',
      collectedFields: {
        title: 'Change Voting Method',
        description: 'Switch to one member one vote.',
        voting_method: '1m1v',
      },
    });
    expect(guidance.ok).toBe(true);
    if (!guidance.ok) return;
    expect(guidance.filled_fields).toContain('title');
    expect(guidance.filled_fields).toContain('voting_method');
    expect(guidance.remaining_field_order).not.toContain('title');
    expect(guidance.ready_to_publish).toBe(false);
    expect(guidance.pending_prepare_all_fields).toBe(true);
  });

  it('still defers governance tuning for contribution proposals', () => {
    const contribution = getProposalCatalogEntry('contribution')!;
    const prompts = pickOptionalDiscoveryPrompts(contribution, {});
    const keys = prompts.map((field) => field.key);
    expect(keys).not.toContain('quorum_percent');
    expect(keys).not.toContain('voting_duration_seconds');
  });
});

describe('proposal discovery — change_entry_method', () => {
  it('starts with title then entry method', () => {
    const guidance = buildGuidanceResponse({
      proposalType: 'change_entry_method',
      collectedFields: {},
    });
    expect(guidance.ok).toBe(true);
    if (!guidance.ok) return;
    expect(guidance.next_question_field).toBe('title');
  });

  it('requires listing all entry options before recommendation', () => {
    const guidance = buildGuidanceResponse({
      proposalType: 'change_entry_method',
      collectedFields: {
        title: 'Change Entry Method',
        description: 'Open the space to everyone.',
      },
    });
    expect(guidance.ok).toBe(true);
    if (!guidance.ok) return;
    expect(guidance.next_question_field).toBe('entry_method');
    expect(guidance.interaction_hint).toMatch(/Open Access/i);
    expect(guidance.interaction_hint).toMatch(/Invite Request/i);
    expect(guidance.interaction_hint).toMatch(/Token Based/i);
  });

  it('uses localized entry option labels for French', () => {
    const guidance = buildGuidanceResponse({
      proposalType: 'change_entry_method',
      collectedFields: {
        title: "Changer la méthode d'entrée",
        description: "Ouvrir l'espace à tous.",
      },
      locale: 'fr',
    });
    expect(guidance.ok).toBe(true);
    if (!guidance.ok) return;
    expect(guidance.interaction_hint).toMatch(/Accès ouvert/i);
    expect(guidance.interaction_hint).toMatch(/Demande d'invitation/i);
    expect(guidance.interaction_hint).toMatch(/Basé sur des tokens/i);
    expect(guidance.interaction_hint).not.toMatch(/Open Access/i);
  });

  it('fast-paths to prepare when entry method is accepted — no title re-ask', () => {
    const guidance = buildGuidanceResponse({
      proposalType: 'change_entry_method',
      collectedFields: { entry_method: 'open_access' },
    });
    expect(guidance.ok).toBe(true);
    if (!guidance.ok) return;
    expect(guidance.step_mode).toBe('prepare_now');
    expect(guidance.next_question_field).toBeNull();
    expect(guidance.pending_prepare_all_fields).toBe(true);
    expect(guidance.ready_to_publish).toBe(false);
    expect(guidance.effective_collected_fields).toMatchObject({
      entry_method: 'open_access',
      title: 'Change Entry Method to Open Access',
    });
    expect(guidance.walkthrough_hint).toMatch(/prepare_governance_proposal/i);
    expect(guidance.walkthrough_hint).toMatch(/does that sound good/i);
    expect(guidance.form_sync?.call_prepare_governance_proposal).toBe(true);
  });

  it('does not mark ready_to_publish before the form is open', () => {
    const guidance = buildGuidanceResponse({
      proposalType: 'change_entry_method',
      collectedFields: {
        entry_method: 'open_access',
        title: 'Change Entry Method to Open Access',
        description: 'Open membership for everyone.',
      },
    });
    expect(guidance.ok).toBe(true);
    if (!guidance.ok) return;
    expect(guidance.ready_to_publish).toBe(false);
    expect(guidance.pending_prepare_all_fields).toBe(true);
  });

  it('prepare_now when title accepted before form open (issue new token)', () => {
    const guidance = buildGuidanceResponse({
      proposalType: 'issue_new_token',
      collectedFields: { title: 'Issue New Token' },
    });
    expect(guidance.ok).toBe(true);
    if (!guidance.ok) return;
    expect(guidance.step_mode).toBe('prepare_now');
    expect(guidance.prepare_now_reason).toBe('title_accepted');
    expect(guidance.next_question_field).toBeNull();
    expect(guidance.walkthrough_hint).toMatch(/Do NOT ask/i);
    expect(guidance.form_sync?.call_prepare_governance_proposal).toBe(true);
  });
});

describe('proposal discovery — issue_new_token', () => {
  it('follows form order: title, description, token type, name, symbol', () => {
    const empty = buildGuidanceResponse({
      proposalType: 'issue_new_token',
      collectedFields: {},
    });
    expect(empty.ok).toBe(true);
    if (!empty.ok) return;
    expect(empty.next_question_field).toBe('title');
    expect(empty.ready_to_publish).toBe(false);

    const afterTitleDesc = buildGuidanceResponse({
      proposalType: 'issue_new_token',
      collectedFields: {
        title: 'Issue New Token',
        description: 'Create a utility token for the space.',
      },
    });
    expect(afterTitleDesc.ok).toBe(true);
    if (!afterTitleDesc.ok) return;
    expect(afterTitleDesc.next_question_field).toBe('token_type');
    expect(afterTitleDesc.next_question).toMatch(/Never ask about supply/i);

    const afterType = buildGuidanceResponse({
      proposalType: 'issue_new_token',
      collectedFields: {
        title: 'Issue New Token',
        description: 'Create a utility token.',
        token_type: 'utility',
      },
    });
    expect(afterType.ok).toBe(true);
    if (!afterType.ok) return;
    expect(afterType.next_question_field).toBe('token_name');
  });

  it('is not ready until token type, name, and symbol are collected', () => {
    const entry = getProposalCatalogEntry('issue_new_token')!;
    expect(entry.requiredFields.map((f) => f.key)).toEqual([
      'title',
      'description',
      'token_type',
      'token_name',
      'token_symbol',
    ]);

    const partial = buildGuidanceResponse({
      proposalType: 'issue_new_token',
      collectedFields: {
        title: 'Issue New Token',
        description: 'Create a token.',
        token_type: 'utility',
      },
    });
    expect(partial.ok).toBe(true);
    if (!partial.ok) return;
    expect(partial.ready_to_publish).toBe(false);

    const complete = buildGuidanceResponse({
      proposalType: 'issue_new_token',
      collectedFields: {
        title: 'Issue New Token',
        description: 'Create a token.',
        token_type: 'utility',
        token_name: 'TOK',
        token_symbol: 'TOK',
      },
    });
    expect(complete.ok).toBe(true);
    if (!complete.ok) return;
    expect(complete.remaining_field_order).toEqual([]);
    expect(complete.ready_to_publish).toBe(false);
    expect(complete.pending_prepare_all_fields).toBe(true);
  });

  it('defers max supply to the form (Advanced toggle — not basic fields)', () => {
    const entry = getProposalCatalogEntry('issue_new_token')!;
    const prompts = orderFieldsForDiscovery(
      pickOptionalDiscoveryPrompts(entry, {
        title: 'Issue New Token',
        description: 'Create a token.',
        token_type: 'utility',
        token_name: 'TOK',
        token_symbol: 'TOK',
      }),
    );
    const keys = prompts.map((field) => field.key);
    expect(keys).not.toContain('max_supply');
    expect(keys).not.toContain('quorum_percent');
  });

  it('maps token fields into issueNewTokenForm resubmit payload', () => {
    const entry = getProposalCatalogEntry('issue_new_token')!;
    const payload = buildResubmitPayload(entry, {
      proposal_type: 'issue_new_token',
      space_slug: 'test-space',
      title: 'Issue New Token',
      description: 'Create a utility token for the space.',
      proposal_fields: {
        token_type: 'utility',
        token_name: 'TOK',
        token_symbol: 'TOK',
        max_supply: 0,
      },
    });
    expect(payload.issueNewTokenForm).toEqual({
      type: 'utility',
      name: 'TOK',
      symbol: 'TOK',
      maxSupply: 0,
      enableLimitedSupply: false,
    });
  });
});

describe('buildResubmitPayload partial updates', () => {
  it('omits placeholder title/description and default autoExecution on partial prepare', () => {
    const entry = getProposalCatalogEntry('change_voting_method')!;
    const payload = buildResubmitPayload(
      entry,
      {
        proposal_type: 'change_voting_method',
        space_slug: 'test-space',
        title: 'Governance proposal',
        description:
          'Prepared with Hypha AI — review and edit on the form before publishing.',
        proposal_fields: { voting_method: '1m1v' },
      },
      { isPartial: true },
    );
    expect(payload.title).toBeUndefined();
    expect(payload.description).toBeUndefined();
    expect(payload.autoExecution).toBeUndefined();
    expect(payload.votingMethod).toBe('1m1v');
  });

  it('normalizes voting duration to dropdown options', () => {
    const entry = getProposalCatalogEntry('change_voting_method')!;
    const payload = buildResubmitPayload(entry, {
      proposal_type: 'change_voting_method',
      space_slug: 'test-space',
      title: 'Voting change',
      description: 'Update voting duration for the space.',
      proposal_fields: {
        auto_execution: false,
        voting_duration_seconds: 250000,
      },
    });
    expect(payload.votingDuration).toBe(259200);
  });
});
