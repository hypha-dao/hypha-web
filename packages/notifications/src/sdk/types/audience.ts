import type { Filter as OneSignalFilter } from '@onesignal/node-onesignal';

export type Filter = {
  filters?: OneSignalFilter[];
};

export type Alias = {
  include_subscription_ids: Array<string>;
  include_aliases: Record<
    ('external_id' | 'onesignal_id') & string,
    Array<string>
  >;
} & Filter;

export type Segment = {
  excluded_segments: Array<string>;
  included_segments: Array<string>;
} & Filter;
