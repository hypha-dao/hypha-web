import { memberships } from './membership';
import { people } from './people';
import { spaces } from './space';
import { spaceConfigs } from './space-config';
import {
  documentDiscussions,
  documentProposals,
  documentSignatures,
  documentVotes,
  documents,
} from './governance';

export * from './governance';
export * from './membership';
export * from './people';
export * from './space-config';
export * from './space';

export const schema = {
  documentDiscussions,
  documentProposals,
  documentSignatures,
  documentVotes,
  documents,
  memberships,
  people,
  spaceConfigs,
  spaces,
};
