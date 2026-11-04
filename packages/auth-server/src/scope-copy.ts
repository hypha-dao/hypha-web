/** Human-readable consent copy per scope (product default, reported for confirmation). */
const COPY: Record<string, { title: string; detail: string }> = {
  'spaces:read': {
    title: 'Read Hypha spaces',
    detail:
      'View the spaces you can see on Hypha: their details, members and public activity.',
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
} {
  return COPY[scope] ?? { title: scope, detail: 'An unrecognised permission.' };
}
