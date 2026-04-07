import type { Space } from '../types';
import type { SpaceMembersRosterResult } from './get-space-members-roster';
import type {
  PersonPublic,
  SpaceMemberRosterEntry,
} from './get-space-members-roster-helpers';

type PersonPublicJson = Omit<PersonPublic, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

type SpaceRowJson = Omit<Space, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

export type SpaceMemberRosterEntryJson =
  | (Omit<
      Extract<SpaceMemberRosterEntry, { member_kind: 'person' }>,
      'person'
    > & {
      person: PersonPublicJson;
    })
  | (Omit<
      Extract<SpaceMemberRosterEntry, { member_kind: 'space' }>,
      'space'
    > & {
      space: SpaceRowJson;
    });

export type SpaceMembersRosterResultJson =
  | Extract<SpaceMembersRosterResult, { found: false }>
  | (Omit<Extract<SpaceMembersRosterResult, { found: true }>, 'members'> & {
      members: SpaceMemberRosterEntryJson[];
    });

/**
 * Converts nested `Date` fields on roster entries to ISO strings (MCP + chat JSON parity).
 */
export function serializeSpaceMembersRosterDatesForJson(
  result: SpaceMembersRosterResult,
): SpaceMembersRosterResultJson {
  if (!result.found) {
    return result;
  }

  return {
    ...result,
    members: result.members.map((entry) => {
      if (entry.member_kind === 'person') {
        return {
          ...entry,
          person: {
            ...entry.person,
            createdAt: entry.person.createdAt.toISOString(),
            updatedAt: entry.person.updatedAt.toISOString(),
          },
        };
      }
      return {
        ...entry,
        space: {
          ...entry.space,
          createdAt: entry.space.createdAt.toISOString(),
          updatedAt: entry.space.updatedAt.toISOString(),
        },
      };
    }),
  };
}
