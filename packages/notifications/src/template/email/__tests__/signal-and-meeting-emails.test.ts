import { describe, expect, it } from 'vitest';

import {
  emailScheduledItemInvitation,
  emailSignalAssigned,
  emailSignalNotice,
} from '..';

const links = {
  url: 'https://app.hypha.earth/en/dho/acme/coherence?signal=s1',
  settingsUrl: 'https://app.hypha.earth/en/network/notification-centre',
};

describe('emailSignalAssigned', () => {
  it('names actor, signal and space, with deadline and CTA', () => {
    const email = emailSignalAssigned({
      signalTitle: 'Fix <it>',
      spaceTitle: 'Acme',
      actorName: 'Alice',
      dueAt: '2026-10-09T12:00:00.000Z',
      ...links,
    });
    expect(email.subject).toBe('You have been assigned: Fix <it>');
    expect(email.preheader).toBe('Alice assigned you to a signal in Acme.');
    expect(email.body).toContain(
      '<strong>Alice</strong> assigned you to the signal <strong>Fix &lt;it&gt;</strong> in <strong>Acme</strong>.',
    );
    expect(email.body).toContain('Deadline: <strong>');
    expect(email.body).toContain('>View signal<');
    expect(email.body).toContain('[unsubscribe_url]');
    expect(email.body).toContain('Manage notification settings');
  });

  it('defaults actor/title and states when no deadline is set', () => {
    const email = emailSignalAssigned({ signalTitle: '  ' });
    expect(email.subject).toBe('You have been assigned: a signal');
    expect(email.body).toContain('<strong>Someone</strong>');
    expect(email.body).toContain('No deadline is set yet.');
  });
});

describe('emailSignalNotice', () => {
  it.each([
    ['mentioned', 'Alice mentioned you on Plan'],
    ['deadline_changed', 'Deadline updated: Plan'],
    ['deadline_reminder', 'Reminder: Plan is due soon'],
    ['deadline_overdue', 'Overdue: Plan'],
  ] as const)('%s subject', (kind, subject) => {
    const email = emailSignalNotice({
      kind,
      signalTitle: 'Plan',
      actorName: 'Alice',
      ...links,
    });
    expect(email.subject).toBe(subject);
    expect(email.preheader).toBeTruthy();
    expect(email.body).toContain('[unsubscribe_url]');
  });

  it('neutralises non-http(s) urls', () => {
    const email = emailSignalNotice({
      kind: 'mentioned',
      signalTitle: 'Plan',
      url: 'javascript:alert(1)',
    });
    expect(email.body).toContain('class="cta" href="#"');
  });
});

describe('emailScheduledItemInvitation', () => {
  const input = {
    title: 'Standup',
    spaceTitle: 'Acme',
    whenLabel: 'Friday, 10:00 – 10:30',
    joinUrl: 'https://meet.test/room?x=1&y=2',
    ...links,
  };

  it('builds subject, preheader, join CTA and copy-link fallback', () => {
    const email = emailScheduledItemInvitation({
      ...input,
      description: 'Weekly <sync>',
    });
    expect(email.subject).toBe('Invitation: Standup');
    expect(email.preheader).toBe('Standup · Friday, 10:00 – 10:30');
    expect(email.body).toContain(
      '<strong>Standup</strong> in <strong>Acme</strong>',
    );
    expect(email.body).toContain('href="https://meet.test/room?x=1&amp;y=2"');
    expect(email.body).toContain('Join meeting');
    expect(email.body).toContain('Weekly &lt;sync&gt;');
    expect(email.body).toContain('Or copy this link');
  });

  it('omits the description block when empty', () => {
    expect(
      emailScheduledItemInvitation({ ...input, description: ' ' }).body,
    ).not.toContain('class="preview"');
  });
});
