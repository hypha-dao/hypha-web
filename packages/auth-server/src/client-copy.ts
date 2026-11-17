import type { ClientKind } from './consent';

/** Shown when the signed login/consent query has run out (see AUTH_QUERY_TTL_SECONDS). */
export const APPROVAL_EXPIRED_MESSAGE =
  'This approval expired. Go back to the app and start again.';

export type CopySegment = { text: string; strong?: boolean };

/**
 * The warning shown above the permissions, as plain text segments (the page renders them as
 * escaped text; nothing here is markup). It says what Hypha actually knows about the app:
 * - registered: Hypha registered it (still shown as unverified until a verification flow exists);
 * - cimd: the app is identified by an https address that served its own details to Hypha, so the
 *   host is proven, but nothing else about it is;
 * - dcr: the app registered itself and chose its name; the name is a claim nobody checked.
 */
export function describeClient(input: {
  kind: ClientKind;
  name: string;
  /** Proven host for `cimd` (the host of its client id); ignored for `dcr`. */
  host: string;
  redirectHost: string;
}): CopySegment[] {
  const { kind, name, host, redirectHost } = input;
  const back: CopySegment[] = [
    { text: ' After you approve, you are sent back to ' },
    { text: redirectHost, strong: true },
    { text: '. Only approve apps you started yourself.' },
  ];
  if (kind === 'cimd') {
    return [
      { text: 'Hypha has not approved this app. It is run from ' },
      { text: host, strong: true },
      {
        text: ': Hypha read its details from that address, so the address is real. Nothing else about the app has been checked. It calls itself ',
      },
      { text: name, strong: true },
      { text: '.' },
      ...back,
    ];
  }
  if (kind === 'dcr') {
    return [
      {
        text: 'Hypha has not approved this app. It registered itself and chose its own name, ',
      },
      { text: name, strong: true },
      {
        text: ', which Hypha has not checked: anyone can register any name, and Hypha cannot tell who is behind this app.',
      },
      ...back,
    ];
  }
  return [
    { text: 'Hypha has not verified this app. It calls itself ' },
    { text: name, strong: true },
    ...(host
      ? [{ text: ' and identifies itself from ' }, { text: host, strong: true }]
      : []),
    { text: '.' },
    ...back,
  ];
}
