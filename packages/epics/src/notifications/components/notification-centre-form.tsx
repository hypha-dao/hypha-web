'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  Checkbox,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Label,
  RadioGroup,
  RadioGroupItem,
  Separator,
  Skeleton,
} from '@hypha-platform/ui';
import { Text } from '@radix-ui/themes';
import { useFieldArray, useForm } from 'react-hook-form';
import React from 'react';
import {
  NOTIFICATION_SUBSCRIPTIONS,
  NotificationConfiguration,
} from '@hypha-platform/notifications/client';
import { ButtonClose } from '../../common/button-close';
import { useRouter } from 'next/navigation';
import { Person } from '@hypha-platform/core/client';
import {
  NotificationCentreFormValues,
  NotificationSubscription,
  schemaNotificationCentreForm,
  YesNo,
  yesNoEnum,
} from '../hooks/validation';

export type NotificationCentreFormProps = {
  person?: Person;
  closeUrl: string;
  isLoading?: boolean;
  error?: string | null;
  subscribed?: boolean;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
  configuration?: NotificationConfiguration;
  saveConfigurations: (
    configuration: NotificationConfiguration,
  ) => Promise<void>;
};

function getSwitch(value: boolean): YesNo {
  return value ? 'yes' : 'no';
}

function parseSwitch(value: YesNo): boolean {
  return value === 'yes';
}

function parseYesNoValue(value: string, defaultValue: YesNo): YesNo {
  try {
    const val = yesNoEnum.parse(value);
    return val;
  } catch (_) {
    return defaultValue;
  }
}

const notificationSubscriptions: NotificationSubscription[] =
  NOTIFICATION_SUBSCRIPTIONS;

export const NotificationCentreForm = ({
  person,
  closeUrl,
  isLoading,
  error,
  subscribed,
  subscribe,
  unsubscribe,
  configuration,
  saveConfigurations,
}: NotificationCentreFormProps) => {
  const form = useForm<NotificationCentreFormValues>({
    resolver: zodResolver(schemaNotificationCentreForm),
    defaultValues: {
      emailNotifications: configuration
        ? getSwitch(configuration.emailNotifications)
        : 'no',
      browserNotifications: configuration
        ? getSwitch(configuration.browserNotifications)
        : 'yes',
      subscriptions: notificationSubscriptions,
    },
    mode: 'onChange',
  });
  const router = useRouter();

  React.useEffect(() => {
    if (!configuration) {
      return;
    }
    const modified = {
      browserNotifications: getSwitch(configuration.browserNotifications),
      emailNotifications: getSwitch(configuration.emailNotifications),
      subscriptions: notificationSubscriptions.map((subscription) => {
        const sub = configuration.subscriptions?.find(
          (s) => s.name === subscription.tagName,
        );
        const tagName = sub?.name ?? subscription.tagName;
        const tagValue = sub?.value ?? subscription.tagValue;
        return {
          ...subscription,
          tagName,
          tagValue,
        };
      }),
    };
    form.reset(modified, { keepDirty: false });
  }, [form, configuration]);

  const handleSubmit = React.useCallback(
    async (values: NotificationCentreFormValues) => {
      await saveConfigurations({
        browserNotifications: parseSwitch(values.browserNotifications),
        emailNotifications: parseSwitch(values.emailNotifications),
        subscriptions: values.subscriptions.map((subscription) => {
          return {
            name: subscription.tagName,
            value: subscription.tagValue,
          };
        }),
      });
      router.push(closeUrl);
    },
    [saveConfigurations, router, closeUrl],
  );

  const handleInvalid = async (err?: any) => {
    console.warn('Notification settings errors:', err);
  };

  const { fields: subscriptions } = useFieldArray({
    control: form.control,
    name: 'subscriptions',
  });

  return (
    <div className="relative">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmit, handleInvalid)}
          className="space-y-8"
        >
          <ButtonClose closeUrl={closeUrl} className="absolute top-0 right-0" />
          <div className="flex flex-col gap-5">
            <div className="flex gap-5 justify-between">
              <Skeleton width="100px" height="24px" loading={isLoading}>
                <span className="text-4 text-secondary-foreground">
                  Notification Centre
                </span>
              </Skeleton>
            </div>
            <Separator />
            <div className="flex gap-5 justify-between">
              <h3 className="text-3 font-medium text-neutral-11">
                Subscribe to Notifications
              </h3>
            </div>
            <span className="text-2 text-neutral-11">
              {subscribed ? (
                <Button type="button" onClick={unsubscribe}>
                  Unsubscribe
                </Button>
              ) : (
                <Button type="button" onClick={subscribe}>
                  Subscribe
                </Button>
              )}
              {error && <FormMessage>{error}</FormMessage>}
            </span>
            {subscribed ? (
              <span className="text-2 text-neutral-11">
                You’re subscribed to notifications. Click unsubscribe at any
                time to stop receiving alerts.
              </span>
            ) : (
              <span className="text-2 text-neutral-11">
                Click subscribe to receive notifications. Some browsers block
                notifications by default, so you may need to enable them using
                the padlock icon next to the address bar or in your browser’s
                settings.
              </span>
            )}
            <Separator />
            <div className="flex gap-5 justify-between">
              <h3 className="text-3 font-medium text-neutral-11">
                Notification Channels
              </h3>
            </div>
            <span className="text-2 text-neutral-11">
              Choose how you’d like to receive notifications:
            </span>
            <span className="text-2 text-neutral-11 flex flex-row justify-between">
              <FormLabel>
                Email Notifications{' '}
                {person && (
                  <>
                    (to <pre className="inline">{person.email}</pre>)
                  </>
                )}
              </FormLabel>
              <FormField
                control={form.control}
                name="emailNotifications"
                render={({ field }) => (
                  <RadioGroup
                    className="flex flex-row justify-end"
                    name="emailNotifications"
                    orientation="horizontal"
                    value={field.value}
                    onValueChange={(value: string) => {
                      form.setValue(field.name, parseYesNoValue(value, 'yes'));
                    }}
                  >
                    <Label htmlFor="emailNotificationsYes">Yes</Label>
                    <RadioGroupItem id="emailNotificationsYes" value="yes" />
                    <Label htmlFor="emailNotificationsNo">No</Label>
                    <RadioGroupItem id="emailNotificationsNo" value="no" />
                  </RadioGroup>
                )}
              />
            </span>
            <span className="text-2 text-neutral-11 flex flex-row justify-between">
              <FormLabel>
                Browser Notifications (formerly "Desktop Pop-up Notifications")
              </FormLabel>
              <FormField
                control={form.control}
                name="browserNotifications"
                render={({ field }) => (
                  <RadioGroup
                    className="flex flex-row justify-end"
                    name="browserNotifications"
                    orientation="horizontal"
                    value={field.value}
                    onValueChange={(value: string) => {
                      form.setValue(field.name, parseYesNoValue(value, 'yes'));
                    }}
                  >
                    <Label htmlFor="browserNotificationYes">Yes</Label>
                    <RadioGroupItem id="browserNotificationYes" value="yes" />
                    <Label htmlFor="browserNotificationNo">No</Label>
                    <RadioGroupItem id="browserNotificationNo" value="no" />
                  </RadioGroup>
                )}
              />
            </span>
            <Separator />
            <div className="flex gap-5 justify-between">
              <h3 className="text-3 font-medium text-neutral-11">
                Get Notified When...
              </h3>
            </div>
            {subscriptions.map((field, index) => (
              <div key={field.id}>
                <FormField
                  control={form.control}
                  name={`subscriptions.${index}`}
                  render={({
                    field: { name, value: subscription, onChange },
                  }) => {
                    const checkboxId = `${name.replace('.', '_')}_checked`;
                    return (
                      <FormItem>
                        <FormControl>
                          <div className="flex flex-col gap-2">
                            <span className="text-2 text-neutral-11 justify-between">
                              <div className="flex flex-row gap-2">
                                <Checkbox
                                  id={checkboxId}
                                  disabled={subscription.disabled}
                                  checked={
                                    !subscription.disabled &&
                                    subscription.tagValue
                                  }
                                  onCheckedChange={(value) => {
                                    onChange({
                                      ...subscription,
                                      tagValue: value === true,
                                    });
                                  }}
                                />
                                <FormLabel htmlFor={checkboxId}>
                                  {subscription.title}
                                  {subscription.disabled && (
                                    <span> (Coming Soon)</span>
                                  )}
                                </FormLabel>
                              </div>
                            </span>
                            <span className="text-2 text-neutral-11">
                              {subscription.description}
                            </span>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </div>
            ))}
            <Separator />
            <div className="flex justify-end w-full">
              <div className="flex flex-col items-end gap-2">
                {/* {error && (
                  <Text className="text-error-11 text-sm">{error}</Text>
                )} */}
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    variant="default"
                    className="rounded-lg justify-start text-white w-fit"
                    disabled={isLoading}
                  >
                    {error ? 'Retry' : 'Save Preferences'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
};
