import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../client', () => ({
  sdkClient: { createNotification: vi.fn() },
}));

import { sdkClient } from '../client';
import { notify } from '../notify';

const notification = {
  app_id: 'app-1',
  target_channel: 'email',
  include_aliases: { external_id: ['gerroza', 'gernz'] },
} as never;

afterEach(() => {
  vi.restoreAllMocks();
});

function loggedFailure(spy: ReturnType<typeof vi.spyOn>): string {
  const [message, details] = spy.mock.calls[0] ?? [];
  return JSON.stringify([message, details]);
}

describe('notify failure logging', () => {
  it('logs the shape of an invalid_aliases rejection without the recipient aliases', async () => {
    vi.mocked(sdkClient.createNotification).mockResolvedValue({
      errors: { invalid_aliases: { external_id: ['gerroza', 'gernz'] } },
    } as never);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(notify(notification)).rejects.toThrow(
      'Failed to create a notification',
    );

    const logged = loggedFailure(spy);
    expect(logged).toContain('invalid_aliases');
    expect(logged).toContain('email');
    expect(logged).toContain('"recipients":2');
    expect(logged).not.toContain('gerroza');
    expect(logged).not.toContain('gernz');
  });

  it('keeps the rejection message from an API exception body but drops identifiers', async () => {
    vi.mocked(sdkClient.createNotification).mockRejectedValue({
      code: 400,
      body: JSON.stringify({
        errors: ['Notification content must not be empty'],
        invalid_aliases: { external_id: ['gerroza'] },
      }),
    });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(notify(notification)).rejects.toThrow(
      'Failed to create a notification',
    );

    const logged = loggedFailure(spy);
    expect(logged).toContain('400');
    expect(logged).toContain('Notification content must not be empty');
    expect(logged).not.toContain('gerroza');
  });
});
