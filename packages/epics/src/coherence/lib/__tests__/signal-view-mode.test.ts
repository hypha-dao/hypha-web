import { describe, expect, it } from 'vitest';
import {
  isDefaultSignalViewMode,
  parseSignalViewMode,
  SIGNAL_VIEW_MODES,
} from '../signal-view-mode';
import {
  buildSignalWorkflowConfigurationPath,
  getSignalWorkflowReturnPath,
} from '../signal-workflow-configuration-return';

describe('parseSignalViewMode', () => {
  it.each(SIGNAL_VIEW_MODES)('accepts %s', (mode) => {
    expect(parseSignalViewMode(mode)).toBe(mode);
  });

  it('rejects unknown values', () => {
    expect(parseSignalViewMode('table')).toBeNull();
    expect(parseSignalViewMode('')).toBeNull();
    expect(parseSignalViewMode(null)).toBeNull();
  });
});

describe('isDefaultSignalViewMode', () => {
  it('treats grid (UpVote) as default', () => {
    expect(isDefaultSignalViewMode('grid')).toBe(true);
    expect(isDefaultSignalViewMode('swimlane')).toBe(false);
    expect(isDefaultSignalViewMode('board')).toBe(false);
  });
});

describe('signal workflow configuration return paths', () => {
  it('preserves view and priority when opening workflow settings', () => {
    const params = new URLSearchParams({
      view: 'grid',
      priority: 'high',
    });
    const url = buildSignalWorkflowConfigurationPath('en', 'my-space', params);
    const parsed = new URL(url, 'http://local');
    expect(parsed.pathname).toBe(
      '/en/dho/my-space/coherence/space-configuration',
    );
    expect(parsed.searchParams.get('from')).toBe('signal-workflow');
    expect(parsed.searchParams.get('view')).toBe('grid');
    expect(parsed.searchParams.get('priority')).toBe('high');
  });

  it('returns to signals with preserved query params minus from', () => {
    const params = new URLSearchParams({
      from: 'signal-workflow',
      view: 'swimlane',
      priority: 'critical',
    });
    expect(getSignalWorkflowReturnPath('en', 'my-space', params)).toBe(
      '/en/dho/my-space/coherence?view=swimlane&priority=critical',
    );
  });
});
