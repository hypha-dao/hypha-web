'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Form, Separator } from '@hypha-platform/ui';
import { Text } from '@radix-ui/themes';
import { RefreshCw } from 'lucide-react';
import { SpaceLoadingBackdrop } from '../../spaces/components/space-loading-backdrop';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  Coherence,
  schemaCreateAgreementFiles,
  schemaUpdateCoherenceForm,
  useAgreementFileUploads,
  useCoherenceMutationsWeb2Rsc,
  useJwt,
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

type FormValues = z.infer<typeof schemaUpdateCoherenceForm>;

type EditSignalFormProps = {
  slug: string;
  signal: Coherence;
  successfulUrl: string;
  closeUrl?: string;
  backUrl?: string;
};

export function EditSignalForm({
  slug,
  signal,
  successfulUrl,
  closeUrl,
  backUrl,
}: EditSignalFormProps) {
  const t = useTranslations('CoherenceTab');
  const tAgreementFlow = useTranslations('AgreementFlow');
  const tSpaces = useTranslations('Spaces');
  const { person } = useMe();
  const { jwt: authToken } = useJwt();
  const router = useRouter();

  const attachmentUrlsRef = React.useRef<
    (string | { name: string; url: string })[]
  >([]);

  const {
    updateCoherenceBySlug,
    isUpdatingCoherence,
    errorUpdateCoherenceBySlugMutation,
    resetUpdateCoherenceBySlugMutation,
  } = useCoherenceMutationsWeb2Rsc(authToken);

  const signalFiles = useAgreementFileUploads(
    authToken,
    async (uploaded, s) => {
      if (!s) return;
      const prev = attachmentUrlsRef.current;
      await updateCoherenceBySlug({
        slug: s,
        attachments: [...prev, ...(uploaded.attachments ?? [])],
      });
    },
  );

  const formRef = React.useRef<HTMLFormElement>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(schemaUpdateCoherenceForm),
    defaultValues: {
      title: signal.title,
      description: signal.description,
      type: signal.type,
      priority: signal.priority,
      tags: signal.tags ?? [],
      attachments: [...(signal.attachments ?? [])],
    },
  });

  useScrollToErrors(form, formRef);

  const handleResetForm = React.useCallback(() => {
    form.reset({
      title: signal.title,
      description: signal.description,
      type: signal.type,
      priority: signal.priority,
      tags: signal.tags ?? [],
      attachments: [...(signal.attachments ?? [])],
    });
  }, [form, signal]);

  const handleSave = React.useCallback(
    async (data: FormValues) => {
      try {
        const { attachments, ...fields } = data;
        const arr = Array.isArray(attachments) ? attachments : [];
        const alreadyUploaded = arr.filter(
          (a): a is string | { name: string; url: string } =>
            typeof a === 'string' ||
            (typeof a === 'object' &&
              a !== null &&
              'url' in a &&
              typeof (a as { url: unknown }).url === 'string'),
        );
        attachmentUrlsRef.current = alreadyUploaded;

        await updateCoherenceBySlug({
          slug,
          ...fields,
          attachments: alreadyUploaded,
        });

        const newFiles = arr.filter((a) => a instanceof File);
        if (newFiles.length > 0) {
          const filePayload = schemaCreateAgreementFiles.parse({
            attachments: newFiles,
          });
          await signalFiles.upload(filePayload, slug);
        }

        router.push(successfulUrl);
      } catch (error) {
        console.warn('Could not update signal:', error);
      }
    },
    [router, signalFiles, slug, successfulUrl, updateCoherenceBySlug],
  );

  const handleInvalid = (err?: Record<string, unknown>) => {
    console.warn('form errors:', err);
  };

  const resolvedBackLabel = backUrl != null ? t('backToCoherence') : undefined;
  const isDirty = form.formState.isDirty;

  return (
    <SpaceLoadingBackdrop
      showKeepWindowOpenMessage={true}
      progress={isUpdatingCoherence || signalFiles.isLoading ? 50 : 0}
      isLoading={isUpdatingCoherence || signalFiles.isLoading}
      fullHeight={true}
      keepWindowOpenMessage={t('keepWindowOpenWhileSaving')}
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
                    disabled={isUpdatingCoherence || signalFiles.isLoading}
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
                userName={[person?.name, person?.surname]
                  .filter(Boolean)
                  .join(' ')}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <SignalTitleField
                  form={form}
                  disabled={isUpdatingCoherence}
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
              disabled={isUpdatingCoherence}
              showAttachments
            />

            <div className="flex w-full justify-end">
              <Button
                type="submit"
                disabled={isUpdatingCoherence || signalFiles.isLoading}
              >
                {tAgreementFlow('buttons.publish')}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </SpaceLoadingBackdrop>
  );
}
