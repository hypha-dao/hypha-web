import type { Alias, Filter, Segment } from './audience';
import type { Template } from './template';

/** `email_to` alone is valid for OneSignal; `include_aliases` is used for subscribed Hypha users. */
export type EmailAlias = Filter & {
  include_aliases?: Alias['include_aliases'];
  email_to?: string[];
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
