import type { Filter as OneSignalFilter } from '@onesignal/node-onesignal';

export type Filter = {
  filters?: OneSignalFilter[];
};

export type Alias = {
  include_aliases: Record<string, Array<string>> & {
    external_id: Array<string>;
    onesignal_id?: Array<string>;
  };
  include_subscription_ids?: Array<string>;
} & Filter;

export type Segment = {
  included_segments: Array<string>;
  excluded_segments?: Array<string>;
} & Filter;
