import type {
  NotificationTargetChannelEnum,
  Filter as OneSignalFilter,
  Notification,
} from '@onesignal/node-onesignal';

export type Alias = Pick<Notification, 'include_subscription_ids'> & {
  target_channel: NotificationTargetChannelEnum;
  include_aliases: Record<('external_id' | 'onesignal_id') & string, string[]>;
};

export type Segment = Pick<Notification, 'excluded_segments'> & {
  included_segments: Array<string>;
};

export type Filter = {
  filters: OneSignalFilter[];
};

export type Audience<T extends Alias> = T | Segment | Filter;
