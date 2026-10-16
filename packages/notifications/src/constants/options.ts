import {
  SubscriptionTag,
  TAG_MEETING_CONSENT,
  TAG_MENTION_CONSENT,
  TAG_SUB_NEW_PROPOSAL_OPEN,
  TAG_SUB_OWN_ACTIONS,
  TAG_SUB_PROPOSAL_APPROVED_OR_REJECTED,
  TAG_SUB_SIGNALS,
} from './tags';

/**
 * The six preference groups, in display order (#2549 D3). `title` / `description` are English
 * fallbacks; the Notification Centre prefers the `NotificationCentre.subscriptions.*` translations.
 * `tagValue` is the default shown before the real stored state loads (everything is on by default
 * except own-action confirmations, which `subscribe()` switches off — D5).
 */
export const NOTIFICATION_SUBSCRIPTIONS: {
  title: string;
  description: string;
  tagName: SubscriptionTag;
  tagValue: boolean;
}[] = [
  {
    title: 'A new proposal is open for vote',
    description: "In any of the spaces you're a member of.",
    tagName: TAG_SUB_NEW_PROPOSAL_OPEN,
    tagValue: true,
  },
  {
    title: 'A proposal is approved or rejected',
    description:
      "The outcome of proposals in the spaces you're a member of, including your own.",
    tagName: TAG_SUB_PROPOSAL_APPROVED_OR_REJECTED,
    tagValue: true,
  },
  {
    title: 'Chat @mentions',
    description:
      'When someone @mentions you in a space or signal thread you belong to.',
    tagName: TAG_MENTION_CONSENT,
    tagValue: true,
  },
  {
    title: 'Meetings and calls',
    description:
      'Invitations, reminders and call alerts for meetings and calls in your spaces.',
    tagName: TAG_MEETING_CONSENT,
    tagValue: true,
  },
  {
    title: 'Signals',
    description:
      'When a signal is assigned to you, you are mentioned on one, or a deadline changes or passes.',
    tagName: TAG_SUB_SIGNALS,
    tagValue: true,
  },
  {
    title: 'Confirmations of your own actions',
    description:
      'When you create a proposal or a space, a confirmation that it worked.',
    tagName: TAG_SUB_OWN_ACTIONS,
    tagValue: true,
  },
];
