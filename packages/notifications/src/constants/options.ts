import {
  SubscriptionTag,
  TAG_SUB_NEW_PROPOSAL_OPEN,
  TAG_SUB_PROPOSAL_APPROVED_OR_REJECTED,
} from './tags';

export const NOTIFICATION_SUBSCRIPTIONS: {
  title: string;
  description: string;
  tagName: SubscriptionTag;
  tagValue: boolean;
  disabled?: boolean;
}[] = [
  {
    title: 'A new proposal is open for vote',
    description: "In any of the spaces you're a member of.",
    tagName: TAG_SUB_NEW_PROPOSAL_OPEN,
    tagValue: true,
  },
  {
    title: 'A proposal is approved or rejected',
    description: "In any of the spaces you're a member of.",
    tagName: TAG_SUB_PROPOSAL_APPROVED_OR_REJECTED,
    tagValue: true,
    disabled: true,
  },
];
