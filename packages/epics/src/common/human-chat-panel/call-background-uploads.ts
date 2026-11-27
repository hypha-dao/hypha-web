/**
 * The member's own call background images (#2563), kept in this browser only (IndexedDB), never
 * uploaded. Each image is re-encoded to a 1920x1080 JPEG (cover crop), which also drops location
 * and camera metadata and applies the photo's orientation. Up to three; at the limit the member
 * removes one before adding (nothing is replaced silently).
 *
 * Gone when site data is cleared, in private windows after closing, under storage pressure, or
 * (Safari) after 7 days without a visit; the effect then falls back to blur.
 */

export const CALL_BACKGROUND_UPLOAD_LIMIT = 3;
export const CALL_BACKGROUND_UPLOAD_MAX_BYTES = 15 * 1024 * 1024;
export const CALL_BACKGROUND_UPLOAD_WIDTH = 1920;
export const CALL_BACKGROUND_UPLOAD_HEIGHT = 1080;
const THUMB_WIDTH = 320;
const THUMB_HEIGHT = 180;

/** HEIC/HEIF decode only where the browser can (Safari); elsewhere decoding fails cleanly. */
export const CALL_BACKGROUND_UPLOAD_ACCEPT =
  'image/jpeg,image/png,image/webp,image/heic,image/heif';
const ACCEPTED_TYPES = new Set(CALL_BACKGROUND_UPLOAD_ACCEPT.split(','));

export type CallBackgroundUploadErrorCode =
  | 'unsupported_type'
  | 'too_large'
  | 'decode_failed'
  | 'limit_reached'
  | 'storage_failed';

export class CallBackgroundUploadError extends Error {
  constructor(readonly code: CallBackgroundUploadErrorCode) {
    super(code);
    this.name = 'CallBackgroundUploadError';
  }
}

export type StoredCallBackgroundUpload = {
  id: string;
  createdAt: number;
  image: Blob;
  thumbnail: Blob;
};

export function validateCallBackgroundUploadFile(file: {
  type: string;
  size: number;
}): CallBackgroundUploadErrorCode | null {
  if (!ACCEPTED_TYPES.has(file.type.toLowerCase())) return 'unsupported_type';
  if (file.size > CALL_BACKGROUND_UPLOAD_MAX_BYTES) return 'too_large';
  return null;
}

/** Source rectangle that covers the target aspect, centred (like CSS `object-fit: cover`). */
export function coverCropRect(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): { sx: number; sy: number; sw: number; sh: number } {
  const targetAspect = targetWidth / targetHeight;
  if (sourceWidth / sourceHeight > targetAspect) {
    const sw = Math.round(sourceHeight * targetAspect);
    return {
      sx: Math.round((sourceWidth - sw) / 2),
      sy: 0,
      sw,
      sh: sourceHeight,
    };
  }
  const sh = Math.round(sourceWidth / targetAspect);
  return {
    sx: 0,
    sy: Math.round((sourceHeight - sh) / 2),
    sw: sourceWidth,
    sh,
  };
}

/** Whether another image fits; at the limit the member removes one first (nothing is replaced). */
export function canAddCallBackgroundUpload(
  count: number,
  limit = CALL_BACKGROUND_UPLOAD_LIMIT,
): boolean {
  return count < limit;
}

const DB_NAME = 'hypha-call-backgrounds';
const DB_VERSION = 1;
const STORE = 'uploads';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new CallBackgroundUploadError('storage_failed'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new CallBackgroundUploadError('storage_failed'));
    request.onblocked = () =>
      reject(new CallBackgroundUploadError('storage_failed'));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await openDatabase();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = run(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request ? request.result : undefined);
      tx.onerror = () =>
        reject(new CallBackgroundUploadError('storage_failed'));
      tx.onabort = () =>
        reject(new CallBackgroundUploadError('storage_failed'));
    });
  } finally {
    db.close();
  }
}

/** Whether this browser can keep images (some private modes cannot). */
export async function isCallBackgroundUploadStorageAvailable(): Promise<boolean> {
  try {
    const db = await openDatabase();
    db.close();
    return true;
  } catch {
    return false;
  }
}

/** Newest first. An unreadable store reads as empty. */
export async function listCallBackgroundUploads(): Promise<
  StoredCallBackgroundUpload[]
> {
  try {
    const all =
      (await withStore<StoredCallBackgroundUpload[]>('readonly', (store) =>
        store.getAll(),
      )) ?? [];
    return all
      .filter((u) => u && typeof u.id === 'string' && u.image instanceof Blob)
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export async function deleteCallBackgroundUpload(id: string): Promise<void> {
  await withStore('readwrite', (store) => {
    store.delete(id);
  });
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new CallBackgroundUploadError('decode_failed')),
      'image/jpeg',
      quality,
    ),
  );
}

async function renderCover(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  quality: number,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new CallBackgroundUploadError('decode_failed');
  const { sx, sy, sw, sh } = coverCropRect(
    bitmap.width,
    bitmap.height,
    width,
    height,
  );
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, width, height);
  return canvasToJpeg(canvas, quality);
}

function newUploadId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Re-encodes and stores a picked file (refused at the limit). Throws
 * {@link CallBackgroundUploadError}.
 */
export async function addCallBackgroundUpload(
  file: File,
): Promise<StoredCallBackgroundUpload> {
  const invalid = validateCallBackgroundUploadFile(file);
  if (invalid) throw new CallBackgroundUploadError(invalid);
  if (!canAddCallBackgroundUpload((await listCallBackgroundUploads()).length)) {
    throw new CallBackgroundUploadError('limit_reached');
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new CallBackgroundUploadError('decode_failed');
  }
  let upload: StoredCallBackgroundUpload;
  try {
    upload = {
      id: newUploadId(),
      createdAt: Date.now(),
      image: await renderCover(
        bitmap,
        CALL_BACKGROUND_UPLOAD_WIDTH,
        CALL_BACKGROUND_UPLOAD_HEIGHT,
        0.86,
      ),
      thumbnail: await renderCover(bitmap, THUMB_WIDTH, THUMB_HEIGHT, 0.8),
    };
  } finally {
    bitmap.close();
  }
  await putWithinLimit(upload);
  return upload;
}

/**
 * Counts and inserts in one `readwrite` transaction, so two tabs adding at once cannot exceed the
 * limit (the early check above only avoids needless encoding). Throws `limit_reached`.
 */
async function putWithinLimit(upload: StoredCallBackgroundUpload) {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      let limitReached = false;
      const count = store.count();
      count.onsuccess = () => {
        if (!canAddCallBackgroundUpload(count.result)) {
          limitReached = true;
          tx.abort();
          return;
        }
        store.put(upload);
      };
      tx.oncomplete = () => resolve();
      tx.onabort = () =>
        reject(
          new CallBackgroundUploadError(
            limitReached ? 'limit_reached' : 'storage_failed',
          ),
        );
      tx.onerror = () => undefined; // onabort follows and reports
    });
  } finally {
    db.close();
  }
}
