import { sanitiseUserText } from '../sanitiser';

/**
 * Trusted fields stay at the top level of a result; everything a Hypha user wrote goes in a
 * `userText` group (D35), sanitised and length-capped, with a truncation flag per field.
 */
export type UserTextGroup<K extends string> = Record<K, string | null> & {
  truncated: K[];
};

export const USER_TEXT_CAPS = { title: 200, description: 1500 } as const;

export function userText<K extends string>(
  fields: Record<
    K,
    { value: string | null | undefined; max: number; atWordBoundary?: boolean }
  >,
): UserTextGroup<K> {
  const out = {} as Record<K, string | null>;
  const truncated: K[] = [];
  for (const key of Object.keys(fields) as K[]) {
    const { value, max, atWordBoundary } = fields[key];
    if (value === null || value === undefined) {
      out[key] = null;
      continue;
    }
    const clean = sanitiseUserText(value, max, { atWordBoundary });
    out[key] = clean.text;
    if (clean.truncated) truncated.push(key);
  }
  return { ...out, truncated };
}
