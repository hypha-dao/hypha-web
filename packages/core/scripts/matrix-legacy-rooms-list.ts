/**
 * Phase 1 (#2428 backfill) — READ-ONLY enumeration of every room Dendrite knows about, with its
 * current join_rules/power_levels/name, queried directly against Dendrite's own Postgres
 * (`roomserver_rooms` + `syncapi_current_room_state` — the same tables `/sync` and `/state` read
 * from, so this is not a derived/approximate cache). No writes anywhere, ever — this script only
 * runs SELECTs.
 *
 * Same script for local and VPS: only MATRIX_DB_URL changes between environments.
 *
 * Usage (writes nothing — redirect stdout to save the snapshot for phase 2):
 *   MATRIX_DB_URL=postgres://dendrite:...@localhost:5432/dendrite \
 *     pnpm exec tsx packages/core/scripts/matrix-legacy-rooms-list.ts > rooms-snapshot.json
 *
 * On the VPS, run this on the box itself (same as the pg_dump backup) so MATRIX_DB_URL can just
 * point at the local Dendrite postgres container over its docker network / exposed port — no
 * need to open the DB to the outside world.
 */
import pg from 'pg';

const { Pool } = pg;

type RoomState = {
  'm.room.join_rules'?: { join_rule?: string };
  'm.room.power_levels'?: {
    users?: Record<string, number>;
    [k: string]: unknown;
  };
  'm.room.name'?: { name?: string };
};

type RoomSnapshot = {
  roomId: string;
  name: string | null;
  joinRule: string | null;
  powerLevelUsers: Record<string, number>;
};

async function main() {
  const dbUrl = process.env.MATRIX_DB_URL?.trim();
  if (!dbUrl) {
    throw new Error(
      "MATRIX_DB_URL is required (Dendrite's own postgres, not the app DB)",
    );
  }

  const pool = new Pool({ connectionString: dbUrl });
  try {
    const { rows } = await pool.query<{
      room_id: string;
      state: RoomState | null;
    }>(`
      SELECT
        r.room_id,
        jsonb_object_agg(s.type, (s.headered_event_json::jsonb -> 'content'))
          FILTER (WHERE s.type IS NOT NULL) AS state
      FROM roomserver_rooms r
      LEFT JOIN syncapi_current_room_state s
        ON s.room_id = r.room_id
        AND s.state_key = ''
        AND s.type IN ('m.room.join_rules', 'm.room.power_levels', 'm.room.name')
      GROUP BY r.room_id
      ORDER BY r.room_id;
    `);

    const snapshots: RoomSnapshot[] = rows.map((row) => {
      const state = row.state ?? {};
      return {
        roomId: row.room_id,
        name: state['m.room.name']?.name ?? null,
        joinRule: state['m.room.join_rules']?.join_rule ?? null,
        powerLevelUsers: state['m.room.power_levels']?.users ?? {},
      };
    });

    const summary = {
      totalRooms: snapshots.length,
      publicJoinRule: snapshots.filter((r) => r.joinRule === 'public').length,
      nonPublicJoinRule: snapshots.filter((r) => r.joinRule !== 'public')
        .length,
      missingPowerLevels: snapshots.filter(
        (r) => Object.keys(r.powerLevelUsers).length === 0,
      ).length,
    };

    console.log(JSON.stringify({ summary, rooms: snapshots }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
