// @vitest-environment jsdom
import * as React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useSWR, { SWRConfig } from 'swr';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  holdEnergySevenDaySettled,
  resetEnergySevenDaySettledForTests,
} from '../energy-seven-day-settled';
import {
  energyIntelligenceSWRMiddleware,
  useMemberIntelligence,
} from '../member-intelligence-swr';
import { MobileSpacesSubnav } from '../../people/components/mobile-spaces-subnav';

vi.mock('next/navigation', () => ({
  usePathname: () => '/en/dho/ponta-do-sol-energy-community/energy',
  useParams: () => ({ lang: 'en' }),
  useRouter: () => ({ prefetch: vi.fn() }),
}));

vi.mock('@hypha-platform/core/client', () => ({
  useJwt: () => ({ jwt: 'test-jwt', isLoadingJwt: false }),
}));

vi.mock('../../people/components/member-home-spaces-rail', () => ({
  MemberHomeSpacesRail: () => <div data-testid="spaces-rail" />,
}));

const fetchMock = vi.fn(async (input: RequestInfo) => {
  const url = typeof input === 'string' ? input : input.url;
  return {
    ok: true,
    status: 200,
    json: async () => ({ spaces: [] }),
    url,
  };
});

function ExtraEnergyIntelligenceCallers() {
  // HumanRightPanel directory / space-attention / notifications share this key.
  useMemberIntelligence();
  // Home/messages shell+full keys that raced 7d when the energy gate failed open.
  useSWR(
    ['/api/v1/people/me/intelligence', 'member-id', 'shell'] as const,
    () =>
      fetchMock(
        '/api/v1/people/me/intelligence?scope=shell',
      ) as Promise<unknown>,
  );
  useSWR(
    ['/api/v1/people/me/intelligence', 'member-id', 'full'] as const,
    () =>
      fetchMock(
        '/api/v1/people/me/intelligence?scope=full',
      ) as Promise<unknown>,
  );
  return null;
}

function EnergyRouteTree() {
  return (
    <SWRConfig
      value={{
        provider: () => new Map(),
        dedupingInterval: 5000,
        use: [energyIntelligenceSWRMiddleware],
      }}
    >
      {/* MobileContentFrame (`xl:hidden`) still mounts on desktop. */}
      <MobileSpacesSubnav
        lang="en"
        activeSlug="ponta-do-sol-energy-community"
      />
      {/* AiLeftPanel mounts a second rail when the AI overlay is open. */}
      <MobileSpacesSubnav
        lang="en"
        activeSlug="ponta-do-sol-energy-community"
        embedded
      />
      <ExtraEnergyIntelligenceCallers />
    </SWRConfig>
  );
}

function intelligenceCalls() {
  return fetchMock.mock.calls.filter(([input]) =>
    String(input).includes('/api/v1/people/me/intelligence'),
  );
}

describe('energy route intelligence fetches', () => {
  beforeEach(() => {
    resetEnergySevenDaySettledForTests();
    fetchMock.mockClear();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    resetEnergySevenDaySettledForTests();
    vi.unstubAllGlobals();
  });

  it('does not fetch people/me/intelligence before 7d telemetry settles', async () => {
    render(<EnergyRouteTree />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(intelligenceCalls()).toHaveLength(0);

    let release: () => void = () => undefined;
    act(() => {
      release = holdEnergySevenDaySettled();
    });
    await waitFor(() => {
      expect(intelligenceCalls().length).toBeGreaterThan(0);
    });
    // Shared `[path, jwt]` key: two rails + HumanRightPanel-style hook = one GET.
    const sharedKeyCalls = intelligenceCalls().filter(
      ([input]) => String(input) === '/api/v1/people/me/intelligence',
    );
    expect(sharedKeyCalls).toHaveLength(1);
    act(() => {
      release();
    });
  });
});

const INTELLIGENCE_PATH = '/api/v1/people/me/intelligence';

const SWR_CALLERS = [
  'packages/epics/src/people/components/mobile-spaces-subnav.tsx',
  'packages/epics/src/common/human-right-panel.tsx',
  'packages/epics/src/spaces/components/space-attention.tsx',
  'packages/epics/src/people/components/member-spaces-entry.tsx',
  'packages/epics/src/people/components/space-invite-arrival.tsx',
  'apps/web/src/app/(main)/[lang]/my-dashboard/attention/attention-route.tsx',
  'apps/web/src/app/(main)/[lang]/my-dashboard/notifications/notifications-route.tsx',
  'apps/web/src/app/(main)/[lang]/my-dashboard/member-home-page.tsx',
  'packages/epics/src/people/components/my-connections.tsx',
  'packages/epics/src/common/human-chat-panel/human-chat-panel-group-menu.tsx',
  'packages/epics/src/common/member-intelligence-swr.ts',
];

const DIRECT_FETCH_CALLERS = [
  'packages/epics/src/network-exchange/network-quick-create.tsx',
  'packages/epics/src/people/components/member-connections.ts',
  'packages/epics/src/people/components/my-connections.tsx',
  'packages/epics/src/people/components/member-home-chat-widgets.tsx',
  'apps/web/src/app/(main)/[lang]/my-dashboard/member-home-page.tsx',
];

const TEST_AND_DOCS_ALLOWLIST = [
  'packages/epics/src/common/index.ts',
  'packages/epics/src/common/__tests__/energy-route-intelligence-gate.test.tsx',
  'packages/epics/src/common/__tests__/use-after-idle.test.tsx',
  'packages/epics/src/common/__tests__/ai-panel-header-next-image.test.ts',
  'packages/epics/src/people/components/__tests__/member-connections.test.ts',
  'apps/web/src/lib/white-label/__tests__/host-login.test.ts',
  'apps/web/src/lib/white-label/__tests__/host-mode.test.ts',
];

function walkSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (
      entry === 'node_modules' ||
      entry === '.next' ||
      entry === 'dist' ||
      entry === 'coverage'
    ) {
      continue;
    }
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walkSourceFiles(full, acc);
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

describe('people/me/intelligence caller inventory', () => {
  it('lists every production caller so a new fetch cannot skip the energy gate', () => {
    const repoRoot = join(
      dirname(fileURLToPath(import.meta.url)),
      '../../../../../',
    );
    const allowed = new Set(
      [...SWR_CALLERS, ...DIRECT_FETCH_CALLERS, ...TEST_AND_DOCS_ALLOWLIST].map(
        (rel) => join(repoRoot, rel),
      ),
    );
    const hits: string[] = [];
    const isCaller = (source: string) =>
      source.includes(INTELLIGENCE_PATH) ||
      source.includes('useMemberIntelligence');
    for (const file of walkSourceFiles(join(repoRoot, 'apps/web/src'))) {
      if (file.includes('/.next/')) continue;
      if (isCaller(readFileSync(file, 'utf8'))) hits.push(file);
    }
    for (const file of walkSourceFiles(join(repoRoot, 'packages/epics/src'))) {
      if (isCaller(readFileSync(file, 'utf8'))) hits.push(file);
    }
    const unexpected = hits.filter((file) => !allowed.has(file));
    expect(unexpected).toEqual([]);
    for (const rel of [...SWR_CALLERS, ...DIRECT_FETCH_CALLERS]) {
      const source = readFileSync(join(repoRoot, rel), 'utf8');
      expect(
        source.includes(INTELLIGENCE_PATH) ||
          source.includes('useMemberIntelligence'),
      ).toBe(true);
    }
  });
});
