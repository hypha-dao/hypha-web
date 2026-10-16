'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  Form,
  FormField,
  FormMessage,
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
  schemaNotificationCentreForm,
  YesNo,
} from '../hooks/validation';

export type NotificationCentreFormProps = {
  person?: Person;
  closeUrl: string;
  isLoading?: boolean;
  error?: string | null;
  subscribed?: boolean;
  /** This browser can receive push right now (permission granted and opted in). */
  pushActive?: boolean;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
  /** Asks for browser permission and opts this browser in; resolves to whether push is now on. */
  enableBrowserPush: () => Promise<boolean>;
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

/** One bordered block (Hypha style: square corners, hairline border) with a small caps header. */
function SettingsCard({
  title,
  children,
}: {
  title?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-border">
      {title && (
        <h4 className="border-b border-border bg-background-2 px-4 py-2 text-1 font-semibold uppercase tracking-[0.12em] text-neutral-10">
          {title}
        </h4>
      )}
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}

/** A title + description with a switch on the right. */
function SettingsRow({
  id,
  title,
  description,
  hint,
  checked,
  disabled,
  onCheckedChange,
}: {
  id: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  hint?: React.ReactNode;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <div className="flex min-w-0 flex-col gap-1">
        <label
          htmlFor={id}
          className="text-2 font-medium text-foreground cursor-pointer"
        >
          {title}
        </label>
        {description && (
          <span className="text-2 text-neutral-11">{description}</span>
        )}
        {hint && <span className="text-2 text-neutral-10">{hint}</span>}
      </div>
      <Switch
        id={id}
        className="mt-0.5"
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

export const NotificationCentreForm = ({
  person,
  closeUrl,
  isLoading,
  error,
  subscribed,
  pushActive,
  subscribe,
  unsubscribe,
  enableBrowserPush,
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
      // Push is per browser: shown on only when this browser can really receive it.
      browserNotifications: getSwitch(
        configuration.browserNotifications && Boolean(pushActive),
      ),
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
  }, [form, configuration, pushActive]);

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
  // Same for this browser's push: ask for permission straight from the click.
  const [pushPending, setPushPending] = React.useState(false);
  const handleBrowserToggle = React.useCallback(
    async (checked: boolean) => {
      if (!checked) {
        form.setValue('browserNotifications', 'no', { shouldDirty: true });
        return;
      }
      setPushPending(true);
      try {
        const active = await enableBrowserPush();
        form.setValue('browserNotifications', getSwitch(active), {
          shouldDirty: true,
        });
      } finally {
        setPushPending(false);
      }
    },
    [form, enableBrowserPush],
  );
  const preferencesDisabled = !subscribed;
  const isDirty = form.formState.isDirty;

  const { fields: subscriptions } = useFieldArray({
    control: form.control,
    name: 'subscriptions',
  });

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

  const optionalText = (key: string, fallback: string, values?: object) =>
    tNotificationCentre.has(key)
      ? tNotificationCentre(key, values as never)
      : fallback;

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
          <div className="flex flex-col gap-6">
            <SettingsCard>
              <Skeleton width="100%" height="64px" loading={isLoading}>
                <SettingsRow
                  id="notificationsSubscribed"
                  title={tNotificationCentre('subscribe.title')}
                  description={
                    subscribed
                      ? tNotificationCentre('subscribe.subscribedDescription')
                      : tNotificationCentre('subscribe.unsubscribedDescription')
                  }
                  checked={Boolean(subscribed)}
                  disabled={isLoading || subscribePending}
                  onCheckedChange={handleSubscribeToggle}
                />
              </Skeleton>
            </SettingsCard>
            {error && <FormMessage>{error}</FormMessage>}
            <fieldset
              disabled={preferencesDisabled}
              className={cn(
                'm-0 flex min-w-0 flex-col gap-6 border-0 p-0',
                preferencesDisabled && 'pointer-events-none opacity-60',
              )}
            >
              <SettingsCard title={tNotificationCentre('channels.title')}>
                <FormField
                  control={form.control}
                  name="emailNotifications"
                  render={({ field }) => (
                    <SettingsRow
                      id="emailNotifications"
                      title={tNotificationCentre('channels.emailNotifications')}
                      description={
                        notificationEmail
                          ? optionalText(
                              'channels.emailDescription',
                              `Sent to ${notificationEmail}.`,
                              { email: notificationEmail },
                            )
                          : optionalText(
                              'channels.emailDescriptionNoAddress',
                              'Sent to your account email.',
                            )
                      }
                      checked={field.value === 'yes'}
                      disabled={preferencesDisabled}
                      onCheckedChange={(checked) =>
                        form.setValue(field.name, getSwitch(checked), {
                          shouldDirty: true,
                        })
                      }
                    />
                  )}
                />
                <FormField
                  control={form.control}
                  name="browserNotifications"
                  render={({ field }) => (
                    <SettingsRow
                      id="browserNotifications"
                      title={tNotificationCentre(
                        'channels.browserNotifications',
                      )}
                      description={optionalText(
                        'channels.browserDescription',
                        'Alerts on this browser or device. Turn it on in each browser you use.',
                      )}
                      checked={field.value === 'yes'}
                      disabled={preferencesDisabled || pushPending}
                      onCheckedChange={handleBrowserToggle}
                    />
                  )}
                />
              </SettingsCard>

              <h3 className="-mb-2 text-3 font-medium text-neutral-11">
                {tNotificationCentre('subscriptions.title')}
              </h3>
              {NOTIFICATION_SUBSCRIPTION_SECTIONS.map((section) => (
                <SettingsCard
                  key={section.id}
                  title={optionalText(
                    `subscriptions.sections.${section.id}`,
                    section.title,
                  )}
                >
                  {subscriptions.map((field, index) => {
                    if (field.group !== section.id) return null;
                    return (
                      <FormField
                        key={field.id}
                        control={form.control}
                        name={`subscriptions.${index}`}
                        render={({
                          field: { name, value: subscription, onChange },
                        }) => {
                          const localizedSubscription =
                            subscriptionTextMap[subscription.tagName];
                          return (
                            <SettingsRow
                              id={`${name.replace('.', '_')}_checked`}
                              title={
                                localizedSubscription?.title ??
                                subscription.title
                              }
                              description={
                                localizedSubscription?.description ??
                                subscription.description
                              }
                              checked={subscription.tagValue}
                              disabled={preferencesDisabled}
                              onCheckedChange={(value) =>
                                onChange({ ...subscription, tagValue: value })
                              }
                            />
                          );
                        }}
                      />
                    );
                  })}
                </SettingsCard>
              ))}
            </fieldset>
            <div className="sticky bottom-0 z-[5] -mx-4 -mb-4 border-t border-border/90 bg-background-2 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:-mx-7 lg:-mb-7 lg:px-7">
              <div className="flex items-center justify-end gap-3">
                {isDirty && (
                  <span className="mr-auto text-2 text-neutral-11">
                    {optionalText(
                      'actions.unsavedChanges',
                      'You have unsaved changes',
                    )}
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
