import { describe, expect, it } from 'vitest';
import { buildSignalNoticeContent } from '../content';
import type { Recipient, SignalBoardNoticeEvent } from '../../../core/types';

const recipient: Recipient = {
  personSlug: 'bob',
  role: 'mentioned',
  data: {
    actorDisplayName: 'Alice',
    url: 'https://app.hypha.earth/en/dho/hypha-energy/coherence?signal=coh-1',
  },
};

function event(
  kind: SignalBoardNoticeEvent['context']['kind'],
): SignalBoardNoticeEvent {
  return {
    type: 'signal.notice',
    source: { kind: 'domain', entityType: 'coherence', entityId: 'coh-1' },
    context: {
      spaceId: 1,
      recipientPersonIds: [2],
      actorPersonId: 1,
      kind,
    },
    payload: {
      signalSlug: 'coh-1',
      signalTitle: 'Draft the memorandum',
      dueAt: '2026-10-09T12:00:00.000Z',
    },
  };
}

describe('buildSignalNoticeContent', () => {
  it('notifies a mentioned person without implying assignment', () => {
    const result = buildSignalNoticeContent(event('mentioned'), recipient);
    const email = result.content.email as { subject: string; body: string };
    expect(email.subject).toContain('mentioned you');
    expect(email.body).toContain('does not change who owns the card');
    expect(email.body).toContain('coh-1');
  });

  it('includes the deadline when it changes or is overdue', () => {
    const changed = buildSignalNoticeContent(
      event('deadline_changed'),
      recipient,
    ).content.email as { subject: string; body: string };
    expect(changed.subject).toContain('Deadline updated');
    expect(changed.body).toContain('Draft the memorandum');

    const overdue = buildSignalNoticeContent(
      event('deadline_overdue'),
      recipient,
    ).content.email as { subject: string };
    expect(overdue.subject).toContain('Overdue');
  });
});
