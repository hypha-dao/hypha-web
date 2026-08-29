import type { Alias, Filter, Segment } from './audience';
import type { Template } from './template';

/**
 * `include_email_tokens` alone is valid for OneSignal (sends directly to raw email addresses,
 * no subscribed Hypha user required); `include_aliases` is used for subscribed Hypha users.
 * Note: this is NOT `email_to` — that isn't a field OneSignal's Notification API recognizes, and
 * the SDK's typed serializer silently drops unknown fields rather than erroring, so a plain
 * `email_to` here (a bug fixed in this codebase, see git history) reaches the API as a
 * notification with no targeting at all, and OneSignal 400s with "You must include which
 * players, segments, or tags you wish to send this notification to."
 */
export type EmailAlias = Filter & {
  include_aliases?: Alias['include_aliases'];
  include_email_tokens?: string[];
};

export type PlainEmail = {
  email_subject: string;
  email_body: string;
  email_preheader?: string;
};

export type EmailContent = Template | PlainEmail;

export type EmailParamsForAlias = {
  app_id: string;
  alias: EmailAlias;
  content: EmailContent;
};

export type EmailParamsForSegment = {
  app_id: string;
  segment: Segment;
  content: EmailContent;
};
