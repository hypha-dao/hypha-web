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
  'vote',
  'deal-link',
  'pipeline-data',
];

const value = (
  extra: Partial<ActionCapabilitiesValue> = {},
): ActionCapabilitiesValue => ({
  unsupportedActions: 'hide',
  fullAppOrigin: 'https://app.example',
  pipelineData: false,
  voteLive: false,
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
      (k) => !['get-started', 'upvote', 'vote', 'pipeline-data'].includes(k),
    )) {
      const html = gate(kind, value({ unsupportedActions: 'full-app' }));
      expect(html, kind).toContain(
        'href="https://app.example/en/dho/s1/treasury"',
      );
      expect(html).toContain('target="_blank"');
      expect(html).toContain('noopener');
      expect(html).toContain('data-wl-full-app-exit');
      expect(html).not.toContain('live control');
    }
  });

  it('get-started stays hidden under full-app', () => {
    expect(
      resolveActionStatus(
        value({ unsupportedActions: 'full-app' }),
        'get-started',
      ),
    ).toBe('hidden');
  });

  it('voting follows voteLive, never becomes a link', () => {
    for (const kind of ['vote', 'upvote'] as const) {
      for (const setting of ['hide', 'full-app'] as const) {
        expect(
          resolveActionStatus(value({ unsupportedActions: setting }), kind),
        ).toBe('hidden');
        expect(
          resolveActionStatus(
            value({ unsupportedActions: setting, voteLive: true }),
            kind,
          ),
        ).toBe('live');
      }
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

describe('create capabilities', () => {
  const CREATE_KINDS: ActionKind[] = [
    'create-signal',
    'create-agreement',
    'create-contribution',
    'create-proposal',
  ];

  it('main app: live; no createActions: hidden, or a full-app link, as before', () => {
    for (const kind of CREATE_KINDS) {
      expect(resolveActionStatus(null, kind), kind).toBe('live');
      expect(resolveActionStatus(value(), kind), kind).toBe('hidden');
      expect(resolveActionStatus(value({ createActions: [] }), kind)).toBe(
        'hidden',
      );
      expect(
        resolveActionStatus(value({ unsupportedActions: 'full-app' }), kind),
        kind,
      ).toBe('full-app');
    }
  });

  it('each kind is live for its own value only', () => {
    const only = (createActions: string[]) =>
      CREATE_KINDS.filter(
        (kind) =>
          resolveActionStatus(value({ createActions }), kind) === 'live',
      );
    expect(only(['signal'])).toEqual(['create-signal']);
    expect(only(['agreement'])).toEqual([
      'create-agreement',
      'create-proposal',
    ]);
    expect(only(['contribution'])).toEqual([
      'create-contribution',
      'create-proposal',
    ]);
    expect(only(['proposal', 'Signal', ''])).toEqual([]);
  });

  it('does not make the other create flows live (memory, tokens, calendar)', () => {
    const all = value({
      createActions: ['signal', 'agreement', 'contribution'],
    });
    for (const kind of ['create-flow', 'calendar-write', 'claim'] as const) {
      expect(resolveActionStatus(all, kind), kind).toBe('hidden');
    }
  });

  it('the gate renders the live control only where the value lists it', () => {
    expect(
      gate('create-signal', value({ createActions: ['signal'] })),
    ).toContain('live control');
    expect(
      gate('create-signal', value({ createActions: ['agreement'] })),
    ).not.toContain('live control');
  });
});
