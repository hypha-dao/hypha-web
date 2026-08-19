import 'server-only';

import { PrivyClient } from '@privy-io/node';
import { determineEnvironment } from '../../coherence/lib/determine-environment';
import { MatrixSharedSecret } from '../../coherence/lib/matrix-shared-secret';
import { decryptMatrixToken } from '../../common/server/decrypt-matrix-token';
import { getLinkByPrivyUserId } from '../../matrix/server/web3/get-link-by-privy-user-id';

/**
 * Same Privy verification as `apps/web` `GET /api/matrix/token`, without issuing
 * a new Matrix registration — only reads an existing `matrix_user_links` row.
 * Used when `HYPHA_MATRIX_BOT_AS_TOKEN` is unset so org memory can
 * still list Human-chat media for the signed-in user (Space Memory + Chat tool),
 * and by the Human Chat send path, which also needs the sender's own MXID to
 * puppet-join them into invite-only rooms (#2428).
 */
export async function resolveUserMatrixIdentityForOrgMemory(
  privyJwt: string,
  requestUrlForEnvironment: string,
): Promise<{ accessToken: string; matrixUserId: string } | null> {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim();
  const appSecret = process.env.PRIVY_APP_SECRET?.trim();
  if (!appId || !appSecret) {
    return null;
  }

  let privyUserId: string;
  try {
    const privy = new PrivyClient({ appId, appSecret });
    const { user_id } = await privy.utils().auth().verifyAuthToken(privyJwt);
    privyUserId = user_id;
  } catch {
    return null;
  }

  const environment = determineEnvironment(requestUrlForEnvironment);
  if (!environment) {
    return null;
  }

  try {
    const existing = await getLinkByPrivyUserId({
      privyUserId,
      environment,
    });
    if (!existing?.encryptedAccessToken || !existing.matrixUserId) {
      return null;
    }

    const accessToken = decryptMatrixToken(
      existing.encryptedAccessToken,
    ).trim();
    if (!accessToken) {
      return null;
    }

    const matrixAuthClient = new MatrixSharedSecret();
    if (!(await matrixAuthClient.validateToken(accessToken))) {
      return null;
    }

    return { accessToken, matrixUserId: existing.matrixUserId };
  } catch {
    return null;
  }
}

export async function resolveUserMatrixAccessTokenForOrgMemory(
  privyJwt: string,
  requestUrlForEnvironment: string,
): Promise<string | null> {
  const identity = await resolveUserMatrixIdentityForOrgMemory(
    privyJwt,
    requestUrlForEnvironment,
  );
  return identity?.accessToken ?? null;
}
