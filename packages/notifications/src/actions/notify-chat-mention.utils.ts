export function sanitizeMentionIds(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
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
  const escapedActor = actorDisplayName
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const escapedPreview = messagePreview
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `
    <p><strong>${escapedActor}</strong> mentioned you in chat.</p>
    <p>${escapedPreview || 'Open chat to view the message.'}</p>
    <p><a href="${url}">Open mention</a></p>
  `.trim();
}
