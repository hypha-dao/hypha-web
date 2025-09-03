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
  Card,
  TextWithLinks,
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
  flags: ['sandbox'] as SpaceFlags[],
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
  const isSandbox = React.useMemo(
    () => flags?.includes('sandbox') ?? false,
    [flags],
  );
  const isDemo = React.useMemo(() => flags?.includes('demo') ?? false, [flags]);
  const isLive = React.useMemo(
    () => !isDemo && !isSandbox,
    [isDemo, isSandbox],
  );

  const toggleSandbox = React.useCallback(() => {
    const current = form.getValues().flags ?? [];
    const next = current.includes('sandbox')
      ? current.filter((f) => f !== 'sandbox')
      : (['sandbox', ...current.filter((f) => f !== 'demo')] as SpaceFlags[]);
    form.setValue('flags', next, { shouldDirty: true, shouldValidate: true });
    if (next.includes('sandbox')) {
      form.clearErrors('categories');
    }
  }, [form]);

  const toggleDemo = React.useCallback(() => {
    const current = form.getValues().flags ?? [];
    const next = current.includes('demo')
      ? current.filter((f) => f !== 'demo')
      : (['demo', ...current.filter((f) => f !== 'sandbox')] as SpaceFlags[]);
    form.setValue('flags', next, { shouldDirty: true, shouldValidate: true });
  }, [form]);

  const toggleLive = React.useCallback(() => {
    const current = form.getValues().flags ?? [];
    const next = current.filter((f) => f !== 'demo' && f !== 'sandbox');
    form.setValue('flags', next, { shouldDirty: true, shouldValidate: true });
  }, [form]);

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((space) => {
          if (!isSandbox && space.categories.length === 0) {
            form.setError('categories', {
              message: 'Please select at least one tag category.',
              type: 'validate',
            });
            return;
          }
          onSubmit(space);
        })}
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
        <FormField
          control={form.control}
          name="categories"
          disabled={isSandbox}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-foreground">Tags</FormLabel>
              <FormControl>
                <MultiSelect
                  placeholder={'Select one or more'}
                  options={categoryOptions}
                  defaultValue={field.value}
                  value={field.value}
                  disabled={isSandbox}
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
              <FormLabel>Social Links</FormLabel>
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
        <Card
          className={clsx('flex p-6 cursor-pointer space-x-4 items-center', {
            'border-accent-9': isSandbox,
            'hover:border-accent-5': !isSandbox,
          })}
          onClick={toggleSandbox}
        >
          <div className="flex flex-col">
            <span className="text-2 font-medium">
              Sandbox Mode (Visible on My Spaces Only)
            </span>
            <span className="text-1 text-neutral-11">
              <span>
                Use Sandbox Mode to test and configure your space. It won’t
                appear on the network page yet, but you can share it with your
                team via URL until it’s publicly live.
              </span>
            </span>
          </div>
        </Card>
        <Card
          className={clsx('flex p-6 cursor-pointer space-x-4 items-center', {
            'border-accent-9': isDemo,
            'hover:border-accent-5': !isDemo,
          })}
          onClick={toggleDemo}
        >
          <div className="flex flex-col">
            <span className="text-2 font-medium">
              Template Mode (Visible on the Network Page)
            </span>
            <span className="text-1 text-neutral-11">
              <span>
                Use Template Mode to share your space as a starting point or
                reference. Perfect for demos, use case prototyping, or reusable
                templates for scaling.
              </span>
            </span>
          </div>
        </Card>
        <Card
          className={clsx('flex p-6 cursor-pointer space-x-4 items-center', {
            'border-accent-9': isLive,
            'hover:border-accent-5': !isLive,
          })}
          onClick={toggleLive}
        >
          <div className="flex flex-col">
            <span className="text-2 font-medium">
              Live Mode (Visible on the Network Page)
            </span>
            <span className="text-1 text-neutral-11">
              <span>
                Use Live Mode to make your space fully operational and
                discoverable on the network page, turning its purpose into
                sustainable value and regenerative impact.
              </span>
            </span>
          </div>
        </Card>
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
