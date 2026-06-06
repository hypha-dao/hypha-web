import {
  createMatrixUserLinkAction,
  decryptMatrixToken,
  determineEnvironment,
  Environment,
  getDecoratedPrivyId,
  getLinkByPrivyUserId,
  getAdminUserNameAction,
  MATRIX_ACCESS_TOKEN_TTL_SEC,
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

function buildMatrixTokenResponse(fields: {
  accessToken: string;
  userId: string;
  deviceId?: string | null;
  expiresInSec?: number;
}) {
  return NextResponse.json({
    accessToken: fields.accessToken,
    userId: fields.userId,
    homeserverUrl: MATRIX_HOMESERVER_URL,
    deviceId: fields.deviceId ?? undefined,
    ...(typeof fields.expiresInSec === 'number'
      ? { expiresInSec: fields.expiresInSec }
      : {}),
    elementConfig: {
      theme: 'dark',
    },
  });
}

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
  const humanChatEnabled = await getEnableHumanChat();
  const authHeader = request.headers.get('Authorization');
  if (!humanChatEnabled || !authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const authToken = authHeader.replace('Bearer ', '');

  let env: ReturnType<typeof validateEnvVars>;
  try {
    env = validateEnvVars();
  } catch (error) {
    const correlationId =
      request.headers.get('x-correlation-id') ?? randomUUID();
    console.warn(
      `Config validation failed [correlationId: ${correlationId}]:`,
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

  if (!privyUserId) {
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
  } catch (error) {
    const correlationId =
      request.headers.get('x-correlation-id') ?? randomUUID();
    console.warn(
      `Matrix client init failed [correlationId: ${correlationId}]:`,
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
    if (!environment) {
      return NextResponse.json(
        { error: 'Unable to determine environment from request URL' },
        { status: 400 },
      );
    }

    const decoratedPrivyUserId = getDecoratedPrivyId(privyUserId, environment);

    const existing = await getLinkByPrivyUserId({
      privyUserId,
      environment,
    });
    if (existing) {
      const accessToken = decryptMatrixToken(existing.encryptedAccessToken);
      const hasValidToken = await matrixAuthClient.validateToken(accessToken);
      if (
        hasValidToken &&
        existing.deviceId !== LEGACY_SHARED_SECRET_DEVICE_ID
      ) {
        return buildMatrixTokenResponse({
          accessToken,
          userId: existing.matrixUserId,
          deviceId: existing.deviceId,
        });
      } else {
        const adminMatrixUsername = await getAdminMatrixUserName(environment);
        const admin = await getAdminRecord(
          adminMatrixUsername,
          environment,
          authToken,
        );
        if (admin?.encryptedAccessToken) {
          const adminAccessToken = decryptMatrixToken(
            admin.encryptedAccessToken,
          );
          const { ok, password } = await matrixAuthClient.resetPassword(
            existing.matrixUserId,
            adminAccessToken,
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

            return buildMatrixTokenResponse({
              accessToken: decryptMatrixToken(encryptedAccessToken),
              userId: matrixUserId,
              deviceId,
              expiresInSec: MATRIX_ACCESS_TOKEN_TTL_SEC,
            });
          }

          throw new Error(
            hasValidToken
              ? 'Matrix user link has legacy device id but cannot be rotated'
              : 'Matrix user link exists but cannot be updated',
          );
        }
      }
    }

    const matrixUsername = decoratedPrivyUserId;
    const {
      accessToken: encryptedAccessToken,
      deviceId,
      userId: matrixUserId,
    } = await matrixAuthClient.registerUser(matrixUsername);

    if (!encryptedAccessToken) {
      const adminMatrixUsername = await getAdminMatrixUserName(environment);
      const admin = await getAdminRecord(
        adminMatrixUsername,
        environment,
        authToken,
      );
      if (!admin?.encryptedAccessToken) {
        throw new Error(
          'Admin record missing or has no encrypted access token',
        );
      }
      const adminAccessToken = decryptMatrixToken(admin.encryptedAccessToken);
      const userInfo = await matrixAuthClient.getUser(
        matrixUsername,
        adminAccessToken,
      );

      const { ok, password } = await matrixAuthClient.resetPassword(
        userInfo.userId,
        adminAccessToken,
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

        return buildMatrixTokenResponse({
          accessToken: decryptMatrixToken(encryptedAccessToken),
          userId,
          deviceId,
          expiresInSec: MATRIX_ACCESS_TOKEN_TTL_SEC,
        });
      }

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

    return buildMatrixTokenResponse({
      accessToken: decryptMatrixToken(encryptedAccessToken),
      userId: matrixUserId,
      deviceId,
      expiresInSec: MATRIX_ACCESS_TOKEN_TTL_SEC,
    });
  } catch (error) {
    const correlationId =
      request.headers.get('x-correlation-id') ?? randomUUID();
    console.warn(
      `Token generation failed [correlationId: ${correlationId}]:`,
      error instanceof Error ? error.message : error,
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
