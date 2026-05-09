'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  ConfirmDialog,
  Button,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  LucideReactIcon,
  MultiSelect,
  RequirementMark,
  RichTextEditor,
  Separator,
} from '@hypha-platform/ui';
import { Text } from '@radix-ui/themes';
import { RefreshCw } from 'lucide-react';
import { SpaceLoadingBackdrop } from '../../spaces/components/space-loading-backdrop';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  COHERENCE_PRIORITY_OPTIONS,
  COHERENCE_SIGNAL_TYPES,
  COHERENCE_TAGS,
  COHERENCE_TYPE_OPTIONS,
  CoherenceTag,
  CoherenceType,
  schemaCreateCoherenceForm,
  useCoherenceMutationsWeb2Rsc,
  useJwt,
  useMatrix,
  useMe,
} from '@hypha-platform/core/client';
import React from 'react';
import { useScrollToErrors } from '../../hooks';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { PersonAvatar } from '../../people/components/person-avatar';
import { CoherenceTypeButton } from './coherence-type-button';
import { CoherencePriorityButton } from './coherence-priority-button';
import { ButtonClose } from '../../common/button-close';
import { ButtonBack } from '../../common/button-back';
import { CardButtonColorVariant } from '../../common/card-button';
import {
  SIGNAL_PROVISIONING_NOTICE_EVENT,
  SIGNAL_PROVISIONING_NOTICE_STORAGE_KEY,
} from '../constants';

type FormValues = z.infer<typeof schemaCreateCoherenceForm>;

interface CreateSignalFormProps {
  spaceId: number;
  successfulUrl: string;
  closeUrl?: string;
  backUrl?: string;
  mode?: 'create' | 'edit';
  signalSlug?: string;
  initialValues?: Partial<FormValues>;
}

export const CreateSignalForm = ({
  spaceId,
  successfulUrl,
  closeUrl,
  backUrl,
  mode = 'create',
  signalSlug,
  initialValues,
}: CreateSignalFormProps) => {
  const t = useTranslations('CoherenceTab');
  const tAgreementFlow = useTranslations('AgreementFlow');
  const translateEditor = React.useCallback(
    (
      key: string,
      defaultValue: string | undefined,
      interpolations?: Record<string, string | number>,
    ) => {
      const translationKey = `createAgreementBaseFields.editor.${key}`;
      if (!tAgreementFlow.has(translationKey)) {
        return defaultValue ?? key;
      }
      return tAgreementFlow(translationKey, interpolations);
    },
    [tAgreementFlow],
  );

  const { person } = useMe();
  const { jwt: authToken } = useJwt();
  const router = useRouter();

  const {
    createCoherence,
    isCreatingCoherence,
    createdCoherence,
    errorCreateCoherenceMutation,
    resetCreateCoherenceMutation,
    updateCoherenceBySlug,
    updateCoherenceSignalBySlug,
    isUpdatingCoherenceSignal,
    deleteCoherenceBySlug,
    isDeletingCoherence,
  } = useCoherenceMutationsWeb2Rsc(authToken);
  const {
    isMatrixAvailable,
    createRoom,
    sendMessage: sendMatrixMessage,
  } = useMatrix();

  const isMutating =
    isCreatingCoherence || isUpdatingCoherenceSignal || isDeletingCoherence;
  const progress = React.useMemo(() => {
    if (isDeletingCoherence) return 50;
    if (mode === 'edit') return isUpdatingCoherenceSignal ? 50 : 0;
    return isCreatingCoherence ? 50 : createdCoherence ? 100 : 0;
  }, [
    createdCoherence,
    isCreatingCoherence,
    isDeletingCoherence,
    isUpdatingCoherenceSignal,
    mode,
  ]);

  const formDefaults = React.useMemo<FormValues>(
    () => ({
      title: initialValues?.title ?? '',
      description: initialValues?.description ?? '',
      creatorId: initialValues?.creatorId ?? person?.id ?? 0,
      spaceId: initialValues?.spaceId ?? spaceId,
      archived: initialValues?.archived ?? false,
      type:
        initialValues?.type &&
        (COHERENCE_SIGNAL_TYPES as readonly string[]).includes(
          initialValues.type,
        )
          ? initialValues.type
          : 'Opportunity',
      priority: initialValues?.priority ?? 'medium',
      tags: Array.isArray(initialValues?.tags)
        ? (initialValues.tags.filter(
            (tag): tag is CoherenceTag =>
              typeof tag === 'string' && tag.trim().length > 0,
          ) as CoherenceTag[])
        : [],
    }),
    [initialValues, person?.id, spaceId],
  );

  const formRef = React.useRef<HTMLFormElement>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(schemaCreateCoherenceForm),
    defaultValues: formDefaults,
  });

  React.useEffect(() => {
    if (mode !== 'edit') return;
    form.reset(formDefaults);
  }, [form, formDefaults, mode, signalSlug]);

  useScrollToErrors(form, formRef);

  const typeOptions = React.useMemo(() => {
    return COHERENCE_TYPE_OPTIONS.filter((option) =>
      (COHERENCE_SIGNAL_TYPES as readonly string[]).includes(option.type),
    ).map(({ icon, type }) => ({
      icon: icon as LucideReactIcon,
      title: t(`types.${type}` as never),
      description: t(`typeDescriptions.${type}` as never),
      type,
      colorVariant: 'subtle' as CardButtonColorVariant,
      titleColor: 'var(--foreground)',
    }));
  }, [t]);

  const priorityOptions = React.useMemo(() => {
    return COHERENCE_PRIORITY_OPTIONS.map(
      ({ priority, icon, colorVariant }) => ({
        icon: icon as LucideReactIcon,
        title: t.has(`priorities.${priority}` as never)
          ? t(`priorities.${priority}` as never)
          : priority,
        priority,
        description: t.has(`priorityDescriptions.${priority}` as never)
          ? t(`priorityDescriptions.${priority}` as never)
          : '',
        colorVariant: 'subtle' as CardButtonColorVariant,
        iconColorVariant: colorVariant as CardButtonColorVariant,
      }),
    );
  }, [t]);

  const tagOptions = React.useMemo(() => {
    type TagOptionRow = {
      value: string;
      label: string;
      kind: 'option' | 'heading' | 'separator';
    };

    const labelFor = (tag: string) =>
      t.has(`tagLabels.${tag}` as never) ? t(`tagLabels.${tag}` as never) : tag;

    const tagsByCategory: Array<{ title: string; tags: readonly string[] }> = [
      {
        title: 'Purpose & Direction',
        tags: [
          'Purpose',
          'North Star',
          'Vision',
          'Strategy',
          'Values',
          'Principles',
          'Milestones',
          'Impact Goals',
        ],
      },
      {
        title: 'Broader Context',
        tags: [
          'Trend',
          'Social Conditions',
          'Planetary Boundaries',
          'Policy',
          'Regulation',
          'Emergency Response',
        ],
      },
      {
        title: 'People & Roles',
        tags: [
          'Project',
          'Quest',
          'Job',
          'Skill',
          'Advisory Support',
          'Volunteering',
        ],
      },
      {
        title: 'Ecosystem Mapping',
        tags: [
          'Serving Audience',
          'Customers',
          'Users',
          'Communities',
          'Beneficiaries',
          'Partners',
        ],
      },
      {
        title: 'Operating Coherence',
        tags: [
          'Governance',
          'Processes',
          'Structure',
          'Rhythms',
          'Support Systems',
        ],
      },
      {
        title: 'Needs & Resources',
        tags: ['Needs', 'Resources', 'Fundraising', 'Matchmaking'],
      },
      {
        title: 'Value & Model',
        tags: [
          'Innovation',
          'Products',
          'Services',
          'Product-Market Fit',
          'Business Model',
          'Data',
          'Knowledge',
          'Intellectual Property',
        ],
      },
      {
        title: 'Evidence & Impact',
        tags: [
          'Proof of Action',
          'Proof of Impact',
          'Learning',
          'Feedback Loop',
        ],
      },
    ];

    const canonicalTags = new Set(COHERENCE_TAGS as readonly string[]);
    const grouped = tagsByCategory.flatMap((category, categoryIndex) => {
      const rows: TagOptionRow[] = [
        {
          value: `__heading__${categoryIndex}`,
          label: category.title,
          kind: 'heading' as const,
        },
        ...category.tags
          .filter((tag) => canonicalTags.has(tag))
          .map((tag) => ({
            value: tag,
            label: labelFor(tag),
            kind: 'option' as const,
          })),
      ];
      if (categoryIndex < tagsByCategory.length - 1) {
        rows.push({
          value: `__separator__${categoryIndex}`,
          label: '',
          kind: 'separator' as const,
        });
      }
      return rows;
    });

    return grouped;
  }, [t]);

  React.useEffect(() => {
    const { isDirty } = form.getFieldState('creatorId');
    if (!isDirty && person?.id) {
      form.setValue('creatorId', person.id, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: true,
      });
    }
  }, [person, form]);

  React.useEffect(() => {
    const { isDirty } = form.getFieldState('spaceId');
    if (!isDirty && spaceId) {
      form.setValue('spaceId', spaceId, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: true,
      });
    }
  }, [spaceId, form]);

  const handleResetForm = React.useCallback(() => {
    form.reset(formDefaults);
  }, [form, formDefaults]);

  const setSignalProvisioningNotice = React.useCallback(
    (message?: string | null, details?: string) => {
      if (typeof window === 'undefined') return;
      if (!message?.trim()) {
        sessionStorage.removeItem(SIGNAL_PROVISIONING_NOTICE_STORAGE_KEY);
        window.dispatchEvent(new Event(SIGNAL_PROVISIONING_NOTICE_EVENT));
        return;
      }
      const lines = details ? [message, details] : [message];
      sessionStorage.setItem(
        SIGNAL_PROVISIONING_NOTICE_STORAGE_KEY,
        JSON.stringify(lines),
      );
      window.dispatchEvent(new Event(SIGNAL_PROVISIONING_NOTICE_EVENT));
    },
    [],
  );

  const handleSubmitSignal = React.useCallback(
    async (data: FormValues) => {
      form.clearErrors('root');
      if (mode === 'edit') {
        if (!signalSlug) {
          form.setError('root', {
            type: 'manual',
            message: t.has('editSignalMissingSlug')
              ? t('editSignalMissingSlug')
              : 'Signal identifier is missing. Please close and reopen the edit form.',
          });
          return;
        }
        try {
          await updateCoherenceSignalBySlug({
            slug: signalSlug,
            title: data.title,
            description: data.description,
            type: data.type,
            priority: data.priority,
            tags: data.tags,
          });
          router.push(successfulUrl);
        } catch (error) {
          const message =
            error instanceof Error && error.message.trim().length > 0
              ? error.message
              : t.has('editSignalSaveFailed')
              ? t('editSignalSaveFailed')
              : 'Could not save signal changes. Please try again.';
          form.setError('root', {
            type: 'manual',
            message,
          });
        }
        return;
      }
      try {
        const coherence = await createCoherence({ ...data });
        setSignalProvisioningNotice(null);
        const coherenceSlug = coherence.slug;
        if (!isMatrixAvailable) {
          setSignalProvisioningNotice(t('provisioning.chatUnavailable'));
          console.warn('Matrix client is unavailable — skipping room creation');
        } else if (coherenceSlug) {
          // Do not block successful form close/navigation on Matrix latency/failures.
          void (async () => {
            let roomId: string;
            try {
              const roomCreationResult = await createRoom(coherence.title);
              roomId = roomCreationResult.roomId;
            } catch (matrixError) {
              const matrixErrorMessage =
                matrixError instanceof Error
                  ? matrixError.message
                  : String(matrixError);
              setSignalProvisioningNotice(
                t('provisioning.roomProvisionFailed'),
                matrixErrorMessage,
              );
              console.warn(
                'Signal created but Matrix room provisioning failed:',
                matrixError,
              );
              return;
            }

            try {
              await updateCoherenceBySlug({ slug: coherenceSlug, roomId });
              const initialDescription = data.description?.trim();
              if (initialDescription) {
                try {
                  await sendMatrixMessage({
                    roomId,
                    message: initialDescription,
                  });
                } catch (initialMessageError) {
                  console.warn(
                    'Signal created and room linked but initial description message failed:',
                    initialMessageError,
                  );
                }
              }
            } catch (linkError) {
              const linkErrorMessage =
                linkError instanceof Error
                  ? linkError.message
                  : String(linkError);
              setSignalProvisioningNotice(
                t('provisioning.roomLinkFailedRetry'),
                linkErrorMessage,
              );
              console.warn(
                'Signal created and room provisioned but room linking failed:',
                linkError,
              );
            }
          })();
        } else {
          setSignalProvisioningNotice(t('provisioning.roomLinkFailedRetry'));
          console.warn(
            'Signal created but coherence slug is missing — room linking skipped.',
          );
        }
        router.push(successfulUrl);
      } catch (error) {
        console.warn('Could not create conversation:', error);
      }
    },
    [
      createCoherence,
      createRoom,
      updateCoherenceBySlug,
      updateCoherenceSignalBySlug,
      isMatrixAvailable,
      sendMatrixMessage,
      mode,
      setSignalProvisioningNotice,
      signalSlug,
      t,
      router,
      successfulUrl,
    ],
  );

  const handleInvalid = async (err?: Record<string, unknown>) => {
    console.warn('form errors:', err);
  };

  const resolvedBackLabel = backUrl != null ? t('backToCoherence') : undefined;
  const isDirty = form.formState.isDirty;

  return (
    <SpaceLoadingBackdrop
      showKeepWindowOpenMessage={true}
      progress={progress}
      isLoading={isMutating}
      fullHeight={true}
      keepWindowOpenMessage={
        isDeletingCoherence
          ? t.has('keepWindowOpenWhileDeleting')
            ? t('keepWindowOpenWhileDeleting')
            : 'Please keep this window open while deleting the signal.'
          : t('keepWindowOpenWhileCreating')
      }
      message={
        errorCreateCoherenceMutation ? (
          <div className="flex flex-col">
            <div>{t('errorOhSnap')}</div>
            <Button onClick={resetCreateCoherenceMutation}>{t('reset')}</Button>
          </div>
        ) : (
          <div>
            {isDeletingCoherence
              ? t.has('deletingSignal')
                ? t('deletingSignal')
                : 'Deleting signal'
              : mode === 'edit'
              ? t.has('savingSignal')
                ? t('savingSignal')
                : 'Saving signal'
              : t('creatingNewSignal')}
          </div>
        )
      }
    >
      <Form {...form}>
        <form
          ref={formRef}
          onSubmit={form.handleSubmit(handleSubmitSignal, handleInvalid)}
          className="flex flex-col gap-0"
        >
          <div className="sticky top-0 z-[5] -mx-4 mb-4 border-b border-border/90 bg-background-2/95 backdrop-blur-md supports-[backdrop-filter]:bg-background-2/80 lg:-mx-7">
            {/* Match {@link CreateAgreementBaseFields} proposal modal toolbar */}
            <div className="flex min-h-11 shrink-0 items-center gap-2 border-b border-border/80 px-4 lg:px-7">
              <h2 className="min-w-0 flex-1 truncate text-base font-semibold leading-tight tracking-tight text-foreground">
                {t('signals')}
              </h2>
              <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1">
                {backUrl ? (
                  <ButtonBack
                    label={resolvedBackLabel}
                    backUrl={backUrl}
                    className="px-0 md:px-3 align-top"
                  />
                ) : null}
                {isDirty ? (
                  <Button
                    type="button"
                    variant="ghost"
                    colorVariant="neutral"
                    className="gap-1.5 px-2 md:px-3"
                    onClick={handleResetForm}
                    disabled={isMutating}
                  >
                    <RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>{t('reset')}</span>
                  </Button>
                ) : null}
                <ButtonClose
                  closeUrl={closeUrl}
                  className="px-0 md:px-3 align-top"
                />
              </div>
            </div>

            {/* Avatar + title — match {@link CreateAgreementBaseFields} proposal title row */}
            <div className="flex flex-grow gap-3 px-4 pb-4 pt-5 lg:px-7">
              <PersonAvatar
                size="lg"
                isLoading={isMutating}
                avatarSrc={person?.avatarUrl || ''}
                userName={[person?.name, person?.surname]
                  .filter(Boolean)
                  .join(' ')}
              />
              <div className="flex w-full min-w-0 flex-col gap-1.5 sm:gap-2">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          rootClassName="!h-auto min-h-10 w-full sm:min-h-11"
                          placeholder={t('signalTitle')}
                          className="!h-auto min-h-10 w-full border-0 bg-inherit p-0 py-1 text-lg font-semibold leading-snug tracking-tight text-foreground placeholder:!text-base placeholder:font-medium placeholder:leading-snug placeholder:text-muted-foreground/80 sm:min-h-11 sm:text-xl sm:placeholder:!text-lg"
                          disabled={isMutating}
                          rightIcon={
                            <RequirementMark className="h-4 w-4 text-muted-foreground sm:h-4 sm:w-4" />
                          }
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Text className="text-1 text-neutral-11">
                  {person?.name} {person?.surname}
                </Text>
              </div>
            </div>

            <Separator className="bg-border" />
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-6 px-0 pt-5">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <div className="flex w-full flex-col gap-3">
                    <FormLabel className="text-foreground">
                      {t('type')} <RequirementMark />
                    </FormLabel>
                    <FormControl>
                      <span className="grid w-full grid-cols-2 gap-2">
                        {typeOptions.map((option) => (
                          <CoherenceTypeButton
                            key={`type-option-${option.type}`}
                            icon={option.icon}
                            title={option.title}
                            description={option.description}
                            colorVariant={option.colorVariant}
                            selected={field.value === option.type}
                            onClick={() => {
                              form.setValue(
                                'type',
                                option.type as FormValues['type'],
                                {
                                  shouldDirty: true,
                                },
                              );
                            }}
                          />
                        ))}
                      </span>
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <div className="flex w-full flex-col gap-3">
                    <FormLabel className="text-foreground">
                      {t('priority')} <RequirementMark />
                    </FormLabel>
                    <FormControl>
                      <span className="flex w-full flex-row gap-2">
                        {priorityOptions.map((option) => (
                          <CoherencePriorityButton
                            key={`priority-option-${option.priority}`}
                            className="w-full"
                            icon={option.icon}
                            title={option.title}
                            description={option.description}
                            colorVariant={option.colorVariant}
                            iconColorVariant={option.iconColorVariant}
                            selected={field.value === option.priority}
                            onClick={() => {
                              form.setValue('priority', option.priority, {
                                shouldDirty: true,
                              });
                            }}
                          />
                        ))}
                      </span>
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => {
                const descriptionValue = field.value || '';
                return (
                  <FormItem>
                    <FormLabel className="gap-1 text-foreground">
                      {t('description')} <RequirementMark />
                    </FormLabel>
                    <FormControl>
                      <div className="overflow-hidden rounded-lg border border-border/80 bg-background-2 shadow-inner focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background-2">
                        <RichTextEditor
                          editorRef={null}
                          markdown={descriptionValue}
                          translation={translateEditor}
                          placeholder={t('descriptionPlaceholder')}
                          onChange={(markdown) => field.onChange(markdown)}
                        />
                      </div>
                    </FormControl>
                    <FormDescription />
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">{t('tags')}</FormLabel>
                  <FormControl>
                    <MultiSelect
                      placeholder={t('selectOneOrMore')}
                      searchPlaceholder={
                        t.has('searchOrCreateTag')
                          ? t('searchOrCreateTag')
                          : 'Type to search or create a tag'
                      }
                      options={tagOptions}
                      value={field.value}
                      allowToggleAll={false}
                      allowCreate={true}
                      uiStyle="tag-picker"
                      onValueChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex w-full justify-end gap-2">
              {form.formState.errors.root?.message ? (
                <p
                  role="alert"
                  className="mr-auto max-w-[28rem] self-center text-sm text-destructive"
                >
                  {form.formState.errors.root.message}
                </p>
              ) : null}
              {mode === 'edit' && signalSlug ? (
                <ConfirmDialog
                  title={
                    t.has('deleteSignal') ? t('deleteSignal') : 'Delete signal'
                  }
                  description={
                    t.has('deleteSignalConfirm')
                      ? t('deleteSignalConfirm')
                      : 'This permanently removes this signal from the space. Continue?'
                  }
                  customAcceptButtonText={
                    t.has('deleteSignalAction')
                      ? t('deleteSignalAction')
                      : 'Delete signal'
                  }
                  customRejectButtonText={t('noLeave')}
                  onAcceptClicked={async () => {
                    form.clearErrors('root');
                    try {
                      await deleteCoherenceBySlug({ slug: signalSlug });
                      router.push(successfulUrl);
                    } catch (error) {
                      const message =
                        error instanceof Error &&
                        error.message.trim().length > 0
                          ? error.message
                          : t.has('deleteFailed')
                          ? t('deleteFailed')
                          : 'Could not delete signal. Please try again.';
                      form.setError('root', {
                        type: 'manual',
                        message,
                      });
                    }
                  }}
                >
                  <Button
                    type="button"
                    variant="outline"
                    colorVariant="neutral"
                    disabled={isDeletingCoherence || isMutating}
                  >
                    {t.has('deleteAction') ? t('deleteAction') : 'Delete'}
                  </Button>
                </ConfirmDialog>
              ) : null}
              <Button type="submit" disabled={isMutating}>
                {mode === 'edit'
                  ? t.has('saveChanges')
                    ? t('saveChanges')
                    : 'Save changes'
                  : tAgreementFlow('buttons.publish')}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </SpaceLoadingBackdrop>
  );
};
