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
  Badge,
  COMBOBOX_TITLE,
  COMBOBOX_DELIMITER,
} from '@hypha-platform/ui';
import { Text } from '@radix-ui/themes';
import React from 'react';

import { z } from 'zod';
import clsx from 'clsx';
import {
  Address,
  ALLOWED_IMAGE_FILE_SIZE,
  categories,
  Category,
  createSpaceFiles,
  schemaCreateSpace,
  Space,
  SpaceFlags,
  useMe,
  useOrganisationSpacesBySingleSlug,
  useSpacesByWeb3Ids,
} from '@hypha-platform/core/client';
import { Links } from '../../common/links';
import {
  ButtonClose,
  ButtonBack,
  ParentSpaceSelector,
  useMemberWeb3SpaceIds,
} from '@hypha-platform/epics';

const schemaCreateSpaceForm = schemaCreateSpace.extend(createSpaceFiles);
export type SchemaCreateSpaceForm = z.infer<typeof schemaCreateSpaceForm>;

export type SpaceFormLabel = 'create' | 'add' | 'configure';

type ParentOption = { avatarUrl?: string | null; value: string; label: string };

export type CreateSpaceFormProps = {
  isLoading?: boolean;
  closeUrl: string;
  backUrl?: string;
  backLabel?: string;
  creator: {
    name?: string;
    surname?: string;
  };
  initialParentSpaceId?: number | null;
  parentSpaceSlug?: string;
  values?: Partial<SchemaCreateSpaceForm>;
  defaultValues?: Partial<SchemaCreateSpaceForm>;
  submitLabel?: string;
  submitLoadingLabel?: string;
  label?: SpaceFormLabel;
  onSubmit: (
    values: SchemaCreateSpaceForm,
    organisationSpaces?: Space[],
  ) => void;
};

const DEFAULT_VALUES = {
  title: '',
  description: '',
  logoUrl: '',
  leadImage: '',
  categories: [] as Category[],
  links: [] as string[],
  parentId: null,
  parentSpaceSlug: '',
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
  initialParentSpaceId,
  parentSpaceSlug,
  values,
  defaultValues = {
    ...DEFAULT_VALUES,
    parentId: initialParentSpaceId || null,
  },
  submitLabel = 'Create',
  submitLoadingLabel = 'Creating Space...',
  label = 'create',
}: CreateSpaceFormProps) => {
  if (process.env.NODE_ENV !== 'production') {
    console.debug('SpaceForm', { defaultValues });
  }

  const form = useForm<SchemaCreateSpaceForm>({
    resolver: zodResolver(schemaCreateSpaceForm),
    defaultValues,
  });

  const parentSpaceId = form.watch('parentId');

  const categoryOptions = React.useMemo(
    () =>
      categories
        .filter((c) => !c.archive)
        .map((c) => ({ value: c.value as string, label: c.label })),
    [],
  );

  React.useEffect(() => {
    form.setValue('parentId', parentSpaceId ?? null);
  }, [parentSpaceId, form]);

  React.useEffect(() => {
    if (!values) return;
    form.reset({ ...form.getValues(), ...values }, { keepDirty: true });
  }, [values, form]);

  const { spaces: organisationSpaces, isLoading: isOrganisationLoading } =
    useOrganisationSpacesBySingleSlug(values?.slug ?? parentSpaceSlug ?? '');
  const { person } = useMe();
  const { web3SpaceIds } = useMemberWeb3SpaceIds({
    personAddress: person?.address as Address | undefined,
  });
  const { spaces: mySpaces, isLoading: isMyLoading } = useSpacesByWeb3Ids(
    web3SpaceIds ?? [],
  );
  const parentOptions = React.useMemo((): ParentOption[] => {
    if (isOrganisationLoading || isMyLoading) {
      return [];
    }
    const organisationOptions =
      organisationSpaces
        ?.filter((orgSpace) => (values ? orgSpace.slug !== values.slug : true))
        .map((space) => {
          return {
            avatarUrl: space.logoUrl,
            value: `${space.id}`,
            label: space.title,
          };
        }) ?? [];
    const mySpacesOptions = mySpaces
      .filter(
        (mySpace) =>
          !organisationSpaces?.find((orgSpace) => mySpace.id === orgSpace.id),
      )
      .map((space) => {
        return {
          avatarUrl: space.logoUrl,
          value: `${space.id}`,
          label: space.title,
        };
      });
    const result: ParentOption[] = [];
    if (organisationOptions.length > 0) {
      result.push(
        { value: COMBOBOX_TITLE, label: 'Organisation Spaces' },
        ...organisationOptions,
      );
    }
    if (organisationOptions.length > 0 && mySpacesOptions.length > 0) {
      result.push({
        value: COMBOBOX_DELIMITER,
        label: '',
      });
    }
    if (mySpacesOptions.length > 0) {
      result.push(
        { value: COMBOBOX_TITLE, label: 'My Other Spaces' },
        ...mySpacesOptions,
      );
    }
    return result;
  }, [organisationSpaces, isOrganisationLoading, mySpaces, isMyLoading]);

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

  const showCategoriesError = React.useCallback(() => {
    form.setError('categories', {
      message: 'Please select at least one tag category.',
      type: 'validate',
    });
  }, [form]);

  const showUnsetParentIdError = React.useCallback(() => {
    form.setError('parentId', {
      message: 'Please select a linked space or enable "Root Space"',
      type: 'validate',
    });
  }, [form]);

  const labelText = React.useMemo(() => {
    switch (label) {
      case 'add':
        return 'Add Space';
      case 'create':
        return 'Create Space';
      case 'configure':
        return 'Configure Space';
    }
  }, [label]);

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(
          (space) => {
            if (
              !space.flags?.includes('sandbox') &&
              space.categories.length === 0
            ) {
              showCategoriesError();
              return;
            }
            if (parentSpaceId === -1) {
              showUnsetParentIdError();
              return;
            }
            onSubmit(space, organisationSpaces);
          },
          (e) => {
            const flags = form.getValues()['flags'];
            const categories = form.getValues()['categories'];
            if (!flags?.includes('sandbox') && categories.length === 0) {
              showCategoriesError();
            }
            if (parentSpaceId === -1) {
              showUnsetParentIdError();
            }
          },
        )}
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
                        typeof values?.logoUrl === 'string'
                          ? values?.logoUrl
                          : typeof defaultValues?.logoUrl === 'string'
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
                <Badge className="w-fit" colorVariant="accent">
                  {labelText}
                </Badge>
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
                    typeof values?.leadImage === 'string'
                      ? values?.leadImage
                      : typeof defaultValues?.leadImage === 'string'
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
        {label === 'configure' && (
          <FormField
            control={form.control}
            name="parentId"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-foreground">
                  Organisation Level
                </FormLabel>
                <FormControl>
                  <ParentSpaceSelector
                    options={parentOptions}
                    isLoading={isOrganisationLoading || isMyLoading}
                    parentSpaceId={field.value}
                    setParentSpaceId={(parentId) => {
                      form.setValue('parentId', parentId ?? null, {
                        shouldDirty: true,
                      });
                      form.clearErrors('parentId');
                    }}
                    className="w-full"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <FormField
          control={form.control}
          name="categories"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-foreground">Tags</FormLabel>
              <FormControl>
                <MultiSelect
                  placeholder={'Select one or more'}
                  options={categoryOptions}
                  value={field.value}
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
              <FormLabel>Channels</FormLabel>
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
        <FormLabel>Activation Mode</FormLabel>
        <div className="flex flex-col gap-2">
          <Card
            className={clsx('flex p-6 cursor-pointer space-x-4 items-center', {
              'border-accent-9': isSandbox,
              'hover:border-accent-5': !isSandbox,
            })}
            onClick={toggleSandbox}
          >
            <div className="flex flex-col">
              <span className="text-2 font-medium">Sandbox Mode</span>
              <span className="text-1 text-neutral-11">
                <span>
                  Use Sandbox Mode to configure and test your space only on My
                  Spaces, sharing it with your team via URL while laying the
                  foundation for regenerative purpose.
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
              <span className="text-2 font-medium">Pilot Mode</span>
              <span className="text-1 text-neutral-11">
                <span>
                  Use Pilot Mode to share your space for demos, use case
                  validation, or as a replicable template. Expand your reach,
                  activate member participation, and gather feedback.
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
              <span className="text-2 font-medium">Live Mode</span>
              <span className="text-1 text-neutral-11">
                <span>
                  Use Live Mode to make your space fully operational and
                  publicly discoverable, generating sustainable value and
                  turning your purpose into regenerative impact.
                </span>
              </span>
            </div>
          </Card>
        </div>
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
