/**
 * Discovery playbooks for governance proposals — backed by the canonical catalog.
 */
import type { AiCreatableProposalType } from './ai-proposal-types';
import {
  buildProposalGuidancePromptLines,
  catalogEntryToPlaybook,
  getProposalCatalogEntry,
  pickOptionalDiscoveryPrompts,
  type ProposalGuidancePlaybook,
} from './proposal-catalog';

export type { ProposalGuidancePlaybook };
export type ProposalGuidanceField =
  ProposalGuidancePlaybook['required_fields'][number];

export { buildProposalGuidancePromptLines };

export function getProposalGuidancePlaybook(
  proposalType: AiCreatableProposalType,
): ProposalGuidancePlaybook {
  const entry = getProposalCatalogEntry(proposalType);
  if (!entry) {
    throw new Error(`Unknown proposal type: ${proposalType}`);
  }
  return catalogEntryToPlaybook(entry);
}

export function buildGuidanceResponse(args: {
  proposalType: AiCreatableProposalType;
  collectedFields?: Record<string, unknown>;
}) {
  const entry = getProposalCatalogEntry(args.proposalType);
  if (!entry) {
    return {
      ok: false as const,
      error: `Unknown proposal type: ${args.proposalType}`,
    };
  }

  const playbook = catalogEntryToPlaybook(entry);
  const collected = args.collectedFields ?? {};

  const remainingRequired = playbook.required_fields.filter((field) => {
    if (field.key === 'title' || field.key === 'description') {
      return !collected[field.key];
    }
    return field.required && collected[field.key] === undefined;
  });

  const optionalPrompts = pickOptionalDiscoveryPrompts(entry, collected);

  const suggestedTool =
    entry.prepareStrategy === 'prepare_governance_proposal'
      ? 'prepare_governance_proposal'
      : entry.prepareStrategy === 'create_space_setup_proposal'
      ? 'create_space_setup_proposal'
      : 'mcp_navigation';

  return {
    ok: true as const,
    playbook,
    suggested_tool: suggestedTool,
    remaining_required_fields: remainingRequired,
    optional_fields_to_ask: optionalPrompts,
    walkthrough_hint:
      'Ask required fields first, then offer optional fields one at a time. After prepare_governance_proposal, the form opens pre-filled with the AI panel available for section-by-section review.',
  };
}
