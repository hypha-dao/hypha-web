import { findPersonBySub } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { verifyPrivyAuthToken } from '../privy-auth';

export async function resolvePrivyUserId(authToken: string): Promise<string> {
  const result = await verifyPrivyAuthToken(authToken);
  if (!result.valid) {
    throw new Error(`Authentication failed: ${result.reason}`);
  }
  const [, payloadB64] = authToken.split('.');
  if (!payloadB64) {
    throw new Error('Could not resolve token payload.');
  }
  const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
  const payload = JSON.parse(payloadJson) as { sub?: unknown };
  if (!payload.sub || typeof payload.sub !== 'string') {
    throw new Error('Could not resolve Privy user id from token.');
  }
  return payload.sub;
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

export { hasExplicitConfirmation } from './onboarding-confirmation';
