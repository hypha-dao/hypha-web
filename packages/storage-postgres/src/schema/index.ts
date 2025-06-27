import { memberships } from './membership';
import { people } from './people';
import { spaces } from './space';
import { documents } from './document';
import { spacesRelations } from './space.relations';
import { membershipRelation } from './membership.relations';
import { peopleRelations } from './people.relations';
import { documentRelation } from './document.relations';

export * from './document';
export * from './membership';
export * from './people';
export * from './space';

export const schema = {
  documents,
  memberships,
  people,
  spaces,
  spacesRelations,
  membershipRelation,
  peopleRelations,
  documentRelation,
};
