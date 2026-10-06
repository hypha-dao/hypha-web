/**
 * `proposal.accepted` / `proposal.rejected` — decision-layer wiring (#2470 step 2). Re-derives
 * the `apps/web/.../webhooks/proposal/{executed,rejected}` routes' prior inline logic; those
 * routes now call `dispatch()` instead. Importing this module registers both event types as a
 * side effect.
 */
import { registerEventHandlers } from '../../core/registry';
import { buildProposalSettlementContent } from './content';
import { resolveProposalSettlementRecipients } from './resolver';

export { buildProposalSettlementContent } from './content';
export { resolveProposalSettlementRecipients } from './resolver';
export type { ProposalSettlementEvent } from './resolver';

registerEventHandlers('proposal.accepted', {
  resolver: resolveProposalSettlementRecipients,
  contentBuilder: buildProposalSettlementContent,
});

registerEventHandlers('proposal.rejected', {
  resolver: resolveProposalSettlementRecipients,
  contentBuilder: buildProposalSettlementContent,
});
