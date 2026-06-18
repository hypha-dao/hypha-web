'use client';

const STORAGE_KEY = 'hypha:auth-return-path:v1';

const DHO_SPACE_CONTEXT_PATH = /^\/[^/]+\/dho\/[^/]+/;

export function isDhoSpaceContextPath(pathname: string): boolean {
  return DHO_SPACE_CONTEXT_PATH.test(pathname);
}

export function saveAuthReturnPath(pathname: string): void {
  if (!isDhoSpaceContextPath(pathname)) {
    clearAuthReturnPath();
    return;
  }

  try {
    window.sessionStorage.setItem(STORAGE_KEY, pathname);
  } catch {
    // Ignore storage failures; auth redirects fall back to default routes.
  }
}

export function peekAuthReturnPath(): string | null {
  try {
    const value = window.sessionStorage.getItem(STORAGE_KEY)?.trim();
    return value && isDhoSpaceContextPath(value) ? value : null;
  } catch {
    return null;
  }
}

export function consumeAuthReturnPath(): string | null {
  const value = peekAuthReturnPath();
  if (!value) return null;

  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }

  return value;
}

export function clearAuthReturnPath(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}
