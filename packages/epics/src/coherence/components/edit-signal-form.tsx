'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  LoadingBackdrop,
  LucideReactIcon,
  MultiSelect,
  RequirementMark,
  RichTextEditor,
  Separator,
} from '@hypha-platform/ui';
import { Text } from '@radix-ui/themes';
import { RefreshCw } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  COHERENCE_PRIORITY_OPTIONS,
  COHERENCE_TAGS,
  COHERENCE_TYPE_OPTIONS,
  Coherence,
  CoherenceType,
  schemaCreateCoherenceForm,
  useCoherenceMutationsWeb2Rsc,
  useJwt,
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

const schemaEdit = schemaCreateCoherenceForm
  .omit({
    creatorId: true,
    spaceId: true,
    archived: true,
  })
  .extend({
    slug: z.string().min(1),
  });

type FormValues = z.infer<typeof schemaEdit>;

type EditSignalFormProps = {
  coherence: Coherence;
  successfulUrl: string;
  closeUrl?: string;
  backUrl?: string;
};

export const EditSignalForm = ({
  coherence,
  successfulUrl,
  closeUrl,
  backUrl,
}: EditSignalFormProps) => {
  const t = useTranslations('CoherenceTab');
  const tAgreementFlow = useTranslations('AgreementFlow');
  const tSpaces = useTranslations('Spaces');
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
    updateCoherenceBySlug,
    isUpdatingCoherence,
    errorUpdateCoherenceBySlugMutation,
    resetUpdateCoherenceBySlugMutation,
  } = useCoherenceMutationsWeb2Rsc(authToken);

  const progress = React.useMemo(() => {
    return isUpdatingCoherence ? 50 : 0;
  }, [isUpdatingCoherence]);

  const formRef = React.useRef<HTMLFormElement>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(schemaEdit),
    defaultValues: {
      slug: coherence.slug ?? '',
      title: coherence.title,
      description: coherence.description,
      type: coherence.type,
      priority: coherence.priority,
      tags: coherence.tags ?? [],
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
    return COHERENCE_PRIORITY_OPTIONS.map(({ priority }) => ({
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

  const handleResetForm = React.useCallback(() => {
    form.reset({
      slug: coherence.slug ?? '',
      title: coherence.title,
      description: coherence.description,
      type: coherence.type,
      priority: coherence.priority,
      tags: coherence.tags ?? [],
    });
  }, [form, coherence]);

  const handleSave = React.useCallback(
    async (data: FormValues) => {
      try {
        await updateCoherenceBySlug({
          slug: data.slug,
          title: data.title,
          description: data.description,
          type: data.type,
          priority: data.priority,
          tags: data.tags,
        });
        router.push(successfulUrl);
      } catch (error) {
        console.warn('Could not update signal:', error);
      }
    },
    [updateCoherenceBySlug, router, successfulUrl],
  );

  const handleInvalid = async (err?: Record<string, unknown>) => {
    console.warn('form errors:', err);
  };

  const resolvedBackLabel = backUrl != null ? t('backToCoherence') : undefined;
  const isDirty = form.formState.isDirty;

  return (
    <LoadingBackdrop
      showKeepWindowOpenMessage={true}
      progress={progress}
      isLoading={isUpdatingCoherence}
      fullHeight={true}
      keepWindowOpenMessage={t('keepWindowOpenWhileCreating')}
      message={
        errorUpdateCoherenceBySlugMutation ? (
          <div className="flex flex-col">
            <div>{t('errorOhSnap')}</div>
            <Button onClick={resetUpdateCoherenceBySlugMutation}>
              {t('reset')}
            </Button>
          </div>
        ) : (
          <div>{t('savingSignal')}</div>
        )
      }
    >
      <Form {...form}>
        <form
          ref={formRef}
          onSubmit={form.handleSubmit(handleSave, handleInvalid)}
          className="flex flex-col gap-0"
        >
          <input type="hidden" {...form.register('slug')} />
          <div className="sticky top-0 z-30 -mx-4 bg-background-2 supports-[backdrop-filter]:bg-background-2/95 supports-[backdrop-filter]:backdrop-blur-sm lg:-mx-7">
            <div className="flex flex-row flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border px-4 pb-4 pt-2 lg:px-7">
              <span className="text-lg font-semibold leading-none text-foreground">
                {t('editSignal')}
              </span>
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
                    disabled={isUpdatingCoherence}
                  >
                    <RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>{tSpaces('reset')}</span>
                  </Button>
                ) : null}
                <ButtonClose
                  closeUrl={closeUrl}
                  className="px-0 md:px-3 align-top"
                />
              </div>
            </div>

            <div className="flex flex-row items-start gap-3 px-4 pb-4 pt-5 lg:px-7">
              <PersonAvatar
                size="lg"
                isLoading={isUpdatingCoherence}
                avatarSrc={person?.avatarUrl || ''}
                userName=""
              />
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          placeholder={t('signalTitle')}
                          className="min-h-10 bg-background py-2.5 text-sm text-foreground shadow-sm placeholder:text-muted-foreground"
                          disabled={isUpdatingCoherence}
                          rightIcon={<RequirementMark className="text-4" />}
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

          <div className="flex min-h-0 flex-1 flex-col gap-5 px-0 pt-5">
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
                        {typeOptions.map((option, index) => (
                          <CoherenceTypeButton
                            key={`type-option-${index}`}
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
                        {priorityOptions.map((option, index) => (
                          <CoherencePriorityButton
                            key={`priority-option-${index}`}
                            className="w-full"
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
                  <FormMessage />
                </FormItem>
              )}
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
                      options={tagOptions}
                      value={field.value}
                      allowToggleAll={false}
                      onValueChange={field.onChange}
                    />
                  </FormControl>
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
                    <FormLabel className="text-foreground gap-1">
                      {t('description')} <RequirementMark />
                    </FormLabel>
                    <FormControl>
                      <RichTextEditor
                        editorRef={null}
                        markdown={descriptionValue}
                        translation={translateEditor}
                        placeholder={t('descriptionPlaceholder')}
                        onChange={(markdown) => field.onChange(markdown)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <div className="flex w-full justify-end">
              <Button type="submit" disabled={isUpdatingCoherence}>
                {t('saveChanges')}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </LoadingBackdrop>
  );
};
