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
  RequirementMark,
} from '@hypha-platform/ui';
import { Text } from '@radix-ui/themes';
import { cn } from '@hypha-platform/ui-utils';
import { Links } from '../../common';
import { ButtonClose } from '@hypha-platform/epics';

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
      onUpdate();
    } catch (e) {
      console.log(e);
    }
  };

  return (
    <div className="relative">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col-reverse md:flex-row gap-5 justify-between">
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
                                placeholder="First Name"
                                required
                                aria-required="true"
                                rightIcon={
                                  !field.value && (
                                    <RequirementMark className="text-4" />
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
                                rightIcon={
                                  !field.value && (
                                    <RequirementMark className="text-4" />
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
                              placeholder="Nickname"
                              rightIcon={
                                !field.value && (
                                  <RequirementMark className="text-4" />
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
              <div className="flex justify-end">
                <ButtonClose closeUrl={closeUrl} className="px-0 md:px-3" />
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
                      defaultImage={
                        typeof person?.leadImageUrl === 'string'
                          ? person?.leadImageUrl
                          : undefined
                      }
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
                            className="w-60"
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
                            className="w-60"
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
