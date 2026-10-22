'use client';

export type OnboardingVisualAssets = {
  logoUrl: string;
  leadImageUrl: string;
};

type MessagePart = {
  type?: string;
  state?: string;
  output?: unknown;
};

type MessageWithParts = {
  parts?: MessagePart[];
};

function isHttpImageUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
}

function readVisualUrlsFromRecord(
  record: Record<string, unknown> | null | undefined,
): OnboardingVisualAssets | null {
  if (!record) return null;
  const logoUrl = isHttpImageUrl(record.logo_url)
    ? record.logo_url.trim()
    : isHttpImageUrl(record.logoUrl)
    ? record.logoUrl.trim()
    : '';
  const leadImageUrl = isHttpImageUrl(record.lead_image_url)
    ? record.lead_image_url.trim()
    : isHttpImageUrl(record.leadImageUrl)
    ? record.leadImageUrl.trim()
    : isHttpImageUrl(record.leadImage)
    ? record.leadImage.trim()
    : '';
  if (!logoUrl || !leadImageUrl) return null;
  return { logoUrl, leadImageUrl };
}

function readVisualUrlsFromToolOutput(
  output: unknown,
): OnboardingVisualAssets | null {
  if (!output || typeof output !== 'object') return null;
  const value = output as {
    ok?: boolean;
    logo_url?: unknown;
    lead_image_url?: unknown;
    preview?: Record<string, unknown>;
    create_payload?: Record<string, unknown>;
  };
  if (value.ok === false) return null;

  return (
    readVisualUrlsFromRecord(value.create_payload) ??
    readVisualUrlsFromRecord(value.preview) ??
    readVisualUrlsFromRecord(value as Record<string, unknown>)
  );
}

function readPartialVisualUrls(output: unknown): {
  logoUrl: string | null;
  bannerUrl: string | null;
} {
  if (!output || typeof output !== 'object') {
    return { logoUrl: null, bannerUrl: null };
  }
  const value = output as Record<string, unknown> & {
    preview?: Record<string, unknown>;
    create_payload?: Record<string, unknown>;
  };
  if (value.ok === false) return { logoUrl: null, bannerUrl: null };
  const roots = [value, value.preview, value.create_payload].filter(
    (root): root is Record<string, unknown> =>
      Boolean(root) && typeof root === 'object',
  );
  let logoUrl: string | null = null;
  let bannerUrl: string | null = null;
  for (const root of roots) {
    if (!logoUrl) {
      logoUrl = isHttpImageUrl(root.logo_url)
        ? root.logo_url.trim()
        : isHttpImageUrl(root.logoUrl)
        ? root.logoUrl.trim()
        : null;
    }
    if (!bannerUrl) {
      bannerUrl = isHttpImageUrl(root.lead_image_url)
        ? root.lead_image_url.trim()
        : isHttpImageUrl(root.leadImageUrl)
        ? root.leadImageUrl.trim()
        : isHttpImageUrl(root.leadImage)
        ? root.leadImage.trim()
        : null;
    }
  }
  return { logoUrl, bannerUrl };
}

function isVisualToolPart(part: MessagePart) {
  const type = typeof part.type === 'string' ? part.type : '';
  if (type === 'tool-generate_space_visual_assets') return true;
  if (type === 'tool-create_space_from_onboarding') return true;
  return (
    type === 'dynamic-tool' &&
    (part as { toolName?: unknown }).toolName === 'generate_space_visual_assets'
  );
}

/** Logo and banner from one assistant message, including a partial result. */
export function generatedVisualsFromParts(parts: MessagePart[] | undefined): {
  logoUrl: string | null;
  bannerUrl: string | null;
} | null {
  let logoUrl: string | null = null;
  let bannerUrl: string | null = null;
  for (const part of parts ?? []) {
    if (!part || typeof part !== 'object') continue;
    if (!isVisualToolPart(part)) continue;
    if (part.state && part.state !== 'output-available') continue;
    const urls = readPartialVisualUrls(part.output);
    if (urls.logoUrl) logoUrl = urls.logoUrl;
    if (urls.bannerUrl) bannerUrl = urls.bannerUrl;
  }
  if (!logoUrl && !bannerUrl) return null;
  return { logoUrl, bannerUrl };
}

/** Recover the latest confirmed logo + banner URLs from onboarding chat tool output. */
export function extractOnboardingVisualAssetsFromMessages(
  messages: MessageWithParts[],
): OnboardingVisualAssets | null {
  for (
    let messageIndex = messages.length - 1;
    messageIndex >= 0;
    messageIndex -= 1
  ) {
    const parts = messages[messageIndex]?.parts ?? [];
    for (let partIndex = parts.length - 1; partIndex >= 0; partIndex -= 1) {
      const part = parts[partIndex];
      if (!part || typeof part !== 'object') continue;
      const type = typeof part.type === 'string' ? part.type : '';
      if (
        type !== 'tool-generate_space_visual_assets' &&
        type !== 'tool-create_space_from_onboarding'
      ) {
        continue;
      }
      if (part.state && part.state !== 'output-available') continue;
      const resolved = readVisualUrlsFromToolOutput(part.output);
      if (resolved) return resolved;
    }
  }
  return null;
}

export function mergeVisualAssetsIntoCreatePayload(
  payload: Record<string, unknown>,
  messages: MessageWithParts[],
  contextVisualAssets?: OnboardingVisualAssets | null,
): Record<string, unknown> {
  const resolved =
    contextVisualAssets ?? extractOnboardingVisualAssetsFromMessages(messages);
  if (!resolved) return payload;

  return {
    ...payload,
    ...(!isHttpImageUrl(payload.logo_url)
      ? { logo_url: resolved.logoUrl }
      : {}),
    ...(!isHttpImageUrl(payload.lead_image_url)
      ? { lead_image_url: resolved.leadImageUrl }
      : {}),
  };
}
