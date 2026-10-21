import {
  CLIENT_LOGO_MAX_BYTES,
  CLIENT_LOGO_REJECTION_MESSAGE,
  inspectClientLogo,
  visibleClientLogoUrl,
  type ClientLogoType,
} from '../integration-client/logo';
import type { IntegrationClientSummary } from '../integration-client/types';
import {
  logFailure,
  serverError,
  type IssuedKey,
  userAuthFailure,
  type UserAuthResult,
} from './handlers';
import { integrationJson } from './response-headers';

/**
 * The developer area's needs (#2515 client registration form): a person lists
 * their own client requests and uploads a logo. Registration itself is
 * `handleRequestClient` (clients/requests); approving stays with the `ops/` routes.
 */
export type IntegrationDeveloperDeps = {
  authenticateUser(request: Request): Promise<UserAuthResult>;
  listClientsForPerson(args: {
    personId: number;
  }): Promise<IntegrationClientSummary[]>;
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
  /** Same core function as `ops/.../rotate-key`; null when not approved. */
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

const notFound = () => integrationJson({ error: 'Not found' }, { status: 404 });

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

/**
 * POST users/me/clients/{slug}/rotate-key (user token): the requester of an
 * approved client gets a new key; the old one stops working at once. The key is
 * returned by this call only (only its digest is stored).
 */
export async function handleRotateMyClientKey(
  request: Request,
  { slug }: { slug: string },
  deps: IntegrationDeveloperDeps,
): Promise<Response> {
  const auth = await deps.authenticateUser(request);
  if (!auth.ok) return userAuthFailure(auth);

  try {
    const client = await deps.findClientBySlug({ slug });
    // Unknown, someone else's, pending or revoked: all look the same.
    if (
      !client ||
      client.requestedByPersonId !== auth.user.id ||
      client.status !== 'approved'
    ) {
      return notFound();
    }
    const issued = await deps.rotateClientKey({ slug });
    if (!issued) return notFound();
    return integrationJson({
      slug,
      keyPrefix: issued.client.keyPrefix,
      clientKey: issued.plaintext,
      warning:
        'Store this key now - it is not recoverable. The previous key no longer works.',
    });
  } catch (error) {
    logFailure('rotate own integration client key', { slug }, error);
    return serverError('Failed to rotate the key');
  }
}
