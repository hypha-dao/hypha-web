import { describe, expect, it } from 'vitest';
import { getCallPanelMobileGridLayout } from '../call-panel-mobile-grid';

describe('getCallPanelMobileGridLayout', () => {
  it('stacks two participants vertically on phone panel', () => {
    const layout = getCallPanelMobileGridLayout(2);
    expect(layout.gridClass).toContain('grid-rows-2');
    expect(layout.gridClass).toContain('grid-cols-1');
    expect(layout.gridClass).toContain('flex-1');
  });

  it('uses 2x2 for four participants', () => {
    const layout = getCallPanelMobileGridLayout(4);
    expect(layout.gridClass).toContain('grid-cols-2');
    expect(layout.gridClass).toContain('grid-rows-2');
  });
});
