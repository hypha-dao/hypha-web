import { afterEach, describe, expect, it } from 'vitest';
import { isChatMessageNotificationsDisabled } from '../kill-switch';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('isChatMessageNotificationsDisabled', () => {
  it('is off by default', () => {
    delete process.env.HYPHA_DISABLE_CHAT_MESSAGE_NOTIFICATIONS;
    expect(isChatMessageNotificationsDisabled()).toBe(false);
  });

  it.each(['true', 'TRUE', ' true ', '1'])('is on for %j', (value) => {
    process.env.HYPHA_DISABLE_CHAT_MESSAGE_NOTIFICATIONS = value;
    expect(isChatMessageNotificationsDisabled()).toBe(true);
  });

  it.each(['false', '0', '', 'yes'])('stays off for %j', (value) => {
    process.env.HYPHA_DISABLE_CHAT_MESSAGE_NOTIFICATIONS = value;
    expect(isChatMessageNotificationsDisabled()).toBe(false);
  });
});
