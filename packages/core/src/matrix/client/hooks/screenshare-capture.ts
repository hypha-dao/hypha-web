/** Matrix `GroupCall.setScreensharingEnabled` opts — request tab/window audio when supported. */
export const MATRIX_SCREENSHARE_CAPTURE_OPTS = {
  audio: { suppressLocalAudioPlayback: false },
} as const;

export function screenshareStreamHasTabAudio(
  stream: MediaStream | null | undefined,
): boolean {
  return (stream?.getAudioTracks().length ?? 0) > 0;
}
