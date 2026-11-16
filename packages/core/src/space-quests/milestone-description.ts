const MILESTONE_DESCRIPTION_STOP = new Set(
  'the and for with that this from into onto about then them they their will would should could can may have has been are was were not but all any its our your you one per via just only also very more most out off own same too'.split(
    ' ',
  ),
);

function normalizeQuestMilestoneText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The description to show and store. Empty when it is missing or only
 * repeats the title, so chat and the milestone card do not echo the title.
 */
export function questMilestoneDescriptionText(
  name: string,
  description: string | null | undefined,
): string {
  const body = description?.trim() ?? '';
  if (!body) return '';
  if (normalizeQuestMilestoneText(body) === normalizeQuestMilestoneText(name)) {
    return '';
  }
  return body;
}

const UNSPACED_SCRIPT =
  /\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Hangul}|\p{Script=Thai}|\p{Script=Lao}|\p{Script=Khmer}|\p{Script=Myanmar}/u;

/**
 * Scripts that do not separate words with spaces. A handful of characters
 * the title does not already use counts as new detail.
 */
function unspacedDescriptionAddsDetail(name: string, body: string): boolean {
  const titleChars = new Set([
    ...normalizeQuestMilestoneText(name).replace(/\s/g, ''),
  ]);
  let extra = 0;
  for (const char of normalizeQuestMilestoneText(body).replace(/\s/g, '')) {
    if (!titleChars.has(char)) extra += 1;
  }
  return extra >= 4;
}

/**
 * A milestone description the Helper may propose. Spaced languages need two
 * content words the title does not use. Unspaced writing needs characters
 * the title does not already contain.
 */
export function questMilestoneDescriptionAddsDetail(
  name: string,
  description: string | null | undefined,
): boolean {
  const body = questMilestoneDescriptionText(name, description);
  if (!body) return false;
  const nameWords = new Set(
    normalizeQuestMilestoneText(name)
      .split(' ')
      .filter((word) => word.length >= 3),
  );
  const extra = normalizeQuestMilestoneText(body)
    .split(' ')
    .filter(
      (word) =>
        word.length >= 4 &&
        !MILESTONE_DESCRIPTION_STOP.has(word) &&
        !nameWords.has(word),
    );
  if (extra.length >= 2) return true;
  return (
    UNSPACED_SCRIPT.test(body) && unspacedDescriptionAddsDetail(name, body)
  );
}
