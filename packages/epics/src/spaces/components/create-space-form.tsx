'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import {
  Button,
  Textarea,
  Input,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  UploadAvatar,
  UploadLeadImage,
  MultiSelect,
} from '@hypha-platform/ui';
import { RxCross1 } from 'react-icons/rx';
import { Text } from '@radix-ui/themes';

import Link from 'next/link';

import { z } from 'zod';
import clsx from 'clsx';
import {
  ALLOWED_IMAGE_FILE_SIZE,
  categories,
  createSpaceFiles,
  schemaCreateSpace,
} from '@hypha-platform/core/client';
import { Links } from '../../common/links';

const schemaCreateSpaceForm = schemaCreateSpace.extend(createSpaceFiles);

export type CreateSpaceFormProps = {
  isLoading?: boolean;
  closeUrl: string;
  creator: {
    name?: string;
    surname?: string;
  };
  onCreate: (values: z.infer<typeof schemaCreateSpaceForm>) => void;
};

export const CreateSpaceForm = ({
  creator,
  isLoading,
  closeUrl,
  onCreate,
}: CreateSpaceFormProps) => {
  const form = useForm<z.infer<typeof schemaCreateSpaceForm>>({
    resolver: zodResolver(schemaCreateSpaceForm),
    defaultValues: {
      title: '',
      // TODO: rename to purpose
      description: '',
      quorum: 80,
      unity: 20,
      votingPowerSource: 0,
      joinMethod: 0,
      exitMethod: 0,
      logoUrl: undefined,
      leadImage: undefined,
      categories: [],
      links: [],
    },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onCreate)}
        className={clsx('flex flex-col gap-5', isLoading && 'opacity-50')}
      >
        <div className="flex gap-5 justify-between">
          <div className="flex items-center gap-3">
            <FormField
              control={form.control}
              name="logoUrl"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <UploadAvatar
                      onChange={field.onChange}
                      maxFileSize={ALLOWED_IMAGE_FILE_SIZE}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-between items-center w-full">
              <div className="flex flex-col">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          placeholder="Type a title..."
                          className="border-0 text-4 p-0 placeholder:text-4 bg-inherit"
                          disabled={isLoading}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <span className="flex items-center">
                  <Text className="text-1 text-foreground mr-1">
                    Created by
                  </Text>
                  <Text className="text-1 text-neutral-11">
                    {creator?.name} {creator?.surname}
                  </Text>
                </span>
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
        <FormField
          control={form.control}
          name="leadImage"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <UploadLeadImage
                  onChange={field.onChange}
                  maxFileSize={ALLOWED_IMAGE_FILE_SIZE}
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
              <FormLabel>Purpose</FormLabel>
              <FormControl>
                <Textarea
                  disabled={isLoading}
                  placeholder="Type a brief description here..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="categories"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tags</FormLabel>
              <FormControl>
                <MultiSelect
                  placeholder={'Select one or more'}
                  options={categories}
                  defaultValue={field.value}
                  onValueChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="links"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Links
                  links={field.value}
                  onChange={field.onChange}
                  errors={form.formState.errors.links}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end w-full">
          <Button
            type="submit"
            variant={isLoading ? 'outline' : 'default'}
            disabled={isLoading}
          >
            {isLoading ? 'Creating Space...' : 'Create'}
          </Button>
        </div>
      </form>
    </Form>
  );
};
