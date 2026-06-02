const SESSION_STORAGE_KEY = 'hypha:call-screenshare-tab-audio-prompt-seen';

export function shouldShowScreenshareTabAudioPrompt(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(SESSION_STORAGE_KEY) !== '1';
  } catch {
    return false;
  }
}

export function markScreenshareTabAudioPromptSeen(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, '1');
  } catch {
    // Ignore private mode / blocked storage.
  }
}
