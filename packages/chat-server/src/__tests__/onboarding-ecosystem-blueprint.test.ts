import { describe, expect, it } from 'vitest';

import { buildEcosystemExecutePhaseDirective } from '../onboarding-ecosystem-blueprint';

describe('buildEcosystemExecutePhaseDirective', () => {
  it('returns null outside ecosystem execute phase', () => {
    expect(
      buildEcosystemExecutePhaseDirective({
        mode: 'onboarding_setup',
        setupPhase: 'discover',
        setupJourney: 'ecosystem',
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
    ).toBeNull();
  });

  it('lists pending blueprint nodes and parent slug', () => {
    const directive = buildEcosystemExecutePhaseDirective({
      mode: 'onboarding_setup',
      setupPhase: 'execute',
      setupJourney: 'ecosystem',
      ecosystemRootSlug: 'acme-root',
      createdAt: '2026-01-01T00:00:00.000Z',
      setupPlan: {
        ecosystemBlueprint: [
          {
            key: 'acme-root-community',
            role: 'community_hub',
            title: 'Community Hub',
            status: 'planned',
          },
          {
            key: 'acme-root-core-team',
            role: 'core_team',
            title: 'Core Team',
            status: 'created',
          },
        ],
      },
    });

    expect(directive).toContain('acme-root');
    expect(directive).toContain('Community Hub');
    expect(directive).toContain('create_ecosystem_space');
    expect(directive).toContain('Do not restart discovery');
  });
});
