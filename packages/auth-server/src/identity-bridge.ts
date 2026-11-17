import { createHash } from 'node:crypto';
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

/** Unique per person, never deliverable (the .invalid TLD is reserved). */
export function syntheticEmail(sub: string): string {
  // A hash, not the id: the column is unique, and the library may fold the case of an address.
  return `${createHash('sha256').update(sub).digest('hex')}@users.invalid`;
}

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
              // Machine-readable, so the page can word it in the person's language.
              code: 'no_profile',
              message:
                'Finish creating your Hypha profile first, then try again.',
            });
          }
          // The allowlist is of person ids (people.sub), whatever the provider.
          const sub = person.sub;
          if (!gate(sub)) {
            throw new APIError('FORBIDDEN', {
              error: 'access_denied',
              code: 'not_enabled',
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
                // as_user.email is unique and nothing here reads it. The person's real address is
                // not copied: two people sharing one address would make the second first sign-in
                // fail, and the address would only be one more copy of personal data.
                email: syntheticEmail(sub),
                emailVerified: false,
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
