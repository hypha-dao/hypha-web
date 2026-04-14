import 'server-only';

import { PrivyClient } from '@privy-io/node';
import { determineEnvironment } from '../../coherence/lib/determine-environment';
import { getDecoratedPrivyId } from '../../coherence/lib/get-decorated-privy-id';
import { MatrixSharedSecret } from '../../coherence/lib/matrix-shared-secret';
import { decryptMatrixToken } from '../../common/server/decrypt-matrix-token';
import { getLinkByPrivyUserId } from '../../matrix/server/web3/get-link-by-privy-user-id';

/**
 * Same Privy verification as `apps/web` `GET /api/matrix/token`, without issuing
 * a new Matrix registration — only reads an existing `matrix_user_links` row.
 * Used when `HYPHA_MATRIX_ORG_MEMORY_ACCESS_TOKEN` is unset so org memory can
 * still list Human-chat media for the signed-in user (Space Memory + Chat tool).
 */
export async function resolveUserMatrixAccessTokenForOrgMemory(
  privyJwt: string,
  requestUrlForEnvironment: string,
): Promise<string | null> {
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

  const decoratedPrivyUserId = getDecoratedPrivyId(privyUserId, environment);
  const existing = await getLinkByPrivyUserId({
    privyUserId: decoratedPrivyUserId,
    environment,
  });
  if (!existing?.encryptedAccessToken) {
    return null;
  }

  const accessToken = decryptMatrixToken(existing.encryptedAccessToken);
  if (!accessToken?.trim()) {
    return null;
  }

  try {
    const matrixAuthClient = new MatrixSharedSecret();
    if (!(await matrixAuthClient.validateToken(accessToken))) {
      return null;
    }
  } catch {
    return null;
  }

  return accessToken.trim();
}
