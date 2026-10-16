import { SUBSCRIPTION_TAGS } from '@hypha-platform/notifications/client';
import { z } from 'zod';

export const yesNoEnum = z.enum(['yes', 'no']);

export const notificationSubscriptionSchema = z.object({
  title: z.string(),
  description: z.string(),
  tagName: z.enum(SUBSCRIPTION_TAGS),
  tagValue: z.boolean().default(true),
});

export const schemaNotificationCentreForm = z.object({
  emailNotifications: yesNoEnum.default('yes'),
  browserNotifications: yesNoEnum.default('yes'),
  subscriptions: z.array(notificationSubscriptionSchema),
});

export type YesNo = z.infer<typeof yesNoEnum>;
export type NotificationSubscription = z.infer<
  typeof notificationSubscriptionSchema
>;

export type NotificationCentreFormValues = z.infer<
  typeof schemaNotificationCentreForm
>;
