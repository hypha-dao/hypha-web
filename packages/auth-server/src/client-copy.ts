import type { ClientKind } from './consent';

/**
 * Which message tells the person who is asking, chosen by how the app was identified. The words
 * live in the app's message files (namespace AuthServer, consent.client.<key>); the values are
 * filled in there. Nothing here is shown without going through that namespace.
 * - cimd: the host of the client id is proven (Hypha read the app's metadata from it).
 * - dcr: the app registered itself and chose its name; the name is a claim nobody checked.
 * - registered: pre-registered with Hypha; shows the app's own host when it has one.
 */
export type ClientCopyKey =
  | 'cimd'
  | 'dcr'
  | 'registered'
  | 'registeredWithHost';

export function describeClient(input: {
  kind: ClientKind;
  name: string;
  /** Proven host for `cimd` (the host of its client id); ignored for `dcr`. */
  host: string;
  redirectHost: string;
}): {
  key: ClientCopyKey;
  values: { name: string; host: string; redirectHost: string };
} {
  const { kind, name, host, redirectHost } = input;
  const key: ClientCopyKey =
    kind === 'cimd'
      ? 'cimd'
      : kind === 'dcr'
      ? 'dcr'
      : host
      ? 'registeredWithHost'
      : 'registered';
  // A dcr app has no proven host, so none is passed on.
  return {
    key,
    values: { name, host: kind === 'dcr' ? '' : host, redirectHost },
  };
}
