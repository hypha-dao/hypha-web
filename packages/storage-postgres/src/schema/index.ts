import { memberships } from './membership';
import { people } from './people';
import { spaces } from './space';
import { documents } from './document';
import { spacesRelations } from './space.relations';
import { membershipRelation } from './membership.relations';
import { peopleRelations } from './people.relations';
import { documentRelation } from './document.relations';
import { tokenRelations, tokens } from './tokens';

export { SPACE_FLAGS } from './flags';
export { CATEGORIES } from './categories';

export * from './document';
export * from './membership';
export * from './people';
export * from './space';
export * from './tokens';

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
};
