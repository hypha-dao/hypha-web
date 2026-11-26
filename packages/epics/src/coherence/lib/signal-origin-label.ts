import type { OriginKind, OriginView } from '@hypha-platform/core/client';

const ORIGIN_LABEL_KEYS = {
  app: 'signalOriginApp',
  hypha_assistant: 'signalOriginAssistant',
  mcp_client: 'signalOriginMcpClient',
  api_client: 'signalOriginApiClient',
  space_key: 'signalOriginSpaceKey',
  hypha_intelligence: 'signalOriginJob',
  hypha_platform: 'signalOriginPlatform',
} as const satisfies Record<Exclude<OriginKind, 'unknown'>, string>;

/** Longest client name shown next to the kind; the stored one is capped at 120. */
const CLIENT_NAME_MAX = 60;

type Translate = (key: string, values?: Record<string, string>) => string;

/**
 * The text of a signal's Origin field (#2724): the path that wrote it, plus the client's own
 * name for a client path and the source space for a relay. `null` for signals written before
 * the origin was recorded: nothing is shown for those.
 */
export function signalOriginLabel(
  origin: OriginView | null | undefined,
  t: Translate,
  { relaySourceLabel }: { relaySourceLabel?: string | null } = {},
): string | null {
  if (!origin || origin.kind === 'unknown') return null;
  const key = ORIGIN_LABEL_KEYS[origin.kind];
  if (!key) return null;
  const parts = [t(key)];
  const clientName = origin.clientLabel?.trim();
  if (clientName && origin.kind !== 'hypha_intelligence') {
    const chars = Array.from(clientName);
    parts.push(
      chars.length > CLIENT_NAME_MAX
        ? `${chars.slice(0, CLIENT_NAME_MAX - 1).join('')}…`
        : clientName,
    );
  }
  if (relaySourceLabel) {
    parts.push(t('signalOriginRelayedFrom', { space: relaySourceLabel }));
  }
  return parts.join(' · ');
}
