import {
  buildPaginatedResponse,
  parseHttpPaginationParams,
} from '../common/pagination';
import { isUniqueViolation } from '../common/server/unique-violation';
import type {
  AuthenticatedIntegrationClient,
  ClientAuthResult,
} from '../integration-client/server/authenticate-client';
import type {
  IntegrationClientScope,
  IntegrationClientSummary,
} from '../integration-client/types';
import {
  schemaApproveIntegrationClient,
  schemaRequestIntegrationClient,
  type RequestIntegrationClientInput,
} from '../integration-client/validation';
import {
  resolveGrantScopes,
  toPublicGrant,
  toPublicGrantWithClient,
  type IntegrationGrantSummary,
  type IntegrationGrantWithClient,
} from '../integration-grant/types';
import { schemaRegisterIntegrationGrant } from '../integration-grant/validation';
import { integrationJson } from './response-headers';

/** The signed-in person behind a user token, as far as these handlers need. */
export type IntegrationUser = {
  id: number;
  email?: string;
  name?: string;
  surname?: string;
  slug?: string;
};

export type UserAuthResult =
  | { ok: true; user: IntegrationUser }
  | { ok: false; status: 401 | 403; error: string };

export type IssuedKey = { client: IntegrationClientSummary; plaintext: string };

/**
 * Everything the handlers need from the outside world. The routes wire the real
 * database and identity code; tests wire fakes. Keeping this a narrow, explicit
 * list is what lets the integration API be extracted into its own service.
 */
export type IntegrationApiDeps = {
  authenticateClient(request: Request): Promise<ClientAuthResult>;
  authenticateUser(request: Request): Promise<UserAuthResult>;
  /** A response to send back when the caller is not ops, or null to continue. */
  authorizeOps(request: Request): Response | null;
  requestClient(
    input: RequestIntegrationClientInput,
    requester: { id: number },
  ): Promise<IntegrationClientSummary>;
  notifyClientRequested(args: {
    client: IntegrationClientSummary;
    requester: IntegrationUser;
  }): Promise<void>;
  listClients(): Promise<IntegrationClientSummary[]>;
  approveClient(args: {
    slug: string;
    scopes?: IntegrationClientScope[];
  }): Promise<IssuedKey | null>;
  revokeClient(args: { slug: string }): Promise<boolean>;
  rotateClientKey(args: { slug: string }): Promise<IssuedKey | null>;
  registerGrant(args: {
    clientId: number;
    personId: number;
    scopes: IntegrationClientScope[];
  }): Promise<IntegrationGrantSummary>;
  listClientGrants(args: {
    clientId: number;
    personId: number;
  }): Promise<IntegrationGrantSummary[]>;
  listUserGrants(args: {
    personId: number;
  }): Promise<IntegrationGrantWithClient[]>;
  revokeGrant(args: {
    grantId: number;
    personId: number;
    clientId?: number;
  }): Promise<boolean>;
};

type Json = Record<string, unknown>;

const unauthorized = () =>
  integrationJson({ error: 'Unauthorized' }, { status: 401 });
const serverError = (error: string) =>
  integrationJson({ error }, { status: 500 });
const invalidJson = () =>
  integrationJson({ error: 'Invalid JSON body' }, { status: 400 });

function logFailure(what: string, context: Json, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to ${what}:`, { ...context, message });
}

function clientAuthFailure(auth: Extract<ClientAuthResult, { ok: false }>) {
  return integrationJson(
    { error: auth.error, code: auth.code },
    { status: auth.status },
  );
}

function userAuthFailure(auth: Extract<UserAuthResult, { ok: false }>) {
  return auth.status === 401
    ? unauthorized()
    : integrationJson({ error: auth.error }, { status: auth.status });
}

/** An absent or blank body is `{}`; anything else must parse as JSON. */
async function readOptionalJson(
  request: Request,
): Promise<{ ok: true; body: unknown } | { ok: false }> {
  const raw = await request.text();
  if (!raw.trim()) return { ok: true, body: {} };
  try {
    return { ok: true, body: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
}

/** Match the whole segment: `parseInt` would read "1junk" as 1. */
function parseGrantId(id: string): number | null {
  const value = /^[1-9]\d*$/.test(id) ? Number(id) : Number.NaN;
  return Number.isSafeInteger(value) ? value : null;
}

// ---------------------------------------------------------------- clients

/**
 * POST clients/requests (user token). Replaces
 * `POST /api/v1/integration-clients/requests`. Creates a `pending` record with
 * no key; ops approve it separately.
 */
export async function handleRequestClient(
  request: Request,
  deps: IntegrationApiDeps,
): Promise<Response> {
  const userAuth = await deps.authenticateUser(request);
  if (!userAuth.ok) return userAuthFailure(userAuth);
  const { user } = userAuth;

  const parsedBody = await readOptionalJson(request);
  if (
    !parsedBody.ok ||
    typeof parsedBody.body !== 'object' ||
    parsedBody.body === null ||
    Array.isArray(parsedBody.body)
  ) {
    return invalidJson();
  }

  // The contact defaults to the requester's account email.
  const parsed = schemaRequestIntegrationClient.safeParse({
    contactEmail: user.email,
    ...(parsedBody.body as Json),
  });
  if (!parsed.success) {
    return integrationJson(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const client = await deps.requestClient(parsed.data, { id: user.id });
    await deps.notifyClientRequested({ client, requester: user });
    // Only what the requester needs back: no key material.
    return integrationJson(
      { slug: client.slug, status: client.status },
      { status: 202 },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === 'TooManyPendingRequestsError'
    ) {
      return integrationJson(
        {
          error:
            'You already have several pending requests. Wait for them to be reviewed.',
        },
        { status: 429 },
      );
    }
    if (isUniqueViolation(error, 'integration_clients_slug_unique')) {
      return integrationJson(
        { error: 'A client with this name already exists. Use another name.' },
        { status: 409 },
      );
    }
    logFailure('record integration client request', {}, error);
    return serverError('Failed to record the request');
  }
}

/** GET clients/me (client key): the calling client's own status and scopes. */
export async function handleGetClientMe(
  request: Request,
  deps: IntegrationApiDeps,
): Promise<Response> {
  const clientAuth = await deps.authenticateClient(request);
  if (!clientAuth.ok) return clientAuthFailure(clientAuth);
  const { slug, name, scopes } = clientAuth.client;
  return integrationJson({
    client: { slug, name, status: 'approved', scopes },
  });
}

// ----------------------------------------------------------------- grants

type ClientAndUser =
  | { ok: true; client: AuthenticatedIntegrationClient; user: IntegrationUser }
  | { ok: false; response: Response };

/** Client key first, then the user token: both are required on clients/me/grants. */
async function authenticateClientAndUser(
  request: Request,
  deps: IntegrationApiDeps,
): Promise<ClientAndUser> {
  const clientAuth = await deps.authenticateClient(request);
  if (!clientAuth.ok) {
    return { ok: false, response: clientAuthFailure(clientAuth) };
  }
  const userAuth = await deps.authenticateUser(request);
  if (!userAuth.ok) return { ok: false, response: userAuthFailure(userAuth) };
  return { ok: true, client: clientAuth.client, user: userAuth.user };
}

/**
 * POST clients/me/grants (client key + user token). Replaces
 * `POST /api/v1/integration-grants`. The client and the person come from the
 * credentials, never from the body. Idempotent per client and person (see
 * `registerIntegrationGrant`). Does not check the wallet signer.
 */
export async function handleRegisterClientGrant(
  request: Request,
  deps: IntegrationApiDeps,
): Promise<Response> {
  const auth = await authenticateClientAndUser(request, deps);
  if (!auth.ok) return auth.response;

  // The body is optional; an empty one grants all of the client's scopes.
  const parsedBody = await readOptionalJson(request);
  if (!parsedBody.ok) return invalidJson();
  const parsed = schemaRegisterIntegrationGrant.safeParse(parsedBody.body);
  if (!parsed.success) {
    return integrationJson(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const scopes = resolveGrantScopes(auth.client.scopes, parsed.data.scopes);
  if (!scopes) {
    return integrationJson(
      { error: 'Requested scopes exceed the scopes of this client' },
      { status: 403 },
    );
  }

  try {
    const grant = await deps.registerGrant({
      clientId: auth.client.id,
      personId: auth.user.id,
      scopes,
    });
    return integrationJson({ grant: toPublicGrant(grant) });
  } catch (error) {
    logFailure('register integration grant', {}, error);
    return serverError('Failed to register the grant');
  }
}

/**
 * GET clients/me/grants (client key + user token): the token user's grants for
 * the calling client only. "Already consented" is an item with `status: active`.
 * Replaces the client view of `GET /api/v1/integration-grants`.
 */
export async function handleListClientGrants(
  request: Request,
  deps: IntegrationApiDeps,
): Promise<Response> {
  const auth = await authenticateClientAndUser(request, deps);
  if (!auth.ok) return auth.response;

  try {
    const grants = await deps.listClientGrants({
      clientId: auth.client.id,
      personId: auth.user.id,
    });
    return integrationJson({ grants: grants.map(toPublicGrant) });
  } catch (error) {
    logFailure('list integration grants', {}, error);
    return serverError('Failed to list grants');
  }
}

/**
 * DELETE clients/me/grants/{id} (client key + user token): the client revokes
 * its own grant for that user. Replaces the client mode of
 * `DELETE /api/v1/integration-grants/{id}`.
 */
export async function handleRevokeClientGrant(
  request: Request,
  { id }: { id: string },
  deps: IntegrationApiDeps,
): Promise<Response> {
  const grantId = parseGrantId(id);
  if (grantId === null) {
    return integrationJson({ error: 'Invalid grant id' }, { status: 400 });
  }
  const auth = await authenticateClientAndUser(request, deps);
  if (!auth.ok) return auth.response;
  return revokeGrant(deps, {
    grantId,
    personId: auth.user.id,
    clientId: auth.client.id,
  });
}

/**
 * GET users/me/grants (user token): all of the user's grants across clients,
 * for the platform's consent screen. Replaces the user view of
 * `GET /api/v1/integration-grants`.
 */
export async function handleListUserGrants(
  request: Request,
  deps: IntegrationApiDeps,
): Promise<Response> {
  const userAuth = await deps.authenticateUser(request);
  if (!userAuth.ok) return userAuthFailure(userAuth);

  try {
    const grants = await deps.listUserGrants({ personId: userAuth.user.id });
    return integrationJson({ grants: grants.map(toPublicGrantWithClient) });
  } catch (error) {
    logFailure('list integration grants', {}, error);
    return serverError('Failed to list grants');
  }
}

/**
 * DELETE users/me/grants/{id} (user token): the user revokes any of their own
 * grants. Replaces the user mode of `DELETE /api/v1/integration-grants/{id}`.
 */
export async function handleRevokeUserGrant(
  request: Request,
  { id }: { id: string },
  deps: IntegrationApiDeps,
): Promise<Response> {
  const grantId = parseGrantId(id);
  if (grantId === null) {
    return integrationJson({ error: 'Invalid grant id' }, { status: 400 });
  }
  const userAuth = await deps.authenticateUser(request);
  if (!userAuth.ok) return userAuthFailure(userAuth);
  return revokeGrant(deps, { grantId, personId: userAuth.user.id });
}

/** Revoking stops the client acting for the user; it does not touch the wallet signer. */
async function revokeGrant(
  deps: IntegrationApiDeps,
  args: { grantId: number; personId: number; clientId?: number },
): Promise<Response> {
  try {
    const revoked = await deps.revokeGrant(args);
    if (!revoked) {
      return integrationJson(
        { error: 'No active grant with that id' },
        { status: 404 },
      );
    }
    return integrationJson({ revoked: true, id: args.grantId });
  } catch (error) {
    logFailure('revoke integration grant', { grantId: args.grantId }, error);
    return serverError('Failed to revoke the grant');
  }
}

// -------------------------------------------------------------------- ops

/** GET ops/clients (ops secret): clients' metadata, never key material. */
export async function handleOpsListClients(
  request: Request,
  deps: IntegrationApiDeps,
): Promise<Response> {
  const denied = deps.authorizeOps(request);
  if (denied) return denied;

  try {
    const { page, pageSize } = parseHttpPaginationParams(new URL(request.url), {
      defaultPageSize: 50,
    });
    const clients = await deps.listClients();
    const offset = (page - 1) * pageSize;
    return integrationJson(
      buildPaginatedResponse(
        clients.slice(offset, offset + pageSize),
        clients.length,
        page,
        pageSize,
      ),
    );
  } catch (error) {
    logFailure('list integration clients', {}, error);
    return serverError('Failed to list integration clients');
  }
}

/**
 * POST ops/clients/{slug}/approve (ops secret): approve a pending client and
 * issue its key, returned by this call only. An optional body `{ scopes }`
 * narrows or edits the requested scopes first.
 */
export async function handleOpsApproveClient(
  request: Request,
  { slug }: { slug: string },
  deps: IntegrationApiDeps,
): Promise<Response> {
  const denied = deps.authorizeOps(request);
  if (denied) return denied;

  const parsedBody = await readOptionalJson(request);
  if (!parsedBody.ok) return invalidJson();
  const parsed = schemaApproveIntegrationClient.safeParse(parsedBody.body);
  if (!parsed.success) {
    return integrationJson(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const issued = await deps.approveClient({
      slug,
      scopes: parsed.data.scopes,
    });
    if (!issued) {
      return integrationJson(
        { error: 'No pending client with that slug' },
        { status: 404 },
      );
    }
    return integrationJson({
      client: issued.client,
      clientKey: issued.plaintext,
      warning:
        'Store this key now — it is not recoverable. Never expose it in client-side code.',
    });
  } catch (error) {
    logFailure('approve integration client', { slug }, error);
    return serverError('Failed to approve integration client');
  }
}

/** POST ops/clients/{slug}/revoke (ops secret): reject a pending client or revoke an approved one. */
export async function handleOpsRevokeClient(
  request: Request,
  { slug }: { slug: string },
  deps: IntegrationApiDeps,
): Promise<Response> {
  const denied = deps.authorizeOps(request);
  if (denied) return denied;

  try {
    const revoked = await deps.revokeClient({ slug });
    if (!revoked) {
      return integrationJson(
        { error: 'No pending or approved client with that slug' },
        { status: 404 },
      );
    }
    return integrationJson({ revoked: true, slug });
  } catch (error) {
    logFailure('revoke integration client', { slug }, error);
    return serverError('Failed to revoke integration client');
  }
}

/**
 * POST ops/clients/{slug}/rotate-key (ops secret): hard cut-over, the old key
 * stops working immediately. The new key is returned by this call only.
 */
export async function handleOpsRotateClientKey(
  request: Request,
  { slug }: { slug: string },
  deps: IntegrationApiDeps,
): Promise<Response> {
  const denied = deps.authorizeOps(request);
  if (denied) return denied;

  try {
    const issued = await deps.rotateClientKey({ slug });
    if (!issued) {
      return integrationJson(
        { error: 'No approved client with that slug' },
        { status: 404 },
      );
    }
    return integrationJson({
      client: issued.client,
      clientKey: issued.plaintext,
      warning:
        'Store this key now — it is not recoverable. The previous key no longer works.',
    });
  } catch (error) {
    logFailure('rotate integration client key', { slug }, error);
    return serverError('Failed to rotate integration client key');
  }
}
