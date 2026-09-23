/**
 * `proposal.created` — decision-layer wiring (#2470, implementation-plan.md sequencing §7.1: the
 * first type routed through `dispatch()`, chosen as the simplest non-Matrix event).
 *
 * Importing this module registers its handlers as a side effect — the action that can fire this
 * event (`actions/notify-proposal-created.ts`) imports it for that reason.
 */
import { registerEventHandlers } from '../../core/registry';
import { buildProposalCreatedContent } from './content';
import { resolveProposalCreatedRecipients } from './resolver';

export { buildProposalCreatedEvent } from './resolver';
export { buildProposalCreatedContent } from './content';

registerEventHandlers('proposal.created', {
  resolver: resolveProposalCreatedRecipients,
  contentBuilder: buildProposalCreatedContent,
});
