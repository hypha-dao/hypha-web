/**
 * Hypha no longer gates share behind a custom dialog — the browser picker is shown
 * immediately with `systemAudio: 'include'` on all desktop share modes.
 */
export function shouldShowScreenshareTabAudioPrompt(): boolean {
  return false;
}

/** @deprecated Browser picker is shown directly; kept for callers that mark "seen". */
export function markScreenshareTabAudioPromptSeen(): void {
  // no-op
}
