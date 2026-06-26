'use client';

const KEEP_AI_PANEL_OPEN_KEY = 'hypha:keep-ai-panel-open';

export function markKeepAiPanelOpen(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(KEEP_AI_PANEL_OPEN_KEY, 'true');
}

export function consumeKeepAiPanelOpen(): boolean {
  if (typeof window === 'undefined') return false;
  const pending =
    window.sessionStorage.getItem(KEEP_AI_PANEL_OPEN_KEY) === 'true';
  if (pending) {
    window.sessionStorage.removeItem(KEEP_AI_PANEL_OPEN_KEY);
  }
  return pending;
}
