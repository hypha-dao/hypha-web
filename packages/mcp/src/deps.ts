import type {
  Caller,
  Failure,
  ListSpacesData,
  ListSpacesInput,
  MyMembership,
  SpaceDetail,
  ListProposalsData,
  MyVote,
  ListProposalsInput,
  GetSpaceInput,
  ListSignalsData,
  ListSignalsInput,
  ListQuestsData,
  ListQuestsInput,
  CreateSignalInput,
  CreatedSignal,
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
  getSpace(
    input: GetSpaceInput,
    caller: UserCaller,
  ): Promise<{ ok: true; data: SpaceDetail } | Failure>;
  listProposals(
    input: ListProposalsInput,
    caller: UserCaller,
  ): Promise<{ ok: true; data: ListProposalsData } | Failure>;
  getMyVote(
    input: { spaceSlug: string; documentSlug: string },
    caller: UserCaller,
  ): Promise<{ ok: true; data: MyVote } | Failure>;
  listSignals(
    input: ListSignalsInput,
    caller: UserCaller,
  ): Promise<{ ok: true; data: ListSignalsData } | Failure>;
  listQuests(
    input: ListQuestsInput,
    caller: UserCaller,
  ): Promise<{ ok: true; data: ListQuestsData } | Failure>;
  getMyMembership(
    input: { spaceSlug: string },
    caller: UserCaller,
  ): Promise<{ ok: true; data: MyMembership } | Failure>;
  /** The one write (#2744); only reached while `writesEnabled` is true. */
  createSignal(
    input: CreateSignalInput,
    caller: UserCaller,
  ): Promise<{ ok: true; data: CreatedSignal } | Failure>;
};

/** The allow-listed fields of the one log line per tool call (see `log.ts`). */
export type ToolCallLog = {
  tool: string;
  outcome: string;
  durationMs: number;
  clientId?: string | null;
  itemCount?: number;
  /** Set on a write tool: the line becomes the audit line `mcp.write`. Ids only. */
  write?: {
    /** Absent when the caller could not be resolved. */
    personId?: number;
    spaceId?: number;
    signalId?: number;
    duplicate?: boolean;
  };
};

export type McpDeps = {
  access: McpAccess;
  features: McpFeatures;
  /** Link to a space page, built from the slug and the app base URL, never from content. */
  spaceUrl(slug: string): string;
  /** Link to a proposal page, built from the two slugs and the app base URL, never from content. */
  proposalUrl(spaceSlug: string, proposalSlug: string): string;
  /** Link to a signal on the space's signals page, built from the two slugs and the app base URL, never from content. */
  signalUrl(spaceSlug: string, signalSlug: string): string;
  /** Link to a quest page, built from the two slugs and the app base URL, never from content. */
  questUrl(spaceSlug: string, questSlug: string): string;
  log(entry: ToolCallLog): void;
  /**
   * Keep the function alive until `work` settles after the response was sent (the platform's
   * post-response hook). Used when a write outlives the deadline, so its outcome is still logged.
   */
  keepAlive?(work: Promise<unknown>): void;
  /**
   * Whether write tools are offered (`MCP_WRITES_ENABLED`, the same switch that lets the
   * authorization server grant the write scope). Off or absent: they are not registered at all.
   */
  writesEnabled?: boolean;
  /** Per-tool deadline in milliseconds. */
  deadlineMs?: number;
  clientId?: string | null;
  now?: () => number;
};
