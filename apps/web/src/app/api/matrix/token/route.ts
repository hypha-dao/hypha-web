import {
  createMatrixUserLinkAction,
  decryptMatrixToken,
  determineEnvironment,
  getDecoratedPrivyId,
  getLinkByPrivyUserId,
  MatrixSharedSecret,
} from '@hypha-platform/core/server';
import { PrivyClient } from '@privy-io/server-auth';
import { NextRequest, NextResponse } from 'next/server';

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '';
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET ?? '';
const MATRIX_HOMESERVER_URL =
  process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL ?? '';
const DEFAULT_ROOM_ID = process.env.DEFAULT_ROOM_ID ?? '';

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

  try {
    const authToken = authHeader.replace('Bearer ', '');
    const { userId: privyUserId } = await privy.verifyAuthToken(authToken);
    const environment = determineEnvironment(request.url);

    const existing = await getLinkByPrivyUserId({ privyUserId, environment });
    if (existing) {
      const accessToken = decryptMatrixToken(existing.encryptedAccessToken);
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
    }

    const matrixUsername = getDecoratedPrivyId(privyUserId, environment);
    const {
      accessToken: encryptedAccessToken,
      deviceId,
      userId: matrixUserId,
    } = await matrixAuthClient.registerUser(matrixUsername);

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
