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
  Separator,
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
  ParentSpaceSelector,
  useMemberWeb3SpaceIds,
  useScrollToErrors,
  useFilterSpacesListWithDiscoverability,
  ButtonBack,
  ButtonClose,
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
  ecosystemLogoUrl: undefined,
  ecosystemLogoUrlLight: undefined,
  ecosystemLogoUrlDark: undefined,
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
  const tModalAside = useTranslations('ModalAside');
  const tCommon = useTranslations('Common');

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
  const isRootConfiguration = label === 'configure' && parentSpaceId === null;

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

  React.useEffect(() => {
    if (!isArchived) {
      return;
    }

    form.setValue('parentId', null, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    form.clearErrors('parentId');
  }, [form, isArchived]);

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

  const modalContextTitle = React.useMemo(() => {
    switch (label) {
      case 'add':
        return tModalAside('addSpace');
      case 'create':
        return tModalAside('createSpace');
      case 'configure':
        return tModalAside('configureSpace');
      default:
        return tModalAside('createSpace');
    }
  }, [label, tModalAside]);

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
        <div className="sticky top-0 z-[5] -mx-4 mb-4 border-b border-border/90 bg-background-2/95 backdrop-blur-md supports-[backdrop-filter]:bg-background-2/80 lg:-mx-7">
          <div className="flex min-h-11 shrink-0 items-center gap-2 border-b border-border/80 px-4 lg:px-7">
            <h2 className="min-w-0 flex-1 truncate text-base font-semibold leading-tight tracking-tight text-foreground">
              {modalContextTitle}
            </h2>
            <div className="flex shrink-0 items-center justify-end gap-1">
              {backUrl ? (
                <ButtonBack
                  label={backLabel ?? tCommon('back')}
                  backUrl={backUrl}
                  className="px-0 md:px-3 align-top"
                />
              ) : null}
              <ButtonClose
                closeUrl={closeUrl}
                className="px-0 md:px-3 align-top"
              />
            </div>
          </div>
          <div className="px-4 pb-3 pt-3 lg:px-7">
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
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex min-w-0 flex-1 flex-col w-full">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem className="gap-0">
                        <FormControl>
                          <Input
                            rootClassName="h-auto min-h-10 w-full sm:min-h-11"
                            rightIcon={!field.value && <RequirementMark />}
                            placeholder={tSpaces('nameYourSpace')}
                            className="h-auto min-h-10 w-full border-0 bg-inherit p-0 py-1 text-lg font-semibold leading-snug tracking-tight text-foreground placeholder:text-base placeholder:font-medium placeholder:leading-snug placeholder:text-muted-foreground/80 sm:min-h-11 sm:text-xl sm:placeholder:text-lg"
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
                  <span className="flex items-center mt-1">
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
          <Separator />
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
                  cropDialogLabels={{
                    title: tCommon('uploadLeadImage.cropTitle'),
                    description: tCommon('uploadLeadImage.cropDescription'),
                    cancel: tCommon('uploadLeadImage.cancel'),
                    confirm: tCommon('uploadLeadImage.confirm'),
                  }}
                  messages={{
                    dropHere: tCommon('uploadLeadImage.dropHere'),
                    fileTooLarge: tCommon('uploadLeadImage.fileTooLarge'),
                    uploadFailed: tCommon('uploadLeadImage.uploadFailed'),
                  }}
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
                    isReadOnly={isArchived}
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
        {isRootConfiguration ? (
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="ecosystemLogoUrlLight"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">
                    {tSpaces('uploadEcosystemLogoLight')}
                  </FormLabel>
                  <FormControl>
                    <UploadAvatar
                      {...field}
                      maxFileSize={ALLOWED_IMAGE_FILE_SIZE}
                      accept={{
                        'image/png': [],
                        'image/jpg': [],
                        'image/jpeg': [],
                        'image/webp': [],
                        'image/svg+xml': [],
                      }}
                      className="mx-auto h-20 w-40 min-w-40 rounded-lg border border-border bg-muted/30"
                      imageClassName="object-contain bg-white p-1.5"
                      defaultImage={
                        typeof values?.ecosystemLogoUrlLight === 'string'
                          ? values?.ecosystemLogoUrlLight
                          : typeof defaultValues?.ecosystemLogoUrlLight ===
                            'string'
                          ? defaultValues?.ecosystemLogoUrlLight
                          : typeof values?.ecosystemLogoUrl === 'string'
                          ? values?.ecosystemLogoUrl
                          : typeof defaultValues?.ecosystemLogoUrl === 'string'
                          ? defaultValues?.ecosystemLogoUrl
                          : undefined
                      }
                    />
                  </FormControl>
                  <p className="text-1 text-neutral-11">
                    {tSpaces('ecosystemLogoLightDescription')}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="ecosystemLogoUrlDark"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">
                    {tSpaces('uploadEcosystemLogoDark')}
                  </FormLabel>
                  <FormControl>
                    <UploadAvatar
                      {...field}
                      maxFileSize={ALLOWED_IMAGE_FILE_SIZE}
                      accept={{
                        'image/png': [],
                        'image/jpg': [],
                        'image/jpeg': [],
                        'image/webp': [],
                        'image/svg+xml': [],
                      }}
                      className="mx-auto h-20 w-40 min-w-40 rounded-lg border border-border bg-muted/30"
                      imageClassName="object-contain bg-white p-1.5"
                      defaultImage={
                        typeof values?.ecosystemLogoUrlDark === 'string'
                          ? values?.ecosystemLogoUrlDark
                          : typeof defaultValues?.ecosystemLogoUrlDark ===
                            'string'
                          ? defaultValues?.ecosystemLogoUrlDark
                          : typeof values?.ecosystemLogoUrl === 'string'
                          ? values?.ecosystemLogoUrl
                          : typeof defaultValues?.ecosystemLogoUrl === 'string'
                          ? defaultValues?.ecosystemLogoUrl
                          : undefined
                      }
                    />
                  </FormControl>
                  <p className="text-1 text-neutral-11">
                    {tSpaces('ecosystemLogoDarkDescription')}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        ) : null}
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
                  searchPlaceholder={tSpaces('search')}
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
                  placeholder={tSpaces('addYourUrl')}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormLabel>{tSpaces('activationMode')}</FormLabel>
        <div className="flex flex-col gap-2">
          <Card
            className={clsx('flex p-6 cursor-pointer space-x-4 items-center', {
              'border-accent-9': isSandbox,
              'hover:border-accent-5': !isSandbox,
            })}
            onClick={toggleSandbox}
          >
            <div className="flex flex-col">
              <span className="text-2 font-medium">
                {tSpaces('sandboxMode')}
              </span>
              <span className="text-1 text-neutral-11">
                <span>{tSpaces('sandboxDescription')}</span>
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
              <span className="text-2 font-medium">{tSpaces('pilotMode')}</span>
              <span className="text-1 text-neutral-11">
                <span>{tSpaces('pilotDescription')}</span>
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
              <span className="text-2 font-medium">{tSpaces('liveMode')}</span>
              <span className="text-1 text-neutral-11">
                <span>{tSpaces('liveDescription')}</span>
              </span>
            </div>
          </Card>
          {label === 'configure' && (
            <Card
              className={clsx(
                'flex p-6 cursor-pointer space-x-4 items-center',
                {
                  'border-accent-9': isArchived,
                  'hover:border-accent-5': !isArchived,
                },
              )}
              onClick={toggleArchived}
            >
              <div className="flex flex-col">
                <span className="text-2 font-medium">
                  {tSpaces('archiveMode')}
                </span>
                <span className="text-1 text-neutral-11">
                  <span>{tSpaces('archiveDescription')}</span>
                </span>
              </div>
            </Card>
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
