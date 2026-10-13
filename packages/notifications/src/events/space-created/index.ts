/**
 * `space.created` — decision-layer wiring (#2511). Importing this module registers its handlers as
 * a side effect; the `webhooks/space/created` route builds the event and calls `dispatch()`.
 */
import { registerEventHandlers } from '../../core/registry';
import { buildSpaceCreatedContent } from './content';
import { resolveSpaceCreatedRecipients } from './resolver';

export { buildSpaceCreatedEvent } from './resolver';
export { buildSpaceCreatedContent } from './content';

registerEventHandlers('space.created', {
  resolver: resolveSpaceCreatedRecipients,
  contentBuilder: buildSpaceCreatedContent,
});
