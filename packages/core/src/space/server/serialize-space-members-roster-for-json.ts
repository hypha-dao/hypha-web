import type { SpaceMembersRosterResult } from './get-space-members-roster';

/**
 * Converts nested `Date` fields on roster entries to ISO strings (MCP + chat JSON parity).
 */
export function serializeSpaceMembersRosterDatesForJson(
  result: SpaceMembersRosterResult,
) {
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
  } as unknown as SpaceMembersRosterResult;
}
