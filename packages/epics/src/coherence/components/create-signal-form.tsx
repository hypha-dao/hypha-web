'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Image,
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
  COHERENCE_TAGS,
  COHERENCE_TYPE_OPTIONS,
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
}

export const CreateSignalForm = ({
  spaceId,
  successfulUrl,
  closeUrl,
  backUrl,
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
  } = useCoherenceMutationsWeb2Rsc(authToken);
  const { isMatrixAvailable, createRoom } = useMatrix();

  const progress = React.useMemo(() => {
    return isCreatingCoherence ? 50 : createdCoherence ? 100 : 0;
  }, [isCreatingCoherence, createdCoherence]);

  const formRef = React.useRef<HTMLFormElement>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(schemaCreateCoherenceForm),
    defaultValues: {
      title: '',
      description: '',
      creatorId: person?.id,
      spaceId,
      archived: false,
      type: 'Opportunity',
      priority: 'medium',
      tags: [],
    },
  });

  useScrollToErrors(form, formRef);

  const typeOptions = React.useMemo(() => {
    return COHERENCE_TYPE_OPTIONS.map(({ icon, type }) => ({
      icon: icon as LucideReactIcon,
      title: t(
        `types.${type}` as
          | 'types.Opportunity'
          | 'types.Risk'
          | 'types.Tension'
          | 'types.Insight'
          | 'types.Trend'
          | 'types.Proposal',
      ),
      description: t(
        `typeDescriptions.${type}` as
          | 'typeDescriptions.Opportunity'
          | 'typeDescriptions.Risk'
          | 'typeDescriptions.Tension'
          | 'typeDescriptions.Insight'
          | 'typeDescriptions.Trend'
          | 'typeDescriptions.Proposal',
      ),
      type,
      colorVariant: 'subtle' as CardButtonColorVariant,
      titleColor: 'var(--foreground)',
    }));
  }, [t]);

  const priorityOptions = React.useMemo(() => {
    return COHERENCE_PRIORITY_OPTIONS.map(({ priority, icon }) => ({
      icon: icon as LucideReactIcon,
      title: t(
        `priorities.${priority}` as
          | 'priorities.high'
          | 'priorities.medium'
          | 'priorities.low',
      ),
      priority,
      description: t(
        `priorityDescriptions.${priority}` as
          | 'priorityDescriptions.high'
          | 'priorityDescriptions.medium'
          | 'priorityDescriptions.low',
      ),
      colorVariant: 'subtle' as CardButtonColorVariant,
    }));
  }, [t]);

  const tagOptions = React.useMemo(() => {
    return COHERENCE_TAGS.map((tag) => ({
      value: tag,
      label: t(
        `tagLabels.${tag}` as
          | 'tagLabels.Strategy'
          | 'tagLabels.Culture'
          | 'tagLabels.Onboarding'
          | 'tagLabels.Engagement'
          | 'tagLabels.Learning'
          | 'tagLabels.Capacity'
          | 'tagLabels.Network'
          | 'tagLabels.Reputation',
      ),
    }));
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
    form.reset({
      title: '',
      description: '',
      creatorId: person?.id,
      spaceId,
      archived: false,
      type: 'Opportunity',
      priority: 'medium',
      tags: [],
    });
  }, [form, person?.id, spaceId]);

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

  const handleCreate = React.useCallback(
    async (data: FormValues) => {
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
            try {
              const { roomId } = await createRoom(coherence.title);
              await updateCoherenceBySlug({ slug: coherenceSlug, roomId });
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
      isMatrixAvailable,
      setSignalProvisioningNotice,
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
      isLoading={isCreatingCoherence}
      fullHeight={true}
      keepWindowOpenMessage={t('keepWindowOpenWhileCreating')}
      message={
        errorCreateCoherenceMutation ? (
          <div className="flex flex-col">
            <div>{t('errorOhSnap')}</div>
            <Button onClick={resetCreateCoherenceMutation}>{t('reset')}</Button>
          </div>
        ) : (
          <div>{t('creatingNewSignal')}</div>
        )
      }
    >
      <Form {...form}>
        <form
          ref={formRef}
          onSubmit={form.handleSubmit(handleCreate, handleInvalid)}
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
                    disabled={isCreatingCoherence}
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
                isLoading={isCreatingCoherence}
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
                          disabled={isCreatingCoherence}
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
                  <section className="rounded-xl border border-border/70 bg-muted/20 p-4 shadow-sm ring-1 ring-border/40 dark:bg-muted/12 lg:p-6">
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
                                  option.type as CoherenceType,
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
                  </section>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <section className="rounded-xl border border-border/70 bg-muted/20 p-4 shadow-sm ring-1 ring-border/40 dark:bg-muted/12 lg:p-6">
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
                  </section>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <section className="rounded-xl border border-border/70 bg-muted/15 p-4 shadow-sm ring-1 ring-border/40 dark:bg-muted/10 lg:p-6">
                    <FormLabel className="text-foreground">
                      {t('tags')}
                    </FormLabel>
                    <FormControl>
                      <MultiSelect
                        placeholder={t('selectOneOrMore')}
                        options={tagOptions}
                        value={field.value}
                        allowToggleAll={false}
                        onValueChange={field.onChange}
                      />
                    </FormControl>
                  </section>
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
                    <section className="rounded-xl border border-border/70 bg-muted/15 p-4 shadow-sm ring-1 ring-border/40 dark:bg-muted/10 lg:p-6">
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
                    </section>
                  </FormItem>
                );
              }}
            />

            <div className="flex w-full justify-end">
              <Button type="submit" disabled={isCreatingCoherence}>
                {tAgreementFlow('buttons.publish')}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </SpaceLoadingBackdrop>
  );
};
