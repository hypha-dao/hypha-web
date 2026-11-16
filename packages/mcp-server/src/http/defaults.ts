import 'server-only';
import {
  buildMyMembershipV2,
  findPersonBySub,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import type { McpDeps } from './server';

type V2Caller = Parameters<typeof buildMyMembershipV2>[0]['caller'];
type V2Person = Extract<V2Caller, { kind: 'user' }>['person'];

/**
 * The real wiring: shared v2 read functions, run as the person the token names. The full domain
 * person travels through `McpPerson` unchanged (it is a structural superset).
 */
export const defaultMcpDeps: McpDeps = {
  findPerson: async (sub) => {
    const person = await findPersonBySub({ sub }, { db });
    return person ? { ...person, slug: person.slug ?? '' } : null;
  },
  readMembership: ({ spaceSlug, person }) =>
    buildMyMembershipV2(
      {
        spaceSlug,
        caller: {
          kind: 'user',
          person: person as unknown as V2Person,
          address: (person.address as `0x${string}` | null | undefined) ?? null,
        },
      },
      { db },
    ),
};
