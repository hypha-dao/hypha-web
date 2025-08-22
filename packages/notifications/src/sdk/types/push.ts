import type { Audience, Alias } from './audience';
import type { Template } from './template';
import type { LanguageStringMap } from '@onesignal/node-onesignal';

export type PushAudience = Audience<
  Alias & {
    target_channel: 'push';
  }
>;

type LangMap = LanguageStringMap & {
  en: string;
};

export type PushContent =
  | Template
  | {
      contents: LangMap;
      headings?: LangMap;
    };

export type Push = PushContent &
  PushAudience & {
    app_id: string;
  };
