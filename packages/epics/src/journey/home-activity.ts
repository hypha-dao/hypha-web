import type { Document } from '@hypha-platform/core/client';

export const HOME_ACTIVITY_SPACE_LIMIT = 8;
export const HOME_ACTIVITY_ITEM_LIMIT = 5;

export type HomeSpaceRef = {
  slug: string;
  title: string;
};

export type HomeVoteItem = {
  id: string;
  title: string;
  spaceSlug: string;
  spaceTitle: string;
  proposalSlug: string;
};

export type HomeSignalItem = {
  id: string;
  title: string;
  spaceSlug: string;
  spaceTitle: string;
  signalSlug: string | null;
};

export function isOpenForVote(document: {
  state?: string;
  status?: string | null;
}): boolean {
  if (document.status === 'accepted' || document.status === 'rejected') {
    return false;
  }
  if (document.status === 'onVoting') return true;
  return document.state === 'proposal';
}

export function votesFromDocuments(
  documents: Document[],
  space: HomeSpaceRef,
): HomeVoteItem[] {
  return documents.filter(isOpenForVote).flatMap((document) => {
    if (!document.slug) return [];
    return [
      {
        id: `${space.slug}:${document.id}`,
        title: document.title,
        spaceSlug: space.slug,
        spaceTitle: space.title,
        proposalSlug: document.slug,
      },
    ];
  });
}

export function sortVotes(items: HomeVoteItem[]): HomeVoteItem[] {
  return [...items].sort((a, b) => a.title.localeCompare(b.title));
}
