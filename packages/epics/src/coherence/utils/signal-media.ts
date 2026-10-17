import { isImageAttachment } from './signal-video';

export const SIGNAL_IMAGE_LIMIT = 8;
export const SIGNAL_DOCUMENT_LIMIT = 8;
export const SIGNAL_MEDIA_MAX_BYTES = 16 * 1024 * 1024;

export const SIGNAL_IMAGE_ACCEPT =
  'image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif';

export const SIGNAL_DOCUMENT_ACCEPT =
  '.pdf,.doc,.docx,.txt,.rtf,.odt,.ppt,.pptx,.xls,.xlsx,.csv,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv';

export const SIGNAL_CREATE_MEDIA_KEY = 'hypha:signal-create-media';

export type SignalMediaItem = { name: string; url: string };

export type SignalMediaDraft = {
  images: SignalMediaItem[];
  documents: SignalMediaItem[];
};

const UPLOAD_BATCH = 5;

export function splitSignalMedia(input?: {
  leadImage?: string | null;
  attachments?: SignalMediaItem[] | null;
}): SignalMediaDraft {
  const attachments = input?.attachments ?? [];
  const images = attachments.filter((item) =>
    isImageAttachment(item.url, item.name),
  );
  const documents = attachments.filter(
    (item) => !isImageAttachment(item.url, item.name),
  );
  const lead = input?.leadImage?.trim();
  if (lead && !images.some((item) => item.url === lead)) {
    images.unshift({
      name: lead.split('/').pop() || 'image',
      url: lead,
    });
  }
  return { images, documents };
}

export function writeSignalCreateMedia(draft: SignalMediaDraft) {
  if (typeof window === 'undefined') return;
  if (draft.images.length === 0 && draft.documents.length === 0) {
    window.sessionStorage.removeItem(SIGNAL_CREATE_MEDIA_KEY);
    return;
  }
  window.sessionStorage.setItem(SIGNAL_CREATE_MEDIA_KEY, JSON.stringify(draft));
}

export function takeSignalCreateMedia(): SignalMediaDraft | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(SIGNAL_CREATE_MEDIA_KEY);
  window.sessionStorage.removeItem(SIGNAL_CREATE_MEDIA_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SignalMediaDraft>;
    const images = Array.isArray(parsed.images)
      ? parsed.images.flatMap(mediaItem)
      : [];
    const documents = Array.isArray(parsed.documents)
      ? parsed.documents.flatMap(mediaItem)
      : [];
    if (images.length === 0 && documents.length === 0) return null;
    return { images, documents };
  } catch {
    return null;
  }
}

function mediaItem(value: unknown): SignalMediaItem[] {
  if (!value || typeof value !== 'object') return [];
  const name =
    'name' in value && typeof value.name === 'string' ? value.name : '';
  const url = 'url' in value && typeof value.url === 'string' ? value.url : '';
  if (!name.trim() || !url.trim()) return [];
  return [{ name: name.trim(), url: url.trim() }];
}

export function asMediaItems(
  updated: Array<string | { name?: string; url?: string }>,
): SignalMediaItem[] {
  return updated.flatMap((item) => {
    if (typeof item === 'string') {
      const name = item.split('/').pop() || item;
      return [{ name, url: item }];
    }
    if (item && typeof item.url === 'string') {
      return [
        {
          name: item.name?.trim() || item.url.split('/').pop() || item.url,
          url: item.url,
        },
      ];
    }
    return [];
  });
}

export function mergeMedia(
  current: SignalMediaItem[],
  extra: SignalMediaItem[],
  limit: number,
) {
  const seen = new Set(current.map((item) => item.url));
  const next = [...current];
  for (const item of extra) {
    if (seen.has(item.url) || next.length >= limit) continue;
    seen.add(item.url);
    next.push(item);
  }
  return next;
}

type UploadedFile = { name: string; ufsUrl?: string | null };

export async function uploadSignalFiles(
  files: File[],
  upload: (batch: File[]) => Promise<UploadedFile[] | undefined>,
): Promise<SignalMediaItem[]> {
  const saved: SignalMediaItem[] = [];
  for (let index = 0; index < files.length; index += UPLOAD_BATCH) {
    const batch = files.slice(index, index + UPLOAD_BATCH);
    const uploaded = await upload(batch);
    if (!uploaded || uploaded.length !== batch.length) {
      throw new Error('upload');
    }
    for (const item of uploaded) {
      const url = item.ufsUrl?.trim();
      if (!url) throw new Error('upload');
      saved.push({ name: item.name, url });
    }
  }
  return saved;
}
