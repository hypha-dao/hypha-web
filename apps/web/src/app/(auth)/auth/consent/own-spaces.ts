import 'server-only';
import { listSpaces, resolveCaller } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

export type PickerSpace = {
  /** Database space id: what the grant stores. */
  id: number;
  title: string;
  /** Title of the parent space, shown next to a sub-space (no inheritance: each is its own row). */
  parentTitle: string | null;
  logoUrl: string | null;
};

/**
 * The spaces the person can pick for an app: those where they are a member or a delegate, among
 * the ones the app could read at all (the same access rule as the hosted MCP server, so nothing is
 * offered that the app could never see). `null` = the list could not be read; the page then offers
 * "all my spaces" only. Never throws.
 */
export async function loadPickerSpaces(
  personSub: string,
): Promise<PickerSpace[] | null> {
  try {
    const resolved = await resolveCaller(
      {
        kind: 'user',
        sub: personSub,
        clientId: null,
        scopes: [],
        spaceGrants: null,
      },
      { db },
    );
    if (!resolved.ok) return null;
    const result = await listSpaces(
      {
        mine: true,
        authoritative: true,
        omitFlagArchived: true,
        titleOrder: 'asc',
      },
      resolved.caller,
      { db },
    );
    if (!result.ok) return null;
    const titleById = new Map(
      result.data.items.map((space) => [space.id, space.title]),
    );
    return result.data.items.map((space) => ({
      id: space.id,
      title: space.title,
      logoUrl: space.logoUrl ?? null,
      parentTitle:
        space.parentId != null ? titleById.get(space.parentId) ?? null : null,
    }));
  } catch {
    return null;
  }
}
