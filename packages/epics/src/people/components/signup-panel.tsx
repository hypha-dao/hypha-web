'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import {
  schemaSignupPerson,
  editPersonFiles,
} from '@hypha-platform/core/client';
import {
  Button,
  Textarea,
  Input,
  Separator,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  UploadLeadImage,
  UploadAvatar,
} from '@hypha-platform/ui';
import { RxCross1 } from 'react-icons/rx';
import { Text } from '@radix-ui/themes';
import { cn } from '@hypha-platform/lib/utils';
import Link from 'next/link';
import React from 'react';
import { Loader2 } from 'lucide-react';

const schemaSignupPersonForm = schemaSignupPerson.extend(editPersonFiles.shape);

interface SignupPanelProps {
  closeUrl: string;
  isLoading?: boolean;
  onSave: (values: z.infer<typeof schemaSignupPersonForm>) => Promise<void>;
  walletAddress?: string;
  isCreating?: boolean;
}

type FormData = z.infer<typeof schemaSignupPersonForm>;

export const SignupPanel = ({
  closeUrl,
  isLoading,
  onSave,
  walletAddress,
  isCreating,
}: SignupPanelProps) => {
  const form = useForm<FormData>({
    resolver: zodResolver(schemaSignupPersonForm),
    defaultValues: {
      name: '',
      surname: '',
      nickname: '',
      avatarUrl: undefined,
      leadImageUrl: undefined,
      description: '',
      location: undefined,
      email: '',
      address: walletAddress || '',
    },
  });

  React.useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
      console.log('Form values:', value);
      console.log('Form errors:', form.formState.errors);
      console.log('Is form valid:', form.formState.isValid);
    });
    return () => subscription.unsubscribe();
  }, [form]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSave)} className="space-y-8">
        <div className="flex flex-col gap-5">
          <div className="flex gap-5 justify-between">
            <div className="flex items-center space-x-2">
              <FormField
                control={form.control}
                name="avatarUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <UploadAvatar onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-between items-center w-full">
                <div className="flex flex-col">
                  <div className="flex gap-1 mb-1">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              disabled={isLoading}
                              placeholder="Name"
                              className="text-2 text-neutral-11"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="surname"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              disabled={isLoading}
                              placeholder="Surname"
                              className="text-2 text-neutral-11"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="nickname"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            disabled={isLoading}
                            placeholder="Nickname"
                            className="text-1 text-neutral-11"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>
            <Link href={closeUrl} scroll={false}>
              <Button
                variant="ghost"
                colorVariant="neutral"
                className="flex items-center"
              >
                Close
                <RxCross1 className="ml-2" />
              </Button>
            </Link>
          </div>
          <Separator />
          <FormField
            control={form.control}
            name="leadImageUrl"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <UploadLeadImage onChange={field.onChange} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea
                    placeholder="Enter description"
                    disabled={isLoading}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Separator />
          <div className="flex gap-3 flex-col">
            <div className="flex justify-between">
              <Text className={cn('text-2', 'text-neutral-11')}>Email</Text>
              <span className="flex items-center">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          disabled={isLoading}
                          placeholder="Email"
                          className="text-1 text-neutral-11"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </span>
            </div>
            <div className="flex justify-between">
              <Text className={cn('text-2', 'text-neutral-11')}>Location</Text>
              <span className="flex items-center">
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          disabled={isLoading}
                          placeholder="Location"
                          className="text-1 text-neutral-11"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </span>
            </div>
          </div>
          <div className="flex justify-end w-full">
            <div className="flex gap-2">
              {isCreating ? (
                <div className="flex items-center gap-2 text-sm text-neutral-10">
                  <Loader2 className="animate-spin w-4 h-4" />
                  Creating profile...
                </div>
              ) : (
                <>
                  <Button
                    type="submit"
                    variant="default"
                    className="rounded-lg justify-start text-white w-fit"
                    disabled={isLoading}
                  >
                    Save
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </form>
    </Form>
  );
};
