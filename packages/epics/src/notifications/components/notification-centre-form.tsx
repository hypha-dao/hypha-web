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
  Switch,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { useFieldArray, useForm } from 'react-hook-form';
import React from 'react';
import {
  NOTIFICATION_SUBSCRIPTIONS,
  NOTIFICATION_SUBSCRIPTION_SECTIONS,
  NotificationConfiguration,
  SubscriptionTag,
  TAG_MEETING_CONSENT,
  TAG_MENTION_CONSENT,
  TAG_SUB_NEW_PROPOSAL_OPEN,
  TAG_SUB_OWN_ACTIONS,
  TAG_SUB_PROPOSAL_APPROVED_OR_REJECTED,
  TAG_SUB_SIGNALS,
} from '@hypha-platform/notifications/client';
import { ModalStickyNavigation } from '../../common/modal-sticky-navigation';
import { useRouter } from 'next/navigation';
import { Person } from '@hypha-platform/core/client';
import { useTranslations } from 'next-intl';
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
  const tNotificationCentre = useTranslations('NotificationCentre');
  const tModalAside = useTranslations('ModalAside');
  const form = useForm<NotificationCentreFormValues>({
    resolver: zodResolver(schemaNotificationCentreForm),
    defaultValues: {
      emailNotifications: configuration
        ? getSwitch(configuration.emailNotifications)
        : 'yes',
      browserNotifications: configuration
        ? getSwitch(configuration.browserNotifications)
        : 'yes',
      subscriptions: NOTIFICATION_SUBSCRIPTIONS,
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
      subscriptions: NOTIFICATION_SUBSCRIPTIONS.map((subscription) => {
        const sub = configuration.subscriptions?.find(
          (s) => s.name === subscription.tagName,
        );
        return {
          ...subscription,
          tagValue: sub?.value ?? subscription.tagValue,
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

  // Enrolment is immediate (not part of "Save"): turning it on has to run from this click because
  // the browser only allows its push-permission prompt from a direct user gesture.
  const [subscribePending, setSubscribePending] = React.useState(false);
  const handleSubscribeToggle = React.useCallback(
    async (checked: boolean) => {
      setSubscribePending(true);
      try {
        if (checked) {
          await subscribe();
        } else {
          await unsubscribe();
        }
      } finally {
        setSubscribePending(false);
      }
    },
    [subscribe, unsubscribe],
  );
  const preferencesDisabled = !subscribed;
  const isDirty = form.formState.isDirty;

  const { fields: subscriptions } = useFieldArray({
    control: form.control,
    name: 'subscriptions',
  });

  const yesLabel = tNotificationCentre('channels.yes');
  const noLabel = tNotificationCentre('channels.no');
  const notificationEmail = person?.email ?? '';

  const subscriptionTextMap = React.useMemo(() => {
    const keys: Record<SubscriptionTag, string> = {
      [TAG_SUB_NEW_PROPOSAL_OPEN]: 'newProposalOpen',
      [TAG_SUB_PROPOSAL_APPROVED_OR_REJECTED]: 'proposalApprovedOrRejected',
      [TAG_MENTION_CONSENT]: 'mentions',
      [TAG_MEETING_CONSENT]: 'meetings',
      [TAG_SUB_SIGNALS]: 'signals',
      [TAG_SUB_OWN_ACTIONS]: 'ownActions',
    };
    const text = (key: string, part: 'title' | 'description') =>
      tNotificationCentre.has(`subscriptions.${key}.${part}`)
        ? tNotificationCentre(`subscriptions.${key}.${part}`)
        : undefined;
    return Object.fromEntries(
      (Object.entries(keys) as [SubscriptionTag, string][]).map(
        ([tagName, key]) => [
          tagName,
          { title: text(key, 'title'), description: text(key, 'description') },
        ],
      ),
    ) as Record<SubscriptionTag, { title?: string; description?: string }>;
  }, [tNotificationCentre]);

  return (
    <div className="flex flex-col gap-5">
      <ModalStickyNavigation
        contextTitle={tModalAside('notificationCentre')}
        closeUrl={closeUrl}
        showBack={false}
      />
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmit, handleInvalid)}
          className="space-y-8"
        >
          <div className="flex flex-col gap-5">
            <div className="flex gap-5 justify-between">
              <Skeleton width="100%" height="24px" loading={isLoading}>
                <h3 className="text-3 font-medium text-neutral-11">
                  {tNotificationCentre('subscribe.title')}
                </h3>
              </Skeleton>
            </div>
            <div className="flex flex-row items-center justify-between gap-4">
              <span className="text-2 text-neutral-11">
                {subscribed
                  ? tNotificationCentre('subscribe.subscribedDescription')
                  : tNotificationCentre('subscribe.unsubscribedDescription')}
              </span>
              <Switch
                id="notificationsSubscribed"
                aria-label={tNotificationCentre('subscribe.title')}
                checked={Boolean(subscribed)}
                disabled={isLoading || subscribePending}
                onCheckedChange={handleSubscribeToggle}
              />
            </div>
            {error && <FormMessage>{error}</FormMessage>}
            <fieldset
              disabled={preferencesDisabled}
              className={cn(
                'm-0 flex min-w-0 flex-col gap-5 border-0 p-0',
                preferencesDisabled && 'pointer-events-none opacity-60',
              )}
            >
              <Separator />
              <div className="flex gap-5 justify-between">
                <h3 className="text-3 font-medium text-neutral-11">
                  {tNotificationCentre('channels.title')}
                </h3>
              </div>
              <span className="text-2 text-neutral-11">
                {tNotificationCentre('channels.description')}
              </span>
              <span className="text-2 text-neutral-11 flex flex-row justify-between">
                <FormLabel>
                  {notificationEmail
                    ? tNotificationCentre(
                        'channels.emailNotificationsWithEmail',
                        {
                          email: notificationEmail,
                        },
                      )
                    : tNotificationCentre('channels.emailNotifications')}
                </FormLabel>
                <FormField
                  control={form.control}
                  name="emailNotifications"
                  render={({ field }) => (
                    <RadioGroup
                      className="flex flex-row justify-end"
                      name="emailNotifications"
                      disabled={preferencesDisabled}
                      orientation="horizontal"
                      value={field.value}
                      onValueChange={(value: string) => {
                        form.setValue(
                          field.name,
                          parseYesNoValue(value, 'yes'),
                        );
                      }}
                    >
                      <Label htmlFor="emailNotificationsYes">{yesLabel}</Label>
                      <RadioGroupItem id="emailNotificationsYes" value="yes" />
                      <Label htmlFor="emailNotificationsNo">{noLabel}</Label>
                      <RadioGroupItem id="emailNotificationsNo" value="no" />
                    </RadioGroup>
                  )}
                />
              </span>
              <span className="text-2 text-neutral-11 flex flex-row justify-between">
                <FormLabel>
                  {tNotificationCentre('channels.browserNotifications')}
                </FormLabel>
                <FormField
                  control={form.control}
                  name="browserNotifications"
                  render={({ field }) => (
                    <RadioGroup
                      className="flex flex-row justify-end"
                      name="browserNotifications"
                      disabled={preferencesDisabled}
                      orientation="horizontal"
                      value={field.value}
                      onValueChange={(value: string) => {
                        form.setValue(
                          field.name,
                          parseYesNoValue(value, 'yes'),
                        );
                      }}
                    >
                      <Label htmlFor="browserNotificationYes">{yesLabel}</Label>
                      <RadioGroupItem id="browserNotificationYes" value="yes" />
                      <Label htmlFor="browserNotificationNo">{noLabel}</Label>
                      <RadioGroupItem id="browserNotificationNo" value="no" />
                    </RadioGroup>
                  )}
                />
              </span>
              <Separator />
              <div className="flex gap-5 justify-between">
                <h3 className="text-3 font-medium text-neutral-11">
                  {tNotificationCentre('subscriptions.title')}
                </h3>
              </div>
              {subscriptions.map((field, index) => {
                const section = NOTIFICATION_SUBSCRIPTION_SECTIONS.find(
                  (item) => item.id === field.group,
                );
                const startsSection =
                  index === 0 ||
                  subscriptions[index - 1]?.group !== field.group;
                return (
                  <div key={field.id}>
                    {startsSection && section && (
                      <h4 className="mb-3 mt-2 text-2 font-medium uppercase tracking-wide text-neutral-10">
                        {tNotificationCentre.has(
                          `subscriptions.sections.${section.id}`,
                        )
                          ? tNotificationCentre(
                              `subscriptions.sections.${section.id}`,
                            )
                          : section.title}
                      </h4>
                    )}
                    <FormField
                      control={form.control}
                      name={`subscriptions.${index}`}
                      render={({
                        field: { name, value: subscription, onChange },
                      }) => {
                        const localizedSubscription =
                          subscriptionTextMap[subscription.tagName];
                        const checkboxId = `${name.replace('.', '_')}_checked`;
                        return (
                          <FormItem>
                            <FormControl>
                              <div className="flex flex-col gap-2">
                                <span className="text-2 text-neutral-11 justify-between">
                                  <div className="flex flex-row gap-2">
                                    <Checkbox
                                      id={checkboxId}
                                      checked={subscription.tagValue}
                                      disabled={preferencesDisabled}
                                      onCheckedChange={(value) => {
                                        onChange({
                                          ...subscription,
                                          tagValue: value === true,
                                        });
                                      }}
                                    />
                                    <FormLabel htmlFor={checkboxId}>
                                      {localizedSubscription?.title ??
                                        subscription.title}
                                    </FormLabel>
                                  </div>
                                </span>
                                <span className="text-2 text-neutral-11">
                                  {localizedSubscription?.description ??
                                    subscription.description}
                                </span>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />
                  </div>
                );
              })}
            </fieldset>
            <div className="sticky bottom-0 z-[5] -mx-4 -mb-4 border-t border-border/90 bg-background-2 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:-mx-7 lg:-mb-7 lg:px-7">
              <div className="flex items-center justify-end gap-3">
                {isDirty && (
                  <span className="mr-auto text-2 text-neutral-11">
                    {tNotificationCentre.has('actions.unsavedChanges')
                      ? tNotificationCentre('actions.unsavedChanges')
                      : 'You have unsaved changes'}
                  </span>
                )}
                <Button
                  type="submit"
                  variant="default"
                  className="rounded-lg justify-start text-white w-fit"
                  disabled={
                    isLoading || preferencesDisabled || (!isDirty && !error)
                  }
                >
                  {error
                    ? tNotificationCentre('actions.retry')
                    : tNotificationCentre('actions.savePreferences')}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
};
