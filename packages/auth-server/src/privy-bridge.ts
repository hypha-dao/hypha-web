import { APIError, createAuthEndpoint } from 'better-auth/api';
import { setSessionCookie } from 'better-auth/cookies';
import { z } from 'zod';
import type { PersonRecord } from './db';
import type { PrivyTokenVerifier } from './privy';

type Deps = {
  verifyPrivyToken: PrivyTokenVerifier;
  gate: (personId: string) => boolean;
  findPerson: (sub: string) => Promise<PersonRecord | null>;
};

/**
 * Sign-in bridge: the login page sends the Privy access token once; the server verifies it,
 * maps it to the Hypha person (sub = Privy user id = people.sub) and opens an authorization
 * server session. The Privy token is not stored, logged, or passed on.
 */
export function createPrivyBridge({
  verifyPrivyToken,
  gate,
  findPerson,
}: Deps) {
  return {
    id: 'privy-bridge',
    endpoints: {
      signInWithPrivy: createAuthEndpoint(
        '/privy/sign-in',
        {
          method: 'POST',
          body: z.object({
            privyToken: z.string().min(1).max(8192),
            oauth_query: z.string().optional(),
          }),
        },
        async (ctx) => {
          const verified = await verifyPrivyToken(ctx.body.privyToken).catch(
            () => null,
          );
          if (!verified?.ok) {
            throw new APIError('UNAUTHORIZED', { message: 'Sign-in failed' });
          }
          const sub = verified.userId;
          if (!gate(sub)) {
            throw new APIError('FORBIDDEN', {
              error: 'access_denied',
              message: 'This account is not enabled for this service.',
            });
          }
          const person = await findPerson(sub);
          if (!person) {
            throw new APIError('FORBIDDEN', {
              error: 'access_denied',
              message:
                'Finish creating your Hypha profile first, then try again.',
            });
          }

          const adapter = ctx.context.internalAdapter;
          let user = await adapter.findUserById(sub);
          if (!user) {
            user = await adapter.createUser(
              {
                id: sub,
                name:
                  [person.name, person.surname].filter(Boolean).join(' ') ||
                  sub,
                email: person.email ?? `${sub}@users.invalid`,
                emailVerified: !!person.email,
              },
              // forceAllowId inside the adapter keeps the supplied id (Privy user id).
              undefined as never,
            );
          }
          const session = await adapter.createSession(user.id);
          await setSessionCookie(ctx, { session, user });
          return ctx.json({ ok: true });
        },
      ),
    },
  } as const;
}
