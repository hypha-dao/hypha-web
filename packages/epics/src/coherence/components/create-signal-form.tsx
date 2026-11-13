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
  Label,
  LucideReactIcon,
  RequirementMark,
  RichTextEditor,
  Separator,
  Slider,
  AddAttachment,
} from '@hypha-platform/ui';
import { Text } from '@radix-ui/themes';
import { RefreshCw, Video } from 'lucide-react';
import { cn } from '@hypha-platform/ui-utils';
import { SpaceLoadingBackdrop } from '../../spaces/components/space-loading-backdrop';
import { useForm, useFormState, useWatch } from 'react-hook-form';
import type { Control } from 'react-hook-form';
import { z } from 'zod';
import {
  HYPHA_ROOM_TYPES,
  COHERENCE_SIGNAL_TYPES,
  COHERENCE_TYPE_OPTIONS,
  CoherenceTag,
  CoherenceType,
  DEFAULT_SIGNAL_PROGRESS_STATUS,
  resolveDefaultBoard,
  schemaCreateCoherenceForm,
  schemaEditCoherenceForm,
  signalFormSchemaForMode,
  type SignalFormValues,
  resolveSignalFormCreatorId,
  parseCapitalKeys,
  mergeTagInList,
  normalizeTagKey,
  personProfileHref,
  wouldCreateNearDuplicate,
  useAttachmentUpload,
  revalidateCoherences,
  useCoherenceMutationsWeb2Rsc,
  useCoherenceUpvoteMutations,
  useJwt,
  useMatrix,
  useMe,
  usePersonById,
  useMySignalVotingPower,
  useSignalWorkflow,
  useSpaceBySlug,
} from '@hypha-platform/core/client';
import React from 'react';
import {
  asMediaItems,
  mergeMedia,
  SIGNAL_DOCUMENT_ACCEPT,
  SIGNAL_DOCUMENT_LIMIT,
  SIGNAL_IMAGE_ACCEPT,
  SIGNAL_IMAGE_LIMIT,
  SIGNAL_MEDIA_MAX_BYTES,
  splitSignalMedia,
  takeSignalCreateMedia,
  uploadSignalFiles,
  type SignalMediaDraft,
  type SignalMediaItem,
} from '../utils/signal-media';
import { useScrollToErrors } from '../../hooks';
import { mutate } from 'swr';
import { useParams, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { PersonAvatar } from '../../people/components/person-avatar';
import { SignalTypePickerGrid, SignalTypeSection } from './signal-type-section';
import { ButtonClose } from '../../common/button-close';
import { ButtonBack } from '../../common/button-back';
import { CardButtonColorVariant } from '../../common/card-button';
import {
  SIGNAL_PROVISIONING_NOTICE_EVENT,
  SIGNAL_PROVISIONING_NOTICE_STORAGE_KEY,
} from '../constants';
import { updateSignalDescriptionCopyInRoom } from '../utils/signal-chat-description';
import {
  signalVotingSpaceId,
  useSignalVotingMode,
} from '../hooks/use-signal-voting-mode';
import {
  signalVideoLinkHost,
  signalVideoLinkProblem,
} from '../utils/signal-video';
import { formatVotingPowerCompact } from '../utils/format-voting-power';
import type { UseMembers } from '../../spaces/hooks/types';
import { SignalTagMergeDialog } from './signal-tag-merge-dialog';
import { SignalImagePicker } from './signal-image-picker';
import { SignalTagPeopleField } from './signal-tag-people-field';
import { LegacySignalFieldsDisclosure } from './legacy-signal-fields/legacy-signal-fields-form';
import { SIGNAL_BOARD_META_TEXT_CLASS } from '../utils/signal-tag-badge-styles';
import { EXCHANGE_SIGNAL_CAPITALS_KEY } from '../../network-exchange/exchange-draft-keys';

type FormValues = SignalFormValues;

export interface CreateSignalFormProps {
  spaceId: number;
  successfulUrl: string;
  closeUrl?: string;
  backUrl?: string;
  mode?: 'create' | 'edit';
  signalSlug?: string;
  signalRoomId?: string | null;
  initialValues?: Partial<FormValues>;
  /** Supplies the space roster for the tag-people picker. */
  useMembers: UseMembers;
}

function SignalFormDirtyResetButton({
  control,
  onReset,
  disabled,
  label,
}: {
  control: Control<FormValues>;
  onReset: () => void;
  disabled: boolean;
  label: string;
}) {
  const { isDirty } = useFormState({ control });
  if (!isDirty) return null;
  return (
    <Button
      type="button"
      variant="ghost"
      colorVariant="neutral"
      className="gap-1.5 px-2 md:px-3"
      onClick={onReset}
      disabled={disabled}
    >
      <RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{label}</span>
    </Button>
  );
}

function SignalFormRootError({ control }: { control: Control<FormValues> }) {
  const { errors } = useFormState({ control });
  if (!errors.root?.message) return null;
  return (
    <p role="alert" className="w-full text-left text-sm text-destructive">
      {errors.root.message}
    </p>
  );
}

function resolveMutationErrorMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    const issue = error.issues.find((item) => item.message.trim().length > 0);
    if (issue?.message) return issue.message;
  }
  if (!(error instanceof Error)) return '';
  const message = error.message.trim();
  if (message) return message;
  if (error.cause instanceof Error) {
    return error.cause.message.trim();
  }
  return '';
}

function firstSignalFieldIssue(
  errors: unknown,
  path = '',
): { field: string; message: string } | null {
  if (!errors || typeof errors !== 'object') return null;
  const record = errors as Record<string, unknown>;
  if (typeof record.message === 'string' && record.message.trim().length > 0) {
    return { field: path, message: record.message };
  }
  for (const [key, value] of Object.entries(record)) {
    if (key === 'ref' || key === 'type' || key === 'types') continue;
    const nextPath = path ? `${path}.${key}` : key;
    const found = firstSignalFieldIssue(value, nextPath);
    if (found) return found;
  }
  return null;
}

function scrollSignalField(form: HTMLFormElement | null, fieldPath: string) {
  if (!form || !fieldPath) return;
  const root = fieldPath.split('.')[0] ?? fieldPath;
  const target =
    form.querySelector(`[data-signal-field="${root}"]`) ??
    form.querySelector(`[name="${fieldPath}"]`) ??
    form.querySelector(`[name="${root}"]`);
  if (!(target instanceof HTMLElement)) return;
  const scroller = target.closest('#proposal-overlay-panel');
  if (scroller instanceof HTMLElement) {
    const top =
      target.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top +
      scroller.scrollTop -
      24;
    scroller.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    return;
  }
  target.scrollIntoView({ block: 'center' });
}

const CREATOR_VOTE_PRESETS = [25, 50, 75, 100] as const;

export const CreateSignalForm = ({
  spaceId,
  successfulUrl,
  closeUrl,
  backUrl,
  mode = 'create',
  signalSlug,
  signalRoomId,
  initialValues,
  useMembers,
}: CreateSignalFormProps) => {
  const params = useParams<{ id?: string }>();
  const spaceSlug = typeof params?.id === 'string' ? params.id.trim() : '';
  const t = useTranslations('CoherenceTab');
  const locale = useLocale();
  const { workflow } = useSignalWorkflow(spaceSlug);
  const tAgreementFlow = useTranslations('AgreementFlow');
  const tSignalCard = useTranslations('SignalCard');
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
  const { space } = useSpaceBySlug(spaceSlug);
  const { upload: uploadAttachment } = useAttachmentUpload({
    authorizationToken: authToken ?? undefined,
  });
  const openingMedia = splitSignalMedia(initialValues);
  const [imageFiles, setImageFiles] = React.useState<File[]>([]);
  const [keptImages, setKeptImages] = React.useState<SignalMediaItem[]>(
    openingMedia.images,
  );
  const [documentFiles, setDocumentFiles] = React.useState<File[]>([]);
  const [keptDocuments, setKeptDocuments] = React.useState<SignalMediaItem[]>(
    openingMedia.documents,
  );
  const [showVideo, setShowVideo] = React.useState(() =>
    Boolean(initialValues?.videoUrl?.trim()),
  );

  const createMediaDraft = React.useRef<SignalMediaDraft | null>(null);
  const createMediaLoaded = React.useRef(false);

  React.useEffect(() => {
    if (!createMediaLoaded.current) {
      createMediaLoaded.current = true;
      createMediaDraft.current =
        mode === 'create' ? takeSignalCreateMedia() : null;
    }
    const split = splitSignalMedia(initialValues);
    const draft = createMediaDraft.current;
    setImageFiles([]);
    setDocumentFiles([]);
    setKeptImages(
      mergeMedia(split.images, draft?.images ?? [], SIGNAL_IMAGE_LIMIT),
    );
    setKeptDocuments(
      mergeMedia(
        split.documents,
        draft?.documents ?? [],
        SIGNAL_DOCUMENT_LIMIT,
      ),
    );
  }, [initialValues, mode, signalSlug]);
  const headerCreatorId = resolveSignalFormCreatorId({
    mode,
    storedCreatorId: initialValues?.creatorId,
    viewerId: person?.id,
  });
  const { person: storedCreatorPerson } = usePersonById({
    id: headerCreatorId ?? undefined,
  });
  const headerPerson =
    mode === 'edit' ? storedCreatorPerson ?? undefined : person;
  const isSignalCreator =
    mode === 'edit' &&
    typeof initialValues?.creatorId === 'number' &&
    person?.id === initialValues.creatorId;
  const isEditAuthorized = mode !== 'edit' || isSignalCreator;

  const {
    createCoherence,
    isCreatingCoherence,
    createdCoherence,
    errorCreateCoherenceMutation,
    resetCreateCoherenceMutation,
    updateCoherenceBySlug,
    updateCoherenceSignalBySlug,
    isUpdatingCoherenceSignal,
    mergeCoherenceTags,
  } = useCoherenceMutationsWeb2Rsc(authToken);
  const [mergeTagsOpen, setMergeTagsOpen] = React.useState(false);
  const { upvote: upvoteCoherence } = useCoherenceUpvoteMutations(authToken);
  // Creator's initial upvote share of their proposal voting power (max by default).
  const [creatorVotePercent, setCreatorVotePercent] = React.useState(100);
  const [taggedMatrixUserIds, setTaggedMatrixUserIds] = React.useState<
    string[]
  >([]);
  const {
    votingMode,
    status: votingModeStatus,
    retry: retryVotingMode,
  } = useSignalVotingMode(signalVotingSpaceId(space));
  const { votingPower: myVotingPower } = useMySignalVotingPower({
    spaceSlug: mode === 'create' ? spaceSlug : null,
    authToken,
  });
  const creatorVoteReadout = React.useMemo(() => {
    const percentLabel = `${creatorVotePercent}%`;
    if (!myVotingPower) return percentLabel;
    let max: bigint;
    try {
      max = BigInt(myVotingPower.votingPower);
    } catch {
      return percentLabel;
    }
    if (max <= 0n) return percentLabel;
    const amount = (max * BigInt(creatorVotePercent)) / 100n;
    return t('signalFormVotingPowerReadout', {
      percent: creatorVotePercent,
      amount: formatVotingPowerCompact(
        amount.toString(),
        myVotingPower.tokenDecimals,
        locale,
      ),
      max: formatVotingPowerCompact(
        myVotingPower.votingPower,
        myVotingPower.tokenDecimals,
        locale,
      ),
    });
  }, [creatorVotePercent, locale, myVotingPower, t]);
  // Keeps the overlay up between a successful save and the route change, so the
  // filled-in form never reappears while navigation settles.
  const [isClosingAfterPublish, setIsClosingAfterPublish] =
    React.useState(false);
  const {
    isMatrixAvailable,
    createRoom,
    joinRoom,
    loadRoomHistory,
    sendMessage,
    getRoomMessages,
    editRoomMessage,
    ensureRoomMembers,
  } = useMatrix();

  const updateSignalDescriptionCopy = React.useCallback(
    async ({
      roomId,
      previousDescription,
      description,
    }: {
      roomId: string;
      previousDescription?: string | null;
      description?: string | null;
    }) => {
      if (!isMatrixAvailable || !roomId?.trim()) return;
      await updateSignalDescriptionCopyInRoom({
        roomId,
        previousDescription,
        description,
        matrix: {
          joinRoom,
          loadRoomHistory,
          getRoomMessages,
          editRoomMessage,
        },
      });
    },
    [
      editRoomMessage,
      getRoomMessages,
      isMatrixAvailable,
      joinRoom,
      loadRoomHistory,
    ],
  );

  const [isPublishing, setIsPublishing] = React.useState(false);
  const isMutating =
    isPublishing ||
    isCreatingCoherence ||
    isUpdatingCoherenceSignal ||
    isClosingAfterPublish;
  const progress = React.useMemo(() => {
    if (isClosingAfterPublish) return 100;
    if (mode === 'edit') return isUpdatingCoherenceSignal ? 50 : 0;
    return isCreatingCoherence ? 50 : createdCoherence ? 100 : 0;
  }, [
    createdCoherence,
    isClosingAfterPublish,
    isCreatingCoherence,
    isUpdatingCoherenceSignal,
    mode,
  ]);

  const formDefaults = React.useMemo<FormValues>(
    () => ({
      title: initialValues?.title ?? '',
      description: initialValues?.description ?? '',
      creatorId:
        resolveSignalFormCreatorId({
          mode,
          storedCreatorId: initialValues?.creatorId,
          viewerId: person?.id,
        }) ?? 0,
      spaceId: initialValues?.spaceId ?? spaceId,
      // Preserve the stored flag. The form no longer offers archive, and a
      // save must not clear it.
      archived: initialValues?.archived ?? false,
      type:
        initialValues?.type &&
        (COHERENCE_SIGNAL_TYPES as readonly string[]).includes(
          initialValues.type,
        )
          ? initialValues.type
          : 'Opportunity',
      priority: initialValues?.priority ?? 'medium',
      capitals: parseCapitalKeys(initialValues?.capitals),
      tags: Array.isArray(initialValues?.tags)
        ? (initialValues.tags.filter(
            (tag): tag is CoherenceTag =>
              typeof tag === 'string' && tag.trim().length > 0,
          ) as CoherenceTag[])
        : [],
      dueAt: initialValues?.dueAt ?? null,
      progressStatus:
        initialValues?.progressStatus ?? DEFAULT_SIGNAL_PROGRESS_STATUS,
      board:
        initialValues?.board ??
        (workflow ? resolveDefaultBoard(workflow) : null),
      assigneeIds: initialValues?.assigneeIds ?? [],
      indicativePayouts:
        initialValues?.indicativePayouts &&
        initialValues.indicativePayouts.length > 0
          ? initialValues.indicativePayouts
          : [{ amount: '', token: '' }],
      leadImage: initialValues?.leadImage ?? null,
      videoUrl: initialValues?.videoUrl ?? '',
      attachments: initialValues?.attachments ?? [],
      sharedWithNetwork: initialValues?.sharedWithNetwork ?? false,
    }),
    [initialValues, mode, person?.id, spaceId, workflow],
  );

  const formRef = React.useRef<HTMLFormElement>(null);
  const form = useForm<FormValues>({
    // Keep typed title/description as-is while editing. Zod `.trim()` still
    // applies on submit via the resolver; `raw: true` stops it from writing
    // the trimmed value back into the field on validate.
    resolver: zodResolver(signalFormSchemaForMode(mode), undefined, {
      raw: true,
    }),
    defaultValues: formDefaults,
  });
  React.useEffect(() => {
    if (mode !== 'edit') return;
    form.reset(formDefaults);
  }, [form, formDefaults, mode, signalSlug]);
  React.useEffect(() => {
    if (mode === 'edit' || !person?.id) return;
    const nextCreatorId = resolveSignalFormCreatorId({
      mode: 'create',
      storedCreatorId: form.getValues('creatorId'),
      viewerId: person.id,
    });
    if (
      nextCreatorId == null ||
      form.getValues('creatorId') === nextCreatorId
    ) {
      return;
    }
    form.setValue('creatorId', nextCreatorId);
  }, [form, mode, person?.id]);
  React.useEffect(() => {
    const videoUrl = createMediaDraft.current?.videoUrl?.trim();
    if (mode === 'create' && videoUrl) {
      form.setValue('videoUrl', videoUrl);
    }
  }, [form, mode]);
  const watchedVideoUrl = useWatch({
    control: form.control,
    name: 'videoUrl',
  });
  const videoLinkProblemMessage = React.useCallback(
    (raw: string | null | undefined) => {
      const problem = signalVideoLinkProblem(raw);
      if (problem === 'blocked') {
        return t('signalFormVideoBlocked', { host: signalVideoLinkHost(raw) });
      }
      if (problem === 'too-long') return t('signalFormVideoTooLong');
      return problem === 'unsupported' ? t('signalFormVideoUnsupported') : null;
    },
    [t],
  );
  // Read after mount: `'self'` needs the page origin, which SSR does not have.
  const [videoLinkWarning, setVideoLinkWarning] = React.useState<string | null>(
    null,
  );
  React.useEffect(() => {
    setVideoLinkWarning(
      showVideo ? videoLinkProblemMessage(watchedVideoUrl) : null,
    );
  }, [showVideo, videoLinkProblemMessage, watchedVideoUrl]);
  React.useEffect(() => {
    if (watchedVideoUrl?.trim()) setShowVideo(true);
  }, [watchedVideoUrl]);
  const toggleVideo = React.useCallback(() => {
    if (showVideo) form.setValue('videoUrl', '', { shouldDirty: true });
    setShowVideo((current) => !current);
  }, [form, showVideo]);

  React.useEffect(() => {
    if (mode !== 'create' || typeof window === 'undefined') return;
    const raw = window.sessionStorage.getItem(EXCHANGE_SIGNAL_CAPITALS_KEY);
    if (!raw) return;
    window.sessionStorage.removeItem(EXCHANGE_SIGNAL_CAPITALS_KEY);
    try {
      const keys = parseCapitalKeys(JSON.parse(raw) as unknown);
      if (keys.length > 0) form.setValue('capitals', keys);
    } catch {
      // Ignore malformed draft from a previous session.
    }
  }, [form, mode]);

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

  // `person` can resolve after mount, so the creator default has to be applied
  // once it lands rather than only through `defaultValues`. Never copy the
  // viewer onto creatorId in edit — that reattributes someone else's signal.
  React.useEffect(() => {
    if (mode !== 'create' || !person?.id) return;
    const { isDirty } = form.getFieldState('assigneeIds');
    if (isDirty || form.getValues('assigneeIds')?.length) return;
    form.setValue('assigneeIds', [person.id], {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: true,
    });
  }, [form, mode, person?.id]);

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
    setTaggedMatrixUserIds([]);
  }, [form, formDefaults]);

  const setSignalProvisioningNotice = React.useCallback(
    (message?: string | null, details?: string) => {
      if (typeof window === 'undefined') return;
      if (!message?.trim()) {
        sessionStorage.removeItem(SIGNAL_PROVISIONING_NOTICE_STORAGE_KEY);
        window.dispatchEvent(new Event(SIGNAL_PROVISIONING_NOTICE_EVENT));
        return;
      }
      const previous = JSON.parse(
        sessionStorage.getItem(SIGNAL_PROVISIONING_NOTICE_STORAGE_KEY) ?? '[]',
      );
      const existing = Array.isArray(previous)
        ? previous.filter(
            (line): line is string =>
              typeof line === 'string' && line.trim().length > 0,
          )
        : [];
      const lines = [...existing, message, ...(details ? [details] : [])];
      sessionStorage.setItem(
        SIGNAL_PROVISIONING_NOTICE_STORAGE_KEY,
        JSON.stringify(lines),
      );
      window.dispatchEvent(new Event(SIGNAL_PROVISIONING_NOTICE_EVENT));
    },
    [],
  );

  // Assignee notifications are server-fired (#2470) from `createCoherenceAction` /
  // `updateCoherenceSignalBySlugAction` themselves, right after the assignee list is persisted —
  // no client trigger needed here.

  const resolveSignalMedia = React.useCallback(
    async (videoUrl: string | null) => {
      const fail = () => {
        throw new Error(
          t.has('signalFormUploadFailed')
            ? t('signalFormUploadFailed')
            : 'Could not upload the file. Try again.',
        );
      };
      let images = keptImages;
      let documents = keptDocuments;
      try {
        if (imageFiles.length > 0) {
          images = [
            ...keptImages,
            ...(await uploadSignalFiles(imageFiles, uploadAttachment)),
          ].slice(0, SIGNAL_IMAGE_LIMIT);
        }
        if (documentFiles.length > 0) {
          documents = [
            ...keptDocuments,
            ...(await uploadSignalFiles(documentFiles, uploadAttachment)),
          ].slice(0, SIGNAL_DOCUMENT_LIMIT);
        }
      } catch {
        fail();
      }
      return {
        leadImage: images[0]?.url ?? null,
        videoUrl,
        attachments: [...images, ...documents],
      };
    },
    [documentFiles, imageFiles, keptDocuments, keptImages, t, uploadAttachment],
  );

  const reportPublishFailure = React.useCallback(
    (error: unknown, fallback: string) => {
      const raw = resolveMutationErrorMessage(error);
      const uploadFailed =
        raw === 'upload' || raw.toLowerCase().includes('could not upload');
      const missingSession =
        raw.includes('missing key') ||
        raw.includes('authToken is required') ||
        raw.includes('Could not resolve authenticated user');
      const message = uploadFailed
        ? t.has('signalFormUploadFailed')
          ? t('signalFormUploadFailed')
          : 'Could not upload the file. Try again.'
        : missingSession
        ? t.has('editSignalMissingAuth')
          ? t('editSignalMissingAuth')
          : 'Your session expired. Please sign in again before saving.'
        : raw || fallback;
      form.setError('root', { type: 'manual', message });
    },
    [form, t],
  );

  const handleSubmitSignal = React.useCallback(
    async (data: FormValues) => {
      form.clearErrors('root');
      const videoProblem = videoLinkProblemMessage(data.videoUrl);
      if (videoProblem) {
        form.setError('videoUrl', { type: 'manual', message: videoProblem });
        form.setError('root', { type: 'manual', message: videoProblem });
        scrollSignalField(formRef.current, 'videoUrl');
        return;
      }
      const storedCreatorId =
        typeof data.creatorId === 'number' && data.creatorId > 0
          ? data.creatorId
          : null;
      // Create attributes the signed-in viewer. Edit never substitutes them.
      const creatorId =
        mode === 'create'
          ? storedCreatorId ?? person?.id ?? null
          : storedCreatorId;
      if (mode === 'create' && !creatorId) {
        reportPublishFailure(
          new Error('authToken is required'),
          'Your session expired. Please sign in again before saving.',
        );
        return;
      }
      if (!authToken?.trim()) {
        reportPublishFailure(
          new Error('authToken is required'),
          'Your session expired. Please sign in again before saving.',
        );
        return;
      }
      let parsed: FormValues;
      try {
        parsed = (
          mode === 'edit' ? schemaEditCoherenceForm : schemaCreateCoherenceForm
        ).parse({
          ...data,
          ...(mode === 'create'
            ? { creatorId }
            : { creatorId: storedCreatorId }),
          spaceId: data.spaceId > 0 ? data.spaceId : spaceId,
        }) as FormValues;
      } catch (error) {
        reportPublishFailure(
          error,
          t.has('editSignalSaveFailed')
            ? t('editSignalSaveFailed')
            : 'Could not save signal changes. Please try again.',
        );
        return;
      }
      if (mode === 'edit') {
        if (!authToken?.trim()) {
          form.setError('root', {
            type: 'manual',
            message: t.has('editSignalMissingAuth')
              ? t('editSignalMissingAuth')
              : 'Your session expired. Please sign in again before saving.',
          });
          return;
        }
        if (!signalSlug) {
          form.setError('root', {
            type: 'manual',
            message: t.has('editSignalMissingSlug')
              ? t('editSignalMissingSlug')
              : 'Signal identifier is missing. Please close and reopen the edit form.',
          });
          return;
        }
        if (!isEditAuthorized) {
          form.setError('root', {
            type: 'manual',
            message: t.has('editSignalNoPermission')
              ? t('editSignalNoPermission')
              : 'Only the signal creator can edit this signal.',
          });
          return;
        }
        setIsPublishing(true);
        try {
          const media = await resolveSignalMedia(parsed.videoUrl ?? null);
          const updatedSignal = await updateCoherenceSignalBySlug({
            slug: signalSlug,
            title: parsed.title,
            description: parsed.description,
            type: parsed.type,
            priority: parsed.priority,
            tags: parsed.tags,
            dueAt: parsed.dueAt ?? null,
            progressStatus:
              parsed.progressStatus ?? DEFAULT_SIGNAL_PROGRESS_STATUS,
            board:
              parsed.board ?? (workflow ? resolveDefaultBoard(workflow) : null),
            assigneeIds: parsed.assigneeIds,
            indicativePayouts: data.indicativePayouts,
            capitals: parsed.capitals,
            sharedWithNetwork: data.sharedWithNetwork ?? false,
            ...media,
          });
          // The signal is saved — close now and let the chat sync and the
          // list refresh finish in the background.
          setIsClosingAfterPublish(true);
          router.push(successfulUrl);
          const attributionSlug = signalSlug?.trim() || '';
          if (attributionSlug) {
            void mutate([attributionSlug, 'signal-creator-attribution']);
          }
          if (updatedSignal?.roomId) {
            void updateSignalDescriptionCopy({
              roomId: updatedSignal.roomId,
              previousDescription: initialValues?.description,
              description: parsed.description,
            }).catch((matrixSyncError) => {
              console.warn(
                'Signal saved but failed to sync description to chat room:',
                matrixSyncError,
              );
            });
          }
          if (spaceSlug) {
            void revalidateCoherences(spaceSlug);
          }
        } catch (error) {
          const rawMessage = resolveMutationErrorMessage(error);
          const isSanitizedServerError =
            rawMessage.includes(
              'An error occurred in the Server Components render',
            ) || rawMessage.toLowerCase().includes('digest');
          const isPermissionError =
            rawMessage.includes('can edit this coherence') ||
            rawMessage.includes('Only the signal creator can') ||
            rawMessage.includes('must be a space member') ||
            rawMessage.includes('interact in this space') ||
            rawMessage.includes('Could not verify your identity');
          const isValidationError =
            rawMessage.includes('Invalid signal update') ||
            rawMessage.includes('Unknown progress status') ||
            rawMessage.includes('Unknown board');
          const isAuthError = rawMessage.includes('authToken is required');
          const genericSaveError = t.has('editSignalSaveFailed')
            ? t('editSignalSaveFailed')
            : 'Could not save signal changes. Please try again.';
          const message = isPermissionError
            ? t.has('editSignalNoPermission')
              ? t('editSignalNoPermission')
              : 'Only the signal creator can edit this signal.'
            : isAuthError
            ? t.has('editSignalMissingAuth')
              ? t('editSignalMissingAuth')
              : 'Your session expired. Please sign in again before saving.'
            : isValidationError
            ? rawMessage
            : isSanitizedServerError
            ? genericSaveError
            : rawMessage || genericSaveError;
          form.setError('root', {
            type: 'manual',
            message,
          });
        } finally {
          setIsPublishing(false);
        }
        return;
      }
      setIsPublishing(true);
      try {
        const media = await resolveSignalMedia(parsed.videoUrl ?? null);
        const coherence = await createCoherence({ ...parsed, ...media });
        setSignalProvisioningNotice(null);
        const coherenceSlug = coherence.slug;
        // Close the panel as soon as the signal exists — everything below is
        // best-effort follow-up work that must not hold the form open.
        setIsClosingAfterPublish(true);
        router.push(successfulUrl);
        if (coherenceSlug && votingMode == null) {
          // Without a resolved voting method the chosen share is unknown, so
          // the creator upvotes from the signal page instead of at 100%.
          if (votingModeStatus !== 'unavailable') {
            setSignalProvisioningNotice(t('provisioning.creatorUpvoteFailed'));
          }
          if (spaceSlug) void revalidateCoherences(spaceSlug);
        } else if (coherenceSlug) {
          // The signal already exists, so the creator upvote runs after close:
          // retry once, then tell the creator to upvote from the signal page.
          void (async () => {
            let upvoteError: unknown = null;
            for (let attempt = 0; attempt < 2; attempt += 1) {
              try {
                await upvoteCoherence({
                  slug: coherenceSlug,
                  votingPowerPercent: creatorVotePercent,
                });
                upvoteError = null;
                break;
              } catch (error) {
                upvoteError = error;
                if (attempt === 0) {
                  await new Promise((resolve) => setTimeout(resolve, 1500));
                }
              }
            }
            if (upvoteError) {
              console.warn(
                'Signal created but creator upvote failed:',
                upvoteError,
              );
              setSignalProvisioningNotice(
                t('provisioning.creatorUpvoteFailed'),
                upvoteError instanceof Error ? upvoteError.message : undefined,
              );
            }
            if (spaceSlug) {
              await revalidateCoherences(spaceSlug);
            }
          })();
        } else if (spaceSlug) {
          void revalidateCoherences(spaceSlug);
        }
        if (!isMatrixAvailable) {
          setSignalProvisioningNotice(t('provisioning.chatUnavailable'));
          console.warn('Matrix client is unavailable — skipping room creation');
        } else if (coherenceSlug) {
          // Do not block successful form close/navigation on Matrix latency/failures.
          void (async () => {
            let roomId: string;
            try {
              const roomCreationResult = await createRoom(coherence.title, {
                grantCreatorPl100: true,
                roomType: HYPHA_ROOM_TYPES.signal,
              });
              roomId = roomCreationResult.roomId;
              const canonicalRoomId = await joinRoom(roomId);

              try {
                await updateCoherenceBySlug({
                  slug: coherenceSlug,
                  roomId: canonicalRoomId,
                });
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
              if (taggedMatrixUserIds.length > 0) {
                // Tags are a normal chat @mention, so the existing mention
                // notification and Messages inbox deliver them.
                try {
                  const notJoined = new Set(
                    await ensureRoomMembers(
                      canonicalRoomId,
                      taggedMatrixUserIds,
                    ),
                  );
                  const joined = taggedMatrixUserIds.filter(
                    (id) => !notJoined.has(id),
                  );
                  if (joined.length > 0) {
                    await sendMessage({
                      roomId: canonicalRoomId,
                      message: joined.join(' '),
                      mentionUserIds: joined,
                    });
                  }
                  if (taggedMatrixUserIds.some((id) => notJoined.has(id))) {
                    setSignalProvisioningNotice(
                      t('provisioning.tagPeopleFailed'),
                    );
                  }
                } catch (tagError) {
                  setSignalProvisioningNotice(
                    t('provisioning.tagPeopleFailed'),
                    tagError instanceof Error ? tagError.message : undefined,
                  );
                  console.warn(
                    'Signal created but tagging people failed:',
                    tagError,
                  );
                }
              }
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
          })();
        } else {
          setSignalProvisioningNotice(t('provisioning.roomLinkFailedRetry'));
          console.warn(
            'Signal created but coherence slug is missing — room linking skipped.',
          );
        }
      } catch (error) {
        console.warn('Could not create conversation:', error);
        reportPublishFailure(
          error,
          t.has('editSignalSaveFailed')
            ? t('editSignalSaveFailed')
            : 'Could not save signal changes. Please try again.',
        );
      } finally {
        setIsPublishing(false);
      }
    },
    [
      authToken,
      createCoherence,
      createRoom,
      creatorVotePercent,
      votingMode,
      votingModeStatus,
      ensureRoomMembers,
      sendMessage,
      taggedMatrixUserIds,
      upvoteCoherence,
      isEditAuthorized,
      joinRoom,
      updateCoherenceBySlug,
      updateCoherenceSignalBySlug,
      isMatrixAvailable,
      updateSignalDescriptionCopy,
      initialValues?.description,
      mode,
      setSignalProvisioningNotice,
      signalSlug,
      spaceSlug,
      t,
      router,
      successfulUrl,
      revalidateCoherences,
      resolveSignalMedia,
      person?.id,
      reportPublishFailure,
      spaceId,
      videoLinkProblemMessage,
    ],
  );

  const handleInvalid = (errors?: Record<string, unknown>) => {
    const issue = firstSignalFieldIssue(errors);
    const field = issue?.field.split('.')[0] ?? '';
    const hiddenField =
      field === 'creatorId' || field === 'spaceId' || field === 'archived';
    const fallback = t.has('editSignalSaveFailed')
      ? t('editSignalSaveFailed')
      : 'Could not save signal changes. Please try again.';
    form.setError('root', {
      type: 'manual',
      message: hiddenField ? fallback : issue?.message || fallback,
    });
    if (!hiddenField) scrollSignalField(formRef.current, issue?.field ?? '');
  };

  const resolvedBackLabel = backUrl != null ? t('backToCoherence') : undefined;

  return (
    <SpaceLoadingBackdrop
      showKeepWindowOpenMessage={true}
      progress={progress}
      isLoading={isMutating}
      fullHeight={true}
      keepWindowOpenMessage={t('keepWindowOpenWhileCreating')}
      message={
        errorCreateCoherenceMutation ? (
          <div className="flex flex-col">
            <div>{t('errorOhSnap')}</div>
            <Button onClick={resetCreateCoherenceMutation}>{t('reset')}</Button>
          </div>
        ) : (
          <div>
            {mode === 'edit'
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
          <div className="sticky top-0 z-[5] -mx-4 mb-4 border-b border-border/90 bg-background-2 lg:-mx-7">
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
                <SignalFormDirtyResetButton
                  control={form.control}
                  onReset={handleResetForm}
                  disabled={isMutating}
                  label={t('reset')}
                />
                <ButtonClose
                  closeUrl={closeUrl}
                  className="px-0 md:px-3 align-top"
                />
              </div>
            </div>

            {/* Avatar + title — match {@link CreateAgreementBaseFields} proposal title row */}
            <div className="flex flex-grow items-start gap-3 px-4 pb-4 pt-5 lg:px-7">
              <div className="flex w-20 shrink-0 flex-col items-center gap-1.5">
                <PersonAvatar
                  size="lg"
                  shape="circle"
                  isLoading={isMutating}
                  avatarSrc={headerPerson?.avatarUrl || ''}
                  userName={[headerPerson?.name, headerPerson?.surname]
                    .filter(Boolean)
                    .join(' ')}
                  personId={headerPerson?.id}
                />
                <Text className="line-clamp-2 w-full text-center text-1 leading-tight text-neutral-11">
                  {[headerPerson?.name, headerPerson?.surname]
                    .filter(Boolean)
                    .join(' ')}
                </Text>
              </div>
              <div className="flex w-full min-w-0 flex-col gap-1.5 sm:gap-2">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem data-signal-field="title">
                      <FormControl>
                        <Input
                          rootClassName="!h-auto min-h-10 w-full sm:min-h-11"
                          placeholder={t('signalTitle')}
                          className="!h-auto min-h-10 w-full rounded-none border border-border bg-inherit py-1 text-lg font-semibold leading-snug tracking-tight text-foreground placeholder:!text-base placeholder:font-medium placeholder:leading-snug placeholder:text-muted-foreground/80 focus-visible:border-foreground sm:min-h-11 sm:text-xl sm:placeholder:!text-lg"
                          disabled={isMutating}
                          rightIcon={
                            <RequirementMark className="h-4 w-4 !text-error-11 sm:h-4 sm:w-4" />
                          }
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator className="bg-border" />
          </div>

          <div className="flex min-h-0 flex-1 flex-col px-4 pt-5 lg:px-7">
            <section className="flex flex-col gap-6">
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => {
                  const descriptionValue = field.value || '';
                  return (
                    <FormItem data-signal-field="description">
                      <FormLabel className="gap-1 text-foreground">
                        {t('description')} <RequirementMark />
                      </FormLabel>
                      <FormControl>
                        <div className="overflow-hidden rounded-none border border-border bg-background-2 shadow-none focus-within:border-foreground">
                          <RichTextEditor
                            editorRef={null}
                            bordered={false}
                            className="signal-description-editor"
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
              {mode === 'create' && spaceSlug ? (
                <div
                  className="flex flex-col gap-2"
                  data-signal-field="tagPeople"
                >
                  <span className="text-2 font-medium text-foreground">
                    {t('signalFormTagPeople')}
                  </span>
                  <SignalTagPeopleField
                    spaceSlug={spaceSlug}
                    useMembers={useMembers}
                    value={taggedMatrixUserIds}
                    onChange={setTaggedMatrixUserIds}
                    disabled={isPublishing}
                  />
                  <p className="text-1 text-muted-foreground">
                    {t('signalFormTagPeopleHint')}
                  </p>
                </div>
              ) : null}
            </section>
            <SignalTypeSection>
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem data-signal-field="type">
                    <div className="flex w-full flex-col gap-3">
                      <FormLabel className="text-foreground">
                        {t('type')} <RequirementMark />
                      </FormLabel>
                      <FormControl>
                        <SignalTypePickerGrid
                          options={typeOptions}
                          selected={field.value}
                          onSelect={(type) => {
                            form.setValue('type', type as FormValues['type'], {
                              shouldDirty: true,
                            });
                          }}
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </SignalTypeSection>
            {mode === 'create' && votingModeStatus === 'error' ? (
              <section className="flex flex-col gap-3 border-t border-border pt-8">
                <Label className="text-foreground">
                  {t('signalFormVoteWithPercent')}
                </Label>
                <div
                  role="alert"
                  className="flex flex-wrap items-center justify-between gap-3 border border-error-6 bg-error-2 px-3 py-2 text-1 text-error-11"
                >
                  <span>{tSignalCard('votingModeLoadFailed')}</span>
                  <Button
                    type="button"
                    variant="outline"
                    colorVariant="neutral"
                    size="sm"
                    onClick={retryVotingMode}
                  >
                    {tSignalCard('votingModeRetry')}
                  </Button>
                </div>
              </section>
            ) : null}
            {mode === 'create' && votingMode === 'token' ? (
              <section className="flex flex-col gap-3 border-t border-border pt-8">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Label className="text-foreground">
                    {t('signalFormVoteWithPercent')}
                  </Label>
                  <span className="text-1 font-medium tabular-nums text-foreground">
                    {creatorVoteReadout}
                  </span>
                </div>
                <Slider
                  min={1}
                  max={100}
                  step={1}
                  value={[creatorVotePercent]}
                  onValueChange={(value) =>
                    setCreatorVotePercent(value[0] ?? 100)
                  }
                  disabled={isMutating}
                  aria-label={t('signalFormVoteWithPercent')}
                />
                <div className="grid grid-cols-4 gap-2">
                  {CREATOR_VOTE_PRESETS.map((preset) => {
                    const selected = creatorVotePercent === preset;
                    return (
                      <Button
                        key={preset}
                        type="button"
                        size="sm"
                        variant="outline"
                        colorVariant="neutral"
                        aria-pressed={selected}
                        disabled={isMutating}
                        onClick={() => setCreatorVotePercent(preset)}
                        className={cn(
                          'tabular-nums',
                          selected &&
                            'border-foreground bg-foreground text-background hover:border-foreground hover:bg-foreground hover:text-background',
                        )}
                      >
                        {preset}%
                      </Button>
                    );
                  })}
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('signalFormVotingPowerHint')}
                </p>
              </section>
            ) : null}
            <section className="flex flex-col gap-6 border-t border-border pt-8">
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-foreground">
                  {t('signalFormMedia')}
                </p>
                <div role="group" aria-label={t('signalFormMedia')}>
                  <SignalImagePicker
                    label={t('signalFormImage')}
                    hint={t('signalFormImageHint')}
                    accept={SIGNAL_IMAGE_ACCEPT}
                    maxFiles={Math.max(
                      0,
                      SIGNAL_IMAGE_LIMIT - keptImages.length,
                    )}
                    maxBytes={SIGNAL_MEDIA_MAX_BYTES}
                    files={imageFiles}
                    kept={keptImages}
                    onFilesChange={setImageFiles}
                    onKeptChange={(updated) =>
                      setKeptImages(asMediaItems(updated))
                    }
                    disabled={isMutating}
                    beside={
                      <button
                        type="button"
                        aria-pressed={showVideo}
                        disabled={isMutating}
                        onClick={toggleVideo}
                        style={{ width: 112, height: 112 }}
                        className={cn(
                          'flex flex-col items-center justify-center gap-2 border px-2',
                          showVideo
                            ? 'border-foreground bg-foreground text-background'
                            : 'border-border bg-background text-foreground hover:bg-neutral-2',
                        )}
                      >
                        <Video
                          className="size-5"
                          strokeWidth={1.5}
                          aria-hidden
                        />
                        <span className="text-center text-1 leading-tight">
                          {t('signalFormMediaVideo')}
                        </span>
                      </button>
                    }
                  />
                </div>
              </div>
              {showVideo ? (
                <FormField
                  control={form.control}
                  name="videoUrl"
                  render={({ field, fieldState }) => (
                    <FormItem data-signal-field="videoUrl">
                      <FormLabel className="text-foreground">
                        {t('signalFormVideo')}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="url"
                          disabled={isMutating}
                          placeholder="https://"
                          value={field.value ?? ''}
                          onChange={(event) => {
                            field.onChange(event);
                            if (fieldState.error?.type === 'manual') {
                              form.clearErrors('videoUrl');
                            }
                          }}
                        />
                      </FormControl>
                      <FormDescription>
                        {t('signalFormVideoHint')}
                      </FormDescription>
                      {videoLinkWarning && !fieldState.error ? (
                        <p
                          role="alert"
                          className="text-sm text-destructive"
                          data-testid="signal-video-link-warning"
                        >
                          {videoLinkWarning}
                        </p>
                      ) : null}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-foreground">
                  {t('signalFormAttachments')}
                </p>
                <AddAttachment
                  accept={SIGNAL_DOCUMENT_ACCEPT}
                  maxFiles={Math.max(
                    0,
                    SIGNAL_DOCUMENT_LIMIT - keptDocuments.length,
                  )}
                  maxBytes={SIGNAL_MEDIA_MAX_BYTES}
                  label={t('signalFormAttachmentsHint')}
                  value={[...keptDocuments, ...documentFiles]}
                  defaultAttachments={keptDocuments}
                  onChange={setDocumentFiles}
                  onExistingAttachmentsChange={(updated) =>
                    setKeptDocuments(asMediaItems(updated))
                  }
                />
              </div>
            </section>

            <div className="relative flex w-full flex-col items-end gap-3 pt-8">
              <SignalFormRootError control={form.control} />
              {/* TODO: Temporary for Reciprocal Exchange. Delete with legacy-signal-fields/. */}
              <LegacySignalFieldsDisclosure disabled={isMutating} />
              <div className="flex w-full justify-end gap-2">
                <Button
                  type="submit"
                  disabled={isMutating || !isEditAuthorized}
                >
                  {mode === 'edit'
                    ? t.has('saveChanges')
                      ? t('saveChanges')
                      : 'Save changes'
                    : tAgreementFlow('buttons.publish')}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </Form>
    </SpaceLoadingBackdrop>
  );
};
