export const QUEST_PROPOSAL_ACCEPTED_TEXT =
  'Quest proposal accepted — Quest is now Active.';

export type QuestUpdateAuthorFields = {
  authorPersonId: number | null;
  authorName: string;
  authorAvatarUrl: string | null;
};

export type QuestAuthorProfile = {
  name?: string | null;
  avatarUrl?: string | null;
};

function cleanAvatar(value: string | null | undefined): string | null {
  const avatar = value?.trim();
  return avatar ? avatar : null;
}

/**
 * The stored photo wins. An older row that saved the person but not the photo
 * uses that person's current photo. The acceptance line was stored against the
 * quest lead; when that person has no photo, show the proposal creator.
 */
export function questUpdateAuthorForDisplay(
  update: QuestUpdateAuthorFields & { text: string },
  peopleById: ReadonlyMap<number, QuestAuthorProfile>,
  proposalCreator: QuestUpdateAuthorFields | null,
): QuestUpdateAuthorFields {
  const storedAvatar = cleanAvatar(update.authorAvatarUrl);
  if (storedAvatar) {
    return {
      authorPersonId: update.authorPersonId,
      authorName: update.authorName,
      authorAvatarUrl: storedAvatar,
    };
  }

  if (update.authorPersonId != null) {
    const avatar = cleanAvatar(
      peopleById.get(update.authorPersonId)?.avatarUrl,
    );
    if (avatar) {
      return {
        authorPersonId: update.authorPersonId,
        authorName: update.authorName,
        authorAvatarUrl: avatar,
      };
    }
  }

  const creatorAvatar = cleanAvatar(proposalCreator?.authorAvatarUrl);
  if (
    update.text === QUEST_PROPOSAL_ACCEPTED_TEXT &&
    proposalCreator?.authorPersonId != null &&
    creatorAvatar
  ) {
    return {
      authorPersonId: proposalCreator.authorPersonId,
      authorName: proposalCreator.authorName,
      authorAvatarUrl: creatorAvatar,
    };
  }

  return {
    authorPersonId: update.authorPersonId,
    authorName: update.authorName,
    authorAvatarUrl: null,
  };
}
