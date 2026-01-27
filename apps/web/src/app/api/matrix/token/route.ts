import {
  createMatrixUserLinkAction,
  decryptMatrixToken,
  determineEnvironment,
  Environment,
  getDecoratedPrivyId,
  getLinkByPrivyUserId,
  MatrixSharedSecret,
  MatrixUserLink,
  updateEncryptedAccessTokenAction,
  updateMatrixUserLink,
} from '@hypha-platform/core/server';
import { PrivyClient } from '@privy-io/server-auth';
import { NextRequest, NextResponse } from 'next/server';

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '';
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET ?? '';
const MATRIX_HOMESERVER_URL =
  process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL ?? '';
const DEFAULT_ROOM_ID = process.env.DEFAULT_ROOM_ID ?? '';
const ADMIN_SUFFIX = 'hypha_admin';

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

  const privy = new PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET);
  const matrixAuthClient = new MatrixSharedSecret();

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
    return (await createMatrixUserLinkAction(
      {
        environment,
        encryptedAccessToken,
        deviceId,
        matrixUserId,
        privyUserId: adminUsername,
      },
      { authToken },
    )) as MatrixUserLink;
  };

  try {
    const authToken = authHeader.replace('Bearer ', '');
    const { userId: privyUserId } = await privy.verifyAuthToken(authToken);
    const environment = determineEnvironment(request.url);

    const existing = await getLinkByPrivyUserId({ privyUserId, environment });
    if (existing) {
      const accessToken = decryptMatrixToken(existing.encryptedAccessToken);
      if (await matrixAuthClient.validateToken(accessToken)) {
        return NextResponse.json({
          accessToken,
          userId: existing.matrixUserId,
          homeserverUrl: MATRIX_HOMESERVER_URL,
          deviceId: existing.deviceId,
          elementConfig: {
            // defaultRoomId: DEFAULT_ROOM_ID,
            theme: 'dark',
          },
        });
      } else {
        const adminMatrixUsername = getDecoratedPrivyId(
          ADMIN_SUFFIX,
          environment,
        );
        const admin = await getAdminRecord(
          adminMatrixUsername,
          environment,
          authToken,
        );
        if (admin) {
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
              },
              { authToken },
            );

            return NextResponse.json({
              accessToken: decryptMatrixToken(encryptedAccessToken),
              userId: matrixUserId,
              homeserverUrl: MATRIX_HOMESERVER_URL,
              deviceId,
              elementConfig: {
                // defaultRoomId: DEFAULT_ROOM_ID,
                theme: 'dark',
              },
            });
          }

          return NextResponse.json(
            {
              error: 'Token generation failed',
            },
            {
              status: 500,
            },
          );
        }
      }
    }

    const matrixUsername = getDecoratedPrivyId(privyUserId, environment);
    const {
      accessToken: encryptedAccessToken,
      deviceId,
      userId: matrixUserId,
    } = await matrixAuthClient.registerUser(matrixUsername);

    if (!encryptedAccessToken) {
      const adminMatrixUsername = getDecoratedPrivyId(
        ADMIN_SUFFIX,
        environment,
      );
      const admin = await getAdminRecord(
        adminMatrixUsername,
        environment,
        authToken,
      );
      const adminAccessToken = decryptMatrixToken(admin.encryptedAccessToken);
      const { ok, password } = await matrixAuthClient.resetPassword(
        matrixUserId,
        adminAccessToken,
      );
      if (ok) {
        const {
          accessToken: encryptedAccessToken,
          deviceId,
          userId,
        } = await matrixAuthClient.loginUser(matrixUserId, password);

        await updateEncryptedAccessTokenAction(
          {
            privyUserId,
            environment,
            encryptedAccessToken,
          },
          { authToken },
        );

        return NextResponse.json({
          accessToken: decryptMatrixToken(encryptedAccessToken),
          userId,
          homeserverUrl: MATRIX_HOMESERVER_URL,
          deviceId,
          elementConfig: {
            // defaultRoomId: DEFAULT_ROOM_ID,
            theme: 'dark',
          },
        });
      }
      return NextResponse.json(
        {
          error: 'Token generation failed',
        },
        {
          status: 500,
        },
      );
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

    return NextResponse.json({
      accessToken: decryptMatrixToken(encryptedAccessToken),
      userId: matrixUserId,
      homeserverUrl: MATRIX_HOMESERVER_URL,
      deviceId,
      elementConfig: {
        // defaultRoomId: DEFAULT_ROOM_ID,
        theme: 'dark',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Token generation failed',
      },
      {
        status: 500,
      },
    );
  }
}
