import { SUBSCRIPTION_TAGS } from '@hypha-platform/notifications/client';
import { z } from 'zod';

export const yesNoEnum = z.enum(['yes', 'no']);

export const notificationSubscriptionSchema = z.object({
  title: z.string(),
  description: z.string(),
  tagName: z.enum(SUBSCRIPTION_TAGS),
  tagValue: z.boolean().default(false),
  disabled: z.boolean().optional(),
});

export const schemaNotificationCentreForm = z.object({
  emailNotifications: yesNoEnum.default('no'),
  browserNotifications: yesNoEnum.default('no'),
  subscriptions: z.array(notificationSubscriptionSchema),
});

export type YesNo = z.infer<typeof yesNoEnum>;
export type NotificationSubscription = z.infer<
  typeof notificationSubscriptionSchema
>;

export type NotificationCentreFormValues = z.infer<
  typeof schemaNotificationCentreForm
>;
