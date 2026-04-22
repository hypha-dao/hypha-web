'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  Form,
  FormControl,
  FormItem,
  FormMessage,
  Image,
  Separator,
} from '@hypha-platform/ui';
import { Text } from '@radix-ui/themes';
import { RefreshCw } from 'lucide-react';
import { SpaceLoadingBackdrop } from '../../spaces/components/space-loading-backdrop';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  schemaCreateAgreementFiles,
  schemaCreateCoherenceForm,
  useAgreementFileUploads,
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
import { ButtonClose } from '../../common/button-close';
import { ButtonBack } from '../../common/button-back';
import { SignalEditorFields, SignalTitleField } from './signal-editor-fields';

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
  const tSpaces = useTranslations('Spaces');
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
  const signalFiles = useAgreementFileUploads(authToken, (uploaded, slug) => {
    if (!slug) return;
    return updateCoherenceBySlug({
      slug,
      attachments: uploaded.attachments ?? [],
    });
  });
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
      attachments: undefined,
    },
  });

  useScrollToErrors(form, formRef);

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
      attachments: undefined,
    });
  }, [form, person?.id, spaceId]);

  const handleCreate = React.useCallback(
    async (data: FormValues) => {
      try {
        const { attachments, ...rest } = data;
        const alreadyUploaded = (attachments ?? []).filter(
          (a): a is string | { name: string; url: string } =>
            typeof a === 'string' ||
            (typeof a === 'object' &&
              a !== null &&
              'url' in a &&
              typeof (a as { url: unknown }).url === 'string'),
        );

        const coherence = await createCoherence({
          ...rest,
          attachments: alreadyUploaded,
        });

        const hasNewFiles =
          Array.isArray(attachments) &&
          attachments.some((a) => a instanceof File);
        if (hasNewFiles) {
          const filePayload = schemaCreateAgreementFiles.parse({ attachments });
          await signalFiles.upload(filePayload, coherence.slug ?? undefined);
        }

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
      signalFiles,
      updateCoherenceBySlug,
      isMatrixAvailable,
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
          <div className="sticky top-0 z-30 -mx-4 bg-background-2 supports-[backdrop-filter]:bg-background-2/95 supports-[backdrop-filter]:backdrop-blur-sm lg:-mx-7">
            {/* Token-burning style: modal title row + delimiter */}
            <div className="flex flex-row flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border px-4 pb-4 pt-2 lg:px-7">
              <span className="text-lg font-semibold leading-none text-foreground">
                {t('signals')}
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
                    disabled={isCreatingCoherence}
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

            {/* Avatar + title field — items-start aligns avatar with input (token burning layout) */}
            <div className="flex flex-row items-start gap-3 px-4 pb-4 pt-5 lg:px-7">
              <PersonAvatar
                size="lg"
                isLoading={isCreatingCoherence}
                avatarSrc={person?.avatarUrl || ''}
                userName={[person?.name, person?.surname]
                  .filter(Boolean)
                  .join(' ')}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <SignalTitleField
                  form={form}
                  disabled={isCreatingCoherence}
                  placeholder={t('signalTitle')}
                />
                <Text className="text-1 text-neutral-11">
                  {person?.name} {person?.surname}
                </Text>
              </div>
            </div>

            <Separator className="bg-border" />
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-5 px-0 pt-5">
            <SignalEditorFields
              form={form}
              disabled={isCreatingCoherence}
              showAttachments
            />

            <div className="flex w-full justify-end">
              <Button
                type="submit"
                disabled={isCreatingCoherence || signalFiles.isLoading}
              >
                {tAgreementFlow('buttons.publish')}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </SpaceLoadingBackdrop>
  );
};
