import { describe, expect, it } from 'vitest';
import {
  buildScheduledItemJoinPath,
  isJoinableScheduledItem,
  resolveScheduledItemJoinUrl,
} from '../meeting-url';

describe('meeting-url helpers', () => {
  it('detects joinable call and meeting items', () => {
    expect(
      isJoinableScheduledItem({
        type: 'call',
        matrixAutoLink: true,
      }),
    ).toBe(true);
    expect(
      isJoinableScheduledItem({
        type: 'event',
        meetingUrl: 'https://example.com',
      }),
    ).toBe(false);
  });

  it('builds Hypha join path for matrix auto link', () => {
    expect(
      buildScheduledItemJoinPath(
        { type: 'call', matrixAutoLink: true, meetingUrl: null },
        'en',
        'demo-space',
      ),
    ).toBe('/en/dho/demo-space?joinCall=1');
  });

  it('resolves absolute join URLs', () => {
    expect(
      resolveScheduledItemJoinUrl(
        {
          type: 'meeting',
          matrixAutoLink: false,
          meetingUrl: 'https://meet.example.com/room',
        },
        'en',
        'demo-space',
        'https://app.hypha.coop',
      ),
    ).toBe('https://meet.example.com/room');
  });

  it('rejects unsafe meeting URL schemes', () => {
    expect(
      buildScheduledItemJoinPath(
        {
          type: 'meeting',
          matrixAutoLink: false,
          meetingUrl: 'javascript:alert(1)',
        },
        'en',
        'demo-space',
      ),
    ).toBeNull();
  });
});
