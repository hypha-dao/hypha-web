import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (globalThis as { React?: unknown }).React = require('react');
  return { canMutate: false, isLoading: false };
});

vi.mock('../../hooks/use-can-mutate-in-space.web3.rpc', () => ({
  useCanMutateInSpace: () => ({
    canMutate: state.canMutate,
    isLoading: state.isLoading,
    userState: 'NOT_LOGGED_IN',
  }),
}));
vi.mock('../space-access-denied', () => ({
  SpaceAccessDenied: () => <div>denied</div>,
}));
vi.mock('@hypha-platform/ui', () => ({
  Skeleton: () => <div>skeleton</div>,
}));
vi.mock('../../../common/modal-sticky-navigation', () => ({
  ModalStickyNavigation: ({ closeUrl }: { closeUrl?: string }) => (
    <a href={closeUrl}>close</a>
  ),
}));

import { SpaceMemberAsideGuard } from '../space-member-aside-guard';

const render = (closeUrl?: string) =>
  renderToStaticMarkup(
    <SpaceMemberAsideGuard spaceSlug="x" closeUrl={closeUrl}>
      <div>form</div>
    </SpaceMemberAsideGuard>,
  );

describe('SpaceMemberAsideGuard close control', () => {
  beforeEach(() => {
    state.canMutate = false;
    state.isLoading = false;
  });

  it('denied: a close control when closeUrl is set, none otherwise (main app)', () => {
    expect(render('/en/agreements')).toContain('href="/en/agreements"');
    expect(render()).not.toContain('close');
    expect(render()).toContain('denied');
  });

  it('loading: a close control when closeUrl is set', () => {
    state.isLoading = true;
    expect(render('/en/agreements')).toContain('href="/en/agreements"');
    expect(render()).not.toContain('close');
  });

  it('member: the form only, the form brings its own header', () => {
    state.canMutate = true;
    const html = render('/en/agreements');
    expect(html).toContain('form');
    expect(html).not.toContain('close');
  });
});
