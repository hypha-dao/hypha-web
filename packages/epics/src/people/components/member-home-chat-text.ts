/** Compare lines after a lead-in so "Next up: …" and "…" count as one line. */
function homeSentenceKey(sentence: string) {
  return sentence
    .toLowerCase()
    .replace(/^(?:next up|up next)\s*:\s*/u, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function repeatsHomeSentence(sentence: string, earlier: string[]) {
  const key = homeSentenceKey(sentence);
  if (key.length < 24) return false;
  return earlier.some((previous) => {
    const other = homeSentenceKey(previous);
    if (other.length < 24) return false;
    return key === other || key.includes(other) || other.includes(key);
  });
}

/** A model that cannot call a tool sometimes prints the call. Never show that. */
export function stripLeakedToolMarkup(text: string) {
  return text
    .replace(/<\s*\|?\s*DSML\b[\s\S]*?<\s*\/\s*\|?\s*DSML\b[^>]*>/gi, ' ')
    .replace(/<\s*\|?\s*DSML\b[\s\S]*$/gi, ' ')
    .replace(/<\/?\s*\|[^>\n]*>/g, ' ')
    .replace(/<\/?(?:tool_call|invoke|parameter|function_call)\b[^>]*>/gi, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function looksLikeToolLeak(sentence: string) {
  return /DSML|invoke\s+name\s*=|parameter\s+name\s*=|get_people_by_space_slug|show_member_home_item|<\s*\|/i.test(
    sentence,
  );
}

/**
 * Drop a trailing clause with no end mark once the turn is done. Stripping a
 * leaked tool call often leaves "…would be" with the rest of the sentence gone.
 */
export function trimDanglingHomeClause(text: string) {
  const trimmed = text.trim();
  if (!trimmed || /[.!?]$/.test(trimmed)) return trimmed;
  const end = Math.max(
    trimmed.lastIndexOf('.'),
    trimmed.lastIndexOf('!'),
    trimmed.lastIndexOf('?'),
  );
  if (end <= 0) return trimmed;
  // Keep short unanswered lines ("Sure") — only drop a longer stump.
  if (trimmed.length - (end + 1) < 12) return trimmed;
  return trimmed.slice(0, end + 1).trim();
}

/** A decision stays with the member. Drop narration and any ask for their choice. */
export function straightforwardHomeText(
  text: string,
  options?: { streaming?: boolean },
) {
  const steers = (sentence: string) =>
    /i['’]ll show you|here(?:'|’)s the proposal|here is the proposal|the proposal titled|if you approve|your approval|can you review|do you approve|would you approve|would you like to approve|what would you like to decide|want to take a look|i(?:'’)?ve approved|\bi approved\b|\bi have approved\b|\bi accepted\b|i(?:'’)?ve accepted|\bi voted\b|you can now see the message|think about it|approval is required|to proceed with|how (?:will|would) you vote|let me know if you|^sure[.!]?$/i.test(
      sentence,
    );
  const sentences = stripLeakedToolMarkup(text)
    .replace(/\*\*/g, '')
    .split(/\n+/)
    .flatMap((paragraph) => paragraph.split(/(?<=[.!?])\s+/))
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
  // A sentence still arriving has no ending mark. Hiding it as soon as it
  // starts to look like narration blanks the bubble, then the next sentence
  // mounts it again. A second step often repeats the line it just finished.
  const kept: string[] = [];
  const cleaned = sentences
    .filter((sentence, index) => {
      const stillArriving =
        index === sentences.length - 1 && !/[.!?]$/.test(sentence);
      if (looksLikeToolLeak(sentence)) return false;
      if (!stillArriving && steers(sentence)) return false;
      if (repeatsHomeSentence(sentence, kept)) return false;
      kept.push(sentence);
      return true;
    })
    .join(' ')
    .trim();
  if (options?.streaming) return cleaned;
  return trimDanglingHomeClause(cleaned);
}

/**
 * Chat bubble and spoken voice must share one script. Board copy replaces a
 * catalogue dump. Speech prep that waits for a full sentence hides the line
 * and then shows it again, so the bubble keeps this text as it arrives.
 */
export function homeAssistantScript(input: {
  displayText: string;
  stripDecisionCue?: boolean;
}) {
  const base = input.displayText.trim();
  if (!input.stripDecisionCue) return base;
  // Dropping the cue can leave a dangling dash from "…decision — You can…"
  return base
    .replace(/You can now decide on the proposal card\.?/gi, '')
    .replace(/\s*[-—–:]\s*$/u, '')
    .trim();
}
