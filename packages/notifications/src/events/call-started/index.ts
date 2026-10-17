/**
 * `call.started` — decision-layer wiring (#2549 D16). Importing this module registers its
 * handlers; `notifyCallStartedAction` builds the event and calls `dispatch()`.
 */
import { registerEventHandlers } from '../../core/registry';
import { buildCallStartedContent } from './content';
import { resolveCallStartedRecipients } from './resolver';

export { buildCallStartedEvent } from './resolver';
export { buildCallStartedContent } from './content';

registerEventHandlers('call.started', {
  resolver: resolveCallStartedRecipients,
  contentBuilder: buildCallStartedContent,
});
