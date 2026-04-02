import {
  createMatrixUserLinkAction,
  decryptMatrixToken,
  determineEnvironment,
  Environment,
  getDecoratedPrivyId,
  getLinkByPrivyUserId,
  getAdminUserNameAction,
  MatrixSharedSecret,
  MatrixUserLink,
  updateEncryptedAccessTokenAction,
} from '@hypha-platform/core/server';
import { PrivyClient } from '@privy-io/node';
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET;
const MATRIX_HOMESERVER_URL = process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL;
const ADMIN_BASE_NAME = 'hypha_admin';

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
    const { user_id: userId } =
      await privy.utils().auth().verifyAuthToken(token);
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
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json(
      {
        error: 'Unauthorized',
      },
      {
        status: 401,
      },
    );
  }

  const authToken = authHeader.replace('Bearer ', '');
  const env = validateEnvVars();
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

  const matrixAuthClient = new MatrixSharedSecret();

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
      return record;
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
      privyUserId: decoratedPrivyUserId,
      environment,
    });
    if (existing) {
      const accessToken = decryptMatrixToken(existing.encryptedAccessToken);
      if (await matrixAuthClient.validateToken(accessToken)) {
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
                privyUserId: decoratedPrivyUserId,
                environment,
                encryptedAccessToken,
              },
              { authToken },
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

          throw new Error('Matrix user link exists but cannot be updated');
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
            privyUserId: decoratedPrivyUserId,
          },
          { authToken },
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

      throw new Error('Matrix user link exists but cannot be updated');
    }

    await createMatrixUserLinkAction(
      {
        environment,
        encryptedAccessToken,
        deviceId,
        matrixUserId,
        privyUserId: decoratedPrivyUserId,
      },
      { authToken },
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
