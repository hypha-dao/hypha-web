import { describe, expect, it } from 'vitest';

import { buildSignalAssignedContent } from './content';
import type { Recipient, SignalAssignedEvent } from '../../core/types';

const event: SignalAssignedEvent = {
  type: 'signal.assigned',
  source: { kind: 'domain', entityType: 'coherence', entityId: 'coh-1' },
  context: { spaceId: 1, assigneePersonIds: [2], actorPersonId: 1 },
  payload: { signalSlug: 'coh-1', signalTitle: 'Fix the thing' },
};

const recipient: Recipient = {
  personSlug: 'bob',
  role: 'assignee',
  data: {
    spaceTitle: 'Hypha Energy',
    actorDisplayName: 'Alice',
    url: 'https://app.hypha.earth/en/dho/hypha-energy/coherence?signal=coh-1',
  },
};

describe('buildSignalAssignedContent', () => {
  it('sends email only, no push, no extra consent tag', () => {
    const result = buildSignalAssignedContent(event, recipient);

    expect(result.channels).toEqual(['email']);
    expect(result.requiredTags).toEqual({});
    expect(result.content.push).toBeUndefined();
    expect(result.content.email).toMatchObject({ kind: 'plain' });
  });

  it('includes the signal title, space title, actor, and link', () => {
    const { body } = buildSignalAssignedContent(event, recipient).content
      .email as { body: string };

    expect(body).toContain('Fix the thing');
    expect(body).toContain('Hypha Energy');
    expect(body).toContain('Alice');
    expect(body).toContain('coh-1');
  });

  it('falls back to "a signal" when the title is blank', () => {
    const blankTitleEvent: SignalAssignedEvent = {
      ...event,
      payload: { ...event.payload, signalTitle: '   ' },
    };

    const { subject } = buildSignalAssignedContent(blankTitleEvent, recipient)
      .content.email as { subject: string };

    expect(subject).toContain('a signal');
  });
});
