import 'server-only';

import { PrivyClient, type LinkedAccount } from '@privy-io/node';
import { eq } from 'drizzle-orm';

import { isAdminEmail } from './config';
import { campaignMembers, db, type CampaignMember } from './db';

/**
 * Identity for the campaign comes from Privy, and from nowhere else.
 *
 * The campaign shares Hypha's Privy app, so a contributor who also uses Hypha
 * carries the same `sub` in both systems and the two can be correlated later.
 * What the campaign does *not* do is read or write Hypha's `people` table: it
 * keeps its own `campaign_members` row, so no bug here can reach the platform
 * database. Display details from a matching Hypha profile are fetched
 * read-only over the public API — see hypha-profiles.ts.
 */

export type Viewer = {
  member: CampaignMember;
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
    // nothing new about them this time. `upsertMember` backfills, so someone
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

async function upsertMember(
  identity: VerifiedIdentity,
  hints: IdentityHints,
): Promise<CampaignMember> {
  const { privyUserId, email, walletAddress } = identity;
  const name = identity.name ?? hints.name?.trim() ?? null;

  const existing = await db.query.campaignMembers.findFirst({
    where: eq(campaignMembers.sub, privyUserId),
  });

  if (existing) {
    // Backfill only, so a value a member has already corrected is not
    // clobbered by whatever the campaign page happens to know this request.
    const patch: Partial<CampaignMember> = {};
    if (!existing.email && email) patch.email = email;
    if (!existing.walletAddress && walletAddress) {
      patch.walletAddress = walletAddress;
    }
    if (!existing.name && name) patch.name = name;

    if (Object.keys(patch).length === 0) return existing;

    const [updated] = await db
      .update(campaignMembers)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(campaignMembers.id, existing.id))
      .returning();
    return updated ?? existing;
  }

  const [created] = await db
    .insert(campaignMembers)
    .values({ sub: privyUserId, email, walletAddress, name })
    .onConflictDoNothing({ target: campaignMembers.sub })
    .returning();

  if (created) return created;

  // Two first requests raced; the other one won.
  const raced = await db.query.campaignMembers.findFirst({
    where: eq(campaignMembers.sub, privyUserId),
  });
  if (!raced) throw new AuthError(500, 'Could not create member record');
  return raced;
}

/** Verifies the caller and returns their member row, creating it on first sign-in. */
export async function requireViewer(
  request: Request,
  hints: IdentityHints = {},
): Promise<Viewer> {
  const token = readBearerToken(request);
  if (!token) throw new AuthError(401, 'Sign in to continue');

  const identity = await verifyToken(token);
  const member = await upsertMember(identity, hints);

  return {
    member,
    privyUserId: identity.privyUserId,
    // Prefer the address Privy just vouched for; the stored one is only a
    // fallback for the request where the Privy user lookup failed.
    isAdmin: isAdminEmail(identity.email ?? member.email),
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
