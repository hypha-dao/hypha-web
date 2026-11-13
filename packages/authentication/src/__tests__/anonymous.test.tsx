import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@hypha-platform/evm', () => ({
  ReadOnlyEvmProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

import { useAnonymousAuthentication } from '../anonymous';

function Probe() {
  const auth = useAnonymousAuthentication();
  return (
    <span>{`canLogin=${auth.canLogin};signedIn=${auth.isAuthenticated}`}</span>
  );
}

describe('anonymous authentication (read-only tree)', () => {
  it('nobody can sign in and the visitor is signed out', () => {
    expect(renderToStaticMarkup(<Probe />)).toContain(
      'canLogin=false;signedIn=false',
    );
  });
});
