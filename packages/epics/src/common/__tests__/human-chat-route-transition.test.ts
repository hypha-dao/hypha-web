import { describe, expect, it } from 'vitest';

import {
  shouldDelaySpaceSignalReset,
  shouldPreserveDirectMessageOnSpaceLeave,
} from '../human-chat-route-transition';

describe('shouldDelaySpaceSignalReset', () => {
  const spaceSignal = {
    coherenceSlug: 'shared-folder',
    routeSpaceSlug: 'live-earth',
    isConnectionsPage: false,
    sidebarOpen: true,
  };

  it('closes the panel before resetting when Back is pressed on an open space signal', () => {
    expect(shouldDelaySpaceSignalReset(spaceSignal)).toBe(true);
  });

  it('does not treat Messages back as a space-signal close', () => {
    expect(
      shouldDelaySpaceSignalReset({
        ...spaceSignal,
        isConnectionsPage: true,
      }),
    ).toBe(false);
  });

  it('does not delay once the panel is already closed', () => {
    expect(
      shouldDelaySpaceSignalReset({ ...spaceSignal, sidebarOpen: false }),
    ).toBe(false);
  });

  it('does not delay a direct message, which has no signal slug', () => {
    expect(
      shouldDelaySpaceSignalReset({ ...spaceSignal, coherenceSlug: '' }),
    ).toBe(false);
  });
});

describe('shouldPreserveDirectMessageOnSpaceLeave', () => {
  it('keeps a direct message when leaving a space for a shell page', () => {
    expect(
      shouldPreserveDirectMessageOnSpaceLeave({
        isDirectConversation: true,
        previousSpaceSlug: 'live-earth',
        nextSpaceSlug: null,
        onNetworkShell: true,
      }),
    ).toBe(true);
  });

  it('resets a direct message when moving from one space to another', () => {
    expect(
      shouldPreserveDirectMessageOnSpaceLeave({
        isDirectConversation: true,
        previousSpaceSlug: 'live-earth',
        nextSpaceSlug: 'hypha',
        onNetworkShell: false,
      }),
    ).toBe(false);
  });

  it('does not preserve a signal thread as a direct message', () => {
    expect(
      shouldPreserveDirectMessageOnSpaceLeave({
        isDirectConversation: false,
        previousSpaceSlug: 'live-earth',
        nextSpaceSlug: null,
        onNetworkShell: true,
      }),
    ).toBe(false);
  });
});
