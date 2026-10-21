import {
  CLIENT_LOGO_MAX_BYTES,
  CLIENT_LOGO_REJECTION_MESSAGE,
  inspectClientLogo,
  visibleClientLogoUrl,
  type ClientLogoType,
} from '../integration-client/logo';
import type { IntegrationClientSummary } from '../integration-client/types';
import { schemaApproveIntegrationClient } from '../integration-client/validation';
import {
  invalidJson,
  logFailure,
  readOptionalJson,
  serverError,
  userAuthFailure,
  type IntegrationUser,
  type IssuedKey,
  type UserAuthResult,
} from './handlers';
import { integrationJson } from './response-headers';

/**
 * The developer area's needs (#2515 client registration form): a person lists
 * their own client requests and uploads a logo; a reviewer sees every request
 * and answers it. Registration itself is `handleRequestClient` (clients/requests)
 * and approving or revoking calls the same core functions the `ops/` routes do.
 */
export type IntegrationDeveloperDeps = {
  authenticateUser(request: Request): Promise<UserAuthResult>;
  /** Who may review: decided by the app (an allowlist), never by the request. */
  isReviewer(user: IntegrationUser): boolean;
  listClientsForPerson(args: {
    personId: number;
  }): Promise<IntegrationClientSummary[]>;
  listClients(): Promise<IntegrationClientSummary[]>;
  findClientBySlug(args: {
    slug: string;
  }): Promise<IntegrationClientSummary | null>;
  /** Put the checked image in Hypha's file storage; returns its public URL. */
  storeLogo(args: {
    slug: string;
    bytes: Uint8Array;
    type: ClientLogoType;
    mime: string;
  }): Promise<string>;
  setLogo(args: {
    slug: string;
    requestedByPersonId: number;
    logoUrl: string;
  }): Promise<boolean>;
  approveClient(args: {
    slug: string;
    scopes?: IntegrationClientSummary['scopes'];
  }): Promise<IssuedKey | null>;
  revokeClient(args: { slug: string }): Promise<boolean>;
  rotateClientKey(args: { slug: string }): Promise<IssuedKey | null>;
};

type LogoState = 'none' | 'in_review' | 'approved';

const logoState = (client: IntegrationClientSummary): LogoState =>
  !client.logoUrl
    ? 'none'
    : visibleClientLogoUrl(client)
    ? 'approved'
    : 'in_review';

/**
 * What the owner sees of their own request. An unapproved logo is reported as
 * "in review" and its address is not included.
 */
function toOwnerClient(client: IntegrationClientSummary) {
  return {
    slug: client.slug,
    name: client.name,
    description: client.description,
    status: client.status,
    scopes: client.scopes,
    allowedOrigins: client.allowedOrigins,
    keyPrefix: client.keyPrefix,
    createdAt: client.createdAt,
    logo: { state: logoState(client), url: visibleClientLogoUrl(client) },
  };
}

/** What a reviewer sees: also the pending logo itself, and the contact. */
function toReviewClient(client: IntegrationClientSummary) {
  return {
    ...toOwnerClient(client),
    contactEmail: client.contactEmail,
    logo: { state: logoState(client), url: client.logoUrl },
  };
}

const notFound = () => integrationJson({ error: 'Not found' }, { status: 404 });

async function authenticateReviewer(
  request: Request,
  deps: IntegrationDeveloperDeps,
) {
  const auth = await deps.authenticateUser(request);
  if (!auth.ok) return { ok: false, response: userAuthFailure(auth) } as const;
  if (!deps.isReviewer(auth.user)) {
    return {
      ok: false,
      response: integrationJson(
        { error: 'Reviewing client requests is not allowed for this account' },
        { status: 403 },
      ),
    } as const;
  }
  return { ok: true, user: auth.user } as const;
}

/** GET users/me/clients (user token): the caller's own client requests. */
export async function handleListMyClients(
  request: Request,
  deps: IntegrationDeveloperDeps,
): Promise<Response> {
  const auth = await deps.authenticateUser(request);
  if (!auth.ok) return userAuthFailure(auth);
  try {
    const clients = await deps.listClientsForPerson({
      personId: auth.user.id,
    });
    return integrationJson({
      items: clients.map(toOwnerClient),
      reviewer: deps.isReviewer(auth.user),
    });
  } catch (error) {
    logFailure('list own integration clients', {}, error);
    return serverError('Failed to list your clients');
  }
}

/**
 * POST users/me/clients/{slug}/logo (user token, multipart field `logo`). Only
 * the requester, only while the request is pending. The file is judged by its
 * bytes (type, size, shape) before anything is stored.
 */
export async function handleUploadClientLogo(
  request: Request,
  { slug }: { slug: string },
  deps: IntegrationDeveloperDeps,
): Promise<Response> {
  const auth = await deps.authenticateUser(request);
  if (!auth.ok) return userAuthFailure(auth);

  try {
    const client = await deps.findClientBySlug({ slug });
    // Unknown, someone else's, or already answered: all look the same.
    if (
      !client ||
      client.requestedByPersonId !== auth.user.id ||
      client.status !== 'pending'
    ) {
      return notFound();
    }

    const declared = Number(request.headers.get('content-length') ?? 0);
    if (declared > CLIENT_LOGO_MAX_BYTES + 64 * 1024) {
      return integrationJson(
        { error: CLIENT_LOGO_REJECTION_MESSAGE.too_large },
        { status: 413 },
      );
    }

    let file: unknown;
    try {
      file = (await request.formData()).get('logo');
    } catch {
      return integrationJson(
        { error: 'Send the logo as multipart form data' },
        { status: 400 },
      );
    }
    if (!(file instanceof Blob)) {
      return integrationJson(
        { error: 'Send one image in the "logo" field' },
        { status: 400 },
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const checked = inspectClientLogo(bytes);
    if (!checked.ok) {
      return integrationJson(
        { error: CLIENT_LOGO_REJECTION_MESSAGE[checked.reason] },
        { status: checked.reason === 'too_large' ? 413 : 400 },
      );
    }

    const logoUrl = await deps.storeLogo({
      slug,
      bytes,
      type: checked.type,
      mime: checked.mime,
    });
    const saved = await deps.setLogo({
      slug,
      requestedByPersonId: auth.user.id,
      logoUrl,
    });
    // Answered between the check and the write: the logo is not attached.
    if (!saved) return notFound();
    return integrationJson({ logo: { state: 'in_review' } }, { status: 201 });
  } catch (error) {
    logFailure('store integration client logo', { slug }, error);
    return serverError('Failed to store the logo');
  }
}

/** GET reviewer/clients (user token + reviewer): every request, with its pending logo. */
export async function handleReviewListClients(
  request: Request,
  deps: IntegrationDeveloperDeps,
): Promise<Response> {
  const auth = await authenticateReviewer(request, deps);
  if (!auth.ok) return auth.response;
  try {
    const clients = await deps.listClients();
    return integrationJson({ items: clients.map(toReviewClient) });
  } catch (error) {
    logFailure('list integration clients for review', {}, error);
    return serverError('Failed to list integration clients');
  }
}

/**
 * POST reviewer/clients/{slug}/approve: approves the client and, with it, its
 * logo. The key is in this response only.
 */
export async function handleReviewApproveClient(
  request: Request,
  { slug }: { slug: string },
  deps: IntegrationDeveloperDeps,
): Promise<Response> {
  const auth = await authenticateReviewer(request, deps);
  if (!auth.ok) return auth.response;

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
      client: toReviewClient(issued.client),
      clientKey: issued.plaintext,
    });
  } catch (error) {
    logFailure('approve integration client (review)', { slug }, error);
    return serverError('Failed to approve integration client');
  }
}

/** POST reviewer/clients/{slug}/revoke: reject a pending client or revoke an approved one. */
export async function handleReviewRevokeClient(
  request: Request,
  { slug }: { slug: string },
  deps: IntegrationDeveloperDeps,
): Promise<Response> {
  const auth = await authenticateReviewer(request, deps);
  if (!auth.ok) return auth.response;
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
    logFailure('revoke integration client (review)', { slug }, error);
    return serverError('Failed to revoke integration client');
  }
}

/** POST reviewer/clients/{slug}/rotate-key: the old key stops working at once. */
export async function handleReviewRotateClientKey(
  request: Request,
  { slug }: { slug: string },
  deps: IntegrationDeveloperDeps,
): Promise<Response> {
  const auth = await authenticateReviewer(request, deps);
  if (!auth.ok) return auth.response;
  try {
    const issued = await deps.rotateClientKey({ slug });
    if (!issued) {
      return integrationJson(
        { error: 'No approved client with that slug' },
        { status: 404 },
      );
    }
    return integrationJson({
      client: toReviewClient(issued.client),
      clientKey: issued.plaintext,
    });
  } catch (error) {
    logFailure('rotate integration client key (review)', { slug }, error);
    return serverError('Failed to rotate integration client key');
  }
}
