function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getSafeSignalHref(url: string): string {
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

export function buildSignalAssignedEmailSubject(signalTitle: string): string {
  return `You have been assigned: ${signalTitle}`;
}

export function buildSignalAssignedEmailBody({
  signalTitle,
  spaceTitle,
  actorDisplayName,
  url,
}: {
  signalTitle: string;
  spaceTitle?: string;
  actorDisplayName?: string;
  url: string;
}): string {
  const escapedTitle = escapeHtml(signalTitle);
  const escapedUrl = escapeHtml(getSafeSignalHref(url));
  const escapedActor = escapeHtml(actorDisplayName?.trim() || 'Someone');
  const spaceLine = spaceTitle?.trim()
    ? `<p style="margin:0 0 16px;color:#52525b;font-size:14px;">${escapeHtml(
        spaceTitle.trim(),
      )}</p>`
    : '';
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>You have been assigned a signal</title>
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
              ${spaceLine}
              <p style="margin:0 0 16px;">Hey there,</p>
              <p style="margin:0 0 8px;"><strong>${escapedActor}</strong> assigned you to the signal <strong>${escapedTitle}</strong>.</p>
              <p style="margin:24px 0 8px;">Open the signal to see the details and pick it up.</p>
              <p style="margin:0 0 24px;">
                <a href="${escapedUrl}" style="color:#2563eb;font-weight:600;text-decoration:underline;">View Signal</a>
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
