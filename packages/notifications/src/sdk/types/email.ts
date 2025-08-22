import type { Audience, Alias } from './audience';
import type { Template } from './template';

export type EmailAudience = Audience<
  Alias & {
    target_channel: 'email';
    email_to?: string[];
  }
>;

export type EmailContent =
  | Template
  | {
      email_subject: string;
      email_body: string;
      email_preheader?: string;
    };

export type Email = EmailContent &
  EmailAudience & {
    app_id: string;
  };
