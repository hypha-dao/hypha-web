/**
 * Phase 2 (#2428 backfill) — grants the primary bot and every configured additional bot
 * (`HYPHA_MATRIX_ADDITIONAL_BOT_AS_TOKENS`) PL100 in each legacy (pre-#2428) room, so both
 * Prod and Preview bots can manage every room while they still share one Postgres DB (#2252).
 *
 * Reads the phase-1 snapshot (packages/core/scripts/matrix-legacy-rooms-list.ts output) and:
 *   - by default (no --execute): DRY RUN. Re-fetches each room's live power_levels via the
 *     Matrix API (cheap per-room, only for what's in this run's scope) and prints exactly what
 *     WOULD happen — no join/invite/PUT calls at all. Use this to confirm scope before running
 *     for real.
 *   - with --execute: performs the plan for real.
 *
 * Same script for local and VPS — only the env vars change:
 *   NEXT_PUBLIC_MATRIX_HOMESERVER_URL   homeserver base URL (same var the app reads)
 *   HYPHA_MATRIX_BOT_AS_TOKEN           primary bot's AS token for this environment
 *   HYPHA_MATRIX_ADDITIONAL_BOT_AS_TOKENS  comma-separated AS tokens of the other bot(s)
 *
 * Usage (dry run):
 *   pnpm exec tsx packages/core/scripts/matrix-legacy-rooms-backfill.ts --input rooms-snapshot.json
 *
 * Small-batch test (2-3 rooms) before a full run:
 *   pnpm exec tsx packages/core/scripts/matrix-legacy-rooms-backfill.ts --input rooms-snapshot.json \
 *     --room-id '!abc:matrix.test' --room-id '!def:matrix.test' --execute
 *
 * Full run:
 *   pnpm exec tsx packages/core/scripts/matrix-legacy-rooms-backfill.ts --input rooms-snapshot.json --execute
 *
 * Legacy rooms only self-join without an invite because they were created with
 * `join_rule: "public"` (pre-#2428 client-side room creation). A room with a non-public
 * join_rule where the primary bot already holds PL100 is a post-#2428 bot-owned room (created
 * during #2428 testing, before this backfill ran) that's just missing the additional bot — no
 * puppet-self-join needed there, the primary bot already has admin rights to invite/grant
 * directly. Any other non-public room (no known admin, primary bot not already present) is left
 * alone and flagged NEEDS_MANUAL_REVIEW — no aggressive fallback for a case with no safe default.
 *
 * Deliberately self-contained (no import from matrix-http-client.ts): that module pulls in the
 * app's DB/schema graph (via governance/server), which only resolves correctly inside a Next.js
 * build. A standalone migration script should not depend on that graph — so the handful of raw
 * Matrix HTTP calls it needs are inlined below instead.
 */
import { readFileSync } from 'node:fs';

type RoomSnapshot = {
  roomId: string;
  name: string | null;
  joinRule: string | null;
  powerLevelUsers: Record<string, number>;
};

type RoomOutcome = {
  roomId: string;
  name: string | null;
  status:
    | 'ALREADY_COMPLIANT'
    | 'PLANNED'
    | 'DONE'
    | 'NEEDS_MANUAL_REVIEW'
    | 'ERROR';
  detail: string;
  before?: Record<string, number>;
  after?: Record<string, number>;
};

const MATRIX_HTTP_TIMEOUT_MS = 10_000;

function matrixFetch(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    signal: AbortSignal.timeout(MATRIX_HTTP_TIMEOUT_MS),
    redirect: 'error',
  });
}

async function readMatrixJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      text.trim().slice(0, 240) ||
        `Matrix request failed with status ${res.status}`,
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('Matrix returned a non-JSON response');
  }
}

function getMatrixHomeserverUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL?.trim();
  return raw ? raw.replace(/\/?$/, '') : null;
}

function getMatrixBotAsToken(): string | null {
  return process.env.HYPHA_MATRIX_BOT_AS_TOKEN?.trim() || null;
}

function getMatrixAdditionalBotAsTokens(): string[] {
  const raw = process.env.HYPHA_MATRIX_ADDITIONAL_BOT_AS_TOKENS?.trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);
}

async function matrixWhoAmI(
  accessToken: string,
  homeserver: string,
): Promise<string> {
  const res = await matrixFetch(
    `${homeserver}/_matrix/client/v3/account/whoami`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const data = await readMatrixJson<{ user_id?: string }>(res);
  const userId = data.user_id?.trim();
  if (!userId) throw new Error('Matrix whoami returned no user_id');
  return userId;
}

async function matrixInviteUser(
  roomId: string,
  userId: string,
  accessToken: string,
  homeserver: string,
): Promise<void> {
  const res = await matrixFetch(
    `${homeserver}/_matrix/client/v3/rooms/${encodeURIComponent(
      roomId,
    )}/invite`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: userId }),
    },
  );
  await readMatrixJson<Record<string, never>>(res);
}

async function matrixJoinRoom(
  roomId: string,
  accessToken: string,
  homeserver: string,
): Promise<void> {
  const res = await matrixFetch(
    `${homeserver}/_matrix/client/v3/join/${encodeURIComponent(roomId)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    },
  );
  await readMatrixJson<{ room_id?: string }>(res);
}

async function matrixGetPowerLevels(
  roomId: string,
  accessToken: string,
  homeserver: string,
): Promise<{ users?: Record<string, number>; [key: string]: unknown }> {
  const res = await matrixFetch(
    `${homeserver}/_matrix/client/v3/rooms/${encodeURIComponent(
      roomId,
    )}/state/m.room.power_levels/`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return readMatrixJson(res);
}

async function matrixGetJoinRule(
  roomId: string,
  accessToken: string,
  homeserver: string,
): Promise<string | undefined> {
  const res = await matrixFetch(
    `${homeserver}/_matrix/client/v3/rooms/${encodeURIComponent(
      roomId,
    )}/state/m.room.join_rules/`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const data = await readMatrixJson<{ join_rule?: string }>(res);
  return data.join_rule;
}

/** Single read-modify-write PUT granting PL100 to each of `userIds` — mirrors
 * matrixApplyRoomPowerLevels in matrix-http-client.ts (kept local, see file header). */
async function matrixGrantPl100(
  roomId: string,
  userIds: string[],
  accessToken: string,
  homeserver: string,
): Promise<void> {
  const current = await matrixGetPowerLevels(roomId, accessToken, homeserver);
  const users = { ...current.users };
  for (const userId of userIds) {
    users[userId] = 100;
  }
  const res = await matrixFetch(
    `${homeserver}/_matrix/client/v3/rooms/${encodeURIComponent(
      roomId,
    )}/state/m.room.power_levels/`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...current, users }),
    },
  );
  await readMatrixJson<Record<string, never>>(res);
}

/** Puppet-PUT power_levels as `puppetUserId` — only needed by this backfill (a PL0 bot granting
 * itself PL100 by acting as the room's actual admin). Not exported from matrix-http-client.ts
 * since production code never needs to puppet anyone but the org bot's own registered users. */
async function puppetGrantPl100(
  roomId: string,
  puppetUserId: string,
  targetUserId: string,
  asToken: string,
  homeserver: string,
): Promise<void> {
  const puppetQs = `?user_id=${encodeURIComponent(puppetUserId)}`;
  const stateUrl = `${homeserver}/_matrix/client/v3/rooms/${encodeURIComponent(
    roomId,
  )}/state/m.room.power_levels/${puppetQs}`;

  const getRes = await matrixFetch(stateUrl, {
    headers: { Authorization: `Bearer ${asToken}` },
  });
  const current = await readMatrixJson<{
    users?: Record<string, number>;
    [key: string]: unknown;
  }>(getRes);

  const users = { ...current.users, [targetUserId]: 100 };
  const putRes = await matrixFetch(stateUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${asToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...current, users }),
  });
  await readMatrixJson<Record<string, never>>(putRes);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const inputIdx = args.indexOf('--input');
  const inputPath = inputIdx >= 0 ? args[inputIdx + 1] : undefined;
  const roomIds = args
    .flatMap((arg, i) => (arg === '--room-id' ? [args[i + 1]] : []))
    .filter(Boolean);
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : undefined;
  const execute = args.includes('--execute');
  if (!inputPath) {
    throw new Error('--input <phase-1-snapshot.json> is required');
  }
  return { inputPath, roomIds, limit, execute };
}

async function processRoom(
  snapshot: RoomSnapshot,
  {
    homeserver,
    primaryBotToken,
    additionalBots,
    execute,
  }: {
    homeserver: string;
    primaryBotToken: string;
    additionalBots: Array<{ token: string; userId: string }>;
    execute: boolean;
  },
): Promise<RoomOutcome> {
  const { roomId, name } = snapshot;

  // Re-fetch live state right before acting — cheap per-room at this scope, and more accurate
  // than the phase-1 DB snapshot which may be stale by the time this room is actually processed.
  let live: { users?: Record<string, number>; join_rule?: string };
  try {
    const [powerLevels, joinRule] = await Promise.all([
      matrixGetPowerLevels(roomId, primaryBotToken, homeserver).catch(() => ({
        users: snapshot.powerLevelUsers,
      })),
      matrixGetJoinRule(roomId, primaryBotToken, homeserver).catch(
        () => snapshot.joinRule ?? undefined,
      ),
    ]);
    live = { users: powerLevels.users, join_rule: joinRule };
  } catch (error) {
    return {
      roomId,
      name,
      status: 'ERROR',
      detail: `Failed to re-fetch live state: ${
        error instanceof Error ? error.message : error
      }`,
    };
  }

  const before = live.users ?? {};
  const primaryUserId = await matrixWhoAmI(primaryBotToken, homeserver);
  const primaryAlreadyPl100 = (before[primaryUserId] ?? 0) >= 100;

  // Non-public join_rule is only safe to proceed on if the primary bot is already the room's
  // admin (a post-#2428 bot-owned room missing the additional bot) — it can invite/grant with
  // its own existing PL100, no puppet-self-join needed. Otherwise there's no known admin to
  // bootstrap from and no way to self-join, so this is a genuine unknown case to flag by hand.
  if (live.join_rule !== 'public' && !primaryAlreadyPl100) {
    return {
      roomId,
      name,
      status: 'NEEDS_MANUAL_REVIEW',
      detail: `join_rule is "${live.join_rule}", not "public", and primary bot isn't already PL100 here — no safe way to proceed automatically, skipping`,
      before,
    };
  }

  const wantedUserIds = additionalBots.map((b) => b.userId);
  const missingBots = wantedUserIds.filter((id) => (before[id] ?? 0) < 100);

  if (primaryAlreadyPl100 && missingBots.length === 0) {
    return {
      roomId,
      name,
      status: 'ALREADY_COMPLIANT',
      detail:
        'Primary bot and all additional bots already hold PL100 — nothing to do',
      before,
    };
  }

  if (!execute) {
    return {
      roomId,
      name,
      status: 'PLANNED',
      detail: [
        !primaryAlreadyPl100
          ? 'primary bot: self-join + puppet-grant PL100'
          : null,
        missingBots.length > 0
          ? `additional bots to invite+join+grant PL100: ${missingBots.join(
              ', ',
            )}`
          : null,
      ]
        .filter(Boolean)
        .join('; '),
      before,
    };
  }

  try {
    if (!primaryAlreadyPl100) {
      // Self-join (public room, no invite needed) — ignore "already in room" errors.
      await matrixJoinRoom(roomId, primaryBotToken, homeserver).catch(
        (error) => {
          if (!String(error).includes('already')) throw error;
        },
      );

      const admins = Object.entries(before).filter(
        ([id, level]) => level >= 100 && id !== primaryUserId,
      );
      if (admins.length === 0) {
        return {
          roomId,
          name,
          status: 'NEEDS_MANUAL_REVIEW',
          detail:
            'No existing PL100 admin found to puppet — cannot self-grant, skipping',
          before,
        };
      }
      const [puppetAdminId] = admins[0]!;
      await puppetGrantPl100(
        roomId,
        puppetAdminId,
        primaryUserId,
        primaryBotToken,
        homeserver,
      );
    }

    for (const bot of additionalBots) {
      if ((before[bot.userId] ?? 0) >= 100) continue;
      // Tolerate "already invited/joined" — makes a re-run after a partial prior failure safe.
      await matrixInviteUser(
        roomId,
        bot.userId,
        primaryBotToken,
        homeserver,
      ).catch((error) => {
        if (!String(error).includes('already')) throw error;
      });
      await matrixJoinRoom(roomId, bot.token, homeserver).catch((error) => {
        if (!String(error).includes('already')) throw error;
      });
    }

    if (missingBots.length > 0) {
      await matrixGrantPl100(roomId, missingBots, primaryBotToken, homeserver);
    }

    const after = await matrixGetPowerLevels(
      roomId,
      primaryBotToken,
      homeserver,
    );
    return {
      roomId,
      name,
      status: 'DONE',
      detail: 'Backfilled successfully',
      before,
      after: after.users,
    };
  } catch (error) {
    return {
      roomId,
      name,
      status: 'ERROR',
      detail: error instanceof Error ? error.message : String(error),
      before,
    };
  }
}

async function main() {
  const { inputPath, roomIds, limit, execute } = parseArgs();

  const homeserver = getMatrixHomeserverUrl();
  const primaryBotToken = getMatrixBotAsToken();
  const additionalBotTokens = getMatrixAdditionalBotAsTokens();
  if (!homeserver || !primaryBotToken) {
    throw new Error(
      'NEXT_PUBLIC_MATRIX_HOMESERVER_URL and HYPHA_MATRIX_BOT_AS_TOKEN are required',
    );
  }
  if (additionalBotTokens.length === 0) {
    throw new Error(
      'HYPHA_MATRIX_ADDITIONAL_BOT_AS_TOKENS is required — nothing to backfill otherwise',
    );
  }

  const additionalBots = await Promise.all(
    additionalBotTokens.map(async (token) => ({
      token,
      userId: await matrixWhoAmI(token, homeserver),
    })),
  );

  const snapshotFile = JSON.parse(readFileSync(inputPath, 'utf-8')) as {
    rooms: RoomSnapshot[];
  };

  let rooms = snapshotFile.rooms;
  if (roomIds.length > 0) {
    rooms = rooms.filter((r) => roomIds.includes(r.roomId));
  }
  if (limit) {
    rooms = rooms.slice(0, limit);
  }

  console.log(
    `Mode: ${
      execute ? 'EXECUTE (will make changes)' : 'DRY RUN (no changes)'
    } — ${rooms.length} room(s) in scope`,
  );
  console.log(
    `Additional bots: ${additionalBots.map((b) => b.userId).join(', ')}`,
  );

  const outcomes: RoomOutcome[] = [];
  for (const room of rooms) {
    const outcome = await processRoom(room, {
      homeserver,
      primaryBotToken,
      additionalBots,
      execute,
    });
    outcomes.push(outcome);
    console.log(JSON.stringify(outcome));
  }

  const summary = outcomes.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {});
  console.log('\nSummary:', JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
