'use client';

import React from 'react';
import {
  addCallBackgroundUpload,
  CallBackgroundUploadError,
  type CallBackgroundUploadErrorCode,
  deleteCallBackgroundUpload,
  isCallBackgroundUploadStorageAvailable,
  listCallBackgroundUploads,
} from './call-background-uploads';

export type CallBackgroundUploadView = {
  id: string;
  /** `blob:` URL of the 1920x1080 image. */
  src: string;
  /** `blob:` URL of the thumbnail. */
  thumbnailSrc: string;
};

export type CallBackgroundUploads = {
  /** False where the browser cannot keep images (the add option is hidden). */
  available: boolean;
  /** Newest first; null until loaded. */
  uploads: CallBackgroundUploadView[] | null;
  busy: boolean;
  error: CallBackgroundUploadErrorCode | null;
  /** Stores a picked file; returns its id, or null on failure (see `error`). */
  add: (file: File) => Promise<string | null>;
  remove: (id: string) => Promise<void>;
};

/**
 * The member's own background images on this device (#2563), loaded from IndexedDB while `enabled`
 * (in a call, effect supported). Nothing is read otherwise.
 */
export function useCallBackgroundUploads({
  enabled,
}: {
  enabled: boolean;
}): CallBackgroundUploads {
  const [available, setAvailable] = React.useState(false);
  const [uploads, setUploads] = React.useState<
    CallBackgroundUploadView[] | null
  >(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] =
    React.useState<CallBackgroundUploadErrorCode | null>(null);
  const urlsRef = React.useRef<string[]>([]);
  /** Bumped on disable and unmount; a read that finishes for an older value is dropped. */
  const lifecycleRef = React.useRef(0);

  const revokeAll = React.useCallback(() => {
    for (const url of urlsRef.current) URL.revokeObjectURL(url);
    urlsRef.current = [];
  }, []);

  /** `lifecycle`: the value when the caller started; a later disable/unmount drops the result. */
  const reload = React.useCallback(async (lifecycle = lifecycleRef.current) => {
    if (lifecycle !== lifecycleRef.current) return;
    const stored = await listCallBackgroundUploads();
    if (lifecycle !== lifecycleRef.current) return;
    const views = stored.map((upload) => ({
      id: upload.id,
      src: URL.createObjectURL(upload.image),
      thumbnailSrc: URL.createObjectURL(upload.thumbnail),
    }));
    const previous = urlsRef.current;
    urlsRef.current = views.flatMap((v) => [v.src, v.thumbnailSrc]);
    setUploads(views);
    // The processor decodes an image when it switches to it; revoke the old URLs a bit later.
    setTimeout(
      () => previous.forEach((url) => URL.revokeObjectURL(url)),
      10_000,
    );
  }, []);

  React.useEffect(() => {
    if (!enabled) {
      lifecycleRef.current += 1;
      setUploads(null);
      revokeAll();
      return;
    }
    let cancelled = false;
    void (async () => {
      const ok = await isCallBackgroundUploadStorageAvailable();
      if (cancelled) return;
      setAvailable(ok);
      if (ok) await reload();
      else setUploads([]);
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, reload, revokeAll]);

  React.useEffect(
    () => () => {
      lifecycleRef.current += 1;
      revokeAll();
    },
    [revokeAll],
  );

  const add = React.useCallback(
    async (file: File) => {
      const lifecycle = lifecycleRef.current;
      setBusy(true);
      setError(null);
      try {
        const upload = await addCallBackgroundUpload(file);
        // The write completes either way; an obsolete view just does not publish it.
        if (lifecycle !== lifecycleRef.current) return null;
        await reload(lifecycle);
        return upload.id;
      } catch (err) {
        if (lifecycle !== lifecycleRef.current) return null;
        setError(
          err instanceof CallBackgroundUploadError
            ? err.code
            : 'storage_failed',
        );
        return null;
      } finally {
        setBusy(false);
      }
    },
    [reload],
  );

  const remove = React.useCallback(
    async (id: string) => {
      const lifecycle = lifecycleRef.current;
      setError(null);
      const failed = await deleteCallBackgroundUpload(id).then(
        () => false,
        () => true,
      );
      if (lifecycle !== lifecycleRef.current) return;
      if (failed) setError('storage_failed');
      await reload(lifecycle);
    },
    [reload],
  );

  return { available, uploads, busy, error, add, remove };
}
