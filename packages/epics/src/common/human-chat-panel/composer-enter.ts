/**
 * Composer Enter behavior: desktop sends, mobile inserts a newline.
 * Shift+Enter is always a newline on desktop. Mobile send is the button.
 */

export function composerKeySendsMessage(input: {
  key: string;
  shiftKey: boolean;
  isTouchComposer: boolean;
}): boolean {
  if (input.key !== 'Enter') return false;
  if (input.isTouchComposer) return false;
  return !input.shiftKey;
}

export function composerKeyInsertsNewline(input: {
  key: string;
  shiftKey: boolean;
  isTouchComposer: boolean;
}): boolean {
  if (input.key !== 'Enter') return false;
  if (input.isTouchComposer) return true;
  return input.shiftKey;
}
