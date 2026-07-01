export type GlobalCallDockMode = 'thumbnail' | 'expanded' | 'fullscreen';
export type CallResumeKind = 'audio' | 'video';

export type CallResumeSnapshot = {
  version: 1;
  roomId: string;
  spaceSlug: string | null;
  callKind: CallResumeKind;
  threadRootEventId?: string;
  dockMode: GlobalCallDockMode;
  updatedAt: number;
  signalTitle?: string;
  signalSlug?: string;
  roomTitle?: string;
};

export const CALL_RESUME_KEY = 'hypha-global-call-resume-v1';
export const CALL_DISMISSED_KEY = 'hypha-global-call-dismissed-v1';
export const CALL_RESUME_MAX_AGE_MS = 30 * 60 * 1000;

type CallDismissedMarker = {
  roomId: string;
  at: number;
};

export function clearCallResumeSnapshot(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(CALL_RESUME_KEY);
  } catch {
    // ignore persistence write failure
  }
}

export function persistCallResumeSnapshot(snapshot: CallResumeSnapshot): void {
  if (typeof window === 'undefined') return;
  if (isCallDismissedByUser(snapshot.roomId)) return;
  try {
    window.localStorage.setItem(CALL_RESUME_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore persistence write failure
  }
}

export function readCallResumeSnapshot(): CallResumeSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CALL_RESUME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CallResumeSnapshot>;
    if (
      parsed.version !== 1 ||
      typeof parsed.roomId !== 'string' ||
      !parsed.roomId.trim() ||
      (parsed.callKind !== 'audio' && parsed.callKind !== 'video') ||
      (parsed.dockMode !== 'thumbnail' &&
        parsed.dockMode !== 'expanded' &&
        parsed.dockMode !== 'fullscreen') ||
      typeof parsed.updatedAt !== 'number'
    ) {
      clearCallResumeSnapshot();
      return null;
    }
    if (Date.now() - parsed.updatedAt > CALL_RESUME_MAX_AGE_MS) {
      clearCallResumeSnapshot();
      return null;
    }
    const roomId = parsed.roomId.trim();
    if (isCallDismissedByUser(roomId)) {
      clearCallResumeSnapshot();
      return null;
    }
    return {
      version: 1,
      roomId,
      spaceSlug: parsed.spaceSlug?.trim() || null,
      callKind: parsed.callKind,
      threadRootEventId: parsed.threadRootEventId?.trim() || undefined,
      dockMode: parsed.dockMode,
      updatedAt: parsed.updatedAt,
      signalTitle: parsed.signalTitle?.trim() || undefined,
      signalSlug: parsed.signalSlug?.trim() || undefined,
      roomTitle: parsed.roomTitle?.trim() || undefined,
    };
  } catch {
    clearCallResumeSnapshot();
    return null;
  }
}

export function markCallDismissedByUser(
  roomId: string | null | undefined,
): void {
  const id = roomId?.trim();
  if (!id || typeof window === 'undefined') return;
  try {
    const marker: CallDismissedMarker = { roomId: id, at: Date.now() };
    window.sessionStorage.setItem(CALL_DISMISSED_KEY, JSON.stringify(marker));
  } catch {
    // ignore storage write failure
  }
}

export function clearCallDismissedByUser(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(CALL_DISMISSED_KEY);
  } catch {
    // ignore storage write failure
  }
}

export function isCallDismissedByUser(
  roomId: string | null | undefined,
): boolean {
  const id = roomId?.trim();
  if (!id || typeof window === 'undefined') return false;
  try {
    const raw = window.sessionStorage.getItem(CALL_DISMISSED_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Partial<CallDismissedMarker>;
    if (typeof parsed.roomId !== 'string' || typeof parsed.at !== 'number') {
      clearCallDismissedByUser();
      return false;
    }
    if (parsed.roomId.trim() !== id) return false;
    if (Date.now() - parsed.at > CALL_RESUME_MAX_AGE_MS) {
      clearCallDismissedByUser();
      return false;
    }
    return true;
  } catch {
    clearCallDismissedByUser();
    return false;
  }
}

export function shouldPersistCallResumeSnapshot(
  roomId: string | null | undefined,
): boolean {
  const id = roomId?.trim();
  if (!id) return false;
  return !isCallDismissedByUser(id);
}
