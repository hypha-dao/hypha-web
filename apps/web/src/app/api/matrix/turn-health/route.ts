import { NextRequest, NextResponse } from 'next/server';
import { getEnableHumanChat } from '@hypha-platform/feature-flags';
import {
  determineEnvironment,
  summarizeMatrixTurnHealth,
} from '@hypha-platform/core/server';
import {
  matrixRequest,
  resolveMatrixAccessToken,
  verifyPrivyToken,
} from '../room-call-permissions/_lib';

type TurnServerResponse = {
  uris?: string[];
  username?: string;
  password?: string;
  ttl?: number;
};

export async function GET(request: NextRequest) {
  const humanChatEnabled = await getEnableHumanChat();
  const authHeader = request.headers.get('Authorization');
  if (!humanChatEnabled || !authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const authToken = authHeader.slice('Bearer '.length).trim();
  const privyUserId = await verifyPrivyToken(authToken);
  if (!privyUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const homeserver = process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL?.replace(
    /\/?$/,
    '',
  );
  if (!homeserver) {
    return NextResponse.json(
      { error: 'Matrix homeserver not configured' },
      { status: 500 },
    );
  }

  const environment = determineEnvironment(request.url);
  const callerAccess = await resolveMatrixAccessToken(environment, privyUserId);
  if (!callerAccess) {
    return NextResponse.json(
      { error: 'Matrix session unavailable for caller' },
      { status: 403 },
    );
  }

  const turnResult = await matrixRequest<TurnServerResponse>(
    'GET',
    `${homeserver}/_matrix/client/v3/voip/turnServer`,
    callerAccess.accessToken,
  );

  if (!turnResult.ok) {
    const status =
      turnResult.status === 401 || turnResult.status === 403 ? 403 : 503;
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to read Matrix TURN credentials',
        httpStatus: turnResult.status,
        details: turnResult.body,
      },
      { status },
    );
  }

  const summary = summarizeMatrixTurnHealth(turnResult.data);

  return NextResponse.json({
    ok: summary.turnCredsOk,
    homeserverConfigured: true,
    matrixUserId: callerAccess.userId,
    ...summary,
  });
}
