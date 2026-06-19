export function sanitizeMentionIds(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getSafeMentionHref(url: string): string {
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

export function buildMentionEmailBody({
  actorDisplayName,
  messagePreview,
  url,
  contextLabel,
}: {
  actorDisplayName: string;
  messagePreview: string;
  url: string;
  contextLabel?: string;
}): string {
  const escapedActor = escapeHtml(actorDisplayName);
  const escapedPreview = escapeHtml(messagePreview);
  const escapedUrl = escapeHtml(getSafeMentionHref(url));
  const escapedContext = escapeHtml(contextLabel?.trim() || 'chat');
  const previewBlock = escapedPreview
    ? `<p style="margin:16px 0;padding:12px 16px;background:#f4f4f5;border-radius:8px;color:#3f3f46;font-size:15px;line-height:1.5;">${escapedPreview}</p>`
    : '';
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapedActor} mentioned you</title>
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
              <p style="margin:0 0 8px;"><strong>${escapedActor}</strong> mentioned you in ${escapedContext}.</p>
              ${previewBlock}
              <p style="margin:24px 0 8px;">Jump back in to read the full message and reply.</p>
              <p style="margin:0 0 24px;">
                <a href="${escapedUrl}" style="color:#2563eb;font-weight:600;text-decoration:underline;">View Mention</a>
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
