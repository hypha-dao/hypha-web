'use client';

import { useFormContext } from 'react-hook-form';
import {
  Button,
  Input,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormMessage,
  UploadLeadImage,
  Separator,
  Badge,
  AddAttachment,
  RichTextEditor,
  FormLabel,
  RequirementMark,
  Image,
} from '@hypha-platform/ui';
import { Text } from '@radix-ui/themes';
import { PersonAvatar } from '../../people/components/person-avatar';
import { z } from 'zod';
import {
  ALLOWED_IMAGE_FILE_SIZE,
  createAgreementFiles,
  schemaCreateAgreement,
  useSpaceBySlug,
  useSpaceMinProposalDuration,
  useSpaceDetailsWeb3Rpc,
  useIsDelegate,
  useJwt,
  NotifyProposalCreatedInput,
  useMe,
  PostNotifyProposalCreatedInput,
} from '@hypha-platform/core/client';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { formatDuration } from '@hypha-platform/ui-utils';

import { useTheme } from 'next-themes';
import { Locale } from '@hypha-platform/i18n';
import { ButtonBack, ButtonClose } from '../../common';
import { useProposalNotifications } from '../../governance/hooks';
import React from 'react';
import { useTranslations } from 'next-intl';
import { RotateCcw } from 'lucide-react';
import {
  RESUBMIT_FORM_DATA_KEY,
  RESUBMIT_PROPOSAL_DATA_KEY,
  getProposalTemplateSegmentFromPathname,
  isLegacyGenericResubmitSegment,
} from '../../utils/resubmit-proposal-template';

/** Session payload for `RESUBMIT_FORM_DATA_KEY` (lead image / attachments bridge). */
export type ResubmitFormData = {
  resubmitTemplateSegment?: string;
  leadImage?: string;
  attachments?: (string | { name: string; url: string })[];
  applied?: boolean;
};

type Creator = { avatar: string; name: string; surname: string };

const schemaCreateAgreementForm =
  schemaCreateAgreement.extend(createAgreementFiles);

export type CreateAgreementFormData = z.infer<typeof schemaCreateAgreementForm>;

type AttachmentListItem = NonNullable<
  CreateAgreementFormData['attachments']
>[number];

export type CreateAgreementFormProps = {
  creator?: Creator;
  isLoading?: boolean;
  successfulUrl: string;
  closeUrl: string;
  backUrl?: string;
  backLabel?: string;
  label?: string;
  /** When set, shown in sticky header instead of `label` (web3 submission still uses `label`). */
  stickyHeaderTitle?: string;
  mode?: 'agreement' | 'memory';
  progress: number;
};

type Callback = () => Promise<void>;
type CallbackList = Array<Callback>;

export function CreateAgreementBaseFields({
  creator,
  isLoading = false,
  successfulUrl,
  closeUrl,
  backUrl,
  backLabel,
  label,
  stickyHeaderTitle,
  mode = 'agreement',
  progress,
}: CreateAgreementFormProps) {
  const tAgreementFlow = useTranslations('AgreementFlow');
  const tCoherence = useTranslations('CoherenceTab');
  const tCommon = useTranslations('Common');
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
  const { lang, id: spaceSlug } = useParams<{ lang: Locale; id: string }>();
  const pathname = usePathname();
  const { jwt: authToken } = useJwt();
  const router = useRouter();

  const form = useFormContext<CreateAgreementFormData>();
  const resolvedBackLabel =
    backLabel ?? tAgreementFlow('createAgreementBaseFields.backToCreate');
  const resolvedLabel =
    label ?? tAgreementFlow('createAgreementBaseFields.agreementLabel');
  const titlePlaceholder =
    mode === 'memory'
      ? tCoherence.has('newMemoryTitlePlaceholder')
        ? tCoherence('newMemoryTitlePlaceholder')
        : tCoherence('newMemory')
      : tAgreementFlow('createAgreementBaseFields.proposalTitlePlaceholder');
  const contentLabel =
    mode === 'memory'
      ? tCoherence.has('newMemoryContentLabel')
        ? tCoherence('newMemoryContentLabel')
        : tCoherence('description')
      : tAgreementFlow('createAgreementBaseFields.proposalContent');
  const contentPlaceholder =
    mode === 'memory'
      ? tCoherence.has('newMemoryContentPlaceholder')
        ? tCoherence('newMemoryContentPlaceholder')
        : tCoherence('descriptionPlaceholder')
      : tAgreementFlow('createAgreementBaseFields.proposalContentPlaceholder');
  const attachmentLabel =
    mode === 'memory'
      ? tCoherence.has('newMemoryAddDocumentLabel')
        ? tCoherence('newMemoryAddDocumentLabel')
        : tAgreementFlow('createAgreementBaseFields.addAttachmentLabel')
      : tAgreementFlow('createAgreementBaseFields.addAttachmentLabel');

  if (!form) {
    return (
      <div>
        {tAgreementFlow('createAgreementBaseFields.formContextMissing')}
      </div>
    );
  }

  const [resubmitFormData, setResubmitFormData] = React.useState<{
    leadImage?: string;
    attachments?: (string | { name: string; url: string })[];
  } | null>(null);
  const [existingAttachments, setExistingAttachments] = React.useState<
    (string | { name: string; url: string })[]
  >([]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const data = sessionStorage.getItem(RESUBMIT_FORM_DATA_KEY);
      if (!data) return;

      const parsed = JSON.parse(data) as ResubmitFormData;

      if (parsed.applied) {
        sessionStorage.removeItem(RESUBMIT_FORM_DATA_KEY);
        return;
      }

      const currentSegment =
        getProposalTemplateSegmentFromPathname(pathname) ?? '';
      const storedSegment = parsed.resubmitTemplateSegment;
      if (storedSegment === undefined) {
        if (!isLegacyGenericResubmitSegment(currentSegment)) {
          return;
        }
      } else if (storedSegment !== currentSegment) {
        return;
      }

      setResubmitFormData(parsed);
      if (parsed.attachments && parsed.attachments.length > 0) {
        setExistingAttachments(parsed.attachments);
      }

      sessionStorage.setItem(
        RESUBMIT_FORM_DATA_KEY,
        JSON.stringify({
          ...parsed,
          resubmitTemplateSegment: storedSegment ?? currentSegment,
          applied: true,
        }),
      );
    } catch (error) {
      console.error('Error reading resubmit form data:', error);
      sessionStorage.removeItem(RESUBMIT_FORM_DATA_KEY);
    }
  }, [pathname]);

  const { space } = useSpaceBySlug(spaceSlug as string);

  /** Pre-fill proposal banner from space hero image once (users can still replace it). */
  const hasAppliedSpaceBannerDefaultRef = React.useRef(false);

  React.useEffect(() => {
    if (resubmitFormData?.leadImage?.trim()) {
      return;
    }

    if (typeof window !== 'undefined') {
      try {
        const raw = sessionStorage.getItem(RESUBMIT_FORM_DATA_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as { leadImage?: string };
          if (parsed?.leadImage?.trim()) {
            return;
          }
        }
      } catch {
        /* ignore */
      }
    }

    const bannerUrl = space?.leadImage?.trim();
    if (!bannerUrl || hasAppliedSpaceBannerDefaultRef.current) {
      return;
    }

    const current = form.getValues('leadImage');
    if (typeof current === 'string' && current.trim().length > 0) {
      return;
    }
    if (current instanceof File) {
      return;
    }

    form.setValue('leadImage', bannerUrl, { shouldValidate: true });
    hasAppliedSpaceBannerDefaultRef.current = true;
  }, [space?.leadImage, resubmitFormData, form]);

  const spaceIdBigInt =
    typeof space?.web3SpaceId === 'number'
      ? BigInt(space.web3SpaceId)
      : undefined;

  const { spaceDetails } = useSpaceDetailsWeb3Rpc({
    spaceId: space?.web3SpaceId as number,
  });

  const { duration } = useSpaceMinProposalDuration({
    spaceId: spaceIdBigInt ?? 0n,
    enabled: !!spaceIdBigInt,
  });

  const durationNumber =
    duration !== undefined && duration !== null ? Number(duration) : NaN;
  const hasVotingDuration = Number.isFinite(durationNumber);

  const quorumPct =
    spaceDetails?.quorum != null ? Number(spaceDetails.quorum) : NaN;
  const unityPct =
    spaceDetails?.unity != null ? Number(spaceDetails.unity) : NaN;
  const votingThresholdSummary =
    Number.isFinite(quorumPct) && Number.isFinite(unityPct)
      ? tAgreementFlow('createAgreementBaseFields.quorumUnityLine', {
          quorumPercent: quorumPct,
          unityPercent: unityPct,
          quorumLabel: tAgreementFlow('createAgreementBaseFields.quorumLabel'),
          unityLabel: tAgreementFlow('createAgreementBaseFields.unityLabel'),
        })
      : null;

  const { theme } = useTheme();

  const { isDelegate } = useIsDelegate({
    spaceId: space?.web3SpaceId as number,
  });

  const { person: me, isLoading: isLoadingMe } = useMe();

  const [delayedCallbacks, setDelayedCallbacks] = React.useState<CallbackList>(
    [],
  );

  React.useEffect(() => {
    if (progress < 100) {
      return;
    }
    if (delayedCallbacks.length === 0) {
      return;
    }
    (async (callbacks) => {
      for (const callback of callbacks) {
        try {
          await callback?.();
        } catch (error) {
          console.warn(error);
        }
      }
    })([...delayedCallbacks]);
    setDelayedCallbacks([]);
  }, [progress, delayedCallbacks, setDelayedCallbacks]);

  const progressRef = React.useRef(progress);
  progressRef.current = progress;

  const postProposalCreated = React.useCallback(
    async ({
      spaceId,
      creator,
      proposalId,
      url,
      sendNotifications,
    }: PostNotifyProposalCreatedInput) => {
      if (isLoadingMe || !me?.address || !space?.web3SpaceId) {
        return;
      }
      if (
        creator !== (me.address as `0x${string}`) ||
        spaceId !== BigInt(space.web3SpaceId)
      ) {
        return;
      }
      if (successfulUrl) {
        const sendNotificationsSafe = async (
          args: NotifyProposalCreatedInput,
        ) => {
          try {
            if (sendNotifications) {
              await sendNotifications(args);
            }
          } catch (error) {
            console.warn(
              'Some issues appeared on send notifications on proposal created:',
              error,
            );
          }
        };
        if (progressRef.current < 100) {
          setDelayedCallbacks((prev) => {
            if (prev.length > 0) {
              // Normally should be called at most once
              return prev;
            }
            return [
              ...prev,
              async () => {
                await sendNotificationsSafe({
                  proposalId,
                  spaceId,
                  creator,
                  url,
                });
                router.push(successfulUrl);
              },
            ];
          });
        } else {
          await sendNotificationsSafe({
            proposalId,
            spaceId,
            creator,
            url,
          });
          router.push(successfulUrl);
        }
      }
    },
    [router, successfulUrl, me, isLoadingMe, space],
  );

  useProposalNotifications({
    lang,
    spaceSlug,
    authToken,
    postProposalCreated,
  });

  const handleResetForm = React.useCallback(() => {
    form.reset();
    setExistingAttachments([]);
    setResubmitFormData(null);
    try {
      sessionStorage.removeItem(RESUBMIT_FORM_DATA_KEY);
      sessionStorage.removeItem(RESUBMIT_PROPOSAL_DATA_KEY);
    } catch {
      /* ignore */
    }
    hasAppliedSpaceBannerDefaultRef.current = false;
  }, [form]);

  return (
    <>
      {/* Sticky header: compact toolbar row (fixed height) like legacy layout, then avatar + badges + title */}
      <div className="sticky top-0 z-[5] -mx-4 mb-4 border-b border-border/90 bg-background-2/95 backdrop-blur-md supports-[backdrop-filter]:bg-background-2/80 lg:-mx-7">
        <div className="flex min-h-11 shrink-0 items-center gap-2 border-b border-border/80 px-4 lg:px-7">
          <h2 className="min-w-0 flex-1 truncate text-base font-semibold leading-tight tracking-tight text-foreground">
            {stickyHeaderTitle ?? resolvedLabel}
          </h2>
          <div className="flex shrink-0 items-center justify-end gap-1">
            {backUrl && (
              <ButtonBack
                label={resolvedBackLabel}
                backUrl={backUrl}
                className="px-0 md:px-3 align-top"
              />
            )}
            {form.formState.isDirty ? (
              <Button
                type="button"
                variant="ghost"
                colorVariant="neutral"
                className="inline-flex items-center gap-1 px-0 text-neutral-10 md:px-3"
                onClick={handleResetForm}
              >
                <RotateCcw className="size-4 shrink-0" aria-hidden />
                {tAgreementFlow('createAgreementBaseFields.resetForm')}
              </Button>
            ) : null}
            <ButtonClose
              closeUrl={closeUrl}
              preferBack={mode === 'memory'}
              className="px-0 md:px-3 align-top"
            />
          </div>
        </div>
        <div className="px-4 pb-3 pt-3 lg:px-7">
          <div className="flex flex-col-reverse md:flex-row justify-between gap-4 md:gap-2">
            <div className="flex flex-grow gap-3">
              <PersonAvatar
                size="lg"
                isLoading={isLoading}
                avatarSrc={creator?.avatar}
                userName={`${creator?.name} ${creator?.surname}`}
              />
              <div className="flex w-full min-w-0">
                <div className="flex flex-col w-full justify-between gap-4">
                  <div className="flex flex-row flex-wrap items-center gap-x-2 gap-y-2">
                    {isDelegate && (
                      <Badge
                        variant="outline"
                        colorVariant="accent"
                        isLoading={isLoading}
                      >
                        {tAgreementFlow('createAgreementBaseFields.delegate')}
                      </Badge>
                    )}
                  </div>
                  <div className="flex justify-between w-full gap-4">
                    <div className="flex flex-col gap-1.5 w-full sm:gap-2">
                      <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                rootClassName="!h-auto min-h-10 w-full sm:min-h-11"
                                placeholder={titlePlaceholder}
                                className="!h-auto min-h-10 w-full border-0 bg-inherit p-0 py-1 text-lg font-semibold leading-snug tracking-tight text-foreground placeholder:!text-base placeholder:font-medium placeholder:leading-snug placeholder:text-muted-foreground/80 sm:min-h-11 sm:text-xl sm:placeholder:!text-lg"
                                disabled={isLoading}
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
                        {creator?.name} {creator?.surname}
                      </Text>
                    </div>
                    {mode !== 'memory' &&
                    hasVotingDuration &&
                    durationNumber === 0 ? (
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
                          {votingThresholdSummary ? (
                            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground text-nowrap tabular-nums">
                              {votingThresholdSummary}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ) : mode !== 'memory' && hasVotingDuration ? (
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
                                duration: formatDuration(durationNumber),
                              },
                            )}
                          </span>
                          {votingThresholdSummary ? (
                            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground text-nowrap tabular-nums">
                              {votingThresholdSummary}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <Separator />
      </div>
      <div className="flex flex-col gap-6">
        {mode !== 'memory' ? (
          <section className="rounded-xl border border-border/70 bg-muted/20 p-4 shadow-sm ring-1 ring-border/40 dark:bg-muted/12 lg:p-6">
            <FormField
              control={form.control}
              name="leadImage"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <UploadLeadImage
                      onChange={field.onChange}
                      maxFileSize={ALLOWED_IMAGE_FILE_SIZE}
                      enableImageResizer={true}
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
                      uploadText={tAgreementFlow.rich(
                        'createAgreementBaseFields.uploadImageLabel',
                        {
                          accent: (chunks) => (
                            <span className="text-accent-11">{chunks}</span>
                          ),
                        },
                      )}
                      defaultImage={
                        typeof field.value === 'string'
                          ? field.value.trim().length > 0
                            ? field.value
                            : null
                          : resubmitFormData?.leadImage?.trim()
                          ? resubmitFormData.leadImage
                          : undefined
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </section>
        ) : null}
        <section className="rounded-xl border border-border/70 bg-muted/15 p-4 shadow-sm ring-1 ring-border/40 dark:bg-muted/10 lg:p-6">
          {mode === 'memory' ? (
            <FormField
              control={form.control}
              name="attachments"
              render={({ field }) => {
                const fieldValue = field.value || [];
                const newFiles = Array.isArray(fieldValue)
                  ? fieldValue.filter((item) => item instanceof File)
                  : [];
                const mergedAttachments: AttachmentListItem[] = [
                  ...existingAttachments,
                  ...newFiles,
                ];

                return (
                  <FormItem className="mb-6">
                    <FormControl>
                      <AddAttachment
                        label={attachmentLabel}
                        onChange={(files) => {
                          field.onChange(files);
                          form.setValue(
                            'attachments',
                            [...existingAttachments, ...files],
                            { shouldValidate: false, shouldDirty: true },
                          );
                        }}
                        onExistingAttachmentsChange={(updated) => {
                          setExistingAttachments(updated);
                          form.setValue(
                            'attachments',
                            [...updated, ...newFiles],
                            { shouldValidate: false, shouldDirty: true },
                          );
                        }}
                        value={
                          mergedAttachments.length > 0
                            ? mergedAttachments
                            : undefined
                        }
                        defaultAttachments={
                          existingAttachments.length > 0
                            ? existingAttachments
                            : undefined
                        }
                      />
                    </FormControl>
                    <FormDescription />
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
          ) : null}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => {
              const descriptionValue = field.value || '';

              return (
                <FormItem>
                  <FormLabel className="gap-1 text-foreground">
                    {contentLabel} <RequirementMark />
                  </FormLabel>
                  <FormControl>
                    <div className="overflow-hidden rounded-lg border border-border/80 bg-background-2 shadow-inner focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background-2">
                      <RichTextEditor
                        editorRef={null}
                        markdown={descriptionValue}
                        translation={translateEditor}
                        placeholder={contentPlaceholder}
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
          {mode !== 'memory' ? (
            <FormField
              control={form.control}
              name="attachments"
              render={({ field }) => {
                const fieldValue = field.value || [];
                const newFiles = Array.isArray(fieldValue)
                  ? fieldValue.filter((item) => item instanceof File)
                  : [];
                const mergedAttachments: AttachmentListItem[] = [
                  ...existingAttachments,
                  ...newFiles,
                ];

                return (
                  <FormItem className="mt-6">
                    <FormControl>
                      <AddAttachment
                        label={attachmentLabel}
                        onChange={(files) => {
                          field.onChange(files);
                          form.setValue(
                            'attachments',
                            [...existingAttachments, ...files],
                            { shouldValidate: false, shouldDirty: true },
                          );
                        }}
                        onExistingAttachmentsChange={(updated) => {
                          setExistingAttachments(updated);
                          form.setValue(
                            'attachments',
                            [...updated, ...newFiles],
                            { shouldValidate: false, shouldDirty: true },
                          );
                        }}
                        value={
                          mergedAttachments.length > 0
                            ? mergedAttachments
                            : undefined
                        }
                        defaultAttachments={
                          existingAttachments.length > 0
                            ? existingAttachments
                            : undefined
                        }
                      />
                    </FormControl>
                    <FormDescription />
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
          ) : null}
        </section>
      </div>
    </>
  );
}
