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
import { Text } from '@radix-ui/themes';
import React from 'react';

import { z } from 'zod';
import clsx from 'clsx';
import {
  ALLOWED_IMAGE_FILE_SIZE,
  categories,
  createSpaceFiles,
  schemaCreateSpace,
} from '@hypha-platform/core/client';
import { Links } from '../../common/links';
import { ButtonClose, ButtonBack } from '@hypha-platform/epics';
import { AsteriskIcon } from 'lucide-react';

const schemaCreateSpaceForm = schemaCreateSpace.extend(createSpaceFiles);

export type CreateSpaceFormProps = {
  isLoading?: boolean;
  closeUrl: string;
  backUrl?: string;
  backLabel?: string;
  creator: {
    name?: string;
    surname?: string;
  };
  parentSpaceId?: number | null;
  defaultValues?: z.infer<typeof schemaCreateSpaceForm>;
  submitLabel?: string;
  submitLoadingLabel?: string;
  onSubmit: (values: z.infer<typeof schemaCreateSpaceForm>) => void;
};

const DEFAULT_VALUES = {
  title: '',
  description: '',
  logoUrl: '',
  leadImage: '',
  categories: [],
  links: [],
  parentId: null,
  address: '',
};

export const SpaceForm = ({
  creator,
  isLoading,
  closeUrl,
  backUrl,
  backLabel,
  onSubmit,
  parentSpaceId,
  defaultValues = {
    ...DEFAULT_VALUES,
    parentId: parentSpaceId || null,
  },
  submitLabel = 'Create',
  submitLoadingLabel = 'Creating Space...',
}: CreateSpaceFormProps) => {
  console.debug('SpaceForm', { defaultValues });
  const form = useForm<z.infer<typeof schemaCreateSpaceForm>>({
    resolver: zodResolver(schemaCreateSpaceForm),
    defaultValues,
  });

  React.useEffect(() => {
    if (parentSpaceId) {
      form.setValue('parentId', parentSpaceId);
    }
  }, [parentSpaceId, form]);

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={clsx('flex flex-col gap-5', isLoading && 'opacity-50')}
      >
        <div className="flex flex-col-reverse md:flex-row justify-between gap-4 md:gap-2">
          <div className="flex flex-grow gap-3">
            <FormField
              control={form.control}
              name="logoUrl"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <UploadAvatar
                      {...field}
                      maxFileSize={ALLOWED_IMAGE_FILE_SIZE}
                      defaultImage={
                        typeof defaultValues?.logoUrl === 'string'
                          ? defaultValues?.logoUrl
                          : undefined
                      }
                      required={true}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex w-full">
              <div className="flex flex-col w-full">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          rightIcon={
                            !field.value && (
                              <AsteriskIcon
                                size={12}
                                className="text-destructive w-4 h-4 left-0 align-super"
                              />
                            )
                          }
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
          <div className="flex justify-between gap-4">
            {backUrl && <ButtonBack label={backLabel} backUrl={backUrl} />}
            <ButtonClose closeUrl={closeUrl} />
          </div>
        </div>
        <FormField
          control={form.control}
          name="leadImage"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <UploadLeadImage
                  {...field}
                  maxFileSize={ALLOWED_IMAGE_FILE_SIZE}
                  defaultImage={
                    typeof defaultValues?.leadImage === 'string'
                      ? defaultValues?.leadImage
                      : undefined
                  }
                  uploadText={
                    <>
                      <span className="text-accent-11">Upload</span> space
                      banner
                      <AsteriskIcon className="text-destructive inline w-4 h-4 align-super" />
                    </>
                  }
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
              <FormLabel className="text-foreground">
                Purpose
                <AsteriskIcon className="text-destructive inline w-4 h-4 align-super" />
              </FormLabel>
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
            {isLoading ? submitLoadingLabel : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
};
