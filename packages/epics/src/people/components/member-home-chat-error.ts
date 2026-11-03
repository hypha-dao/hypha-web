/** A spoken assistant reply is a finished turn, even if a late stream error arrives. */
export function homeAssistantTurnSucceeded(
  last: { role?: string } | undefined,
  text: string,
  droppedLine: string,
) {
  return last?.role === 'assistant' && text.length > 0 && text !== droppedLine;
}
