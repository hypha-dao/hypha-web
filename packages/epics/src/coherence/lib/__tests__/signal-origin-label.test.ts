import { describe, expect, it } from 'vitest';
import type { OriginView } from '@hypha-platform/core/client';
import { signalOriginLabel } from '../signal-origin-label';

const en: Record<string, string> = {
  signalOriginApp: 'Hypha app',
  signalOriginAssistant: 'Hypha AI assistant',
  signalOriginMcpClient: 'AI client',
  signalOriginApiClient: 'Connected app',
  signalOriginSpaceKey: 'Community app',
  signalOriginJob: 'Hypha Intelligence',
  signalOriginPlatform: 'Hypha platform',
  signalOriginRelayedFrom: 'relayed from {space}',
};
const t = (key: string, values?: Record<string, string>) =>
  (en[key] ?? key).replace('{space}', values?.space ?? '');
const origin = (
  kind: OriginView['kind'],
  clientLabel: string | null = null,
): OriginView => ({ kind, clientLabel });

describe('signalOriginLabel (#2724)', () => {
  it('names each recorded path', () => {
    expect(signalOriginLabel(origin('app'), t)).toBe('Hypha app');
    expect(signalOriginLabel(origin('hypha_assistant'), t)).toBe(
      'Hypha AI assistant',
    );
    expect(signalOriginLabel(origin('hypha_platform'), t)).toBe(
      'Hypha platform',
    );
  });

  it('adds the client name for client paths, not for a job', () => {
    expect(signalOriginLabel(origin('mcp_client', 'Claude'), t)).toBe(
      'AI client · Claude',
    );
    expect(signalOriginLabel(origin('space_key', 'acaw-contest'), t)).toBe(
      'Community app · acaw-contest',
    );
    expect(signalOriginLabel(origin('api_client', null), t)).toBe(
      'Connected app',
    );
    expect(
      signalOriginLabel(origin('hypha_intelligence', 'signal-orchestrator'), t),
    ).toBe('Hypha Intelligence');
  });

  it('shortens a long client name', () => {
    const label = signalOriginLabel(origin('mcp_client', 'x'.repeat(120)), t)!;
    expect(Array.from(label.replace('AI client · ', ''))).toHaveLength(60);
    expect(label.endsWith('…')).toBe(true);
  });

  it('adds the relay source', () => {
    expect(
      signalOriginLabel(origin('hypha_assistant'), t, {
        relaySourceLabel: 'River Ops',
      }),
    ).toBe('Hypha AI assistant · relayed from River Ops');
  });

  it('shows nothing for rows written before the origin was recorded', () => {
    expect(signalOriginLabel(origin('unknown'), t)).toBeNull();
    expect(signalOriginLabel(null, t)).toBeNull();
    expect(signalOriginLabel(undefined, t)).toBeNull();
  });
});
