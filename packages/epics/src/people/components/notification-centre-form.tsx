'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  Checkbox,
  Form,
  FormField,
  FormLabel,
  FormMessage,
  Input,
  RadioGroup,
  RadioGroupItem,
  Separator,
} from '@hypha-platform/ui';
import { Text } from '@radix-ui/themes';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import React from 'react';
import { NotificationCofiguration } from '@hypha-platform/notifications/client';
import { ButtonClose } from '../../common/button-close';
import { schemaNotificationCentreForm, yesNoEnum } from '../hooks/validation';

type FormData = z.infer<typeof schemaNotificationCentreForm>;

export type NotificationCentreFormProps = {
  closeUrl: string;
  isLoading?: boolean;
  error?: string | null;
  subscribed?: boolean;
  subscribe: () => void;
  unsubscribe: () => void;
  configuration?: NotificationCofiguration;
  saveConfigurations: (configuration: NotificationCofiguration) => void;
};

type YesNo = z.infer<typeof yesNoEnum>;

function getSwitch(value: boolean): YesNo {
  return value ? 'yes' : 'no';
}

function parseSwitch(value: YesNo): boolean {
  return value === 'yes';
}

export const NotificationCentreForm = ({
  closeUrl,
  isLoading,
  error,
  subscribed,
  subscribe,
  unsubscribe,
  configuration,
  saveConfigurations,
}: NotificationCentreFormProps) => {
  const form = useForm<FormData>({
    resolver: zodResolver(schemaNotificationCentreForm),
    defaultValues: {
      emailNotifications: configuration
        ? getSwitch(configuration.emailNotifications)
        : 'yes',
      browserNotifications: configuration
        ? getSwitch(configuration.browserNotifications)
        : 'yes',
      newProposalOpen: configuration ? configuration.newProposalOpen : true,
      proposalApprovedOrRejected: configuration
        ? configuration.proposalApprovedOrRejected
        : true,
    },
    mode: 'onChange',
  });

  React.useEffect(() => {
    if (!configuration) {
      return;
    }
    const modified = {
      browserNotifications: getSwitch(configuration.browserNotifications),
      emailNotifications: getSwitch(configuration.emailNotifications),
      newProposalOpen: configuration.newProposalOpen,
      proposalApprovedOrRejected: configuration.newProposalOpen,
    };
    form.reset(modified, { keepDirty: false });
  }, [form, configuration]);

  const handleSubmit = async (values: FormData) => {
    console.log('Save notification settings:', values);
    saveConfigurations({
      browserNotifications: parseSwitch(values.browserNotifications),
      emailNotifications: parseSwitch(values.emailNotifications),
      newProposalOpen: values.newProposalOpen,
      proposalApprovedOrRejected: values.proposalApprovedOrRejected,
    });
  };

  return (
    <div className="relative">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col-reverse md:flex-row gap-5 justify-between">
              <div className="flex items-center space-x-2">
                {/* TODO */}
                <div className="flex justify-between items-center w-full">
                  <div className="flex flex-col">
                    <div className="flex gap-1 mb-1">{/* TODO: fields */}</div>
                    {/* TODO: fields */}
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <ButtonClose closeUrl={closeUrl} className="px-0 md:px-3" />
              </div>
            </div>
            <div className="flex gap-5 justify-between">
              <span className="text-4 text-secondary-foreground">
                Notification Centre
              </span>
            </div>
            <span className="text-2 text-neutral-11">
              On this page, choose how you’d like to be notified about proposals
              and other Network activity.
            </span>
            <Separator />
            <div className="flex gap-5 justify-between">
              <h3 className="text-3 font-medium text-neutral-11">
                Subscribe to Notifications
              </h3>
            </div>
            <span className="text-2 text-neutral-11">
              {subscribed ? (
                <Button onClick={unsubscribe}>Unsubscribe</Button>
              ) : (
                <Button onClick={subscribe}>Subscribe</Button>
              )}
              {error && <FormMessage>{error}</FormMessage>}
            </span>
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
              Email Notifications
              <FormField
                control={form.control}
                name="emailNotifications"
                render={({ field }) => (
                  <RadioGroup
                    className="flex flex-row justify-end"
                    name="emailNotifications"
                    orientation="horizontal"
                    value={field.value}
                    onChange={field.onChange}
                  >
                    <FormLabel htmlFor="emailNotificationsYes">Yes</FormLabel>
                    <RadioGroupItem id="emailNotificationsYes" value="yes" />
                    <FormLabel htmlFor="emailNotificationsNo">No</FormLabel>
                    <RadioGroupItem id="emailNotificationsNo" value="no" />
                  </RadioGroup>
                )}
              />
            </span>
            <span className="text-2 text-neutral-11 flex flex-row justify-between">
              Browser Notifications (formerly "Desktop Pop-up Notifications")
              <FormField
                control={form.control}
                name="browserNotifications"
                render={({ field }) => (
                  <RadioGroup
                    className="flex flex-row justify-end"
                    name="browserNotifications"
                    orientation="horizontal"
                    value={field.value}
                    onChange={field.onChange}
                  >
                    <FormLabel htmlFor="browserNotificationYes">Yes</FormLabel>
                    <RadioGroupItem id="browserNotificationYes" value="yes" />
                    <FormLabel htmlFor="browserNotificationNo">No</FormLabel>
                    <RadioGroupItem id="browserNotificationNo" value="no" />
                  </RadioGroup>
                )}
              />
            </span>
            <span className="text-2 text-neutral-11">
              Receive real-time alerts directly in your browser while you’re
              online. You may be prompted to allow browser permissions.
            </span>
            <Separator />
            <div className="flex gap-5 justify-between">
              <h3 className="text-3 font-medium text-neutral-11">
                Get Notified When...
              </h3>
            </div>
            <span className="text-2 text-neutral-11 justify-between">
              <FormField
                control={form.control}
                name="newProposalOpen"
                render={({ field }) => (
                  <div className="flex flex-row gap-2">
                    <Checkbox
                      id="newProposalOpenChecked"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                    <FormLabel htmlFor="newProposalOpenChecked">
                      A new proposal is open for vote
                    </FormLabel>
                  </div>
                )}
              />
            </span>
            <span className="text-2 text-neutral-11">
              In any of the spaces you're a member of.
            </span>
            <span className="text-2 text-neutral-11 justify-between">
              <FormField
                control={form.control}
                name="proposalApprovedOrRejected"
                render={({ field }) => (
                  <div className="flex flex-row gap-2">
                    <Checkbox
                      id="proposalApprovedOrRejectedChecked"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                    <FormLabel htmlFor="proposalApprovedOrRejectedChecked">
                      A proposal is approved or rejected
                    </FormLabel>
                  </div>
                )}
              />
            </span>
            <span className="text-2 text-neutral-11">
              In any of the spaces you're a member of.
            </span>
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
