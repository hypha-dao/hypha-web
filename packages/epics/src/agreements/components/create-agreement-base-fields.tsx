'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import {
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
import { useParams, useRouter } from 'next/navigation';
import { formatDuration } from '@hypha-platform/ui-utils';

import { useTheme } from 'next-themes';
import { Locale } from '@hypha-platform/i18n';
import { ButtonBack, ButtonClose } from '../../common';
import { useProposalNotifications } from '../../governance/hooks';
import React from 'react';
import { useTranslations } from 'next-intl';

type Creator = { avatar: string; name: string; surname: string };

const schemaCreateAgreementForm =
  schemaCreateAgreement.extend(createAgreementFiles);

export type CreateAgreementFormData = z.infer<typeof schemaCreateAgreementForm>;

export type CreateAgreementFormProps = {
  creator?: Creator;
  isLoading?: boolean;
  successfulUrl: string;
  closeUrl: string;
  backUrl?: string;
  backLabel?: string;
  label?: string;
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
  progress,
}: CreateAgreementFormProps) {
  const tAgreementFlow = useTranslations('AgreementFlow');
  const { lang, id: spaceSlug } = useParams<{ lang: Locale; id: string }>();
  const { jwt: authToken } = useJwt();
  const router = useRouter();

  const form = useFormContext<CreateAgreementFormData>();
  const resolvedBackLabel =
    backLabel ?? tAgreementFlow('createAgreementBaseFields.backToCreate');
  const resolvedLabel =
    label ?? tAgreementFlow('createAgreementBaseFields.agreementLabel');

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
      const data = sessionStorage.getItem('resubmitFormData');
      if (!data) return;

      const parsed = JSON.parse(data) as {
        leadImage?: string;
        attachments?: (string | { name: string; url: string })[];
        applied?: boolean;
        [key: string]: any;
      };

      if (parsed.applied) {
        sessionStorage.removeItem('resubmitFormData');
        return;
      }

      setResubmitFormData(parsed);
      if (parsed.attachments && parsed.attachments.length > 0) {
        setExistingAttachments(parsed.attachments);
      }

      sessionStorage.setItem(
        'resubmitFormData',
        JSON.stringify({
          ...parsed,
          applied: true,
        }),
      );
    } catch (error) {
      console.error('Error reading resubmit form data:', error);
      sessionStorage.removeItem('resubmitFormData');
    }
  }, []);

  const { space } = useSpaceBySlug(spaceSlug as string);

  const spaceIdBigInt = space?.web3SpaceId ? BigInt(space.web3SpaceId) : null;

  const { spaceDetails } = useSpaceDetailsWeb3Rpc({
    spaceId: space?.web3SpaceId as number,
  });

  const { duration } = useSpaceMinProposalDuration({
    spaceId: spaceIdBigInt as bigint,
  });

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

  return (
    <>
      <div className="flex flex-col-reverse md:flex-row justify-between gap-4 md:gap-2">
        <div className="flex flex-grow gap-3">
          <PersonAvatar
            size="lg"
            isLoading={isLoading}
            avatarSrc={creator?.avatar}
            userName={`${creator?.name} ${creator?.surname}`}
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
                    isLoading={isLoading}
                    className="ml-2"
                  >
                    {tAgreementFlow('createAgreementBaseFields.delegate')}
                  </Badge>
                )}
                <div className="flex grow"></div>
                {backUrl && (
                  <ButtonBack
                    label={resolvedBackLabel}
                    backUrl={backUrl}
                    className="px-0 md:px-3 align-top"
                  />
                )}
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
                            placeholder={tAgreementFlow(
                              'createAgreementBaseFields.proposalTitlePlaceholder',
                            )}
                            className="border-0 text-4 p-0 placeholder:text-4 bg-inherit"
                            disabled={isLoading}
                            rightIcon={<RequirementMark className="text-4" />}
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
                        {spaceDetails?.quorum}% Quorum | {spaceDetails?.unity}%
                        Unity
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
                        {tAgreementFlow('createAgreementBaseFields.toVote', {
                          duration: formatDuration(Number(duration)),
                        })}
                      </span>
                      <span className="text-[9px] text-accent-11 text-nowrap font-medium">
                        {spaceDetails?.quorum}% Quorum | {spaceDetails?.unity}%
                        Unity
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <Separator />
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
                defaultImage={
                  resubmitFormData?.leadImage || field.value
                    ? typeof field.value === 'string'
                      ? field.value
                      : resubmitFormData?.leadImage
                    : undefined
                }
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
                {tAgreementFlow('createAgreementBaseFields.proposalContent')}{' '}
                <RequirementMark />
              </FormLabel>
              <FormControl>
                <RichTextEditor
                  editorRef={null}
                  markdown={descriptionValue}
                  placeholder={tAgreementFlow(
                    'createAgreementBaseFields.proposalContentPlaceholder',
                  )}
                  onChange={(markdown) => field.onChange(markdown)}
                />
              </FormControl>
              <FormDescription />
              <FormMessage />
            </FormItem>
          );
        }}
      />
      <FormField
        control={form.control}
        name="attachments"
        render={({ field }) => {
          const fieldValue = field.value || [];
          const newFiles = Array.isArray(fieldValue)
            ? fieldValue.filter((item) => item instanceof File)
            : [];
          const allAttachments = [...existingAttachments, ...newFiles];

          return (
            <FormItem>
              <FormControl>
                <AddAttachment
                  onChange={(files) => {
                    field.onChange(files);
                    form.setValue(
                      'attachments',
                      [...existingAttachments, ...files] as any,
                      { shouldValidate: false },
                    );
                  }}
                  onExistingAttachmentsChange={(updated) => {
                    setExistingAttachments(updated);
                    form.setValue(
                      'attachments',
                      [...updated, ...newFiles] as any,
                      { shouldValidate: false },
                    );
                  }}
                  value={allAttachments.length > 0 ? allAttachments : undefined}
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
    </>
  );
}
