import {
  AI_ORIGIN_KINDS,
  CLIENT_ID_REQUIRED_ORIGIN_KINDS,
  CLIENT_LESS_ORIGIN_KINDS,
  ORIGIN_CLIENT_ID_MAX,
  ORIGIN_CLIENT_LABEL_MAX,
  ORIGIN_KINDS,
  type OriginKind,
} from './kinds';

declare const originBrand: unique symbol;

/**
 * Which path created a row, set by the server and never editable (#2724).
 *
 * Plain serializable data (a later approval-link flow stores it with a pending action). It
 * carries no database handle. The brand is type-only: only the constructors below, and
 * `assertOrigin` for data that already went through them, produce an `Origin`. It is passed as an
 * explicit parameter next to a write's input, never inside the input and never read from
 * anything a user typed.
 */
export type Origin = Readonly<{
  kind: OriginKind;
  clientId: string | null;
  clientLabel: string | null;
}> & { readonly [originBrand]: true };

/** What readers (UI, MCP) see: the kind and the self-declared client name, never the client id. */
export type OriginView = Readonly<{
  kind: OriginKind;
  clientLabel: string | null;
}>;

/** The three columns the data layer writes (`originColumns` in storage-postgres). */
export type OriginColumns = {
  originKind: OriginKind;
  originClientId: string | null;
  originClientLabel: string | null;
};

/** A name is self-declared by clients: strip control characters, collapse spaces, cap it. */
function cleanLabel(value: string | null | undefined): string | null {
  if (value == null) return null;
  const collapsed = value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Count and cut by code point (the database counts characters, and a UTF-16 slice can split an emoji).
  const cleaned = Array.from(collapsed)
    .slice(0, ORIGIN_CLIENT_LABEL_MAX)
    .join('')
    .trim();
  return cleaned.length > 0 ? cleaned : null;
}

function cleanId(value: string | number | null | undefined): string | null {
  if (value == null) return null;
  const id = String(value).trim();
  if (id.length === 0) return null;
  if (Array.from(id).length > ORIGIN_CLIENT_ID_MAX) {
    throw new Error(
      `Origin client id exceeds ${ORIGIN_CLIENT_ID_MAX} characters`,
    );
  }
  return id;
}

function make(
  kind: OriginKind,
  clientId: string | null,
  clientLabel: string | null,
): Origin {
  return Object.freeze({ kind, clientId, clientLabel }) as unknown as Origin;
}

function requireId(kind: OriginKind, id: string | null): string {
  if (id == null) throw new Error(`Origin kind "${kind}" needs a client id`);
  return id;
}

/** The Hypha app's own entry point (server actions and routes) with the person's credentials. */
export const appOrigin = (): Origin => make('app', null, null);

/** Hypha's chat assistant acting for the signed-in person. */
export const hyphaAssistantOrigin = (): Origin =>
  make('hypha_assistant', null, null);

/** A third-party AI client through the authorization server. `clientName` is self-declared. */
export const mcpClientOrigin = (input: {
  clientId: string;
  clientName?: string | null;
}): Origin =>
  make(
    'mcp_client',
    requireId('mcp_client', cleanId(input.clientId)),
    cleanLabel(input.clientName),
  );

/** An OAuth app of the integration kit acting for a person (no writer yet). */
export const apiClientOrigin = (input: {
  clientId: string;
  clientName?: string | null;
}): Origin =>
  make(
    'api_client',
    requireId('api_client', cleanId(input.clientId)),
    cleanLabel(input.clientName),
  );

/** A community app writing with a space key: the key's id and its `source` label. */
export const spaceKeyOrigin = (input: {
  keyId: number | string;
  source: string;
}): Origin =>
  make(
    'space_key',
    requireId('space_key', cleanId(input.keyId)),
    cleanLabel(input.source),
  );

/** A job, by its own fixed name (id and label are both the name). */
export const jobOrigin = (jobName: string): Origin => {
  const name = requireId('hypha_intelligence', cleanId(jobName));
  return make('hypha_intelligence', name, cleanLabel(name));
};

/** A record the platform writes in reaction to an event; the label names the source. */
export const platformOrigin = (source: string): Origin =>
  make('hypha_platform', null, cleanLabel(source));

/**
 * Rows written before origin existed. Not a path a writer may choose: it exists for tests.
 */
export const unknownOrigin = (): Origin => make('unknown', null, null);

/**
 * The data layer's last check before a write: the same rules as the database CHECK, so a bad
 * value fails with a clear error instead of a constraint violation (and a cast cannot slip one
 * through).
 */
export function assertOrigin(value: unknown): Origin {
  const candidate = value as Partial<Origin> | null | undefined;
  if (!candidate || typeof candidate !== 'object') {
    throw new Error('An origin is required to write this record');
  }
  const { kind, clientId, clientLabel } = candidate;
  if (!ORIGIN_KINDS.includes(kind as OriginKind)) {
    throw new Error(`Unknown origin kind "${String(kind)}"`);
  }
  const k = kind as OriginKind;
  const id = clientId ?? null;
  const label = clientLabel ?? null;
  if (id !== null && (typeof id !== 'string' || id.trim().length === 0)) {
    throw new Error('Invalid origin client id');
  }
  if (id !== null && Array.from(id).length > ORIGIN_CLIENT_ID_MAX) {
    throw new Error('Origin client id is too long');
  }
  if (
    label !== null &&
    (typeof label !== 'string' ||
      label.trim().length === 0 ||
      Array.from(label).length > ORIGIN_CLIENT_LABEL_MAX)
  ) {
    throw new Error('Invalid origin client label');
  }
  if (CLIENT_LESS_ORIGIN_KINDS.includes(k) && (id !== null || label !== null)) {
    throw new Error(`Origin kind "${k}" carries no client`);
  }
  if (CLIENT_ID_REQUIRED_ORIGIN_KINDS.includes(k) && id === null) {
    throw new Error(`Origin kind "${k}" needs a client id`);
  }
  return make(k, id, label);
}

/** The columns to write. Validates first. */
export function originToColumns(origin: Origin): OriginColumns {
  const checked = assertOrigin(origin);
  return {
    originKind: checked.kind,
    originClientId: checked.clientId,
    originClientLabel: checked.clientLabel,
  };
}

/** Read side: the view of a row's origin columns. Unknown values read as `unknown`. */
export function originViewFromColumns(row: {
  originKind?: string | null;
  originClientLabel?: string | null;
}): OriginView {
  const kind = ORIGIN_KINDS.includes(row.originKind as OriginKind)
    ? (row.originKind as OriginKind)
    : 'unknown';
  return { kind, clientLabel: row.originClientLabel ?? null };
}

const ORIGIN_COLUMN_KEYS = [
  'originKind',
  'originClientId',
  'originClientLabel',
] as const;

/** Entity and origin come back as two separate parts: drop the origin columns from a row. */
/** Database rows type the kind as a plain string; the view validates it. */
type OriginColumnsRow = {
  originKind: string;
  originClientId: string | null;
  originClientLabel: string | null;
};

export function splitOriginColumns<T extends OriginColumnsRow>(
  row: T,
): { entity: Omit<T, keyof OriginColumnsRow>; origin: OriginView } {
  const entity = { ...row } as Record<string, unknown>;
  for (const key of ORIGIN_COLUMN_KEYS) delete entity[key];
  return {
    entity: entity as Omit<T, keyof OriginColumnsRow>,
    origin: originViewFromColumns(row),
  };
}

/** Whether the UI shows this origin as AI-written. `unknown` is not decided here. */
export const isAiOrigin = (origin: Pick<OriginView, 'kind'>): boolean =>
  AI_ORIGIN_KINDS.includes(origin.kind);
