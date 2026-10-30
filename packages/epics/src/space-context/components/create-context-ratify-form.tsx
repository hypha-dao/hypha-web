'use client';

import { useForm } from 'react-hook-form';
import {
  schemaCreateAgreementForm,
  createAgreementFiles,
  SPACE_CONTEXT_DOCUMENT_LABEL,
  headingForSectionKey,
  buildProposalMarkdown,
  type SpaceContextSectionKey,
  type SpaceContextSectionRecord,
  useMe,
  useJwt,
  useCreateAgreementOrchestrator,
} from '@hypha-platform/core/client';
import {
  Badge,
  Button,
  Checkbox,
  Form,
  RequirementMark,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import React from 'react';
import { useConfig } from 'wagmi';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { SpaceLoadingBackdrop } from '../../spaces/components/space-loading-backdrop';
import { CreateAgreementBaseFields } from '../../agreements';
import { useLocalizedProposalResolver } from '../../governance/hooks/use-localized-proposal-resolver';
import { useResubmitProposalData, useScrollToErrors } from '../../hooks';
import { getResubmitPayloadForTemplate } from '../../utils/resubmit-proposal-template';
import {
  proposeSpaceContextSectionsRequest,
  useSpaceContext,
} from '../hooks/use-space-context';
import { SpaceContextStatusChip } from './space-context-status-chip';
import { agreementNumber } from './agreement-number';
import { useAuthentication } from '@hypha-platform/authentication';

const FIELD_LABEL_CLASS =
  'text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground';

const formSchema = schemaCreateAgreementForm.extend(createAgreementFiles);
type FormValues = z.infer<typeof formSchema>;

function isSelectable(section: SpaceContextSectionRecord): boolean {
  if (section.status === 'proposed') return false;
  return section.markdown.trim().length > 0;
}

function sectionMeta(
  section: SpaceContextSectionRecord,
  t: ReturnType<typeof useTranslations<'SpaceContext'>>,
): string {
  if (section.status === 'proposed') {
    return t('proposeForm.alreadyVoting', {
      agreement: agreementNumber(
        section.proposalWeb3Id,
        section.proposalDocumentId,
      ),
    });
  }
  if (section.status === 'ratified') {
    return t('proposeForm.ratifiedAmend', {
      agreement: agreementNumber(
        section.ratifiedWeb3Id,
        section.ratifiedDocumentId,
      ),
    });
  }
  if (!section.markdown.trim()) return t('proposeForm.noDraft');
  const parts = [t('proposeForm.draftVersion', { version: section.version })];
  if (section.contributorCount > 1) {
    parts.push(t('card.contributors', { count: section.contributorCount }));
  } else if (section.lastEditorName) {
    parts.push(section.lastEditorName);
  }
  return parts.join(' · ');
}

function ratifyContextResubmitMatchesSpace(
  restored: Record<string, unknown> | null,
  spaceId: number | null | undefined,
  spaceSlug: string,
): boolean {
  if (!restored) return false;
  const originatingId = restored.spaceContextSpaceId;
  if (typeof originatingId === 'number' && typeof spaceId === 'number') {
    return originatingId === spaceId;
  }
  const originatingSlug = restored.spaceContextSpaceSlug;
  if (typeof originatingSlug === 'string' && originatingSlug.length > 0) {
    return originatingSlug === spaceSlug;
  }
  return false;
}

function ratifyContextResubmitHasField(
  restored: Record<string, unknown> | null,
  field: 'title' | 'description',
): boolean {
  return typeof restored?.[field] === 'string';
}

export function CreateContextRatifyForm({
  spaceId,
  web3SpaceId,
  spaceSlug,
  successfulUrl,
  backUrl,
  closeUrl,
}: {
  spaceId: number | undefined | null;
  web3SpaceId: number | undefined | null;
  spaceSlug: string;
  successfulUrl: string;
  backUrl?: string;
  closeUrl?: string;
}) {
  const t = useTranslations('SpaceContext');
  const tAgreementFlow = useTranslations('AgreementFlow');
  const tSpaces = useTranslations('Spaces');
  const searchParams = useSearchParams();
  const { person } = useMe();
  const { jwt } = useJwt();
  const { getAccessToken } = useAuthentication();
  const config = useConfig();
  const { overview, error, refresh } = useSpaceContext(spaceSlug);
  const {
    createAgreement,
    reset,
    currentAction,
    isError,
    isPending,
    progress,
    agreement,
    taskState,
  } = useCreateAgreementOrchestrator({
    authToken: jwt,
    config,
  });
  const resolver = useLocalizedProposalResolver(formSchema, tAgreementFlow);
  const formRef = React.useRef<HTMLFormElement>(null);
  const preselected = React.useMemo(() => {
    const raw = searchParams.get('sections') ?? '';
    return raw
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
  }, [searchParams]);

  const selectable = (overview?.sections ?? []).filter(isSelectable);
  const [selected, setSelected] = React.useState<SpaceContextSectionKey[]>([]);
  const initializedRef = React.useRef(false);
  const titleTouchedRef = React.useRef(false);
  const descriptionTouchedRef = React.useRef(false);
  const linkedRef = React.useRef(false);
  const submittedSectionKeysRef = React.useRef<SpaceContextSectionKey[] | null>(
    null,
  );
  const [linkError, setLinkError] = React.useState(false);

  React.useEffect(() => {
    if (initializedRef.current || !overview) return;
    initializedRef.current = true;
    const fromQuery = selectable
      .map((section) => section.sectionKey)
      .filter((key) => preselected.includes(key));
    setSelected(
      fromQuery.length > 0
        ? fromQuery
        : selectable
            .filter((section) => section.status !== 'ratified')
            .map((section) => section.sectionKey),
    );
  }, [overview, preselected, selectable]);

  const form = useForm<FormValues>({
    resolver,
    defaultValues: {
      title: '',
      description: '',
      spaceId: spaceId ?? undefined,
      creatorId: person?.id,
    },
  });

  const { resubmitKey } = useResubmitProposalData(
    form,
    spaceId,
    person?.id,
    'ratify-context',
  );

  useScrollToErrors(form, formRef);

  React.useEffect(() => {
    if (person?.id) {
      form.setValue('creatorId', person.id);
    }
  }, [form, person?.id]);

  React.useEffect(() => {
    const restored = getResubmitPayloadForTemplate('ratify-context');
    if (!ratifyContextResubmitMatchesSpace(restored, spaceId, spaceSlug)) {
      return;
    }
    if (typeof restored?.title === 'string' && restored.title) {
      titleTouchedRef.current = true;
    }
    if (typeof restored?.description === 'string' && restored.description) {
      descriptionTouchedRef.current = true;
    }
  }, [spaceId, spaceSlug]);

  React.useEffect(() => {
    if (!resubmitKey) return;
    const restored = getResubmitPayloadForTemplate('ratify-context');
    if (!ratifyContextResubmitMatchesSpace(restored, spaceId, spaceSlug)) {
      return;
    }
    if (ratifyContextResubmitHasField(restored, 'title')) {
      titleTouchedRef.current = true;
    }
    if (ratifyContextResubmitHasField(restored, 'description')) {
      descriptionTouchedRef.current = true;
    }
  }, [resubmitKey, spaceId, spaceSlug]);

  React.useEffect(() => {
    const subscription = form.watch((_values, info) => {
      if (info?.type !== 'change') return;
      if (info.name === 'title') titleTouchedRef.current = true;
      if (info.name === 'description') descriptionTouchedRef.current = true;
    });
    return () => subscription.unsubscribe();
  }, [form]);

  React.useEffect(() => {
    if (!overview) return;
    const chosen = overview.sections.filter((section) =>
      selected.includes(section.sectionKey),
    );
    if (chosen.length === 0) return;
    const titles = chosen.map((section) =>
      headingForSectionKey(section.sectionKey),
    );
    if (!titleTouchedRef.current) {
      const generated = t('proposeForm.title', {
        sections: titles.join(', '),
      });
      form.setValue(
        'title',
        generated.length > 50 ? t('proposeForm.titleShort') : generated,
        { shouldDirty: false },
      );
    }
    if (!descriptionTouchedRef.current) {
      form.setValue(
        'description',
        buildProposalMarkdown(
          chosen.map((section) => ({
            key: section.sectionKey,
            title: headingForSectionKey(section.sectionKey),
            markdown: section.markdown,
          })),
        ).slice(0, 4000),
        { shouldDirty: false },
      );
    }
  }, [form, overview, selected, t]);

  const linkSectionsToProposal = React.useCallback(
    async (documentId: number, sectionKeys?: SpaceContextSectionKey[]) => {
      const keys = sectionKeys ?? submittedSectionKeysRef.current ?? selected;
      if (linkedRef.current || keys.length === 0) return;
      setLinkError(false);
      try {
        await proposeSpaceContextSectionsRequest({
          spaceSlug,
          sectionKeys: keys,
          documentId,
          getAccessToken,
        });
        linkedRef.current = true;
      } catch {
        setLinkError(true);
      }
    },
    [getAccessToken, selected, spaceSlug],
  );

  React.useEffect(() => {
    const documentId = agreement?.id;
    const keys = submittedSectionKeysRef.current ?? selected;
    const uploadSucceeded = taskState.UPLOAD_FILES.status === 'isDone';
    if (
      !documentId ||
      linkedRef.current ||
      keys.length === 0 ||
      !uploadSucceeded
    ) {
      return;
    }
    void linkSectionsToProposal(documentId, keys);
  }, [
    agreement?.id,
    linkSectionsToProposal,
    selected,
    taskState.UPLOAD_FILES.status,
  ]);

  const handleCreate = async (data: FormValues) => {
    if (selected.length === 0) return;
    submittedSectionKeysRef.current = [...selected];
    await createAgreement({
      ...data,
      label: SPACE_CONTEXT_DOCUMENT_LABEL,
      spaceId: spaceId as number,
      ...(typeof web3SpaceId === 'number' ? { web3SpaceId } : {}),
    });
  };

  const retryDocumentId = agreement?.id;

  const loadingMessage = isError ? (
    <div className="flex flex-col">
      <div>{tSpaces('errorOhSnap')}</div>
      <Button onClick={reset}>{tSpaces('reset')}</Button>
    </div>
  ) : (
    <div>{currentAction}</div>
  );

  return (
    <SpaceLoadingBackdrop
      progress={progress}
      isLoading={isPending}
      fullHeight
      showKeepWindowOpenMessage
      keepWindowOpenMessage={tAgreementFlow('loadingBackdrop.keepWindowOpen')}
      message={loadingMessage}
    >
      <Form {...form}>
        <form
          ref={formRef}
          onSubmit={form.handleSubmit(handleCreate)}
          className="flex flex-col gap-5"
        >
          <CreateAgreementBaseFields
            creator={{
              id: person?.id,
              avatar: person?.avatarUrl || '',
              name: person?.name || '',
              surname: person?.surname || '',
            }}
            successfulUrl={successfulUrl}
            closeUrl={closeUrl || successfulUrl}
            backUrl={backUrl}
            isLoading={false}
            label={SPACE_CONTEXT_DOCUMENT_LABEL}
            stickyHeaderTitle={t('proposeForm.header')}
            progress={progress}
            hideLeadImage
            contentLabel={
              <>
                {tAgreementFlow('createAgreementBaseFields.proposalContent')}
                <span className="font-normal text-neutral-11">
                  {' — '}
                  {t('proposeForm.contentPrefilled')}
                </span>
              </>
            }
            beforeContent={
              <section className="space-y-5 rounded-none border border-border/70 bg-background-2 p-4 lg:p-6">
                <div className="space-y-2">
                  <p className={FIELD_LABEL_CLASS}>
                    {t('proposeForm.proposalType')}
                  </p>
                  <Badge
                    variant="outline"
                    colorVariant="neutral"
                    className="uppercase tracking-[0.12em]"
                  >
                    {t('proposeForm.proposalTypeValue')}
                  </Badge>
                </div>
                <fieldset className="space-y-2">
                  <legend className={FIELD_LABEL_CLASS}>
                    {t('proposeForm.sections')} <RequirementMark />
                  </legend>
                  <p className="text-1 text-neutral-11">
                    {t('proposeForm.hint')}
                  </p>
                  <div className="divide-y divide-border/70 border border-border/70">
                    {(overview?.sections ?? []).map((section) => {
                      const disabled = !isSelectable(section);
                      const selectionLocked = typeof agreement?.id === 'number';
                      const checked = selected.includes(section.sectionKey);
                      return (
                        <label
                          key={section.sectionKey}
                          className={cn(
                            'flex items-center justify-between gap-3 px-3 py-3',
                            disabled || selectionLocked
                              ? 'cursor-not-allowed'
                              : 'cursor-pointer',
                            disabled && 'opacity-60',
                          )}
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <Checkbox
                              checked={checked}
                              disabled={disabled || selectionLocked}
                              onCheckedChange={(value) => {
                                setSelected((current) => {
                                  if (value === true) {
                                    return current.includes(section.sectionKey)
                                      ? current
                                      : [...current, section.sectionKey];
                                  }
                                  return current.filter(
                                    (key) => key !== section.sectionKey,
                                  );
                                });
                              }}
                            />
                            <span className="min-w-0 truncate text-2">
                              <span className="font-semibold text-foreground">
                                {headingForSectionKey(section.sectionKey)}
                              </span>
                              <span className="text-neutral-11">
                                {' · '}
                                {sectionMeta(section, t)}
                              </span>
                            </span>
                          </span>
                          <SpaceContextStatusChip status={section.status} />
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              </section>
            }
          />

          {error ? (
            <div className="border border-error-6 bg-background-2 px-4 py-6">
              <p className="text-2 text-error-11">{t('error.load')}</p>
              <Button
                type="button"
                className="mt-3"
                variant="outline"
                colorVariant="neutral"
                onClick={() => void refresh()}
              >
                {t('error.retry')}
              </Button>
            </div>
          ) : null}

          {linkError && typeof retryDocumentId === 'number' ? (
            <div className="border border-error-6 bg-background-2 px-4 py-6">
              <p className="text-2 text-error-11">{t('error.link')}</p>
              <Button
                type="button"
                className="mt-3"
                variant="outline"
                colorVariant="neutral"
                onClick={() =>
                  void linkSectionsToProposal(
                    retryDocumentId,
                    submittedSectionKeysRef.current ?? selected,
                  )
                }
              >
                {t('error.retry')}
              </Button>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-1 text-neutral-11">
              {t('proposeForm.onPassNote')}
            </p>
            <div className="flex shrink-0 justify-end gap-2">
              <Button asChild variant="outline" colorVariant="neutral">
                <Link href={closeUrl || successfulUrl} scroll={false}>
                  {t('proposeForm.cancel')}
                </Link>
              </Button>
              <Button type="submit" disabled={selected.length === 0}>
                {tAgreementFlow('buttons.publish')}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </SpaceLoadingBackdrop>
  );
}
