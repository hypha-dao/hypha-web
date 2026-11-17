/** Human-readable consent copy per scope (product default, reported for confirmation). */
const COPY: Record<
  string,
  { title: string; detail: string; unverifiedWarning?: string }
> = {
  'spaces:read': {
    title: 'Read Hypha spaces',
    detail:
      'View the spaces you can see on Hypha: their details, members and public activity.',
  },
  'agreements:vote': {
    title: 'Prepare votes for you to approve',
    detail:
      'Ask you to vote on proposals in your spaces. Nothing is cast until you approve each vote on Hypha and sign it with your wallet.',
    unverifiedWarning:
      'Hypha has not approved this app. If you allow this, it can ask you to vote in your name. Allow it only if you trust this app and started this yourself.',
  },
  offline_access: {
    title: 'Stay connected',
    detail:
      'Keep this app connected without asking you to sign in again, until you disconnect it.',
  },
};

export function describeScope(scope: string): {
  title: string;
  detail: string;
  unverifiedWarning?: string;
} {
  return COPY[scope] ?? { title: scope, detail: 'An unrecognised permission.' };
}
