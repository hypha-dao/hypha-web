import { describe, expect, it } from 'vitest';
import {
  CALL_PANEL_MOBILE_PAGINATED_MIN,
  getCallPanelMobileGridLayout,
} from '../call-panel-mobile-grid';

describe('getCallPanelMobileGridLayout', () => {
  it('returns null for large calls (paginated gallery on phone)', () => {
    expect(getCallPanelMobileGridLayout(7)).toBeNull();
    expect(getCallPanelMobileGridLayout(30)).toBeNull();
    expect(CALL_PANEL_MOBILE_PAGINATED_MIN).toBe(7);
  });

  it('fills stage for a solo participant', () => {
    const layout = getCallPanelMobileGridLayout(1);
    expect(layout).not.toBeNull();
    expect(layout!.gridClass).toContain('grid-rows-1');
    expect(layout!.gridClass).toContain('flex-1');
  });

  it('stacks two participants vertically on phone panel', () => {
    const layout = getCallPanelMobileGridLayout(2);
    expect(layout).not.toBeNull();
    expect(layout!.gridClass).toContain('grid-rows-2');
    expect(layout!.gridClass).toContain('grid-cols-1');
    expect(layout!.gridClass).toContain('flex-1');
  });

  it('stacks three participants in three equal rows', () => {
    const layout = getCallPanelMobileGridLayout(3);
    expect(layout!.gridClass).toContain('grid-rows-3');
    expect(layout!.gridClass).toContain('grid-cols-1');
  });

  it('uses 2x2 for four participants', () => {
    const layout = getCallPanelMobileGridLayout(4);
    expect(layout!.gridClass).toContain('grid-cols-2');
    expect(layout!.gridClass).toContain('grid-rows-2');
  });

  it('uses 2x3 for five and six participants', () => {
    for (const n of [5, 6]) {
      const layout = getCallPanelMobileGridLayout(n);
      expect(layout!.gridClass).toContain('grid-cols-2');
      expect(layout!.gridClass).toContain('grid-rows-3');
    }
  });
});
