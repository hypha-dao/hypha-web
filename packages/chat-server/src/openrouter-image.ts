import 'server-only';

const DEFAULT_OPENROUTER_IMAGE_MODEL =
  process.env.OPENROUTER_IMAGE_MODEL?.trim() ||
  'black-forest-labs/flux.2-klein-4b';

function buildOpenRouterAppHeaders(): Record<string, string> {
  const referer =
    process.env.OPENROUTER_HTTP_REFERER?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL?.trim()
      ? `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, '')}`
      : '') ||
    'https://hypha.earth';

  const title = process.env.OPENROUTER_APP_TITLE?.trim() || 'Hypha Platform';

  return {
    'HTTP-Referer': referer,
    'X-Title': title,
  };
}

function extractImageDataUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const choice = (payload as { choices?: unknown[] }).choices?.[0];
  if (!choice || typeof choice !== 'object') return null;
  const message = (choice as { message?: unknown }).message;
  if (!message || typeof message !== 'object') return null;

  const images = (message as { images?: unknown[] }).images;
  if (Array.isArray(images)) {
    for (const image of images) {
      if (!image || typeof image !== 'object') continue;
      const nested = image as {
        image_url?: { url?: unknown };
        imageUrl?: { url?: unknown };
      };
      const url =
        typeof nested.image_url?.url === 'string'
          ? nested.image_url.url
          : typeof nested.imageUrl?.url === 'string'
          ? nested.imageUrl.url
          : null;
      if (url?.startsWith('data:image/')) return url;
    }
  }

  const content = (message as { content?: unknown }).content;
  if (typeof content === 'string' && content.startsWith('data:image/')) {
    return content;
  }

  return null;
}

export async function generateOpenRouterImage(prompt: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is missing.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  let response: Response;
  try {
    response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...buildOpenRouterAppHeaders(),
      },
      body: JSON.stringify({
        model: DEFAULT_OPENROUTER_IMAGE_MODEL,
        messages: [{ role: 'user', content: prompt }],
        modalities: ['image'],
        stream: false,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(
      `Image generation failed (${response.status})${
        errorText ? `: ${errorText.slice(0, 200)}` : ''
      }`,
    );
  }

  const payload: unknown = await response.json();
  const dataUrl = extractImageDataUrl(payload);
  if (!dataUrl) {
    throw new Error('Image generation returned no image data.');
  }
  return dataUrl;
}
