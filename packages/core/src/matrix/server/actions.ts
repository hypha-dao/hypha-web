'use server';

/**
 * Server actions for Matrix user link management.
 * These actions must only be called from pre-authenticated API routes
 * that have already verified the auth token (e.g., via PrivyClient).
 * The authToken parameter serves as a guard to ensure callers are
 * authentication-aware, not as a verification mechanism.
 */

import { db } from '@hypha-platform/storage-postgres';
import {
  CreateMatrixUserLinkInput,
  GetAdminUserNameActionInput,
  GetMatrixUserLinkActionInput,
  UpdateEncryptedAccessTokenInput,
} from '../types';
import { createMatrixUserLink, updateMatrixUserLink } from './mutations';
import {
  findAdminUserName,
  findLinkByPrivyUserId,
  findMatrixUserIdsByPersonIds,
  findMatrixUserIdsByPrivyUserIds,
} from './queries';
import { getLinkByMatrixUserId } from './web3/get-link-by-matrix-user-id';
import { Environment } from '../../coherence/types';
import {
  getMatrixBotAsToken,
  getMatrixHomeserverUrl,
  matrixCreateRoom,
  matrixEnsureRoomCallPowerLevels,
  matrixInviteUser,
  matrixJoinRoom,
  matrixJoinRoomAsPuppet,
  matrixSetPowerLevelForUser,
} from './matrix-http-client';

export async function createMatrixUserLinkAction(
  data: CreateMatrixUserLinkInput,
  { authToken }: { authToken?: string },
) {
  if (!authToken) {
    throw new Error('authToken is required to create Matrix user link');
  }
  return await createMatrixUserLink({ ...data }, { db });
}

export async function updateEncryptedAccessTokenAction(
  data: UpdateEncryptedAccessTokenInput,
  { authToken }: { authToken?: string },
) {
  if (!authToken) {
    throw new Error(
      'authToken is required to update Matrix user link encrypted access token',
    );
  }
  return await updateMatrixUserLink(data, { db });
}

export async function getMatrixUserLinkAction(
  data: GetMatrixUserLinkActionInput,
  { authToken }: { authToken?: string },
) {
  if (!authToken) {
    throw new Error('authToken is required to get Matrix user link');
  }
  return await findLinkByPrivyUserId(data, { db });
}

export async function getAdminUserNameAction(
  data: GetAdminUserNameActionInput,
  { authToken }: { authToken?: string },
) {
  if (!authToken) {
    throw new Error('authToken is required to get admin user name');
  }
  return await findAdminUserName(data, { db });
}

/** Batch map Privy subs → Matrix MXIDs for the mention picker (space roster merge). */
export async function getMatrixUserIdsByPrivySubsAction(
  {
    privyUserIds,
    environment,
  }: {
    privyUserIds: string[];
    environment: Environment;
  },
  { authToken }: { authToken?: string } = {},
): Promise<Array<{ privyUserId: string; matrixUserId: string }>> {
  if (!authToken) {
    throw new Error('authToken is required for matrix user id batch lookup');
  }
  return findMatrixUserIdsByPrivyUserIds({ privyUserIds, environment }, { db });
}

/** Batch map space roster person ids → Matrix MXIDs without exposing Privy subs. */
export async function getMatrixUserIdsByPersonIdsAction(
  {
    personIds,
    environment,
  }: {
    personIds: number[];
    environment: Environment;
  },
  { authToken }: { authToken?: string } = {},
): Promise<Array<{ personId: number; matrixUserId: string }>> {
  if (!authToken) {
    throw new Error('authToken is required for matrix user id batch lookup');
  }
  return findMatrixUserIdsByPersonIds({ personIds, environment }, { db });
}

/**
 * Have the org bot (its own permanent AS identity, `HYPHA_MATRIX_BOT_AS_TOKEN`) accept a pending
 * invite / join a room. Soft-fails (never throws) — a bot-join failure must not block room
 * creation or the human's own chat flow; the room still works for the human either way.
 */
export async function ensureBotJoinedRoomAction(
  roomId: string,
): Promise<{ joined: boolean }> {
  const trimmedRoomId = roomId?.trim();
  if (!trimmedRoomId) return { joined: false };

  const homeserver = getMatrixHomeserverUrl();
  const botToken = getMatrixBotAsToken();
  if (!homeserver || !botToken) return { joined: false };

  try {
    await matrixJoinRoom(trimmedRoomId, botToken, homeserver);
    return { joined: true };
  } catch (error) {
    console.warn(
      `[MatrixBot] Failed to join room ${trimmedRoomId}:`,
      error instanceof Error ? error.message : error,
    );
    return { joined: false };
  }
}

/**
 * Create a room owned by the bot (its own AS identity), instead of the human/org-memory token
 * that used to create it. The bot is PL100 by construction as the room's creator — no
 * power-level state-event mutation and no `hypha_admin` impersonation needed to manage the room
 * afterward. Rooms are invite-only (`matrixCreateRoom`'s `private_chat` preset); membership is
 * granted via `ensureMemberJoinedRoomAction`.
 *
 * `grantPl100ToMatrixUserId` additionally elevates one human (the signal's DB `creatorId`, or —
 * as a pragmatic fallback when that's not resolvable at call time — whoever triggered creation)
 * to PL100 alongside the bot, so they can manage the room too (e.g. edit/close a signal).
 * Soft-fails on any Matrix error — a bot-side room-setup problem must not block the human's flow;
 * returns `null` so callers can fall back.
 */
export async function createBotOwnedRoomAction({
  title,
  grantPl100ToMatrixUserId,
}: {
  title: string;
  grantPl100ToMatrixUserId?: string;
}): Promise<{ roomId: string } | null> {
  const homeserver = getMatrixHomeserverUrl();
  const botToken = getMatrixBotAsToken();
  if (!homeserver || !botToken) return null;

  try {
    const roomId = await matrixCreateRoom(title, botToken, homeserver);
    await matrixEnsureRoomCallPowerLevels(roomId, botToken, homeserver);
    const targetUserId = grantPl100ToMatrixUserId?.trim();
    if (targetUserId) {
      await matrixSetPowerLevelForUser(
        roomId,
        targetUserId,
        100,
        botToken,
        homeserver,
      );
    }
    return { roomId };
  } catch (error) {
    console.warn(
      `[MatrixBot] Failed to create bot-owned room "${title}":`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/**
 * Get a real (Privy-backed) member into a room the bot owns, without that member's own client
 * ever calling `join`: the bot (PL100) invites them, then the AS puppets their accept — both
 * steps authenticated purely with the bot's own credentials (#2428 Decision 9). Works the same
 * whether the room is invite-only (new bot-owned rooms) or still open-join (legacy rooms predating
 * this change) — on an open room the invite step harmlessly no-ops/fails and the puppet-join
 * succeeds anyway via public `join_rules`. Soft-fails: never throws.
 */
export async function ensureMemberJoinedRoomAction({
  roomId,
  matrixUserId,
}: {
  roomId: string;
  matrixUserId: string;
}): Promise<{ joined: boolean }> {
  const trimmedRoomId = roomId?.trim();
  const trimmedUserId = matrixUserId?.trim();
  if (!trimmedRoomId || !trimmedUserId) return { joined: false };

  const homeserver = getMatrixHomeserverUrl();
  const botToken = getMatrixBotAsToken();
  if (!homeserver || !botToken) return { joined: false };

  try {
    await matrixInviteUser(trimmedRoomId, trimmedUserId, botToken, homeserver);
  } catch (error) {
    console.warn(
      `[MatrixBot] Invite of ${trimmedUserId} to room ${trimmedRoomId} skipped/failed (likely already a member):`,
      error instanceof Error ? error.message : error,
    );
  }

  try {
    await matrixJoinRoomAsPuppet(
      trimmedRoomId,
      trimmedUserId,
      botToken,
      homeserver,
    );
    return { joined: true };
  } catch (error) {
    console.warn(
      `[MatrixBot] Failed to puppet-join ${trimmedUserId} into room ${trimmedRoomId}:`,
      error instanceof Error ? error.message : error,
    );
    return { joined: false };
  }
}

export async function getLinkByMatrixUserIdAction(
  {
    matrixUserId,
    environment,
  }: {
    matrixUserId: string;
    environment: Environment;
  },
  { authToken }: { authToken?: string } = {},
) {
  if (!authToken) {
    throw new Error('authToken is required to get Matrix user link by ID');
  }
  return getLinkByMatrixUserId({ matrixUserId, environment });
}
