import { Creator } from '../agreements';

export type Comment = {
  creator?: Creator;
  date?: string;
  message?: string;
  replies: Comment[];
  isReply?: boolean;
  isLoading?: boolean;
};
