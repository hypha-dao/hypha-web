import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  ActionCapabilitiesProvider,
  ActionGate,
  resolveActionStatus,
  type ActionCapabilitiesValue,
  type ActionKind,
} from '../action-capabilities';

const KINDS: ActionKind[] = [
  'create-flow',
  'claim',
  'join',
  'member-action',
  'wallet-action',
  'calendar-write',
  'banking-write',
  'get-started',
  'upvote',
  'pipeline-data',
];

const value = (
  extra: Partial<ActionCapabilitiesValue> = {},
): ActionCapabilitiesValue => ({
  unsupportedActions: 'hide',
  fullAppOrigin: 'https://app.example',
  pipelineData: false,
  ...extra,
});

const gate = (kind: ActionKind, provider?: ActionCapabilitiesValue) => {
  const node = (
    <ActionGate kind={kind} fullAppPath="/en/dho/s1/treasury" label="Claim">
      <button>live control</button>
    </ActionGate>
  );
  return renderToStaticMarkup(
    provider ? (
      <ActionCapabilitiesProvider value={provider}>
        {node}
      </ActionCapabilitiesProvider>
    ) : (
      node
    ),
  );
};

describe('action capabilities', () => {
  it('without a provider (main app) every action is live', () => {
    for (const kind of KINDS) {
      expect(resolveActionStatus(null, kind), kind).toBe('live');
      expect(gate(kind), kind).toContain('live control');
    }
  });

  it('default setting hides everything a delivery cannot perform', () => {
    for (const kind of KINDS) {
      expect(resolveActionStatus(value(), kind), kind).toBe('hidden');
      expect(gate(kind, value()), kind).toBe('');
    }
  });

  it('full-app turns most actions into a link to the same Space in the full app', () => {
    for (const kind of KINDS.filter(
      (k) => !['get-started', 'upvote', 'pipeline-data'].includes(k),
    )) {
      const html = gate(kind, value({ unsupportedActions: 'full-app' }));
      expect(html, kind).toContain(
        'href="https://app.example/en/dho/s1/treasury"',
      );
      expect(html).toContain('target="_blank"');
      expect(html).toContain('noopener');
      expect(html).not.toContain('live control');
    }
  });

  it('get-started and upvote stay hidden under full-app', () => {
    for (const kind of ['get-started', 'upvote'] as const) {
      expect(
        resolveActionStatus(value({ unsupportedActions: 'full-app' }), kind),
      ).toBe('hidden');
    }
  });

  it('the pipeline follows pipelineData, not the setting', () => {
    expect(
      resolveActionStatus(value({ pipelineData: true }), 'pipeline-data'),
    ).toBe('live');
    expect(
      resolveActionStatus(
        value({ unsupportedActions: 'full-app' }),
        'pipeline-data',
      ),
    ).toBe('hidden');
  });

  it('in the iframe the full-app link is relative to the page origin', () => {
    const html = gate(
      'claim',
      value({ unsupportedActions: 'full-app', fullAppOrigin: '' }),
    );
    expect(html).toContain('href="/en/dho/s1/treasury"');
  });
});
