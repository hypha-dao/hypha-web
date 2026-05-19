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
  TAG_SUB_NEW_PROPOSAL_OPEN,
  TAG_SUB_PROPOSAL_APPROVED_OR_REJECTED,
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
        : 'no',
      browserNotifications: configuration
        ? getSwitch(configuration.browserNotifications)
        : 'yes',
      mentionNotificationsConsent: configuration
        ? typeof configuration.mentionNotificationsConsent === 'boolean'
          ? getSwitch(configuration.mentionNotificationsConsent)
          : 'yes'
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
      mentionNotificationsConsent:
        typeof configuration.mentionNotificationsConsent === 'boolean'
          ? getSwitch(configuration.mentionNotificationsConsent)
          : 'yes',
      subscriptions: NOTIFICATION_SUBSCRIPTIONS.map((subscription) => {
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
        mentionNotificationsConsent: parseSwitch(
          values.mentionNotificationsConsent,
        ),
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

  const yesLabel = tNotificationCentre('channels.yes');
  const noLabel = tNotificationCentre('channels.no');
  const notificationEmail = person?.email ?? '';

  const subscriptionTextMap = React.useMemo(
    () => ({
      [TAG_SUB_NEW_PROPOSAL_OPEN]: {
        title: tNotificationCentre.has('subscriptions.newProposalOpen.title')
          ? tNotificationCentre('subscriptions.newProposalOpen.title')
          : undefined,
        description: tNotificationCentre.has(
          'subscriptions.newProposalOpen.description',
        )
          ? tNotificationCentre('subscriptions.newProposalOpen.description')
          : undefined,
      },
      [TAG_SUB_PROPOSAL_APPROVED_OR_REJECTED]: {
        title: tNotificationCentre.has(
          'subscriptions.proposalApprovedOrRejected.title',
        )
          ? tNotificationCentre(
              'subscriptions.proposalApprovedOrRejected.title',
            )
          : undefined,
        description: tNotificationCentre.has(
          'subscriptions.proposalApprovedOrRejected.description',
        )
          ? tNotificationCentre(
              'subscriptions.proposalApprovedOrRejected.description',
            )
          : undefined,
      },
    }),
    [tNotificationCentre],
  );

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
            <span className="text-2 text-neutral-11">
              {subscribed ? (
                <Button type="button" onClick={unsubscribe}>
                  {tNotificationCentre('subscribe.unsubscribe')}
                </Button>
              ) : (
                <Button type="button" onClick={subscribe}>
                  {tNotificationCentre('subscribe.subscribe')}
                </Button>
              )}
              {error && <FormMessage>{error}</FormMessage>}
            </span>
            {subscribed ? (
              <span className="text-2 text-neutral-11">
                {tNotificationCentre('subscribe.subscribedDescription')}
              </span>
            ) : (
              <span className="text-2 text-neutral-11">
                {tNotificationCentre('subscribe.unsubscribedDescription')}
              </span>
            )}
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
                    orientation="horizontal"
                    value={field.value}
                    onValueChange={(value: string) => {
                      form.setValue(field.name, parseYesNoValue(value, 'yes'));
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
                    orientation="horizontal"
                    value={field.value}
                    onValueChange={(value: string) => {
                      form.setValue(field.name, parseYesNoValue(value, 'yes'));
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
            <FormField
              control={form.control}
              name="mentionNotificationsConsent"
              render={({ field }) => {
                const checkboxId = 'mentionNotificationsConsentChecked';
                return (
                  <FormItem>
                    <FormControl>
                      <div className="flex flex-col gap-2">
                        <div className="text-2 text-neutral-11 justify-between">
                          <div className="flex flex-row gap-2">
                            <Checkbox
                              id={checkboxId}
                              checked={parseSwitch(field.value)}
                              onCheckedChange={(value) => {
                                form.setValue(
                                  field.name,
                                  value === true ? 'yes' : 'no',
                                );
                              }}
                            />
                            <FormLabel htmlFor={checkboxId}>
                              {tNotificationCentre(
                                'subscriptions.mentionOnChatMessage.title',
                              )}
                            </FormLabel>
                          </div>
                        </div>
                        <span className="text-2 text-neutral-11">
                          {tNotificationCentre(
                            'subscriptions.mentionOnChatMessage.description',
                          )}
                        </span>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
            {subscriptions.map((field, index) => (
              <div key={field.id}>
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
                                  {subscription.disabled
                                    ? tNotificationCentre(
                                        'subscriptions.labelWithComingSoon',
                                        {
                                          title:
                                            localizedSubscription?.title ??
                                            subscription.title,
                                          comingSoon: tNotificationCentre(
                                            'subscriptions.comingSoon',
                                          ),
                                        },
                                      )
                                    : localizedSubscription?.title ??
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
                    {error
                      ? tNotificationCentre('actions.retry')
                      : tNotificationCentre('actions.savePreferences')}
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
