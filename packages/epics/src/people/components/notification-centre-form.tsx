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
} from '@hypha-platform/ui';
import { Text } from '@radix-ui/themes';
import { useFieldArray, useForm } from 'react-hook-form';
import React from 'react';
import {
  NotificationCofiguration,
  TAG_NEW_PROPOSAL_OPEN,
  TAG_PROPOSAL_APPROVED_OR_REJECTED,
} from '@hypha-platform/notifications/client';
import { ButtonClose } from '../../common/button-close';
import {
  NotificationCentreFormValues,
  NotificationOption,
  schemaNotificationCentreForm,
  YesNo,
  yesNoEnum,
} from '../hooks/validation';

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

const notificationOptions: NotificationOption[] = [
  {
    title: 'A new proposal is open for vote',
    description: "In any of the spaces you're a member of.",
    tagName: TAG_NEW_PROPOSAL_OPEN,
    tagValue: true,
  },
  {
    title: 'A proposal is approved or rejected',
    description: "In any of the spaces you're a member of.",
    tagName: TAG_PROPOSAL_APPROVED_OR_REJECTED,
    tagValue: true,
  },
];

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
  const form = useForm<NotificationCentreFormValues>({
    resolver: zodResolver(schemaNotificationCentreForm),
    defaultValues: {
      emailNotifications: configuration
        ? getSwitch(configuration.emailNotifications)
        : 'yes',
      browserNotifications: configuration
        ? getSwitch(configuration.browserNotifications)
        : 'yes',
      options: notificationOptions,
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
      options: notificationOptions.map((option, index) => {
        const opt = configuration.options?.[index];
        const tagName = opt?.name ?? option.tagName;
        const tagValue = opt?.value ?? option.tagValue;
        return {
          ...option,
          tagName,
          tagValue,
        };
      }),
    };
    form.reset(modified, { keepDirty: false });
  }, [form, configuration]);

  const handleSubmit = async (values: NotificationCentreFormValues) => {
    console.log('Save notification settings:', values);
    saveConfigurations({
      browserNotifications: parseSwitch(values.browserNotifications),
      emailNotifications: parseSwitch(values.emailNotifications),
      options: values.options.map((option) => {
        return {
          name: option.tagName,
          value: option.tagValue,
        };
      }),
    });
  };

  const handleInvalid = async (err?: any) => {
    console.log('Notification settings errors:', err);
  };

  const { fields: options } = useFieldArray({
    control: form.control,
    name: 'options',
  });

  return (
    <div className="relative">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmit, handleInvalid)}
          className="space-y-8"
        >
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
              <FormLabel>Email Notifications</FormLabel>
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
            {options.map((field, index) => (
              <div key={field.id}>
                <FormField
                  control={form.control}
                  name={`options.${index}`}
                  render={({ field: { name, value: option, onChange } }) => {
                    const checkboxId = `${name.replace('.', '_')}_checked`;
                    return (
                      <FormItem>
                        <FormControl>
                          <div className="flex flex-col gap-2">
                            <span className="text-2 text-neutral-11 justify-between">
                              <div className="flex flex-row gap-2">
                                <Checkbox
                                  id={checkboxId}
                                  checked={option.tagValue}
                                  onCheckedChange={(value) => {
                                    onChange({
                                      ...option,
                                      tagValue: value === true,
                                    });
                                  }}
                                />
                                <FormLabel htmlFor={checkboxId}>
                                  {option.title}
                                </FormLabel>
                              </div>
                            </span>
                            <span className="text-2 text-neutral-11">
                              {option.description}
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
