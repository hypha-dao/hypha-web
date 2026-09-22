import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./consent-gate', () => ({ gateRecipientChannels: vi.fn() }));

// Avoid pulling in the real delivery layer (`onesignal-adapter.ts` imports the OneSignal SDK
// client, which imports the `server-only` package — not resolvable in this package's test env,
// same reason `notify-chat-mention.test.ts`/`notify-call-started.test.ts` avoid the action files).
vi.mock('../delivery', () => {
  let active: { sendMany: (...args: unknown[]) => unknown } | undefined;
  return {
    setNotificationDispatcher: (dispatcher: typeof active) => {
      active = dispatcher;
    },
    getNotificationDispatcher: () => active,
  };
});

import { gateRecipientChannels } from './consent-gate';
import { setNotificationDispatcher } from '../delivery';
import { dispatch } from './dispatch';
import { registerEventHandlers } from './registry';
import type { NotificationDispatcher } from '../delivery/types';
import type { ProposalCreatedEvent, Recipient } from './types';

const event: ProposalCreatedEvent = {
  type: 'proposal.created',
  source: { kind: 'domain', entityType: 'proposal', entityId: '1' },
  context: { proposalWeb3Id: 1n, spaceWeb3Id: 2n, creatorWeb3Address: '0xabc' },
  payload: {
    url: 'https://app.hypha.earth/en',
    unsubscribeLink: 'https://app.hypha.earth/en/unsub',
  },
};

describe('dispatch', () => {
  let sendMany: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    sendMany = vi.fn().mockResolvedValue({ sent: 0, failed: 0 });
    setNotificationDispatcher({
      sendMany,
    } as unknown as NotificationDispatcher);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves, filters by strategy, gates consent, then hands only the allowed recipients+channels to the dispatcher', async () => {
    const recipients: Recipient[] = [
      { personSlug: 'alice', role: 'creator' },
      { personSlug: 'bob', role: 'member' },
    ];
    registerEventHandlers('proposal.created', {
      resolver: async () => recipients,
      contentBuilder: (_e, recipient) => ({
        channels: ['push'],
        requiredTags: { sub: 'true' },
        content: {
          push: { templateId: 't', customData: { who: recipient.personSlug } },
        },
      }),
      strategy: (_e, recipient) => recipient.personSlug !== 'bob',
    });
    vi.mocked(gateRecipientChannels).mockResolvedValue(
      new Map([['push', new Set(['alice'])]]),
    );

    await dispatch(event);

    expect(gateRecipientChannels).toHaveBeenCalledTimes(1);
    const [gatedRecipients] = vi.mocked(gateRecipientChannels).mock.calls[0];
    expect(gatedRecipients.map((r) => r.personSlug)).toEqual(['alice']);

    expect(sendMany).toHaveBeenCalledTimes(1);
    expect(sendMany).toHaveBeenCalledWith([
      {
        recipient: { personSlug: 'alice', role: 'creator' },
        channels: ['push'],
        content: { push: { templateId: 't', customData: { who: 'alice' } } },
      },
    ]);
  });

  it('never calls the consent gate or dispatcher when the strategy excludes every recipient', async () => {
    registerEventHandlers('proposal.created', {
      resolver: async () => [{ personSlug: 'bob' }],
      contentBuilder: () => ({
        channels: ['push'],
        requiredTags: {},
        content: {},
      }),
      strategy: () => false,
    });

    await dispatch(event);

    expect(gateRecipientChannels).not.toHaveBeenCalled();
    expect(sendMany).not.toHaveBeenCalled();
  });

  it('never calls the dispatcher when consent gating allows no channel for anyone', async () => {
    registerEventHandlers('proposal.created', {
      resolver: async () => [{ personSlug: 'carol' }],
      contentBuilder: () => ({
        channels: ['push'],
        requiredTags: {},
        content: { push: { templateId: 't' } },
      }),
    });
    vi.mocked(gateRecipientChannels).mockResolvedValue(
      new Map([['push', new Set()]]),
    );

    await dispatch(event);

    expect(sendMany).not.toHaveBeenCalled();
  });

  it('groups recipients sharing channels+requiredTags into one consent-gate call', async () => {
    registerEventHandlers('proposal.created', {
      resolver: async () => [{ personSlug: 'alice' }, { personSlug: 'bob' }],
      contentBuilder: () => ({
        channels: ['push'],
        requiredTags: { sub: 'true' },
        content: { push: { templateId: 't' } },
      }),
    });
    vi.mocked(gateRecipientChannels).mockResolvedValue(
      new Map([['push', new Set(['alice', 'bob'])]]),
    );

    await dispatch(event);

    expect(gateRecipientChannels).toHaveBeenCalledTimes(1);
    expect(sendMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ recipient: { personSlug: 'alice' } }),
        expect.objectContaining({ recipient: { personSlug: 'bob' } }),
      ]),
    );
  });
});
