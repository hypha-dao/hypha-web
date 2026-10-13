import type { Push } from './types';

export function pushSpaceCreationForCreator({
  spacesCount = 1,
}: { spacesCount?: number } = {}): Push {
  return {
    contents: {
      en:
        spacesCount > 1
          ? `You've successfully created ${spacesCount} spaces.`
          : "You've successfully created a space.",
    },
    headings: { en: 'Successful space creation' },
  };
}
