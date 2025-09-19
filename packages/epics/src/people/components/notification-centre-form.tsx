'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Badge, Button, Form, Separator, Skeleton } from '@hypha-platform/ui';
import { Text } from '@radix-ui/themes';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ButtonClose } from '../../common/button-close';

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
              <Skeleton width="100px" height="24px" loading={isLoading}>
                <span className="text-4 text-secondary-foreground">
                  Notification Centre
                </span>
              </Skeleton>
            </div>
            <Skeleton
              width="100%"
              height="72px"
              loading={isLoading}
              className="rounded-lg"
            >
              <span className="text-2 text-neutral-11">
                On this page, choose how you’d like to be notified about
                proposals and other Network activity.
              </span>
            </Skeleton>
            <Separator />
            <Separator />
            {/* TODO: fields */}
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
                    {error ? 'Retry' : 'Save'}
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
