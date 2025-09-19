'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Badge, Button, Form, Separator, Skeleton } from '@hypha-platform/ui';
import { Checkbox, Radio, Text } from '@radix-ui/themes';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ButtonClose } from '../../common/button-close';
import { Label, RadioGroup } from '@radix-ui/react-dropdown-menu';

const schemaNotificationCentreForm = z.object({});

type FormData = z.infer<typeof schemaNotificationCentreForm>;

export type NotificationCentreFormProps = {
  closeUrl: string;
  isLoading?: boolean;
  error?: string | null;
};

export const NotificationCentreForm = ({
  closeUrl,
  isLoading,
  error,
}: NotificationCentreFormProps) => {
  const form = useForm<FormData>({
    resolver: zodResolver(schemaNotificationCentreForm),
    defaultValues: {},
    mode: 'onChange',
  });

  const handleSubmit = async (values: FormData) => {};

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
              <span className="text-4 text-secondary-foreground">
                Subscribe to Notifications
              </span>
            </div>
            <span className="text-2 text-neutral-11">
              <Button>Subscript/Unsubscribe</Button>
            </span>
            <Separator />
            <div className="flex gap-5 justify-between">
              <span className="text-4 text-secondary-foreground">
                Notification Channels
              </span>
            </div>
            <span className="text-2 text-neutral-11">
              Choose how you’d like to receive notifications:
            </span>
            <span className="text-2 text-neutral-11 flex flex-row justify-between">
              Email Notifications{' '}
              <RadioGroup className="flex flex-row justify-end">
                <Label>
                  Yes <Radio value="yes" />
                </Label>{' '}
                <Label>
                  No <Radio value="no" />
                </Label>
              </RadioGroup>
            </span>
            <span className="text-2 text-neutral-11 flex flex-row justify-between">
              Browser Notifications (formerly "Desktop Pop-up Notifications")
              <RadioGroup className="flex flex-row justify-end">
                <Label>
                  Yes <Radio value="yes" />
                </Label>{' '}
                <Label>
                  No <Radio value="no" />
                </Label>
              </RadioGroup>
            </span>
            <span className="text-2 text-neutral-11">
              Receive real-time alerts directly in your browser while you’re
              online. You may be prompted to allow browser permissions.
            </span>
            <Separator />
            <div className="flex gap-5 justify-between">
              <span className="text-4 text-secondary-foreground">
                Get Notified When...
              </span>
            </div>
            <span className="text-2 text-neutral-11 justify-between">
              <Checkbox size="1" /> A new proposal is open for vote
            </span>
            <span className="text-2 text-neutral-11">
              In any of the spaces you're a member of.
            </span>
            <span className="text-2 text-neutral-11 justify-between">
              <Checkbox size="1" /> A proposal is approved or rejected
            </span>
            <span className="text-2 text-neutral-11">
              In any of the spaces you're a member of.
            </span>
            <Separator />
            <div className="flex justify-end w-full">
              <div className="flex flex-col items-end gap-2">
                {error && (
                  <Text className="text-error-11 text-sm">{error}</Text>
                )}
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
