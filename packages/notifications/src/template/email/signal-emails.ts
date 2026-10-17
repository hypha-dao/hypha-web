import type { Email } from './types';
import {
  layout,
  paragraph,
  paragraphHtml,
  safeHref,
  strong,
} from '../common/layout';

export type SignalNoticeKind =
  | 'deadline_changed'
  | 'mentioned'
  | 'deadline_reminder'
  | 'deadline_overdue';

export function formatSignalDeadline(
  dueAt?: string | Date | null,
): string | null {
  if (dueAt == null || dueAt === '') return null;
  const date = dueAt instanceof Date ? dueAt : new Date(dueAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

interface SignalEmailLinks {
  /** Signal card URL (CTA). */
  url?: string;
  settingsUrl?: string;
  appUrl?: string;
}

function signalLayout({
  title,
  preheader,
  contentHtml,
  url,
  settingsUrl,
  appUrl,
}: SignalEmailLinks & {
  title: string;
  preheader: string;
  contentHtml: string;
}): string {
  return layout({
    title,
    preheader,
    appUrl,
    contentHtml,
    cta: {
      label: 'View signal',
      url: url ? safeHref(url) : appUrl ?? 'https://app.hypha.earth',
    },
    footer: {
      unsubscribe: true,
      settingsUrl: settingsUrl ? safeHref(settingsUrl) : undefined,
    },
  });
}

function deadlineParagraph(
  dueAt: string | Date | null | undefined,
  noDeadlineText: string,
): string {
  const deadline = formatSignalDeadline(dueAt);
  return deadline
    ? paragraphHtml(`Deadline: ${strong(deadline)}`)
    : paragraph(noDeadlineText);
}

/** Signal assigned (email only, gated on `sub_signals`). */
export function emailSignalAssigned({
  signalTitle,
  spaceTitle,
  actorName,
  dueAt,
  url,
  settingsUrl,
  appUrl,
}: SignalEmailLinks & {
  signalTitle: string;
  spaceTitle?: string;
  actorName?: string;
  dueAt?: string | Date | null;
}): Email {
  const title = signalTitle.trim() || 'a signal';
  const actor = actorName?.trim() || 'Someone';
  const space = spaceTitle?.trim();
  const subject = `You have been assigned: ${title}`;
  const preheader = space
    ? `${actor} assigned you to a signal in ${space}.`
    : `${actor} assigned you to a signal.`;

  const body = signalLayout({
    title: 'You have been assigned a signal',
    preheader,
    url,
    settingsUrl,
    appUrl,
    contentHtml: [
      paragraphHtml(
        `${strong(actor)} assigned you to the signal ${strong(title)}${
          space ? ` in ${strong(space)}` : ''
        }.`,
      ),
      deadlineParagraph(dueAt, 'No deadline is set yet.'),
      paragraph('Open the signal to see the details and pick it up.'),
    ].join(''),
  });

  return { subject, preheader, body };
}

/** Signal board notices (mentioned / deadline changed / reminder / overdue), gated on `sub_signals`. */
export function emailSignalNotice({
  kind,
  signalTitle,
  actorName,
  dueAt,
  url,
  settingsUrl,
  appUrl,
}: SignalEmailLinks & {
  kind: SignalNoticeKind;
  signalTitle: string;
  actorName?: string;
  dueAt?: string | Date | null;
}): Email {
  const title = signalTitle.trim() || 'a signal';
  const actor = actorName?.trim() || 'Someone';
  const links = { url, settingsUrl, appUrl };
  const noDeadline = 'No deadline is set.';

  if (kind === 'mentioned') {
    const subject = `${actor} mentioned you on ${title}`;
    const preheader = `${actor} mentioned you on a signal.`;
    return {
      subject,
      preheader,
      body: signalLayout({
        title: 'You were mentioned on a signal',
        preheader,
        ...links,
        contentHtml:
          paragraphHtml(`${strong(actor)} mentioned you on ${strong(title)}.`) +
          paragraph(
            'This does not change who owns the card. Open it to reply.',
          ),
      }),
    };
  }

  if (kind === 'deadline_changed') {
    const subject = `Deadline updated: ${title}`;
    const preheader = `${actor} changed the deadline on a signal.`;
    return {
      subject,
      preheader,
      body: signalLayout({
        title: 'Signal deadline updated',
        preheader,
        ...links,
        contentHtml:
          paragraphHtml(
            `${strong(actor)} changed the deadline on ${strong(title)}.`,
          ) + deadlineParagraph(dueAt, noDeadline),
      }),
    };
  }

  if (kind === 'deadline_reminder') {
    const subject = `Reminder: ${title} is due soon`;
    const preheader = 'A signal assigned to you is due soon.';
    return {
      subject,
      preheader,
      body: signalLayout({
        title: 'Signal deadline reminder',
        preheader,
        ...links,
        contentHtml:
          paragraphHtml(`${strong(title)} is due soon.`) +
          deadlineParagraph(dueAt, noDeadline),
      }),
    };
  }

  const subject = `Overdue: ${title}`;
  const preheader = 'A signal assigned to you is overdue.';
  return {
    subject,
    preheader,
    body: signalLayout({
      title: 'Signal is overdue',
      preheader,
      ...links,
      contentHtml:
        paragraphHtml(`${strong(title)} is now overdue.`) +
        deadlineParagraph(dueAt, noDeadline),
    }),
  };
}
