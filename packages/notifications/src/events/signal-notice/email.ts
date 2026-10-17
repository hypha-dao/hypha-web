import {
  emailSignalNotice,
  formatSignalDeadline,
  type SignalNoticeKind,
} from '../../template';

export const formatSignalNoticeDueAt = formatSignalDeadline;

/** Kept for existing callers; delegates to the shared template (`template/email/signal-emails.ts`). */
export function buildSignalNoticeEmail({
  kind,
  signalTitle,
  actorDisplayName,
  dueAt,
  url,
  settingsUrl,
}: {
  kind: SignalNoticeKind;
  signalTitle: string;
  actorDisplayName?: string;
  dueAt?: string | Date | null;
  url: string;
  settingsUrl?: string;
}): { subject: string; body: string; preheader?: string } {
  return emailSignalNotice({
    kind,
    signalTitle,
    actorName: actorDisplayName,
    dueAt,
    url,
    settingsUrl,
  });
}
