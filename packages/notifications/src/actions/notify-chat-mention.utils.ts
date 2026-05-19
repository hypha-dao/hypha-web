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
}: {
  actorDisplayName: string;
  messagePreview: string;
  url: string;
}): string {
  const escapedActor = escapeHtml(actorDisplayName);
  const escapedPreview = escapeHtml(messagePreview);
  const escapedUrl = escapeHtml(getSafeMentionHref(url));
  return `
    <p><strong>${escapedActor}</strong> mentioned you in chat.</p>
    <p>${escapedPreview || 'Open chat to view the message.'}</p>
    <p><a href="${escapedUrl}">Open mention</a></p>
  `.trim();
}
