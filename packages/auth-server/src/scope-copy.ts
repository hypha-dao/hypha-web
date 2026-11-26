/**
 * Which message the consent page shows for a scope. The words live in the app's message files
 * (namespace AuthServer, scopes.<key>); this file only says which entry a scope uses and whether
 * it carries the stronger warning for clients that are not pre-approved.
 */
export type ScopeCopyKey =
  | 'spacesRead'
  | 'agreementsVote'
  | 'signalsWrite'
  | 'offlineAccess'
  | 'unknown';

const KEYS: Record<string, ScopeCopyKey> = {
  'spaces:read': 'spacesRead',
  'agreements:vote': 'agreementsVote',
  'signals:write': 'signalsWrite',
  offline_access: 'offlineAccess',
};

/** Scopes whose message has a `warning` entry (shown for write scopes of unapproved clients). */
const HAS_WARNING = new Set<ScopeCopyKey>(['agreementsVote', 'signalsWrite']);

export function describeScope(scope: string): {
  key: ScopeCopyKey;
  hasWarning: boolean;
} {
  const key = Object.hasOwn(KEYS, scope) ? KEYS[scope]! : 'unknown';
  return { key, hasWarning: HAS_WARNING.has(key) };
}
