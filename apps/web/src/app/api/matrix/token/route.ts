import {
  createMatrixUserLinkAction,
  decryptMatrixToken,
  determineEnvironment,
  Environment,
  getDecoratedPrivyId,
  getLinkByPrivyUserId,
  getAdminUserNameAction,
  MatrixSharedSecret,
  updateEncryptedAccessTokenAction,
} from '@hypha-platform/core/server';
import { PrivyClient } from '@privy-io/node';
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getEnableHumanChat } from '@hypha-platform/feature-flags';

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET;
const MATRIX_HOMESERVER_URL = process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL;
const ADMIN_BASE_NAME = 'hypha_admin';
const LEGACY_SHARED_SECRET_DEVICE_ID = 'shared_secret_registration';

function validateEnvVars() {
  if (!PRIVY_APP_ID || !PRIVY_APP_SECRET || !MATRIX_HOMESERVER_URL) {
    throw new Error(
      'Missing required environment variables: NEXT_PUBLIC_PRIVY_APP_ID, PRIVY_APP_SECRET, NEXT_PUBLIC_MATRIX_HOMESERVER_URL',
    );
  }
  return { PRIVY_APP_ID, PRIVY_APP_SECRET, MATRIX_HOMESERVER_URL };
}

async function verifyPrivyToken(
  token: string,
  appId: string,
  appSecret: string,
): Promise<string | null> {
  try {
    const privy = new PrivyClient({ appId, appSecret });
    const { user_id: userId } = await privy
      .utils()
      .auth()
      .verifyAuthToken(token);
    return userId;
  } catch (error) {
    console.warn(
      'Auth error:',
      error instanceof Error ? error.message : 'Unknown auth error',
    );
    return null;
  }
}

export async function GET(request: NextRequest) {
  const correlationId =
    request.headers.get('x-correlation-id') ?? randomUUID();
  const requestStart = Date.now();
  console.log(
    `[DEBUG /api/matrix/token] [${correlationId}] GET started — url=${request.url}`,
  );

  const humanChatEnabled = await getEnableHumanChat();
  const authHeader = request.headers.get('Authorization');
  console.log(
    `[DEBUG /api/matrix/token] [${correlationId}] humanChatEnabled=${humanChatEnabled} hasAuthHeader=${!!authHeader}`,
  );

  if (!humanChatEnabled || !authHeader?.startsWith('Bearer ')) {
    console.log(
      `[DEBUG /api/matrix/token] [${correlationId}] Early 401 — humanChatEnabled=${humanChatEnabled} headerPresent=${!!authHeader}`,
    );
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const authToken = authHeader.replace('Bearer ', '');

  let env: ReturnType<typeof validateEnvVars>;
  try {
    env = validateEnvVars();
  } catch (error) {
    console.warn(
      `[DEBUG /api/matrix/token] [${correlationId}] 500 — Config validation failed:`,
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: 'Server configuration error', correlationId },
      { status: 500 },
    );
  }

  const privyUserId = await verifyPrivyToken(
    authToken,
    env.PRIVY_APP_ID,
    env.PRIVY_APP_SECRET,
  );
  console.log(
    `[DEBUG /api/matrix/token] [${correlationId}] Privy token verified — privyUserIdPresent=${!!privyUserId}`,
  );

  if (!privyUserId) {
    console.log(
      `[DEBUG /api/matrix/token] [${correlationId}] 401 — Privy token invalid or expired`,
    );
    return NextResponse.json(
      {
        error: 'Unauthorized',
      },
      {
        status: 401,
      },
    );
  }

  let matrixAuthClient: MatrixSharedSecret;
  try {
    matrixAuthClient = new MatrixSharedSecret();
    console.log(
      `[DEBUG /api/matrix/token] [${correlationId}] MatrixSharedSecret client created`,
    );
  } catch (error) {
    console.warn(
      `[DEBUG /api/matrix/token] [${correlationId}] 500 — MatrixSharedSecret init failed:`,
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: 'Server configuration error', correlationId },
      { status: 500 },
    );
  }

  const getAdminMatrixUserName = async (
    environment: Environment,
  ): Promise<string> => {
    const adminUsername =
      (await getAdminUserNameAction(
        { baseName: ADMIN_BASE_NAME, environment },
        { authToken },
      )) ?? `${ADMIN_BASE_NAME}_${randomUUID()}`;
    return adminUsername;
  };

  const getAdminRecord = async (
    adminUsername: string,
    environment: Environment,
    authToken: string,
  ) => {
    const record = await getLinkByPrivyUserId({
      privyUserId: adminUsername,
      environment,
    });
    if (record) {
      const adminAccessToken = decryptMatrixToken(record.encryptedAccessToken);
      if (await matrixAuthClient.validateToken(adminAccessToken)) {
        return record;
      }
      // Admin token expired — register a new admin to recover
      console.warn('Admin Matrix token expired, creating new admin to recover');
      const newAdminUsername = `${ADMIN_BASE_NAME}_${randomUUID()}`;
      const {
        accessToken: newEncryptedAccessToken,
        deviceId: newDeviceId,
        userId: newMatrixUserId,
      } = await matrixAuthClient.registerUser(newAdminUsername, true);
      if (!newEncryptedAccessToken) {
        throw new Error(
          'Admin token expired and new admin registration failed',
        );
      }
      // Update the existing admin record with the new admin's credentials
      await updateEncryptedAccessTokenAction(
        {
          privyUserId: adminUsername,
          environment,
          encryptedAccessToken: newEncryptedAccessToken,
          deviceId: newDeviceId,
        },
        { authToken },
      );
      return {
        ...record,
        encryptedAccessToken: newEncryptedAccessToken,
        deviceId: newDeviceId,
        matrixUserId: newMatrixUserId,
      };
    }
    const {
      accessToken: encryptedAccessToken,
      deviceId,
      userId: matrixUserId,
    } = await matrixAuthClient.registerUser(adminUsername, true);
    const newRecord = await createMatrixUserLinkAction(
      {
        environment,
        encryptedAccessToken,
        deviceId,
        matrixUserId,
        privyUserId: adminUsername,
      },
      { authToken },
    );
    if (!newRecord) {
      throw new Error('Failed to create admin Matrix user link');
    }
    return newRecord;
  };

  try {
    const environment = determineEnvironment(request.url);
    console.log(
      `[DEBUG /api/matrix/token] [${correlationId}] environment=${environment}`,
    );
    if (!environment) {
      console.log(
        `[DEBUG /api/matrix/token] [${correlationId}] 400 — could not determine environment from url=${request.url}`,
      );
      return NextResponse.json(
        { error: 'Unable to determine environment from request URL' },
        { status: 400 },
      );
    }

    const decoratedPrivyUserId = getDecoratedPrivyId(privyUserId, environment);
    console.log(
      `[DEBUG /api/matrix/token] [${correlationId}] decoratedPrivyUserId prefix=${decoratedPrivyUserId.slice(0, 8)}...`,
    );

    const existing = await getLinkByPrivyUserId({
      privyUserId,
      environment,
    });
    console.log(
      `[DEBUG /api/matrix/token] [${correlationId}] existingLink=${!!existing} deviceId=${existing?.deviceId ?? 'none'} matrixUserId=${existing?.matrixUserId ?? 'none'}`,
    );

    if (existing) {
      const accessToken = decryptMatrixToken(existing.encryptedAccessToken);
      const hasValidToken = await matrixAuthClient.validateToken(accessToken);
      console.log(
        `[DEBUG /api/matrix/token] [${correlationId}] existing link — hasValidToken=${hasValidToken} isLegacyDeviceId=${existing.deviceId === LEGACY_SHARED_SECRET_DEVICE_ID}`,
      );

      if (
        hasValidToken &&
        existing.deviceId !== LEGACY_SHARED_SECRET_DEVICE_ID
      ) {
        console.log(
          `[DEBUG /api/matrix/token] [${correlationId}] 200 — returning cached valid token (${Date.now() - requestStart}ms)`,
        );
        return NextResponse.json({
          accessToken,
          userId: existing.matrixUserId,
          homeserverUrl: MATRIX_HOMESERVER_URL,
          deviceId: existing.deviceId,
          elementConfig: {
            theme: 'dark',
          },
        });
      } else {
        // Token expired or legacy device id — need to rotate via admin
        const rotateReason = hasValidToken
          ? 'legacy-device-id'
          : 'token-expired';
        console.log(
          `[DEBUG /api/matrix/token] [${correlationId}] Token rotation needed — reason=${rotateReason}`,
        );
        const adminMatrixUsername = await getAdminMatrixUserName(environment);
        console.log(
          `[DEBUG /api/matrix/token] [${correlationId}] Admin username resolved: ${adminMatrixUsername.slice(0, 12)}...`,
        );
        const admin = await getAdminRecord(
          adminMatrixUsername,
          environment,
          authToken,
        );
        console.log(
          `[DEBUG /api/matrix/token] [${correlationId}] Admin record fetched — adminPresent=${!!admin} adminHasToken=${!!admin?.encryptedAccessToken}`,
        );

        if (admin?.encryptedAccessToken) {
          const adminAccessToken = decryptMatrixToken(
            admin.encryptedAccessToken,
          );
          console.log(
            `[DEBUG /api/matrix/token] [${correlationId}] Calling resetPassword for matrixUserId=${existing.matrixUserId}`,
          );
          const { ok, password } = await matrixAuthClient.resetPassword(
            existing.matrixUserId,
            adminAccessToken,
          );
          console.log(
            `[DEBUG /api/matrix/token] [${correlationId}] resetPassword result — ok=${ok}`,
          );
          if (ok) {
            const {
              accessToken: encryptedAccessToken,
              deviceId,
              userId: matrixUserId,
            } = await matrixAuthClient.loginUser(
              existing.matrixUserId,
              password,
            );

            await updateEncryptedAccessTokenAction(
              {
                privyUserId,
                environment,
                encryptedAccessToken,
                deviceId,
              },
              { authToken },
            );

            console.log(
              `[DEBUG /api/matrix/token] [${correlationId}] 200 — rotated token via admin resetPassword (${Date.now() - requestStart}ms)`,
            );
            return NextResponse.json({
              accessToken: decryptMatrixToken(encryptedAccessToken),
              userId: matrixUserId,
              homeserverUrl: MATRIX_HOMESERVER_URL,
              deviceId,
              elementConfig: {
                theme: 'dark',
              },
            });
          }

          const throwMsg = hasValidToken
            ? 'Matrix user link has legacy device id but cannot be rotated'
            : 'Matrix user link exists but cannot be updated';
          console.log(
            `[DEBUG /api/matrix/token] [${correlationId}] THROW — ${throwMsg} (resetPassword ok=false)`,
          );
          throw new Error(throwMsg);
        }
      }
    }

    const matrixUsername = decoratedPrivyUserId;
    console.log(
      `[DEBUG /api/matrix/token] [${correlationId}] No existing link — attempting registerUser for matrixUsername=${matrixUsername.slice(0, 8)}...`,
    );
    const {
      accessToken: encryptedAccessToken,
      deviceId,
      userId: matrixUserId,
    } = await matrixAuthClient.registerUser(matrixUsername);
    console.log(
      `[DEBUG /api/matrix/token] [${correlationId}] registerUser result — gotToken=${!!encryptedAccessToken} matrixUserId=${matrixUserId}`,
    );

    if (!encryptedAccessToken) {
      // User already exists in Matrix (Synapse returns no token for existing users)
      console.log(
        `[DEBUG /api/matrix/token] [${correlationId}] registerUser returned no token — user likely already exists in Synapse; trying admin recovery flow`,
      );
      const adminMatrixUsername = await getAdminMatrixUserName(environment);
      const admin = await getAdminRecord(
        adminMatrixUsername,
        environment,
        authToken,
      );
      if (!admin?.encryptedAccessToken) {
        console.log(
          `[DEBUG /api/matrix/token] [${correlationId}] THROW — Admin record missing or has no encrypted access token`,
        );
        throw new Error(
          'Admin record missing or has no encrypted access token',
        );
      }
      const adminAccessToken = decryptMatrixToken(admin.encryptedAccessToken);
      console.log(
        `[DEBUG /api/matrix/token] [${correlationId}] Fetching user info for matrixUsername=${matrixUsername.slice(0, 8)}...`,
      );
      const userInfo = await matrixAuthClient.getUser(
        matrixUsername,
        adminAccessToken,
      );
      console.log(
        `[DEBUG /api/matrix/token] [${correlationId}] getUser returned userId=${userInfo.userId} — calling resetPassword`,
      );

      const { ok, password } = await matrixAuthClient.resetPassword(
        userInfo.userId,
        adminAccessToken,
      );
      console.log(
        `[DEBUG /api/matrix/token] [${correlationId}] resetPassword (admin recovery) ok=${ok}`,
      );
      if (ok) {
        const {
          accessToken: encryptedAccessToken,
          deviceId,
          userId,
        } = await matrixAuthClient.loginUser(userInfo.userId, password);

        await createMatrixUserLinkAction(
          {
            environment,
            encryptedAccessToken,
            deviceId,
            matrixUserId: userId,
            privyUserId,
          },
          { authToken },
        );

        console.log(
          `[DEBUG /api/matrix/token] [${correlationId}] 200 — admin recovery flow succeeded (${Date.now() - requestStart}ms)`,
        );
        return NextResponse.json({
          accessToken: decryptMatrixToken(encryptedAccessToken),
          userId,
          homeserverUrl: MATRIX_HOMESERVER_URL,
          deviceId,
          elementConfig: {
            theme: 'dark',
          },
        });
      }

      console.log(
        `[DEBUG /api/matrix/token] [${correlationId}] THROW — admin recovery resetPassword ok=false; user link exists but cannot be updated`,
      );
      throw new Error('Matrix user link exists but cannot be updated');
    }

    await createMatrixUserLinkAction(
      {
        environment,
        encryptedAccessToken,
        deviceId,
        matrixUserId,
        privyUserId,
      },
      { authToken },
    );

    console.log(
      `[DEBUG /api/matrix/token] [${correlationId}] 200 — new user registered and link created (${Date.now() - requestStart}ms)`,
    );
    return NextResponse.json({
      accessToken: decryptMatrixToken(encryptedAccessToken),
      userId: matrixUserId,
      homeserverUrl: MATRIX_HOMESERVER_URL,
      deviceId,
      elementConfig: {
        theme: 'dark',
      },
    });
  } catch (error) {
    console.warn(
      `[DEBUG /api/matrix/token] [${correlationId}] 500 — Token generation failed after ${Date.now() - requestStart}ms:`,
      error instanceof Error ? error.stack ?? error.message : error,
    );
    return NextResponse.json(
      {
        error: 'Token generation failed',
        correlationId,
      },
      {
        status: 500,
      },
    );
  }
}
