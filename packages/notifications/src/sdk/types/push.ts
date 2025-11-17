import type { Alias, Segment } from './audience';
import type { Template } from './template';
import type {
  FilterExpression,
  LanguageStringMap,
} from '@onesignal/node-onesignal';

export type LangMap = LanguageStringMap & {
  en: string;
};

export type PlainPush = {
  contents: LangMap;
  headings?: LangMap;
};

export type PushContent = Template | PlainPush;

export type PushParamsForAlias = {
  app_id: string;
  alias: Alias;
  content: PushContent;
  filters: Array<FilterExpression>;
};

export type PushParamsForSegment = {
  app_id: string;
  segment: Segment;
  content: PushContent;
  filters: Array<FilterExpression>;
};
