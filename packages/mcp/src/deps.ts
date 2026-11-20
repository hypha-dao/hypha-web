import type {
  Caller,
  Failure,
  ListSpacesData,
  ListSpacesInput,
  MyMembership,
} from '@hypha-platform/core/server';

/**
 * Everything the MCP package needs from the outside, injected per request. The package never
 * imports the database or the authorization-server package: it calls the feature functions it
 * is handed (bound to a database and a caller by the route glue) and nothing else.
 */
export type UserCaller = Extract<Caller, { kind: 'user' }>;

export type Refusal = {
  code: 'no_profile' | 'rate_limited';
  message: string;
  retryAfterSeconds?: number;
};

export type McpAccess =
  | { kind: 'caller'; caller: UserCaller }
  | { kind: 'refused'; refusal: Refusal };

export type McpFeatures = {
  listSpaces(
    input: ListSpacesInput,
    caller: UserCaller,
  ): Promise<{ ok: true; data: ListSpacesData } | Failure>;
  getMyMembership(
    input: { spaceSlug: string },
    caller: UserCaller,
  ): Promise<{ ok: true; data: MyMembership } | Failure>;
};

/** The allow-listed fields of the one log line per tool call (see `log.ts`). */
export type ToolCallLog = {
  tool: string;
  outcome: string;
  durationMs: number;
  clientId?: string | null;
  itemCount?: number;
};

export type McpDeps = {
  access: McpAccess;
  features: McpFeatures;
  /** Link to a space page, built from the slug and the app base URL, never from content. */
  spaceUrl(slug: string): string;
  log(entry: ToolCallLog): void;
  /** Per-tool deadline in milliseconds. */
  deadlineMs?: number;
  clientId?: string | null;
  now?: () => number;
};
