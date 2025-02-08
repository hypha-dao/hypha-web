import { memberships } from './membership';
import { people } from './people';
import { spaces } from './space';
import { spaceConfigs } from './space-config';
import {
  documentAgreements,
  documentAgreementSignatures,
} from './governance/agreements';
import { documentProposals } from './governance/proposals';
import { documents } from './governance/document';

export * from './governance';
export * from './membership';
export * from './people';
export * from './space-config';
export * from './space';

export const schema = {
  documentAgreements,
  documentAgreementSignatures,
  documentProposals,
  documents,
  memberships,
  people,
  spaceConfigs,
  spaces,
};
