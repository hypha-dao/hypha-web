import { NextRequest, NextResponse } from 'next/server';

import {
  authenticateSpaceApiKey,
  findSpaceBySlug,
  SPACE_API_KEY_HEADER,
  type AuthenticatedSpaceApiKey,
  type Space,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { checkSpaceAccess } from '@web/utils/check-space-access';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';

export type IntelligenceHttpAuth =
  | { kind: 'iba'; space: Space; apiKey: AuthenticatedSpaceApiKey }
  | { kind: 'member'; space: Space; authToken?: string };

export function isSpaceApiKeyRequest(request: NextRequest): boolean {
  return Boolean(presentedSpaceApiKey(request));
}

function presentedSpaceApiKey(request: NextRequest): string | undefined {
  const explicit = request.headers.get(SPACE_API_KEY_HEADER)?.trim();
  if (explicit) return explicit;
  const bearer = request.headers
    .get('authorization')
    ?.replace(/^Bearer\s+/i, '')
    .trim();
  if (bearer?.startsWith('hyk_')) return bearer;
  return undefined;
}

function memberBearer(request: NextRequest): string | undefined {
  const authHeader = request.headers.get('authorization');
  const bearer = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!bearer || bearer.startsWith('hyk_')) return undefined;
  return bearer;
}

export async function authorizeIntelligenceRequest(
  request: NextRequest,
  spaceSlug: string,
  access: 'read' | 'write',
): Promise<{ auth: IntelligenceHttpAuth } | { response: NextResponse }> {
  const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
  if (!space) {
    return {
      response: NextResponse.json(
        { error: 'Space not found' },
        { status: 404 },
      ),
    };
  }

  if (presentedSpaceApiKey(request)) {
    const requiredScope =
      access === 'write' ? 'intelligence:write' : 'intelligence:read';
    const result = await authenticateSpaceApiKey(
      { request, spaceId: space.id, requiredScope },
      { db },
    );
    if (!result.ok) {
      return {
        response: NextResponse.json(
          { error: result.error },
          { status: result.status },
        ),
      };
    }
    return { auth: { kind: 'iba', space, apiKey: result.apiKey } };
  }

  if (space.web3SpaceId && canConvertToBigInt(space.web3SpaceId)) {
    const { hasAccess, response } = await checkSpaceAccess(
      request,
      space.web3SpaceId as number,
    );
    if (!hasAccess && response) {
      return { response };
    }
  }

  return {
    auth: { kind: 'member', space, authToken: memberBearer(request) },
  };
}

export function intelligenceWriteFlags(auth: IntelligenceHttpAuth): {
  skipMembershipCheck: boolean;
  authToken?: string;
  canonicalSourceApp?: string;
} {
  if (auth.kind === 'iba') {
    return {
      skipMembershipCheck: true,
      canonicalSourceApp: auth.apiKey.source,
    };
  }
  return {
    skipMembershipCheck: false,
    authToken: auth.authToken,
  };
}
