import { findPersonBySub } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { PrivyClient } from '@privy-io/node';

export async function resolvePrivyUserId(authToken: string): Promise<string> {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error('Privy server credentials are not configured.');
  }
  const privy = new PrivyClient({ appId, appSecret });
  const { user_id } = await privy.utils().auth().verifyAuthToken(authToken);
  if (!user_id) throw new Error('Could not resolve Privy user id from token.');
  return user_id;
}

export async function resolveActorPerson(authToken: string) {
  const privyUserId = await resolvePrivyUserId(authToken);
  const person = await findPersonBySub({ sub: privyUserId }, { db });
  if (!person) {
    throw new Error(
      'No person profile is linked to this account yet. Complete profile setup first.',
    );
  }
  return { person, privyUserId };
}

export function hasExplicitConfirmation(
  lastUserText: string | null | undefined,
  token: string,
): boolean {
  if (!lastUserText) return false;
  const normalized = lastUserText.toLowerCase();
  return (
    normalized.includes('confirm') && normalized.includes(token.toLowerCase())
  );
}
