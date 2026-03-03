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
  Badge,
  COMBOBOX_TITLE,
  COMBOBOX_DELIMITER,
} from '@hypha-platform/ui';
import { Text } from '@radix-ui/themes';
import React from 'react';
import { useTranslations } from 'next-intl';

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
  useSpaceBySlugExists,
  useSpacesByWeb3Ids,
} from '@hypha-platform/core/client';
import { Links } from '../../common/links';
import {
  ButtonClose,
  ButtonBack,
  ParentSpaceSelector,
  useMemberWeb3SpaceIds,
  useScrollToErrors,
  useFilterSpacesListWithDiscoverability,
  CardButton,
} from '@hypha-platform/epics';
import slugify from 'slugify';
import { cn } from '@hypha-platform/ui-utils';

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
  spaceId?: number;
  slugIncorrectMessage?: string;
  onSubmit: (
    values: SchemaCreateSpaceForm,
    organisationSpaces?: Space[],
  ) => Promise<void> | void;
};

const DEFAULT_VALUES = {
  title: '',
  description: '',
  logoUrl: '',
  slug: '',
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
  submitLabel,
  submitLoadingLabel,
  label = 'create',
  spaceId = -1,
  slugIncorrectMessage,
}: CreateSpaceFormProps) => {
  if (process.env.NODE_ENV !== 'production') {
    console.debug('SpaceForm', { defaultValues });
  }

  const tSpaces = useTranslations('Spaces');

  const resolvedSubmitLabel = submitLabel ?? tSpaces('createSpace');
  const resolvedSubmitLoadingLabel = submitLoadingLabel ?? tSpaces('creating');
  const resolvedSlugIncorrectMessage =
    slugIncorrectMessage ?? tSpaces('slugAlreadyExists');

  const [slugDuplicated, setSlugDuplicated] = React.useState(false);

  const resolveSlug = React.useCallback(
    () => !slugDuplicated,
    [slugDuplicated],
  );

  const schema = schemaCreateSpaceForm.extend({
    slug: z
      .string()
      .min(1, '')
      .max(50)
      .regex(/^[a-z0-9'-]+$/, tSpaces('slugFieldRegex'))
      .optional()
      .refine(resolveSlug, { message: resolvedSlugIncorrectMessage }),
  });

  const formRef = React.useRef<HTMLFormElement>(null);
  const form = useForm<SchemaCreateSpaceForm>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  useScrollToErrors(form, formRef);

  const parentSpaceId = form.watch('parentId');
  const slug = form.watch('slug');

  const {
    exists: slugExists,
    spaceId: foundSpaceId,
    isLoading: slugIsChecking,
  } = useSpaceBySlugExists(slug ?? '');

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
    if (slugIsChecking) {
      return;
    }
    if (slugExists && spaceId !== foundSpaceId) {
      setSlugDuplicated(true);
    } else {
      setSlugDuplicated(false);
    }
  }, [spaceId, slugExists, foundSpaceId, slugIsChecking]);

  React.useEffect(() => {
    const { title } = form.getValues();
    const { isTouched } = form.getFieldState('title');
    if ((!values || values.title) && !title && !isTouched) {
      return;
    }
    form.trigger('slug');
  }, [form, slugDuplicated]);

  const updateSlug = React.useCallback(
    (title: string) => {
      const preparedSlug = slugify(title, { lower: true });
      form.setValue('slug', preparedSlug);
    },
    [form],
  );

  React.useEffect(() => {
    const { isDirty } = form.getFieldState('parentId');
    if (!isDirty) {
      form.setValue('parentId', initialParentSpaceId ?? null, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: true,
      });
    }
  }, [initialParentSpaceId, form]);

  React.useEffect(() => {
    if (!values) return;
    form.reset(
      { ...form.getValues(), ...values },
      { keepDirty: true, keepTouched: false },
    );
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

  const { filteredSpaces: filteredMySpaces } =
    useFilterSpacesListWithDiscoverability({
      spaces: mySpaces,
      useGeneralState: false,
    });
  const { filteredSpaces: filteredOrganisationSpaces } =
    useFilterSpacesListWithDiscoverability({
      spaces: organisationSpaces ?? [],
      useGeneralState: true,
    });

  const parentOptions = React.useMemo((): ParentOption[] => {
    if (isOrganisationLoading || isMyLoading) {
      return [];
    }
    const organisationOptions =
      filteredOrganisationSpaces
        ?.filter((orgSpace) => (values ? orgSpace.slug !== values.slug : true))
        .map((space) => {
          return {
            avatarUrl: space.logoUrl,
            value: `${space.id}`,
            label: space.title,
          };
        }) ?? [];
    const mySpacesOptions = filteredMySpaces
      .filter(
        (mySpace) =>
          !filteredOrganisationSpaces?.find(
            (orgSpace) => mySpace.id === orgSpace.id,
          ),
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
        { value: COMBOBOX_TITLE, label: tSpaces('organisationSpaces') },
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
        { value: COMBOBOX_TITLE, label: tSpaces('myOtherSpaces') },
        ...mySpacesOptions,
      );
    }
    return result;
  }, [
    filteredOrganisationSpaces,
    isOrganisationLoading,
    filteredMySpaces,
    isMyLoading,
    values?.slug,
  ]);

  const flags = form.watch('flags');
  const isSandbox = React.useMemo(
    () => flags?.includes('sandbox') ?? false,
    [flags],
  );
  const isDemo = React.useMemo(() => flags?.includes('demo') ?? false, [flags]);
  const isArchived = React.useMemo(
    () => flags?.includes('archived') ?? false,
    [flags],
  );
  const isLive = React.useMemo(
    () => !isDemo && !isSandbox && !isArchived,
    [isDemo, isSandbox, isArchived],
  );

  const toggleSandbox = React.useCallback(() => {
    const current = form.getValues().flags ?? [];
    const next = current.includes('sandbox')
      ? current.filter((f) => f !== 'sandbox')
      : ([
          'sandbox',
          ...current.filter((f) => f !== 'demo' && f !== 'archived'),
        ] as SpaceFlags[]);
    form.setValue('flags', next, { shouldDirty: true, shouldValidate: true });
    if (next.includes('sandbox')) {
      form.clearErrors('categories');
    }
  }, [form]);

  const toggleDemo = React.useCallback(() => {
    const current = form.getValues().flags ?? [];
    const next = current.includes('demo')
      ? current.filter((f) => f !== 'demo')
      : ([
          'demo',
          ...current.filter((f) => f !== 'sandbox' && f !== 'archived'),
        ] as SpaceFlags[]);
    form.setValue('flags', next, { shouldDirty: true, shouldValidate: true });
  }, [form]);

  const toggleArchived = React.useCallback(() => {
    const current = form.getValues().flags ?? [];
    const next = current.includes('archived')
      ? current.filter((f) => f !== 'archived')
      : ([
          'archived',
          ...current.filter((f) => f !== 'demo' && f !== 'sandbox'),
        ] as SpaceFlags[]);
    form.setValue('flags', next, { shouldDirty: true, shouldValidate: true });
  }, [form]);

  const toggleLive = React.useCallback(() => {
    const current = form.getValues().flags ?? [];
    const next = current.filter(
      (f) => f !== 'demo' && f !== 'sandbox' && f !== 'archived',
    );
    form.setValue('flags', next, { shouldDirty: true, shouldValidate: true });
  }, [form]);

  const showCategoriesError = React.useCallback(() => {
    form.setError('categories', {
      message: tSpaces('selectCategoryError'),
      type: 'validate',
    });
  }, [form, tSpaces]);

  const showUnsetParentIdError = React.useCallback(() => {
    form.setError('parentId', {
      message: tSpaces('selectParentError'),
      type: 'validate',
    });
  }, [form, tSpaces]);

  const labelText = React.useMemo(() => {
    switch (label) {
      case 'add':
        return tSpaces('addSpace');
      case 'create':
        return tSpaces('createSpace');
      case 'configure':
        return tSpaces('configureSpace');
    }
  }, [label, tSpaces]);

  return (
    <Form {...form}>
      <form
        ref={formRef}
        onSubmit={form.handleSubmit(
          async (space) => {
            if (
              !space.flags?.includes('sandbox') &&
              !space.flags?.includes('archived') &&
              space.categories.length === 0
            ) {
              showCategoriesError();
              return;
            }
            if (parentSpaceId === -1) {
              showUnsetParentIdError();
              return;
            }
            await onSubmit(space, organisationSpaces);
          },
          (e) => {
            const flags = form.getValues()['flags'];
            const categories = form.getValues()['categories'];
            if (
              !flags?.includes('sandbox') &&
              !flags?.includes('archived') &&
              categories.length === 0
            ) {
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
            <div className="flex flex-col w-full">
              <div className="flex flex-row w-full">
                <Badge className="w-fit" colorVariant="accent">
                  {labelText}
                </Badge>
                <div className="flex grow"></div>
                <div className="flex justify-between gap-4">
                  {backUrl && (
                    <ButtonBack label={backLabel} backUrl={backUrl} />
                  )}
                  <ButtonClose closeUrl={closeUrl} />
                </div>
              </div>
              <div className="flex flex-row w-full">
                <div className="flex flex-col w-full">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem className="gap-0">
                        <FormControl>
                          <Input
                            rightIcon={!field.value && <RequirementMark />}
                            placeholder={tSpaces('nameYourSpace')}
                            className="border-0 text-4 p-0 placeholder:text-4 bg-inherit"
                            disabled={isLoading}
                            {...field}
                            onChange={(
                              event: React.ChangeEvent<HTMLInputElement>,
                            ) => {
                              field.onChange(event);
                              updateSlug(event.target.value);
                            }}
                          />
                        </FormControl>
                        <FormMessage className="mt-1" />
                      </FormItem>
                    )}
                  />
                  {spaceId === -1 && (
                    <FormField
                      control={form.control}
                      name="slug"
                      render={({ field }) => (
                        <FormItem>
                          <FormMessage className="mt-1" />
                        </FormItem>
                      )}
                    />
                  )}
                  <span className="flex items-center">
                    <Text className="text-1 text-foreground mr-1">
                      {tSpaces('createdBy')}
                    </Text>
                    <Text className="text-1 text-neutral-11">
                      {creator?.name} {creator?.surname}
                    </Text>
                  </span>
                </div>
              </div>
            </div>
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
                      <span className="text-accent-11 gap-1">
                        {tSpaces('uploadSpaceBanner')}
                      </span>{' '}
                      {tSpaces('spaceBanner')} <RequirementMark />
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
                {tSpaces('purpose')} <RequirementMark />
              </FormLabel>
              <FormControl>
                <Textarea
                  disabled={isLoading}
                  placeholder={tSpaces('purposePlaceholder')}
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
                  {tSpaces('organisationLevel')}
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
              <FormLabel className="text-foreground">
                {tSpaces('tags')}
              </FormLabel>
              <FormControl>
                <MultiSelect
                  placeholder={tSpaces('selectOneOrMore')}
                  options={categoryOptions}
                  value={field.value}
                  allowToggleAll={false}
                  onValueChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {spaceId !== -1 && (
          <FormField
            control={form.control}
            name="slug"
            render={({ field, fieldState: { error } }) => (
              <FormItem>
                <FormLabel className="text-foreground">
                  {tSpaces('spaceUniqueLink')}
                </FormLabel>
                <FormControl>
                  <Input
                    leftIcon={<div className="text-2">/</div>}
                    rightIcon={!field.value && <RequirementMark />}
                    placeholder={tSpaces('spaceUniqueLink')}
                    className={cn(
                      'text-2 pl-4',
                      error &&
                        'border-destructive focus-visible:ring-destructive',
                    )}
                    disabled={isLoading}
                    {...field}
                  />
                </FormControl>
                <FormMessage className="mt-1" />
                <span className="text-1 text-neutral-11">
                  <span>{tSpaces('spaceLinkDescription')}</span>
                </span>
              </FormItem>
            )}
          />
        )}
        <FormField
          control={form.control}
          name="links"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{tSpaces('channels')}</FormLabel>
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
        <FormLabel>{tSpaces('activationMode')}</FormLabel>
        <div className="flex flex-col gap-2">
          <CardButton
            title="Sandbox Mode"
            description="Use Sandbox Mode to configure and test your space only on My Spaces, sharing it with your team via URL while laying the foundation for regenerative purpose."
            selected={isSandbox}
            colorVariant={'accent'}
            onClick={toggleSandbox}
          />
          <CardButton
            title="Pilot Mode"
            description="Use Pilot Mode to share your space for demos, use case validation, or as a replicable template. Expand your reach, activate member participation, and gather feedback."
            selected={isDemo}
            colorVariant={'accent'}
            onClick={toggleDemo}
          />
          <CardButton
            title="Live Mode"
            description="Use Live Mode to make your space fully operational and publicly discoverable, generating sustainable value and turning your purpose into regenerative impact."
            selected={isLive}
            colorVariant={'accent'}
            onClick={toggleLive}
          />
          {label === 'configure' && (
            <CardButton
              title="Archive Mode"
              description="Archive this space to temporarily pause activity or deactivate it while keeping all data and history safe. You can reactivate it anytime by selecting a different activation mode."
              selected={isArchived}
              colorVariant={'accent'}
              onClick={toggleArchived}
            />
          )}
        </div>
        <div className="flex justify-end w-full">
          <Button
            type="submit"
            variant={isLoading ? 'outline' : 'default'}
            disabled={isLoading}
          >
            {isLoading ? resolvedSubmitLoadingLabel : resolvedSubmitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
};
