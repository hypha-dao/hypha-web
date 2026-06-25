export function buildScheduledCallJoinPath(
  lang: string,
  spaceSlug: string,
): string {
  const params = new URLSearchParams();
  params.set('joinCall', '1');
  return `/${lang}/dho/${spaceSlug}?${params.toString()}`;
}

export function buildScheduledCalendarEventPath(
  lang: string,
  spaceSlug: string,
  itemId: number,
): string {
  return `/${lang}/dho/${spaceSlug}/calendar?event=${itemId}`;
}

export function resolveAppOrigin(): string | null {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, '')}`;

  return null;
}

export function toAbsoluteAppUrl(path: string): string {
  const origin = resolveAppOrigin();
  if (!origin) return path;
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}

export type MatrixAutoLinkInput = {
  type?: string;
  matrixAutoLink?: boolean;
  meetingUrl?: string | null;
  matrixRoomId?: string | null;
};

export function applyMatrixAutoLink<T extends MatrixAutoLinkInput>(
  input: T,
  args: {
    spaceSlug: string;
    chatRoomId?: string | null;
    lang?: string;
  },
): T {
  if (!input.matrixAutoLink) return input;
  if (input.type && input.type !== 'call' && input.type !== 'meeting')
    return input;
  if (!input.type) return input;

  const lang = args.lang?.trim() || 'en';
  const joinPath = buildScheduledCallJoinPath(lang, args.spaceSlug);
  const meetingUrl = input.meetingUrl?.trim() || toAbsoluteAppUrl(joinPath);

  return {
    ...input,
    matrixRoomId: args.chatRoomId?.trim() || input.matrixRoomId || null,
    meetingUrl,
  };
}

export function isMatrixLinkedCall(item: {
  type: string;
  matrixAutoLink?: boolean;
  matrixRoomId?: string | null;
}): boolean {
  return (
    (item.type === 'call' || item.type === 'meeting') &&
    Boolean(item.matrixAutoLink && item.matrixRoomId?.trim())
  );
}
