import type { Email } from './types';

export function emailSpaceCreationForCreator({
  spacesCount = 1,
}: { spacesCount?: number } = {}): Email {
  return {
    subject: 'Successful space creation',
    body:
      spacesCount > 1
        ? `You've successfully created ${spacesCount} spaces.`
        : "You've successfully created a space.",
  };
}
