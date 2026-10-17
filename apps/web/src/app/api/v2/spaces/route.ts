import { NextRequest } from 'next/server';
import { buildSpacesListV2 } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

import {
  authenticateV2,
  failureResponse,
  jsonV2,
  v2Route,
} from '../../../../lib/api-v2/authenticate-v2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * twin:         GET /api/v1/spaces
 * kind:         enriched
 * adds:         VIEWER-AWARE LIST: returns only the spaces the viewer may see
 *               (guests: discoverability 0; signed-in: the four-level rule,
 *               incl. members/delegates, DB-organisation siblings and members
 *               of member-spaces at level 2); `?include=visibility,governance`
 *               (per-item blocks; `null` = unknown); `omitArchived`,
 *               `omitSandbox` on every source; optional `page`/`pageSize`
 *               (cap 100, applied AFTER the filter); `asOf`, `asOfBlock`.
 *               Unknown include -> 400.
 * diverges:     FILTERED BY DEFAULT and varies by caller (v1 returns every
 *               space); no unfiltered mode; `Cache-Control: private, no-store`
 *               and `Vary: Authorization, x-hypha-client-key`; an invalid
 *               token is 401; a space whose level cannot be read, or that has
 *               no on-chain id, is not listed (fail closed; the Hypha UI shows
 *               it); member-of-a-member-space is org-level (the UI treats it
 *               as space-level); omits `memberAddresses` from every item (no
 *               wallet-address arrays in v2); body is an envelope
 *               `{ data, pagination, asOf, asOfBlock }` (v1: bare array; items
 *               are v1 items minus the omission); `pagination` is null when no
 *               `page`/`pageSize` is sent (full visible list); requires the
 *               client key; blocks read at `latest`. `include=` blocks stay
 *               caller-independent: only WHICH items appear depends on the
 *               viewer.
 * ui-delegated: layout, sorting and copy; treating `memberCount` 0 as
 *               unknown. NOT delegated: "may this viewer see this space".
 */
async function handleGet(request: NextRequest) {
  const auth = await authenticateV2(request);
  if (!auth.ok) return auth.response;

  try {
    const params = request.nextUrl.searchParams;

    const web3SpaceIds = params.has('web3SpaceIds')
      ? (params.get('web3SpaceIds')?.split(',') ?? [])
          .map(Number)
          .filter((id) => !Number.isNaN(id))
      : undefined;
    const slugs = params.has('slugs')
      ? (params.get('slugs')?.split(',') ?? [])
          .map((slug) => slug.trim())
          .filter(Boolean)
      : undefined;
    const parentOnlyParam = params.get('parentOnly');
    const intParam = (name: string) => {
      const raw = params.get(name);
      if (raw === null) return undefined;
      const n = Number.parseInt(raw, 10);
      return Number.isNaN(n) ? undefined : n;
    };

    const result = await buildSpacesListV2(
      {
        web3SpaceIds,
        slugs,
        parentOnly:
          parentOnlyParam !== null ? parentOnlyParam === 'true' : undefined,
        omitArchived: params.get('omitArchived') === 'true',
        omitSandbox: params.get('omitSandbox') === 'true',
        page: intParam('page'),
        pageSize: intParam('pageSize'),
        include: params.get('include'),
      },
      auth.caller,
      { db },
    );
    if (!result.ok) return failureResponse(result);

    return jsonV2(result.body);
  } catch (error) {
    console.error('Failed to fetch spaces (v2):', error);
    return jsonV2({ error: 'Failed to fetch spaces' }, { status: 500 });
  }
}

export const GET = v2Route(handleGet);
