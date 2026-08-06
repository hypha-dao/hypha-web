import 'server-only';

import { PrivyClient, type LinkedAccount } from '@privy-io/node';
import { eq } from 'drizzle-orm';
import { db, people, type Person } from '@hypha-platform/storage-postgres';

import { isAdminEmail } from './config';

/**
 * Identity for the campaign is Hypha's identity: the same Privy app, so the
 * same `sub`, resolving to the same row in `people`. Someone who already has a
 * Hypha profile keeps it; a first-time contributor gets a minimal one created.
 */

export type Viewer = {
  person: Person;
  privyUserId: string;
  isAdmin: boolean;
};

export class AuthError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

let cachedClient: PrivyClient | null = null;

function getPrivyClient(): PrivyClient {
  if (cachedClient) return cachedClient;

  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  if (!appId || !appSecret) {
    throw new AuthError(
      500,
      'Privy is not configured (NEXT_PUBLIC_PRIVY_APP_ID, PRIVY_APP_SECRET)',
    );
  }

  cachedClient = new PrivyClient({ appId, appSecret });
  return cachedClient;
}

export function readBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header?.toLowerCase().startsWith('bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

/**
 * What Privy itself vouches for. The email in particular must come from here
 * rather than from the request body: admin rights are decided by email, so a
 * caller who could name their own would be a caller who could make themselves
 * an admin.
 */
type VerifiedIdentity = {
  privyUserId: string;
  email: string | null;
  walletAddress: string | null;
  name: string | null;
};

async function verifyToken(token: string): Promise<VerifiedIdentity> {
  const privy = getPrivyClient();

  let privyUserId: string;
  try {
    const claims = await privy.utils().auth().verifyAuthToken(token);
    privyUserId = claims.user_id;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    console.warn('Privy token verification failed:', message);
    throw new AuthError(401, 'Invalid or expired session');
  }

  let accounts: LinkedAccount[] = [];
  try {
    const user = await privy.users()._get(privyUserId);
    accounts = user.linked_accounts ?? [];
  } catch (error) {
    // A lookup failure must not lock a member out — it only means we learn
    // nothing new about them this time. `upsertPerson` backfills, so a person
    // who already exists keeps the email and wallet they have.
    const message = error instanceof Error ? error.message : 'unknown error';
    console.warn(`Could not load Privy user ${privyUserId}:`, message);
  }

  const emailAccount = accounts.find((a) => a.type === 'email');
  const googleAccount = accounts.find((a) => a.type === 'google_oauth');
  const walletAccount = accounts.find(
    (a) => a.type === 'wallet' && a.chain_type === 'ethereum',
  );

  return {
    privyUserId,
    email:
      (emailAccount?.address ?? googleAccount?.email)?.toLowerCase() ?? null,
    walletAddress: walletAccount?.address ?? null,
    name: googleAccount?.name ?? null,
  };
}

/**
 * Non-identifying extras the client may pass — never used for authorisation.
 */
export type IdentityHints = {
  name?: string | null;
};

function slugify(seed: string): string {
  const base = seed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  return `${base || 'member'}-${Math.random().toString(36).slice(2, 8)}`;
}

async function upsertPerson(
  identity: VerifiedIdentity,
  hints: IdentityHints,
): Promise<Person> {
  const { privyUserId, email, walletAddress: address } = identity;
  const name = identity.name ?? hints.name?.trim() ?? null;

  const existing = await db.query.people.findFirst({
    where: eq(people.sub, privyUserId),
  });

  if (existing) {
    // Backfill only. A Hypha profile edited by its owner must not be
    // overwritten by whatever the campaign page happens to know.
    const patch: Partial<Person> = {};
    if (!existing.email && email) patch.email = email;
    if (!existing.address && address) patch.address = address;
    if (!existing.name && name) patch.name = name;

    if (Object.keys(patch).length === 0) return existing;

    const [updated] = await db
      .update(people)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(people.id, existing.id))
      .returning();
    return updated ?? existing;
  }

  const [created] = await db
    .insert(people)
    .values({
      sub: privyUserId,
      email,
      address,
      name,
      slug: slugify(email?.split('@')[0] ?? 'member'),
    })
    .returning();

  if (!created) throw new AuthError(500, 'Could not create person record');
  return created;
}

/** Verifies the caller and returns their person row, creating it on first sign-in. */
export async function requireViewer(
  request: Request,
  hints: IdentityHints = {},
): Promise<Viewer> {
  const token = readBearerToken(request);
  if (!token) throw new AuthError(401, 'Sign in to continue');

  const identity = await verifyToken(token);
  const person = await upsertPerson(identity, hints);

  return {
    person,
    privyUserId: identity.privyUserId,
    isAdmin: isAdminEmail(person.email),
  };
}

export async function requireAdmin(request: Request): Promise<Viewer> {
  const viewer = await requireViewer(request);
  if (!viewer.isAdmin) {
    throw new AuthError(403, 'This area is limited to the Regen Sydney team');
  }
  return viewer;
}

/** Like `requireViewer`, but returns null for signed-out callers. */
export async function optionalViewer(request: Request): Promise<Viewer | null> {
  if (!readBearerToken(request)) return null;
  try {
    return await requireViewer(request);
  } catch (error) {
    if (error instanceof AuthError && error.status === 401) return null;
    throw error;
  }
}
