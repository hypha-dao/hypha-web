'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  Badge,
  Button,
  Form,
  FormControl,
  FormDescription,
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
} from '@hypha-platform/ui';
import { Text } from '@radix-ui/themes';
import { Image } from '@hypha-platform/ui';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  COHERENCE_PRIORITY_OPTIONS,
  COHERENCE_TAGS,
  COHERENCE_TYPE_OPTIONS,
  CoherenceType,
  schemaCreateCoherenceForm,
  useCoherenceMutationsWeb2Rsc,
  useIsDelegate,
  useJwt,
  useMatrix,
  useMe,
  useSpaceBySlug,
  useSpaceDetailsWeb3Rpc,
  useSpaceMinProposalDuration,
} from '@hypha-platform/core/client';
import React from 'react';
import { useScrollToErrors } from '../../hooks';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { formatDuration } from '@hypha-platform/ui-utils';
import { Locale } from '@hypha-platform/i18n';
import { PersonAvatar } from '../../people/components/person-avatar';
import { CoherenceTypeButton } from './coherence-type-button';
import { CoherencePriorityButton } from './coherence-priority-button';
import { ButtonClose } from '../../common/button-close';
import { ButtonBack } from '../../common/button-back';
import { CardButtonColorVariant } from '../../common/card-button';

type FormValues = z.infer<typeof schemaCreateCoherenceForm>;

interface CreateSignalFormProps {
  spaceId: number;
  successfulUrl: string;
  closeUrl?: string;
  /** Same pattern as proposal create flows (e.g. space-settings-transparency). */
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
  const { id: spaceSlug } = useParams<{ lang: Locale; id: string }>();
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
  const { theme } = useTheme();
  const { space } = useSpaceBySlug(spaceSlug as string);
  const spaceIdBigInt = space?.web3SpaceId ? BigInt(space.web3SpaceId) : null;
  const { spaceDetails } = useSpaceDetailsWeb3Rpc({
    spaceId: space?.web3SpaceId as number,
  });
  const { duration } = useSpaceMinProposalDuration({
    spaceId: spaceIdBigInt as bigint,
  });
  const { isDelegate } = useIsDelegate({
    spaceId: space?.web3SpaceId as number,
  });

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

  const resolvedLabel = tAgreementFlow('labels.newSignal');
  const resolvedBackLabel = backUrl != null ? t('backToCoherence') : undefined;

  return (
    <LoadingBackdrop
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
          {/* Sticky like proposal aside: header stays visible while the modal body scrolls */}
          <div className="sticky top-0 z-30 -mx-4 bg-background-2 px-4 pb-4 pt-0 supports-[backdrop-filter]:bg-background-2/95 supports-[backdrop-filter]:backdrop-blur-sm lg:-mx-7 lg:px-7">
            <div className="flex flex-col-reverse md:flex-row justify-between gap-4 md:gap-2">
              <div className="flex flex-grow gap-3">
                <PersonAvatar
                  size="lg"
                  isLoading={isCreatingCoherence}
                  avatarSrc={person?.avatarUrl || ''}
                  userName={`${person?.name ?? ''} ${person?.surname ?? ''}`}
                />
                <div className="flex w-full">
                  <div className="flex flex-col w-full justify-between gap-4">
                    <div className="flex flex-row w-full">
                      <Badge className="w-fit" colorVariant="accent">
                        {resolvedLabel}
                      </Badge>
                      {isDelegate && (
                        <Badge
                          variant="outline"
                          colorVariant="accent"
                          isLoading={isCreatingCoherence}
                          className="ml-2"
                        >
                          {tAgreementFlow('createAgreementBaseFields.delegate')}
                        </Badge>
                      )}
                      <div className="flex grow"></div>
                      {backUrl ? (
                        <ButtonBack
                          label={resolvedBackLabel}
                          backUrl={backUrl}
                          className="px-0 md:px-3 align-top"
                        />
                      ) : null}
                      <ButtonClose
                        closeUrl={closeUrl}
                        className="px-0 md:px-3 align-top"
                      />
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
                                  disabled={isCreatingCoherence}
                                  rightIcon={
                                    <RequirementMark className="text-4" />
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
                      {Number(duration) === 0 ? (
                        <div className="flex gap-2 h-fit items-center pr-3">
                          <Image
                            className="max-w-[32px] max-h-[32px] min-w-[32px] min-h-[32px]"
                            width={32}
                            height={32}
                            src={
                              theme === 'light'
                                ? '/placeholder/auto-execution-icon-light.svg'
                                : '/placeholder/auto-execution-icon.svg'
                            }
                            alt={tAgreementFlow(
                              'createAgreementBaseFields.proposalMinimumVotingIconAlt',
                            )}
                          />
                          <div className="flex flex-col">
                            <span className="text-3 text-accent-11 text-nowrap font-medium">
                              {tAgreementFlow(
                                'createAgreementBaseFields.autoExecution',
                              )}
                            </span>
                            <span className="text-[9px] text-accent-11 text-nowrap font-medium">
                              {spaceDetails?.quorum}% Quorum |{' '}
                              {spaceDetails?.unity}% Unity
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2 h-fit items-center pr-3">
                          <Image
                            className="max-w-[32px] max-h-[32px] min-w-[32px] min-h-[32px]"
                            width={32}
                            height={32}
                            src={
                              theme === 'light'
                                ? '/placeholder/non-auto-execution-icon-light.svg'
                                : '/placeholder/non-auto-execution-icon.svg'
                            }
                            alt={tAgreementFlow(
                              'createAgreementBaseFields.proposalMinimumVotingIconAlt',
                            )}
                          />
                          <div className="flex flex-col">
                            <span className="text-2 text-accent-11 text-nowrap font-medium">
                              {tAgreementFlow(
                                'createAgreementBaseFields.toVote',
                                {
                                  duration: formatDuration(Number(duration)),
                                },
                              )}
                            </span>
                            <span className="text-[9px] text-accent-11 text-nowrap font-medium">
                              {spaceDetails?.quorum}% Quorum |{' '}
                              {spaceDetails?.unity}% Unity
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-5 pt-5">
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
                  <div className="w-full flex flex-col gap-3">
                    <FormLabel className="text-foreground">
                      {t('priority')} <RequirementMark />
                    </FormLabel>
                    <FormControl>
                      <span className="w-full flex flex-row gap-2">
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
                    <FormDescription />
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <div className="flex justify-end w-full">
              <Button type="submit" disabled={isCreatingCoherence}>
                {tAgreementFlow('buttons.publish')}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </LoadingBackdrop>
  );
};
