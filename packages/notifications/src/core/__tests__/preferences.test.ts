import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({
  getUser: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  createSubscription: vi.fn(),
  updateSubscription: vi.fn(),
  deleteSubscription: vi.fn(),
}));
vi.mock('../../sdk/client', () => ({ sdkClient: sdk }));

import {
  enrolNotifications,
  getNotificationPreferences,
  saveNotificationPreferences,
  unenrolNotifications,
} from '../preferences';

const notFound = Object.assign(new Error('not found'), { code: 404 });

function user(
  tags: Record<string, string> = {},
  subscriptions: Record<string, unknown>[] = [],
) {
  return { properties: { tags }, subscriptions };
}

describe('notification preferences (server side)', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_ONESIGNAL_APP_ID', 'app-id');
    Object.values(sdk).forEach((fn) => fn.mockReset());
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('getNotificationPreferences', () => {
    it('treats a person without a OneSignal user as not enrolled, defaults on', async () => {
      sdk.getUser.mockRejectedValue(notFound);
      const prefs = await getNotificationPreferences('alice');
      expect(prefs.subscribed).toBe(false);
      // Email can't be delivered without a subscription, so it is not shown as on.
      expect(prefs.emailEnabled).toBe(false);
      expect(prefs.pushTagEnabled).toBe(true);
      expect(prefs.subscriptions.every((s) => s.value)).toBe(true);
      expect(sdk.createUser).not.toHaveBeenCalled();
    });

    it('reads tags: subscribed opt-in, disabled and legacy false switch off', async () => {
      sdk.getUser.mockResolvedValue(
        user({
          subscribed: 'true',
          email: 'disabled',
          push: 'false',
          sub_signals: 'disabled',
        }),
      );
      const prefs = await getNotificationPreferences('alice');
      expect(sdk.getUser).toHaveBeenCalledWith(
        'app-id',
        'external_id',
        'alice',
      );
      expect(prefs.subscribed).toBe(true);
      expect(prefs.emailEnabled).toBe(false);
      expect(prefs.pushTagEnabled).toBe(false);
      expect(
        prefs.subscriptions.find((s) => s.name === 'sub_signals')?.value,
      ).toBe(false);
    });

    it('rethrows errors other than not-found', async () => {
      sdk.getUser.mockRejectedValue(
        Object.assign(new Error('boom'), { code: 500 }),
      );
      await expect(getNotificationPreferences('alice')).rejects.toThrow('boom');
    });

    it('throws when the app id is missing', async () => {
      vi.stubEnv('NEXT_PUBLIC_ONESIGNAL_APP_ID', '');
      await expect(getNotificationPreferences('alice')).rejects.toThrow(
        'ONESIGNAL_APP_ID environment variable is not set',
      );
    });
  });

  describe('enrolNotifications', () => {
    it('creates the user by external_id when absent, then writes subscribed + own-actions off', async () => {
      sdk.getUser.mockRejectedValue(notFound);
      sdk.createUser.mockResolvedValue(user());
      const prefs = await enrolNotifications('alice');
      expect(sdk.createUser).toHaveBeenCalledWith('app-id', {
        identity: { external_id: 'alice' },
        properties: { tags: {} },
      });
      expect(sdk.updateUser).toHaveBeenCalledWith(
        'app-id',
        'external_id',
        'alice',
        {
          properties: {
            tags: { subscribed: 'true', sub_ownActions: 'disabled' },
          },
        },
      );
      expect(prefs.subscribed).toBe(true);
    });

    it('never overwrites an own-actions choice the person already made', async () => {
      sdk.getUser.mockResolvedValue(user({ sub_ownActions: 'true' }));
      await enrolNotifications('alice');
      expect(sdk.createUser).not.toHaveBeenCalled();
      expect(sdk.updateUser.mock.calls[0][3]).toEqual({
        properties: { tags: { subscribed: 'true' } },
      });
    });

    it('falls back to the existing user when creation races with the SDK login', async () => {
      sdk.getUser
        .mockRejectedValueOnce(notFound)
        .mockResolvedValueOnce(user({ subscribed: 'false' }));
      sdk.createUser.mockRejectedValue(new Error('already exists'));
      await expect(enrolNotifications('alice')).resolves.toMatchObject({
        subscribed: true,
      });
    });
  });

  it('unenrolNotifications writes subscribed=false', async () => {
    sdk.getUser.mockResolvedValue(user({ subscribed: 'true' }));
    const prefs = await unenrolNotifications('alice');
    expect(sdk.updateUser.mock.calls[0][3]).toEqual({
      properties: { tags: { subscribed: 'false' } },
    });
    expect(prefs.subscribed).toBe(false);
  });

  describe('saveNotificationPreferences', () => {
    const subs = [
      { name: 'sub_signals' as const, value: false },
      { name: 'consent_mentions' as const, value: true },
    ];

    it('batches all tags into one update: off => disabled, on => removed', async () => {
      sdk.getUser.mockResolvedValue(user({ subscribed: 'true' }));
      await saveNotificationPreferences('alice', undefined, {
        emailEnabled: false,
        pushTagEnabled: true,
        subscriptions: subs,
      });
      expect(sdk.updateUser).toHaveBeenCalledTimes(1);
      expect(sdk.updateUser.mock.calls[0][3]).toEqual({
        properties: {
          tags: {
            email: 'disabled',
            push: '',
            sub_signals: 'disabled',
            consent_mentions: '',
          },
        },
      });
    });

    it('leaves the push tag alone when pushTagEnabled is omitted', async () => {
      sdk.getUser.mockResolvedValue(user());
      await saveNotificationPreferences('alice', undefined, {
        emailEnabled: true,
        subscriptions: [],
      });
      expect(
        Object.keys(sdk.updateUser.mock.calls[0][3].properties.tags),
      ).toEqual(['email']);
    });

    it('ignores tag names that are not preference groups', async () => {
      sdk.getUser.mockResolvedValue(user());
      await saveNotificationPreferences('alice', undefined, {
        emailEnabled: true,
        subscriptions: [
          { name: 'subscribed' as never, value: false },
          { name: 'sub_signals', value: false },
        ],
      });
      const tags = sdk.updateUser.mock.calls[0][3].properties.tags;
      expect(tags.subscribed).toBeUndefined();
      expect(tags.sub_signals).toBe('disabled');
    });

    it('email on: creates an Email subscription for the address when none exists', async () => {
      sdk.getUser.mockResolvedValue(user());
      await saveNotificationPreferences('alice', 'a@example.com', {
        emailEnabled: true,
        subscriptions: [],
      });
      expect(sdk.createSubscription).toHaveBeenCalledWith(
        'app-id',
        'external_id',
        'alice',
        {
          subscription: {
            type: 'Email',
            token: 'a@example.com',
            enabled: true,
          },
        },
      );
    });

    it('email on: re-enables an unsubscribed subscription instead of duplicating it', async () => {
      sdk.getUser.mockResolvedValue(
        user({}, [
          {
            id: 'sub-1',
            type: 'Email',
            token: 'A@Example.com',
            enabled: false,
          },
        ]),
      );
      await saveNotificationPreferences('alice', 'a@example.com', {
        emailEnabled: true,
        subscriptions: [],
      });
      expect(sdk.createSubscription).not.toHaveBeenCalled();
      expect(sdk.updateSubscription).toHaveBeenCalledWith('app-id', 'sub-1', {
        subscription: { enabled: true },
      });
    });

    it('email on with an already enabled subscription is a no-op for subscriptions', async () => {
      sdk.getUser.mockResolvedValue(
        user({}, [
          { id: 'sub-1', type: 'Email', token: 'a@example.com', enabled: true },
        ]),
      );
      await saveNotificationPreferences('alice', 'a@example.com', {
        emailEnabled: true,
        subscriptions: [],
      });
      expect(sdk.createSubscription).not.toHaveBeenCalled();
      expect(sdk.updateSubscription).not.toHaveBeenCalled();
    });

    it('email off: deletes the matching subscription, leaves other types alone', async () => {
      sdk.getUser.mockResolvedValue(
        user({}, [
          { id: 'push-1', type: 'ChromePush', token: 'x', enabled: true },
          { id: 'sub-1', type: 'Email', token: 'a@example.com', enabled: true },
        ]),
      );
      await saveNotificationPreferences('alice', 'a@example.com', {
        emailEnabled: false,
        subscriptions: [],
      });
      expect(sdk.deleteSubscription).toHaveBeenCalledTimes(1);
      expect(sdk.deleteSubscription).toHaveBeenCalledWith('app-id', 'sub-1');
    });

    it('touches no email subscription when the person has no address', async () => {
      sdk.getUser.mockResolvedValue(user());
      await saveNotificationPreferences('alice', undefined, {
        emailEnabled: true,
        subscriptions: [],
      });
      expect(sdk.createSubscription).not.toHaveBeenCalled();
    });
  });

  describe('email delivery state', () => {
    const enabledSub = {
      id: 's1',
      type: 'Email',
      token: 'a@example.com',
      enabled: true,
    };

    it('shows email on only with the tag allowing it AND an enabled subscription for the address', async () => {
      sdk.getUser.mockResolvedValue(user({}, [enabledSub]));
      expect(
        (await getNotificationPreferences('alice', 'a@example.com'))
          .emailEnabled,
      ).toBe(true);
      expect(
        (await getNotificationPreferences('alice', 'other@example.com'))
          .emailEnabled,
      ).toBe(false);
      sdk.getUser.mockResolvedValue(user({ email: 'disabled' }, [enabledSub]));
      expect(
        (await getNotificationPreferences('alice', 'a@example.com'))
          .emailEnabled,
      ).toBe(false);
      sdk.getUser.mockResolvedValue(
        user({}, [{ ...enabledSub, enabled: false }]),
      );
      expect(
        (await getNotificationPreferences('alice', 'a@example.com'))
          .emailEnabled,
      ).toBe(false);
    });

    it('enrol creates the Email subscription before writing the tags', async () => {
      sdk.getUser.mockResolvedValue(user());
      const order: string[] = [];
      sdk.createSubscription.mockImplementation(async () =>
        order.push('subscription'),
      );
      sdk.updateUser.mockImplementation(async () => order.push('tags'));
      const prefs = await enrolNotifications('alice', 'a@example.com');
      expect(order).toEqual(['subscription', 'tags']);
      expect(prefs.emailEnabled).toBe(true);
    });

    it('enrol keeps an explicit email opt-out: no subscription is created', async () => {
      sdk.getUser.mockResolvedValue(user({ email: 'disabled' }));
      const prefs = await enrolNotifications('alice', 'a@example.com');
      expect(sdk.createSubscription).not.toHaveBeenCalled();
      expect(prefs.emailEnabled).toBe(false);
    });

    it('enrol does not re-enable a subscription that was unsubscribed from an email', async () => {
      sdk.getUser.mockResolvedValue(
        user({}, [{ ...enabledSub, enabled: false }]),
      );
      const prefs = await enrolNotifications('alice', 'a@example.com');
      expect(sdk.updateSubscription).not.toHaveBeenCalled();
      expect(prefs.emailEnabled).toBe(false);
    });

    it('enrol without an address creates nothing and shows email off', async () => {
      sdk.getUser.mockResolvedValue(user());
      const prefs = await enrolNotifications('alice', undefined);
      expect(sdk.createSubscription).not.toHaveBeenCalled();
      expect(prefs.emailEnabled).toBe(false);
    });

    it('save with email on and no address stores the email tag as disabled', async () => {
      sdk.getUser.mockResolvedValue(user());
      const prefs = await saveNotificationPreferences('alice', undefined, {
        emailEnabled: true,
        subscriptions: [],
      });
      expect(sdk.updateUser.mock.calls[0][3].properties.tags.email).toBe(
        'disabled',
      );
      expect(prefs.emailEnabled).toBe(false);
    });

    it('save with email on does not write the tag if creating the subscription fails', async () => {
      sdk.getUser.mockResolvedValue(user());
      sdk.createSubscription.mockRejectedValue(new Error('boom'));
      await expect(
        saveNotificationPreferences('alice', 'a@example.com', {
          emailEnabled: true,
          subscriptions: [],
        }),
      ).rejects.toThrow('boom');
      expect(sdk.updateUser).not.toHaveBeenCalled();
    });

    it('save with email off writes the tag before removing the subscription', async () => {
      sdk.getUser.mockResolvedValue(user({}, [enabledSub]));
      const order: string[] = [];
      sdk.updateUser.mockImplementation(async () => order.push('tags'));
      sdk.deleteSubscription.mockImplementation(async () =>
        order.push('delete'),
      );
      await saveNotificationPreferences('alice', 'a@example.com', {
        emailEnabled: false,
        subscriptions: [],
      });
      expect(order).toEqual(['tags', 'delete']);
    });
  });
});
