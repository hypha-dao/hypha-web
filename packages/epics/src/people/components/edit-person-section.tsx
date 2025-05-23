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
  Switch,
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
import { useState } from 'react';
import Link from 'next/link';

interface Person {
  avatarUrl?: string;
  name?: string;
  surname?: string;
  id?: number;
  nickname?: string;
  description?: string;
  leadImageUrl?: string;
}

const schemaEditPersonForm = schemaEditPersonWeb2.extend(editPersonFiles);

export type EditPersonSectionProps = {
  person?: Person;
  closeUrl: string;
  isLoading?: boolean;
  onEdit: (values: z.infer<typeof schemaEditPersonForm>) => Promise<void>;
};

type FormData = z.infer<typeof schemaEditPersonForm>;

export const EditPersonSection = ({
  isLoading,
  closeUrl,
  person,
  onEdit,
}: EditPersonSectionProps & Person) => {
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
    },
    mode: 'onChange',
  });

  const [activeLinks, setActiveLinks] = useState({
    website: false,
    linkedin: false,
    x: false,
  });

  const handleLinkToggle =
    (field: keyof typeof activeLinks) => (isActive: boolean) => {
      setActiveLinks((prev) => ({ ...prev, [field]: isActive }));
    };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onEdit)} className="space-y-8">
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
                      control={form?.control}
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
                      control={form?.control}
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
                    control={form?.control}
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
          <div className="flex gap-6 flex-col">
            <div className="flex justify-between">
              <Text
                className={cn(
                  'text-2',
                  activeLinks.website ? 'text-neutral-11' : 'text-neutral-8',
                )}
              >
                Website
              </Text>
              <span className="flex items-center">
                <Input
                  placeholder="Add your URL"
                  disabled={!activeLinks.website}
                  className={cn(
                    'text-2 mr-3',
                    !activeLinks.website ? 'bg-neutral-6' : '',
                  )}
                />
                <Switch
                  disabled={isLoading}
                  checked={activeLinks.website}
                  onCheckedChange={handleLinkToggle('website')}
                />
              </span>
            </div>
            <div className="flex justify-between">
              <Text
                className={cn(
                  'text-2',
                  activeLinks.linkedin ? 'text-neutral-11' : 'text-neutral-8',
                )}
              >
                LinkedIn
              </Text>
              <span className="flex items-center">
                <Input
                  placeholder="Add your URL"
                  disabled={!activeLinks.linkedin}
                  className={cn(
                    'text-2 mr-3',
                    !activeLinks.linkedin ? 'bg-neutral-6' : '',
                  )}
                />
                <Switch
                  disabled={isLoading}
                  checked={activeLinks.linkedin}
                  onCheckedChange={handleLinkToggle('linkedin')}
                />
              </span>
            </div>
            <div className="flex justify-between">
              <Text
                className={cn(
                  'text-2',
                  activeLinks.x ? 'text-neutral-11' : 'text-neutral-8',
                )}
              >
                X
              </Text>
              <span className="flex items-center">
                <Input
                  placeholder="Add your URL"
                  disabled={!activeLinks.x}
                  className={cn(
                    'text-2 mr-3',
                    !activeLinks.x ? 'bg-neutral-6' : '',
                  )}
                />
                <Switch
                  disabled={isLoading}
                  checked={activeLinks.x}
                  onCheckedChange={handleLinkToggle('x')}
                />
              </span>
            </div>
          </div>
          <div className="flex justify-end w-full">
            <Button
              type="submit"
              variant="default"
              className="rounded-lg justify-start text-white w-fit"
              disabled={isLoading || !form.formState.isValid}
            >
              Save
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
};
