function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getSafeHref(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '#';
    }
    return parsed.toString();
  } catch {
    return '#';
  }
}

export function formatSignalNoticeDueAt(
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

function wrapEmail({
  title,
  intro,
  body,
  url,
}: {
  title: string;
  intro: string;
  body: string;
  url: string;
}): string {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#ececee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ececee;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#0a0a0f;padding:28px 24px;text-align:center;">
              <p style="margin:0;color:#ffffff;font-size:18px;font-weight:600;line-height:1.4;">Hypha &mdash; Growing Together &#10024;</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px;color:#18181b;font-size:16px;line-height:1.6;">
              <p style="margin:0 0 16px;">Hey there,</p>
              <p style="margin:0 0 8px;">${intro}</p>
              ${body}
              <p style="margin:24px 0 8px;">
                <a href="${escapeHtml(
                  getSafeHref(url),
                )}" style="color:#2563eb;font-weight:600;text-decoration:underline;">Open the card</a>
              </p>
              <p style="margin:0;color:#52525b;">With appreciation,<br />Hypha</p>
            </td>
          </tr>
          <tr>
            <td style="background:#f4f4f5;padding:24px 28px;text-align:center;color:#71717a;font-size:13px;line-height:1.5;">
              <p style="margin:0 0 8px;">Questions? Contact us at <a href="mailto:support@hypha.earth" style="color:#2563eb;text-decoration:underline;">support@hypha.earth</a></p>
              <p style="margin:0 0 12px;">&copy; ${year} Hypha. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

export function buildSignalNoticeEmail({
  kind,
  signalTitle,
  actorDisplayName,
  dueAt,
  url,
}: {
  kind:
    | 'deadline_changed'
    | 'mentioned'
    | 'deadline_reminder'
    | 'deadline_overdue';
  signalTitle: string;
  actorDisplayName?: string;
  dueAt?: string | Date | null;
  url: string;
}): { subject: string; body: string } {
  const title = signalTitle.trim() || 'a signal';
  const actor = actorDisplayName?.trim() || 'Someone';
  const deadline = formatSignalNoticeDueAt(dueAt);
  const deadlineLine = deadline
    ? `<p style="margin:0 0 8px;">Deadline: <strong>${escapeHtml(
        deadline,
      )}</strong></p>`
    : '<p style="margin:0 0 8px;">No deadline is set.</p>';

  if (kind === 'mentioned') {
    return {
      subject: `${actor} mentioned you on ${title}`,
      body: wrapEmail({
        title: 'You were mentioned on a signal',
        intro: `<strong>${escapeHtml(
          actor,
        )}</strong> mentioned you on <strong>${escapeHtml(title)}</strong>.`,
        body: '<p style="margin:0 0 8px;">This does not change who owns the card. Open it to reply.</p>',
        url,
      }),
    };
  }
  if (kind === 'deadline_changed') {
    return {
      subject: `Deadline updated: ${title}`,
      body: wrapEmail({
        title: 'Signal deadline updated',
        intro: `<strong>${escapeHtml(
          actor,
        )}</strong> changed the deadline on <strong>${escapeHtml(
          title,
        )}</strong>.`,
        body: deadlineLine,
        url,
      }),
    };
  }
  if (kind === 'deadline_reminder') {
    return {
      subject: `Reminder: ${title} is due soon`,
      body: wrapEmail({
        title: 'Signal deadline reminder',
        intro: `<strong>${escapeHtml(title)}</strong> is due soon.`,
        body: deadlineLine,
        url,
      }),
    };
  }
  return {
    subject: `Overdue: ${title}`,
    body: wrapEmail({
      title: 'Signal is overdue',
      intro: `<strong>${escapeHtml(title)}</strong> is now overdue.`,
      body: deadlineLine,
      url,
    }),
  };
}
