import { describe, expect, it, vi } from 'vitest';

vi.mock('@hypha-platform/storage-postgres', () => ({ db: {} }));
vi.mock('@hypha-platform/core/server', () => ({
  hyphaAssistantOrigin: () => ({
    kind: 'hypha_assistant',
    clientId: null,
    clientLabel: null,
  }),
  createAiSignalForSpaceBySlug: vi.fn(async () => ({ ok: true })),
  relayAiSignalToEcosystemSpace: vi.fn(async () => ({ ok: true })),
}));

import {
  createAiSignalForSpaceBySlug,
  relayAiSignalToEcosystemSpace,
} from '@hypha-platform/core/server';
import { createCreateSpaceSignalBySlugTool } from '../tools/create-space-signal-by-slug';
import { createRelayEcosystemSignalTool } from '../tools/relay-ecosystem-signal';

describe('chat signal tools record the assistant origin (#2724)', () => {
  it('create_space_signal_by_slug', async () => {
    const tool = createCreateSpaceSignalBySlugTool('token');
    await tool.execute({
      space_slug: 'alpha',
      title: 'Water',
      description: 'The well in the north field is dry since Monday.',
    } as never);
    const [, options] = vi.mocked(createAiSignalForSpaceBySlug).mock.calls[0]!;
    expect(options.origin).toMatchObject({ kind: 'hypha_assistant' });
  });

  it('relay_ecosystem_signal', async () => {
    const tool = createRelayEcosystemSignalTool('token');
    await tool.execute({
      source_space_slug: 'alpha',
      target_space_slug: 'beta',
      title: 'Water',
      summary: 'The well in the north field is dry since Monday.',
      recommended_action: 'Send a water truck.',
      relevance_rationale: 'Beta runs the water trucks for the region.',
    } as never);
    const [, options] = vi.mocked(relayAiSignalToEcosystemSpace).mock.calls[0]!;
    expect(options.origin).toMatchObject({ kind: 'hypha_assistant' });
  });
});
