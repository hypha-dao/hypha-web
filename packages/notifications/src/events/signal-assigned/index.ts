/**
 * `signal.assigned` — decision-layer wiring (#2470 step 2). Re-derives
 * `actions/notify-signal-assigned.ts`'s prior logic; `createCoherenceAction` /
 * `updateCoherenceSignalBySlugAction` (`packages/core/src/coherence/server/actions.ts`) now call
 * `dispatch()` directly instead of relying on a client-fired follow-up call.
 */
import { registerEventHandlers } from '../../core/registry';
import { buildSignalAssignedContent } from './content';
import { resolveSignalAssignedRecipients } from './resolver';

export { buildSignalAssignedEvent } from './resolver';
export { buildSignalAssignedContent } from './content';

registerEventHandlers('signal.assigned', {
  resolver: resolveSignalAssignedRecipients,
  contentBuilder: buildSignalAssignedContent,
});
