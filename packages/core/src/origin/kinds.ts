/**
 * The closed list of origin kinds (#2724). Mirrors `ORIGIN_KINDS` in
 * `@hypha-platform/storage-postgres` (the database CHECK); a test asserts the two are equal.
 * A new kind needs a migration that widens the CHECK.
 *
 * - `app`: the Hypha app's own entry point with the person's own credentials. Not proof of a
 *   click in the UI.
 * - `hypha_assistant`: Hypha's chat assistant acting for the signed-in person.
 * - `mcp_client`: a third-party AI client through the authorization server.
 * - `api_client`: an OAuth app of the integration kit acting for a person (no writer yet).
 * - `space_key`: a community app writing with a space key.
 * - `hypha_intelligence`: the jobs (today the signal orchestrator).
 * - `hypha_platform`: records the platform writes in reaction to an event.
 * - `unknown`: rows written before origin existed. Nothing is inferred for them.
 */
export const ORIGIN_KINDS = [
  'app',
  'hypha_assistant',
  'mcp_client',
  'api_client',
  'space_key',
  'hypha_intelligence',
  'hypha_platform',
  'unknown',
] as const;
export type OriginKind = (typeof ORIGIN_KINDS)[number];

/** Kinds that carry no client id and no client label. */
export const CLIENT_LESS_ORIGIN_KINDS: readonly OriginKind[] = [
  'app',
  'unknown',
  'hypha_assistant',
];

/** Kinds that must carry a stable client id. */
export const CLIENT_ID_REQUIRED_ORIGIN_KINDS: readonly OriginKind[] = [
  'mcp_client',
  'api_client',
  'space_key',
];

export const ORIGIN_CLIENT_ID_MAX = 255;
export const ORIGIN_CLIENT_LABEL_MAX = 120;

/** Kinds the UI shows as written by AI. `unknown` rows fall back to the legacy tag heuristics. */
export const AI_ORIGIN_KINDS: readonly OriginKind[] = [
  'hypha_assistant',
  'hypha_intelligence',
  'mcp_client',
];
