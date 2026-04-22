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
  Input,
  LucideReactIcon,
  MultiSelect,
  RequirementMark,
  RichTextEditor,
} from '@hypha-platform/ui';
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
import { CoherenceTypeButton } from './coherence-type-button';
import { CoherencePriorityButton } from './coherence-priority-button';
import { ButtonClose } from '../../common/button-close';
import { CardButtonColorVariant } from '../../common/card-button';

type FormValues = z.infer<typeof schemaCreateCoherenceForm>;

interface CreateSignalFormProps {
  spaceId: number;
  successfulUrl: string;
  closeUrl?: string;
}

export const CreateSignalForm = ({
  spaceId,
  successfulUrl,
  closeUrl,
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
    isUpdatingCoherence,
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
    },
  });

  useScrollToErrors(form, formRef);

  const typeOptions = React.useMemo(() => {
    const computeColor = (colorVariant: string) => {
      return `var(--${colorVariant}-10)`;
    };
    return COHERENCE_TYPE_OPTIONS.map(({ icon, type, colorVariant }) => ({
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
      colorVariant: colorVariant as CardButtonColorVariant,
      titleColor: computeColor(colorVariant),
    }));
  }, [t]);

  const priorityOptions = React.useMemo(() => {
    return COHERENCE_PRIORITY_OPTIONS.map(({ priority, colorVariant }) => ({
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
      colorVariant: colorVariant as CardButtonColorVariant,
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

  const handleCreate = React.useCallback(
    async (data: FormValues) => {
      try {
        const coherence = await createCoherence({ ...data });
        if (isMatrixAvailable) {
          const { roomId } = await createRoom(coherence.title);
          await updateCoherenceBySlug({ slug: coherence.slug!, roomId });
        } else {
          console.warn('Matrix client is unavailable — skipping room creation');
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
      router,
      successfulUrl,
    ],
  );

  const handleInvalid = async (err?: Record<string, unknown>) => {
    console.warn('form errors:', err);
  };

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
          className="flex flex-col gap-5"
        >
          <div className="flex w-full">
            <div className="flex flex-col w-full justify-between gap-4">
              <div className="flex flex-row w-full">
                <div className="flex grow"></div>
                <ButtonClose
                  closeUrl={closeUrl}
                  className="px-0 md:px-3 align-top"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-between w-full gap-4">
            <div className="flex flex-col gap-4 w-full">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        placeholder={t('signalTitle')}
                        className="border-0 text-4 p-0 placeholder:text-4 bg-inherit"
                        rightIcon={<RequirementMark className="text-4" />}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <div className="w-full flex flex-col gap-3">
                      <FormLabel className="text-foreground">
                        {t('type')} <RequirementMark />
                      </FormLabel>
                      <FormControl>
                        <span className="w-full grid grid-cols-2 gap-2">
                          {typeOptions &&
                            typeOptions.map((option, index) => {
                              return (
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
                              );
                            })}
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
                    <div className="w-full flex flex-col gap-3">
                      <FormLabel className="text-foreground">
                        {t('priority')} <RequirementMark />
                      </FormLabel>
                      <FormControl>
                        <span className="w-full flex flex-row gap-2">
                          {priorityOptions &&
                            priorityOptions.map((option, index) => {
                              return (
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
                              );
                            })}
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
                      <FormDescription />
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            </div>
          </div>
          <div className="flex justify-end w-full">
            <Button type="submit">{t('publish')}</Button>
          </div>
        </form>
      </Form>
    </SpaceLoadingBackdrop>
  );
};
