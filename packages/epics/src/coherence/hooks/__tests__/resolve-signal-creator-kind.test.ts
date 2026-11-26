import { describe, expect, it } from 'vitest';
import type { OriginView } from '@hypha-platform/core/client';
import {
  resolveSignalCreatorKind,
  signalRelaySourceSlug,
} from '../use-signal-creator-meta';

const plain = { description: 'We need clean water.', title: 'Water', tags: [] };
const withTag = { ...plain, tags: ['AI Signal'] };
const jobText = {
  description:
    'Recent space-memory activity indicates a coordination opportunity.',
  title: 'Alpha: high-signal discussion summary update',
  tags: [],
};
const relay = {
  ...plain,
  description: 'Summary.\n\nRelayed from ecosystem space: river-ops',
};
const origin = (kind: OriginView['kind']): OriginView => ({
  kind,
  clientLabel: null,
});

describe('resolveSignalCreatorKind', () => {
  it('shows the AI label for the AI paths', () => {
    expect(
      resolveSignalCreatorKind({ ...plain, origin: origin('hypha_assistant') })
        .kind,
    ).toBe('aiRole');
    expect(
      resolveSignalCreatorKind({ ...plain, origin: origin('mcp_client') }).kind,
    ).toBe('aiRole');
    expect(
      resolveSignalCreatorKind({
        ...plain,
        origin: origin('hypha_intelligence'),
      }).kind,
    ).toBe('backgroundJob');
  });

  it('keeps the relay label for a relayed AI signal', () => {
    expect(
      resolveSignalCreatorKind({ ...relay, origin: origin('hypha_assistant') }),
    ).toEqual({ kind: 'relay', relaySourceSpaceSlug: 'river-ops' });
  });

  it('shows the person for every other known path, whatever the tag or text says', () => {
    for (const kind of [
      'app',
      'api_client',
      'space_key',
      'hypha_platform',
    ] as const) {
      expect(
        resolveSignalCreatorKind({ ...withTag, origin: origin(kind) }),
      ).toEqual({ kind: 'person', relaySourceSpaceSlug: null });
      expect(
        resolveSignalCreatorKind({ ...jobText, origin: origin(kind) }).kind,
      ).toBe('person');
      expect(
        resolveSignalCreatorKind({ ...relay, origin: origin(kind) }).kind,
      ).toBe('person');
    }
  });

  it('shows the stored person for an AI path when there is one; the path goes to the origin field', () => {
    for (const kind of [
      'hypha_assistant',
      'mcp_client',
      'hypha_intelligence',
    ] as const) {
      expect(
        resolveSignalCreatorKind({
          ...withTag,
          creatorId: 42,
          origin: origin(kind),
        }),
      ).toEqual({ kind: 'person', relaySourceSpaceSlug: null });
    }
    expect(
      resolveSignalCreatorKind({
        ...relay,
        creatorId: 42,
        origin: origin('hypha_assistant'),
      }).kind,
    ).toBe('person');
    // no person stored: the label stays
    expect(
      resolveSignalCreatorKind({
        ...plain,
        creatorId: null,
        origin: origin('hypha_assistant'),
      }).kind,
    ).toBe('aiRole');
  });

  it('keeps the legacy label for unknown rows even with a person stored', () => {
    expect(
      resolveSignalCreatorKind({
        ...withTag,
        creatorId: 42,
        origin: origin('unknown'),
      }).kind,
    ).toBe('aiRole');
  });

  it('finds the relay source only for AI paths and legacy rows', () => {
    expect(
      signalRelaySourceSlug({ ...relay, origin: origin('hypha_assistant') }),
    ).toBe('river-ops');
    expect(signalRelaySourceSlug({ ...relay, origin: origin('unknown') })).toBe(
      'river-ops',
    );
    expect(signalRelaySourceSlug({ ...relay, origin: origin('app') })).toBe(
      null,
    );
    expect(
      signalRelaySourceSlug({ ...plain, origin: origin('hypha_assistant') }),
    ).toBe(null);
  });

  it('falls back to the legacy heuristics for unknown rows, as before', () => {
    expect(
      resolveSignalCreatorKind({ ...withTag, origin: origin('unknown') }).kind,
    ).toBe('aiRole');
    expect(
      resolveSignalCreatorKind({ ...plain, origin: origin('unknown') }).kind,
    ).toBe('person');
    expect(resolveSignalCreatorKind({ ...jobText, origin: null }).kind).toBe(
      'backgroundJob',
    );
    expect(resolveSignalCreatorKind({ ...relay }).kind).toBe('relay');
    expect(resolveSignalCreatorKind({ ...withTag }).kind).toBe('aiRole');
  });
});
