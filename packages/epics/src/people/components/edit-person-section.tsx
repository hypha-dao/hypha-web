'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import {
  schemaEditPersonWeb2,
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
import { cn } from '@hypha-platform/ui-utils';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { Links } from '../../common';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Person {
  avatarUrl?: string;
  name?: string;
  surname?: string;
  id?: number;
  nickname?: string;
  description?: string;
  leadImageUrl?: string;
  location?: string;
  email?: string;
  links?: string[];
}

const schemaEditPersonForm = schemaEditPersonWeb2.extend(editPersonFiles.shape);

export type EditPersonSectionProps = {
  person?: Person;
  closeUrl: string;
  isLoading?: boolean;
  onEdit: (values: z.infer<typeof schemaEditPersonForm>) => Promise<void>;
  onUpdate: () => void;
  error?: string | null;
};

type FormData = z.infer<typeof schemaEditPersonForm>;

export const EditPersonSection = ({
  isLoading,
  closeUrl,
  person,
  onEdit,
  onUpdate,
  error,
}: EditPersonSectionProps) => {
  const router = useRouter();
  const [isSuccess, setIsSuccess] = useState(false);
  const form = useForm<FormData>({
    resolver: zodResolver(schemaEditPersonForm),
    defaultValues: {
      avatarUrl: person?.avatarUrl || '',
      name: person?.name || '',
      surname: person?.surname || '',
      nickname: person?.nickname || '',
      description: person?.description || '',
      leadImageUrl: person?.leadImageUrl || '',
      id: person?.id,
      links: person?.links || [],
      email: person?.email || '',
      location: person?.location || '',
    },
    mode: 'onChange',
  });

  const handleSubmit = async (values: FormData) => {
    try {
      await onEdit(values);
      setIsSuccess(true);
      onUpdate();
    } catch (e) {
      console.log(e);
    }
  };

  useEffect(() => {
    if (isSuccess) {
      const timer = setTimeout(() => {
        setIsSuccess(false);
        router.push('/profile');
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, router]);

  return (
    <div className="relative">
      {isSuccess && (
        <div className="absolute top-0 left-0 right-0 bottom-0 flex flex-col items-center justify-center space-y-2 bg-background/75">
          <Text className="text-neutral-11">
            Your changes have been saved and will appear on your profile
            shortly.
          </Text>
        </div>
      )}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
          <div className="flex flex-col gap-5">
            <div className="flex gap-5 justify-between">
              <div className="flex items-center space-x-2">
                <FormField
                  control={form.control}
                  name="avatarUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <UploadAvatar
                          defaultImage={
                            typeof person?.avatarUrl === 'string'
                              ? person?.avatarUrl
                              : undefined
                          }
                          onChange={field.onChange}
                        />
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
                              disabled
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
                    <UploadLeadImage
                      defaultImage={
                        typeof person?.leadImageUrl === 'string'
                          ? person?.leadImageUrl
                          : undefined
                      }
                      onChange={field.onChange}
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
                      placeholder="Enter description"
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
                <Text className={cn('text-2', 'text-neutral-11')}>
                  Location
                </Text>
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
                {error && (
                  <Text className="text-error-11 text-sm">{error}</Text>
                )}
                <div className="flex gap-2">
                  {isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-neutral-10">
                      <Loader2 className="animate-spin w-4 h-4" />
                      Updating profile...
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
    </div>
  );
};
