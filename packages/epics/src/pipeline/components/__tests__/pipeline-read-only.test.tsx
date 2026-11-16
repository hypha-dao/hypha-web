import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (globalThis as { React?: unknown }).React = require('react');
  return { canLogin: true, isAuthenticated: false };
});

vi.mock('@hypha-platform/authentication', () => ({
  useAuthentication: () => ({
    canLogin: auth.canLogin,
    isAuthenticated: auth.isAuthenticated,
    login: () => undefined,
  }),
}));
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 's1', lang: 'en' }),
}));
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({ number: (n: number) => String(n) }),
}));
vi.mock('@hypha-platform/core/client', () => ({
  effectiveSuccessRate: () => 50,
}));

import { ActionCapabilitiesProvider } from '../../../common/action-capabilities';
import { DealCard } from '../deal-card';
import { PipelineUnavailable } from '../pipeline-unavailable';

const deal = {
  id: 7,
  title: 'Deal one',
  priority: 'medium',
  currency: '$',
  value: 100,
} as never;

const withCaps = (
  unsupportedActions: 'hide' | 'full-app',
  node: React.ReactNode,
) =>
  renderToStaticMarkup(
    <ActionCapabilitiesProvider
      value={{
        unsupportedActions,
        fullAppOrigin: 'https://app.example',
        pipelineData: true,
        voteLive: false,
      }}
    >
      {node}
    </ActionCapabilitiesProvider>,
  );

describe('read-only deal card', () => {
  it('main app (no provider), not read-only: a button, as before', () => {
    const html = renderToStaticMarkup(<DealCard deal={deal} />);
    expect(html).toContain('<button');
    expect(html).not.toContain('href=');
  });

  it('read-only, no provider: inert', () => {
    const html = renderToStaticMarkup(<DealCard deal={deal} readOnly />);
    expect(html).not.toContain('<button');
    expect(html).not.toContain('<a');
  });

  it('read-only, hide (default): inert', () => {
    const html = withCaps('hide', <DealCard deal={deal} readOnly />);
    expect(html).not.toContain('<a');
    expect(html).not.toContain('<button');
  });

  it('read-only, full-app: a link to the deal in the full app, new tab', () => {
    const html = withCaps('full-app', <DealCard deal={deal} readOnly />);
    expect(html).toContain(
      'href="https://app.example/en/dho/s1/pipeline/deal/7"',
    );
    expect(html).toContain('target="_blank"');
    expect(html).toContain('data-wl-full-app-exit');
    expect(html).toContain('noopener');
  });

  it('full-app does not turn an editable card into a link', () => {
    const html = withCaps('full-app', <DealCard deal={deal} />);
    expect(html).toContain('<button');
    expect(html).not.toContain('href=');
  });
});

describe('pipeline unavailable state', () => {
  beforeEach(() => {
    auth.canLogin = true;
    auth.isAuthenticated = false;
  });

  it('refused, signed out, login host: members only and a sign-in button', () => {
    const html = renderToStaticMarkup(
      <PipelineUnavailable refused onRetry={() => undefined} />,
    );
    expect(html).toContain('membersOnly');
    expect(html).toContain('membersOnlySignIn');
    expect(html).toContain('<button');
  });

  it('refused, signed in (not a member): members only, no sign-in button', () => {
    auth.isAuthenticated = true;
    const html = renderToStaticMarkup(
      <PipelineUnavailable refused onRetry={() => undefined} />,
    );
    expect(html).toContain('membersOnly');
    expect(html).not.toContain('<button');
  });

  it('refused, no login here: the message only', () => {
    auth.canLogin = false;
    const html = renderToStaticMarkup(
      <PipelineUnavailable refused onRetry={() => undefined} />,
    );
    expect(html).toContain('membersOnly');
    expect(html).not.toContain('<button');
  });

  it('a failed load (not refused) is an error with a retry, not members only', () => {
    const html = renderToStaticMarkup(
      <PipelineUnavailable refused={false} onRetry={() => undefined} />,
    );
    expect(html).toContain('configLoadFailed');
    expect(html).not.toContain('membersOnly');
  });
});
