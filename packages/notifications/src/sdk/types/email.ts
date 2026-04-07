import type { Alias, Segment } from './audience';
import type { Template } from './template';

export type EmailAlias = Alias & {
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
