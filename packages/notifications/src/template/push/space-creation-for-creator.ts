import type { Push } from './types';

export function pushSpaceCreationForCreator(): Push {
  return {
    contents: { en: "You've successfully created a space." },
    headings: { en: 'Successful space creation' },
  };
}
