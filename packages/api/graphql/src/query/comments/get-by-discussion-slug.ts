import { data } from './get-by-discussion-slug.mock';
import { Comment } from './types';

type GetCommentsByDiscussionSlugProps = {
  slug: string;
};

export const getCommentsByDiscussionSlug = async ({
  slug,
}: GetCommentsByDiscussionSlugProps): Promise<Comment[]> => {
  console.debug('getCommentsByDiscussionSlug', { slug });

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(data);
    }, 500);
  });
};
