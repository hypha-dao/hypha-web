import 'server-only';
import { listSpaces, resolveCaller } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

export type PickerSpace = {
  /** Database space id: what the grant stores. */
  id: number;
  title: string;
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
        // Sub-spaces are spaces of their own (a grant never reaches down a tree), so they have
        // to be listed too; the list's default is top-level spaces only.
        parentOnly: false,
        authoritative: true,
        omitFlagArchived: true,
        titleOrder: 'asc',
      },
      resolved.caller,
      { db },
    );
    if (!result.ok) return null;
    return result.data.items.map((space) => ({
      id: space.id,
      title: space.title,
      logoUrl: space.logoUrl ?? null,
    }));
  } catch {
    return null;
  }
}
