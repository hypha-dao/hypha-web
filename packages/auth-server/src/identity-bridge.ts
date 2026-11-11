import { APIError, createAuthEndpoint } from 'better-auth/api';
import { setSessionCookie } from 'better-auth/cookies';
import { z } from 'zod';
import type { PersonRecord } from './db';
import type { ProviderRegistry } from './providers';

type Deps = {
  providers: ProviderRegistry;
  gate: (personId: string) => boolean;
  resolvePerson: (
    provider: string,
    providerUserId: string,
  ) => Promise<PersonRecord | null>;
};

/**
 * Sign-in bridge: the login page sends the provider's access token once; the server verifies
 * it with that provider, maps the provider account to the Hypha person (sub = people.sub) and
 * opens an authorization server session. The provider token is not stored, logged, or passed on.
 */
export function createIdentityBridge({ providers, gate, resolvePerson }: Deps) {
  return {
    id: 'identity-bridge',
    endpoints: {
      signInWithProvider: createAuthEndpoint(
        '/provider/sign-in',
        {
          method: 'POST',
          body: z.object({
            provider: z.string().min(1).max(32),
            token: z.string().min(1).max(8192),
            oauth_query: z.string().optional(),
          }),
        },
        async (ctx) => {
          const verify = Object.hasOwn(providers, ctx.body.provider)
            ? providers[ctx.body.provider]
            : undefined;
          if (!verify) {
            throw new APIError('BAD_REQUEST', { message: 'Unknown provider' });
          }
          const verified = await verify(ctx.body.token).catch(() => null);
          if (!verified?.ok) {
            throw new APIError('UNAUTHORIZED', { message: 'Sign-in failed' });
          }
          const person = await resolvePerson(
            ctx.body.provider,
            verified.providerUserId,
          );
          if (!person) {
            throw new APIError('FORBIDDEN', {
              error: 'access_denied',
              message:
                'Finish creating your Hypha profile first, then try again.',
            });
          }
          // The allowlist is of person ids (people.sub), whatever the provider.
          const sub = person.sub;
          if (!gate(sub)) {
            throw new APIError('FORBIDDEN', {
              error: 'access_denied',
              message: 'This account is not enabled for this service.',
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
              // forceAllowId inside the adapter keeps the supplied id (the person's sub).
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
