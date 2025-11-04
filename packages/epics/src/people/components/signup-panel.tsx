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
  RequirementMark,
} from '@hypha-platform/ui';
import { RxCross1 } from 'react-icons/rx';
import { Text } from '@radix-ui/themes';
import { cn } from '@hypha-platform/ui-utils';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { Links } from '../../common';
import { useAuthentication } from '@hypha-platform/authentication';
import { useEffect } from 'react';

const schemaSignupPersonForm = schemaSignupPerson.extend(editPersonFiles.shape);

interface SignupPanelProps {
  closeUrl: string;
  isLoading?: boolean;
  onSave: (values: z.infer<typeof schemaSignupPersonForm>) => Promise<void>;
  isCreating?: boolean;
  error?: string | null;
}

type FormData = z.infer<typeof schemaSignupPersonForm>;

export const SignupPanel = ({
  closeUrl,
  isLoading,
  onSave,
  isCreating,
  error,
}: SignupPanelProps) => {
  const { user } = useAuthentication();
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
      email: undefined,
      address: '',
      links: [],
    },
  });

  useEffect(() => {
    if (user?.email) {
      form.setValue('email', user.email.trim());
    }
    if (user?.wallet?.address) {
      form.setValue('address', user.wallet.address);
    }
  }, [user, form]);

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
                              placeholder="First Name"
                              className="text-2 text-neutral-11"
                              rightIcon={
                                !field.value && (
                                  <RequirementMark className="text-2" />
                                )
                              }
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
                              placeholder="Last Name"
                              className="text-2 text-neutral-11"
                              rightIcon={
                                !field.value && (
                                  <RequirementMark className="text-2" />
                                )
                              }
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
                            rightIcon={
                              !field.value && (
                                <RequirementMark className="text-1" />
                              )
                            }
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
          </div>
          <Separator />
          <FormField
            control={form.control}
            name="leadImageUrl"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <UploadLeadImage
                    onChange={field.onChange}
                    enableImageResizer={true}
                  />
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
                    placeholder="Type your life purpose here..."
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
            <div>
              <FormField
                control={form.control}
                name="links"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Links
                        links={field.value || []}
                        onChange={field.onChange}
                        errors={form.formState.errors.links}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
          <div className="flex justify-end w-full">
            <div className="flex flex-col items-end gap-2">
              {error && <Text className="text-error-11 text-sm">{error}</Text>}
              <div className="flex gap-2">
                {isCreating ? (
                  <div className="flex items-center gap-2 text-sm text-neutral-10">
                    <Loader2 className="animate-spin w-4 h-4" />
                    Creating profile...
                  </div>
                ) : (
                  <Button
                    type="submit"
                    variant="default"
                    className="rounded-lg justify-start text-white w-fit"
                    disabled={isLoading}
                  >
                    {error ? 'Retry' : 'Save'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </form>
    </Form>
  );
};
