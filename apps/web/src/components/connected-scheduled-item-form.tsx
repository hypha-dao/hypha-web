'use client';

import {
  ScheduledItemForm,
  type ScheduledItemFormProps,
} from '@hypha-platform/epics';

export function ConnectedScheduledItemForm(props: ScheduledItemFormProps) {
  return <ScheduledItemForm {...props} />;
}
