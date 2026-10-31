import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(__dirname, '../human-right-panel.tsx'),
  'utf8',
);

describe('network room join guard', () => {
  it('only ensures the network room on /{lang}/network', () => {
    expect(source).toContain('isNetworkPath(pathname)');
    expect(source).toContain('ensureNetworkRoom');
    const ensureAt = source.indexOf('await ensureNetworkRoom()');
    expect(ensureAt).toBeGreaterThan(-1);
    const guardAt = source.lastIndexOf(
      'if (!isNetworkPath(pathname)) return;',
      ensureAt,
    );
    expect(guardAt).toBeGreaterThan(-1);
    expect(guardAt).toBeLessThan(ensureAt);
  });

  it('does not inherit a DHO space slug while on Network in space mode', () => {
    expect(source).toContain('routeSpaceSlugFromLocation');
    expect(source).toContain("onNetworkPage && mode === 'space'");
    expect(source).toContain(
      'Entering Network clears leftover DHO / coherence space chrome',
    );
  });

  it('locks timeline paints to the intended room before join awaits (HE → HUMAI)', () => {
    expect(source).toContain('paintedRoomId');
    expect(source).toContain(
      'openingTimelineRoomIdRef.current = intendedRoomId',
    );
    expect(source).toContain(
      'activeRoom && painted && activeRoom === painted ? messages : []',
    );
    expect(source).toContain('Mid-switch both refs may be empty');
  });

  it('shows the mycelium mark beside the network globe (no external-link arrow)', () => {
    expect(source).toContain('MemberHomeMark');
    expect(source).toContain(
      "coherenceChannel === 'network' || isNetworkSpaceChat",
    );
  });

  it('treats Home / Messages space mode without a slug as not the network room', () => {
    expect(source).toContain(
      "const isNetworkSpaceChat = onNetworkPage && mode === 'space'",
    );
    expect(source).toContain('!isNetworkSpaceChat');
    expect(source).toContain('Leaving Network clears that join sentinel');
  });
});
