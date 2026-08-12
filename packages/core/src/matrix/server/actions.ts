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
  getMatrixAdditionalBotAsTokens,
  getMatrixBotAsToken,
  getMatrixHomeserverUrl,
  matrixApplyRoomPowerLevels,
  matrixCreateRoom,
  matrixInviteUser,
  matrixJoinRoom,
  matrixJoinRoomAsPuppet,
  matrixWhoAmI,
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
      '[MatrixBot] Failed to join room:',
      trimmedRoomId,
      error instanceof Error ? error.message : error,
    );
    return { joined: false };
  }
}

/**
 * Joins each configured additional bot (`HYPHA_MATRIX_ADDITIONAL_BOT_AS_TOKENS`, #2428) into
 * `roomId` under its own identity, and returns their MXIDs so the caller can grant them PL100
 * alongside the primary bot. Temporary bridge while Prod/Preview share one Postgres DB (#2252) —
 * see `getMatrixAdditionalBotAsTokens`. Rooms are invite-only, so a plain self-join has nothing
 * to bypass join_rules with (that's only for puppet-joins via `?user_id=`) — `primaryBotToken`
 * (PL100 as room creator) must invite each additional bot before it can accept, same as
 * `ensureMemberJoinedRoomAction` does for humans. Soft-fails per bot: one bot failing to join
 * must not stop the others or the room-creation flow.
 */
async function joinAdditionalBotsToRoom(
  roomId: string,
  primaryBotToken: string,
  homeserver: string,
): Promise<string[]> {
  const additionalBotTokens = getMatrixAdditionalBotAsTokens();
  const joinedUserIds: string[] = [];
  for (const additionalBotToken of additionalBotTokens) {
    try {
      const additionalBotUserId = await matrixWhoAmI(
        additionalBotToken,
        homeserver,
      );
      await matrixInviteUser(
        roomId,
        additionalBotUserId,
        primaryBotToken,
        homeserver,
      );
      await matrixJoinRoom(roomId, additionalBotToken, homeserver);
      joinedUserIds.push(additionalBotUserId);
    } catch (error) {
      console.warn(
        '[MatrixBot] Failed to join additional bot into room:',
        roomId,
        error instanceof Error ? error.message : error,
      );
    }
  }
  return joinedUserIds;
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
 * Any other bots configured via `HYPHA_MATRIX_ADDITIONAL_BOT_AS_TOKENS` are also joined and
 * granted PL100 (#2428) — a temporary bridge until #2252 gives Prod/Preview isolated databases.
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

  let roomId: string;
  try {
    roomId = await matrixCreateRoom(title, botToken, homeserver);
  } catch (error) {
    console.warn(
      '[MatrixBot] Failed to create bot-owned room:',
      title,
      error instanceof Error ? error.message : error,
    );
    return null;
  }

  const additionalBotUserIds = await joinAdditionalBotsToRoom(
    roomId,
    botToken,
    homeserver,
  );

  // Power-level setup is best-effort — the room already exists, so a failure here must not
  // orphan it: callers retry room creation on a `null` return, which would create a duplicate,
  // never-persisted room every time.
  try {
    await matrixApplyRoomPowerLevels(roomId, botToken, homeserver, {
      grantPl100ToUserId: grantPl100ToMatrixUserId?.trim(),
      additionalPl100UserIds: additionalBotUserIds,
    });
  } catch (error) {
    console.warn(
      '[MatrixBot] Room created but power-level setup failed:',
      roomId,
      error instanceof Error ? error.message : error,
    );
  }
  return { roomId };
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
      '[MatrixBot] Invite skipped/failed (likely already a member), room:',
      trimmedRoomId,
      error instanceof Error ? error.message : error,
    );
  }

  // The member's own AS-puppeting namespace may not be this environment's primary bot (e.g. a
  // Prod-primary deployment puppeting a Preview-created account) — try every configured bot
  // token, not just the primary's, before giving up. Same fix as the legacy-rooms backfill
  // script's puppet-grant call (#2428, 2026-08-12) — same root cause, temporary bridge while
  // Prod/Preview share one Postgres DB (#2252).
  const puppetCandidates = [botToken, ...getMatrixAdditionalBotAsTokens()];
  for (const token of puppetCandidates) {
    try {
      await matrixJoinRoomAsPuppet(
        trimmedRoomId,
        trimmedUserId,
        token,
        homeserver,
      );
      return { joined: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        '[MatrixBot] Failed to puppet-join member into room:',
        trimmedRoomId,
        message,
      );
      if (!message.includes('M_FORBIDDEN')) return { joined: false };
    }
  }
  return { joined: false };
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
