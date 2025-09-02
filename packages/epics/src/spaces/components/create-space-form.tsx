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
  RequirementMark,
} from '@hypha-platform/ui';
import { Text } from '@radix-ui/themes';
import React from 'react';

import { z } from 'zod';
import clsx from 'clsx';
import {
  ALLOWED_IMAGE_FILE_SIZE,
  categories,
  Category,
  createSpaceFiles,
  schemaCreateSpace,
  SpaceFlags,
} from '@hypha-platform/core/client';
import { Links } from '../../common/links';
import { ButtonClose, ButtonBack } from '@hypha-platform/epics';

const schemaCreateSpaceForm = schemaCreateSpace.extend(createSpaceFiles);
type SchemaCreateSpaceForm = z.infer<typeof schemaCreateSpaceForm>;

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
  values?: SchemaCreateSpaceForm;
  defaultValues?: SchemaCreateSpaceForm;
  submitLabel?: string;
  submitLoadingLabel?: string;
  onSubmit: (values: SchemaCreateSpaceForm) => void;
};

const DEFAULT_VALUES = {
  title: '',
  description: '',
  logoUrl: '',
  leadImage: '',
  categories: [] as Category[],
  links: [] as string[],
  parentId: null,
  address: '',
  flags: [] as SpaceFlags[],
};

export const SpaceForm = ({
  creator,
  isLoading,
  closeUrl,
  backUrl,
  backLabel,
  onSubmit,
  parentSpaceId,
  values,
  defaultValues = {
    ...DEFAULT_VALUES,
    parentId: parentSpaceId || null,
  },
  submitLabel = 'Create',
  submitLoadingLabel = 'Creating Space...',
}: CreateSpaceFormProps) => {
  console.debug('SpaceForm', { defaultValues });
  const form = useForm<SchemaCreateSpaceForm>({
    resolver: zodResolver(schemaCreateSpaceForm),
    defaultValues,
  });

  const actualCategories = categories
    .filter((category) => !category.archive)
    .map((category) => {
      return {
        value: category.value as string,
        label: category.label,
      };
    });
  const categoryOptions = ([] as { value: string; label: string }[]).concat(
    actualCategories,
  );

  React.useEffect(() => {
    if (parentSpaceId) {
      form.setValue('parentId', parentSpaceId);
    }
  }, [parentSpaceId, form]);

  React.useEffect(() => {
    if (!values) return;
    form.reset({ ...form.getValues(), ...values }, { keepDirty: true });
  }, [values, form]);

  const flags = form.watch('flags');
  const isSandbox = React.useMemo(() => flags.includes('sandbox'), [flags]);
  const isDemo = React.useMemo(() => flags.includes('demo'), [flags]);

  const toggleSandbox = React.useCallback(() => {
    const flags = form.getValues()['flags'];
    if (flags.includes('sandbox')) {
      const index = flags.indexOf('sandbox', 0);
      if (index > -1) {
        flags.splice(index, 1);
      }
    } else {
      flags.push('sandbox');
    }
    form.setValue('flags', flags);
  }, [form]);

  const toggleDemo = React.useCallback(() => {
    const flags = form.getValues()['flags'];
    if (flags.includes('demo')) {
      const index = flags.indexOf('demo', 0);
      if (index > -1) {
        flags.splice(index, 1);
      }
    } else {
      flags.push('demo');
    }
    form.setValue('flags', flags);
  }, [form]);

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
                          rightIcon={!field.value && <RequirementMark />}
                          placeholder="Name your space..."
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
                      <span className="text-accent-11 gap-1">Upload</span> space
                      banner <RequirementMark />
                    </>
                  }
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
              <FormLabel className="text-foreground gap-1">
                Purpose <RequirementMark />
              </FormLabel>
              <FormControl>
                <Textarea
                  disabled={isLoading}
                  placeholder="Type your space purpose here..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex flex-col w-full">
          <label>
            Test in Sandbox mode. When ready, turn this option off in space
            settings and select relevant tags to make it visible on the network
            page.
          </label>
          <span className="flex flex-row">
            <span className="w-4 h-4 mr-2">
              <Input
                id="sandbox-trigger"
                type="checkbox"
                checked={isSandbox}
                onChange={toggleSandbox}
              />
            </span>
            <label htmlFor="sandbox-trigger">Sandbox Mode</label>
          </span>
        </div>
        <FormField
          control={form.control}
          name="categories"
          disabled={isSandbox}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tags</FormLabel>
              <FormControl>
                <MultiSelect
                  placeholder={'Select one or more'}
                  options={categoryOptions}
                  defaultValue={field.value}
                  disabled={isSandbox}
                  onValueChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex flex-col w-full" aria-disabled={isSandbox}>
          <label>
            Enable this option if your space is a demo or use case. It will
            appear in the selected categories (tags) above and is for
            demonstration purposes only.
          </label>
          <span className="flex flex-row">
            <span className="w-4 h-4 mr-2">
              <Input
                id="demo-trigger"
                type="checkbox"
                disabled={isDemo}
                checked={isDemo}
                onChange={toggleDemo}
              />
            </span>
            <label htmlFor="demo-trigger">Use Case (Demo) Mode</label>
          </span>
        </div>
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
