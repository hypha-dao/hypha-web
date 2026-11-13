import { NextRequest } from 'next/server';
import {
  buildMyProfileV2,
  parseInclude,
  PEOPLE_ME_INCLUDE_BLOCKS,
} from '@hypha-platform/core/server';

import {
  authenticateV2,
  failureResponse,
  jsonV2,
  v2Route,
} from '../../../../../lib/api-v2/authenticate-v2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * twin:         GET /api/v1/people/me (not mirrored: v1 is untouched and returns the full row)
 * kind:         new
 * adds:         {name, surname, slug, avatarUrl}: the caller's own minimal profile. `address`
 *               (wallet) only with `include=address`. Never email, `sub` or the internal id.
 * diverges:     requires the client key AND a verified user token (Privy or an
 *               authorization-server token with `spaces:read`); 401 without or invalid, 403
 *               `profile_required` without a Hypha profile. An unknown `include` is a 400.
 * ui-delegated: display of the name and avatar; the sign-in / sign-up screens.
 */
async function handleGet(request: NextRequest) {
  const auth = await authenticateV2(request);
  if (!auth.ok) return auth.response;

  const include = parseInclude(
    request.nextUrl.searchParams.get('include'),
    PEOPLE_ME_INCLUDE_BLOCKS,
  );
  if (!include.ok) {
    return jsonV2(
      {
        error: 'Unknown include block',
        message: `Unknown include: ${include.unknown.join(
          ', ',
        )}. Allowed: ${include.allowed.join(', ')}.`,
      },
      { status: 400 },
    );
  }

  const result = buildMyProfileV2({
    caller: auth.caller,
    includeAddress: include.blocks.has('address'),
  });
  if (!result.ok) return failureResponse(result);
  return jsonV2(result.body);
}

export const GET = v2Route(handleGet);
