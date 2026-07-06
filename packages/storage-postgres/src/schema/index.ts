import { memberships } from './membership';
import { people } from './people';
import { spaces } from './space';
import { documents } from './document';
import { spacesRelations } from './space.relations';
import { membershipRelation } from './membership.relations';
import { peopleRelations } from './people.relations';
import { documentRelation } from './document.relations';
import { tokenRelations, tokens } from './tokens';
import { eventRelations } from './event.relations';
import { events } from './event';
import { transfers } from './transfers';
import { coherences } from './coherence';
import { coherenceUpvotes } from './coherence-upvotes';
import { matrixUserLinks } from './matrix-user-link';
import { tokenUpdates, tokenUpdateRelations } from './token-updates';
import { bankCustomers } from './bank-customer';
import {
  spaceSubscriptions,
  spaceSubscriptionInvoices,
} from './space-subscription';
import {
  spaceCallRecordings,
  spaceCallTranscripts,
  spaceDiscussionSummaries,
} from './call-artifacts';
import {
  signalOrchestratorCooldowns,
  signalOrchestratorDispatches,
  signalOrchestratorQueue,
} from './signal-orchestrator';
import {
  spaceScheduledItems,
  spaceScheduledItemReminderDispatches,
  spaceScheduledItemInvitationDispatches,
} from './space-scheduled-item';

export { SPACE_FLAGS } from './flags';
export { CATEGORIES } from './categories';
// TODO: Re-enable once coherence statuses are finalised and the enum is stable
// export { COHERENCE_STATUSES } from './coherence-statuses';

export * from './document';
export * from './membership';
export * from './people';
export * from './space';
export * from './tokens';
export * from './event';
export * from './transfers';
export * from './coherence';
export * from './coherence-upvotes';
export * from './matrix-user-link';
export * from './token-updates';
export * from './bank-customer';
export * from './space-subscription';
export * from './call-artifacts';
export * from './signal-orchestrator';
export * from './space-scheduled-item';

export const schema = {
  documents,
  memberships,
  people,
  spaces,
  spacesRelations,
  membershipRelation,
  peopleRelations,
  documentRelation,
  tokens,
  tokenRelations,
  events,
  eventRelations,
  transfers,
  coherences,
  coherenceUpvotes,
  matrixUserLinks,
  tokenUpdates,
  tokenUpdateRelations,
  bankCustomers,
  spaceSubscriptions,
  spaceSubscriptionInvoices,
  spaceCallRecordings,
  spaceCallTranscripts,
  spaceDiscussionSummaries,
  signalOrchestratorQueue,
  signalOrchestratorCooldowns,
  signalOrchestratorDispatches,
  spaceScheduledItems,
  spaceScheduledItemReminderDispatches,
  spaceScheduledItemInvitationDispatches,
};
