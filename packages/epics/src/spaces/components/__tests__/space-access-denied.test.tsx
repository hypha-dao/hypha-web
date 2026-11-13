import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The component under test uses the automatic JSX runtime; vitest's esbuild
// emits classic JSX here, which needs React in scope.
const auth = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (globalThis as { React?: unknown }).React = require('react');
  return { canLogin: true };
});

vi.mock('@hypha-platform/authentication', () => ({
  useAuthentication: () => ({
    login: () => undefined,
    canLogin: auth.canLogin,
  }),
}));
vi.mock('@hypha-platform/core/client', () => ({
  useSpaceBySlug: () => ({ space: undefined }),
  useSpacesByWeb3Ids: () => ({ spaces: [] }),
}));
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock('../join-space', () => ({ JoinSpace: () => null }));
vi.mock('../../hooks/use-user-space-state.web3.rpc', () => ({
  UserSpaceState: { NOT_LOGGED_IN: 'NOT_LOGGED_IN' },
}));
vi.mock('../../../common/empty', () => ({
  Empty: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { SpaceAccessDenied } from '../space-access-denied';

const render = () =>
  renderToStaticMarkup(
    <SpaceAccessDenied userState={'NOT_LOGGED_IN' as never} spaceSlug="x" />,
  );

describe('SpaceAccessDenied, signed out', () => {
  beforeEach(() => {
    auth.canLogin = true;
  });

  it('with login: the account prompt and both buttons', () => {
    const html = render();
    expect(html).toContain('accessDeniedNotLoggedIn');
    expect(html).toContain('signIn');
    expect(html).toContain('getStarted');
    expect(html).toContain('<button');
  });

  it('without login (read-only host): a plain message, no buttons', () => {
    auth.canLogin = false;
    const html = render();
    expect(html).toContain('accessDeniedReadOnly');
    expect(html).not.toContain('accessDeniedNotLoggedIn');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('getStarted');
  });
});
