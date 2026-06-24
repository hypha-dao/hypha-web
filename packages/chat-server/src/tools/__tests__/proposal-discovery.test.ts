import { describe, expect, it } from 'vitest';
import {
  getProposalCatalogEntry,
  pickOptionalDiscoveryPrompts,
  orderFieldsForDiscovery,
} from '../proposal-catalog';
import { buildGuidanceResponse } from '../proposal-guidance';

describe('proposal discovery — change_voting_method', () => {
  const entry = getProposalCatalogEntry('change_voting_method')!;

  it('includes quorum, unity, and voting period in optional discovery prompts', () => {
    const prompts = orderFieldsForDiscovery(
      pickOptionalDiscoveryPrompts(entry, { voting_method: '1m1v' }),
    );
    const keys = prompts.map((field) => field.key);
    expect(keys).toContain('quorum_percent');
    expect(keys).toContain('unity_percent');
    expect(keys).toContain('auto_execution');
    expect(keys).toContain('voting_duration_seconds');
  });

  it('walks quorum before title when voting method is collected', () => {
    const guidance = buildGuidanceResponse({
      proposalType: 'change_voting_method',
      collectedFields: { voting_method: '1m1v' },
    });
    expect(guidance.ok).toBe(true);
    if (!guidance.ok) return;
    expect(guidance.next_question_field).toBe('quorum_percent');
    expect(guidance.form_sync?.call_prepare_governance_proposal).toBe(true);
  });

  it('still defers governance tuning for contribution proposals', () => {
    const contribution = getProposalCatalogEntry('contribution')!;
    const prompts = pickOptionalDiscoveryPrompts(contribution, {});
    const keys = prompts.map((field) => field.key);
    expect(keys).not.toContain('quorum_percent');
    expect(keys).not.toContain('voting_duration_seconds');
  });
});
