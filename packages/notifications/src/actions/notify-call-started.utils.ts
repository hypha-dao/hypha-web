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

export function buildCallStartedEmailBody({
  actorDisplayName,
  contextLabel,
  url,
}: {
  actorDisplayName: string;
  contextLabel: string;
  url: string;
}): string {
  const escapedActor = escapeHtml(actorDisplayName);
  const escapedContext = escapeHtml(contextLabel);
  const escapedUrl = escapeHtml(getSafeHref(url));
  return `
    <p><strong>${escapedActor}</strong> started a call in ${escapedContext}.</p>
    <p><a href="${escapedUrl}">Join call</a></p>
  `.trim();
}
