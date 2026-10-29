'use client';

import { useForm } from 'react-hook-form';
import {
  schemaCreateAgreementForm,
  createAgreementFiles,
  SPACE_CONTEXT_DOCUMENT_LABEL,
  headingForSectionKey,
  buildProposalMarkdown,
  type SpaceContextSectionKey,
  useMe,
  useJwt,
  useCreateAgreementOrchestrator,
} from '@hypha-platform/core/client';
import { Button, Checkbox, Form } from '@hypha-platform/ui';
import { useSearchParams } from 'next/navigation';
import React from 'react';
import { useConfig } from 'wagmi';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { SpaceLoadingBackdrop } from '../../spaces/components/space-loading-backdrop';
import { CreateAgreementBaseFields } from '../../agreements';
import { useLocalizedProposalResolver } from '../../governance/hooks/use-localized-proposal-resolver';
import { useScrollToErrors } from '../../hooks';
import {
  proposeSpaceContextSectionsRequest,
  useSpaceContext,
} from '../hooks/use-space-context';
import { SpaceContextStatusChip } from './space-context-status-chip';
import { useAuthentication } from '@hypha-platform/authentication';

const formSchema = schemaCreateAgreementForm.extend(createAgreementFiles);
type FormValues = z.infer<typeof formSchema>;

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
  const { overview } = useSpaceContext(spaceSlug);
  const {
    createAgreement,
    reset,
    currentAction,
    isError,
    isPending,
    progress,
    agreement,
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

  const selectable = (overview?.sections ?? []).filter(
    (section) =>
      section.status === 'draft' ||
      (section.status === 'not_started' && section.markdown.trim()),
  );
  const [selected, setSelected] = React.useState<SpaceContextSectionKey[]>([]);

  React.useEffect(() => {
    if (selected.length > 0 || !overview) return;
    const fromQuery = selectable
      .map((section) => section.sectionKey)
      .filter((key) => preselected.includes(key));
    setSelected(
      fromQuery.length > 0
        ? fromQuery
        : selectable.map((section) => section.sectionKey),
    );
  }, [overview, preselected, selectable, selected.length]);

  const form = useForm<FormValues>({
    resolver,
    defaultValues: {
      title: '',
      description: '',
      spaceId: spaceId ?? undefined,
      creatorId: person?.id,
    },
  });

  useScrollToErrors(form, formRef);

  React.useEffect(() => {
    if (!overview) return;
    const chosen = overview.sections.filter((section) =>
      selected.includes(section.sectionKey),
    );
    if (chosen.length === 0) return;
    const titles = chosen.map((section) =>
      headingForSectionKey(section.sectionKey),
    );
    if (!form.getValues('title')) {
      const generated = t('proposeForm.title', {
        sections: titles.join(', '),
      });
      form.setValue(
        'title',
        generated.length > 50 ? t('proposeForm.titleShort') : generated,
      );
    }
    form.setValue(
      'description',
      buildProposalMarkdown(
        chosen.map((section) => ({
          key: section.sectionKey,
          title: headingForSectionKey(section.sectionKey),
          markdown: section.markdown,
        })),
      ).slice(0, 4000),
    );
  }, [form, overview, selected, t]);

  const linkedRef = React.useRef(false);
  React.useEffect(() => {
    const documentId = agreement?.id;
    if (!documentId || linkedRef.current || selected.length === 0) return;
    linkedRef.current = true;
    void proposeSpaceContextSectionsRequest({
      spaceSlug,
      sectionKeys: selected,
      documentId,
      getAccessToken,
    });
  }, [agreement?.id, getAccessToken, selected, spaceSlug]);

  const handleCreate = async (data: FormValues) => {
    if (selected.length === 0) return;
    await createAgreement({
      ...data,
      label: SPACE_CONTEXT_DOCUMENT_LABEL,
      spaceId: spaceId as number,
      ...(typeof web3SpaceId === 'number' ? { web3SpaceId } : {}),
    });
  };

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
          />

          <fieldset className="space-y-3">
            <legend className="text-[11px] font-semibold uppercase tracking-[0.12em]">
              {t('proposeForm.sections')}
            </legend>
            <p className="text-2 text-neutral-11">{t('proposeForm.hint')}</p>
            <div className="divide-y divide-border/70 border border-border/70">
              {(overview?.sections ?? []).map((section) => {
                const disabled =
                  section.status === 'proposed' ||
                  section.status === 'ratified' ||
                  !section.markdown.trim();
                const checked = selected.includes(section.sectionKey);
                return (
                  <label
                    key={section.sectionKey}
                    className="flex cursor-pointer items-center justify-between gap-3 px-3 py-3"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <Checkbox
                        checked={checked}
                        disabled={disabled}
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
                      <span className="min-w-0">
                        <span className="block font-medium">
                          {headingForSectionKey(section.sectionKey)}
                        </span>
                        <span className="block truncate text-1 text-neutral-11">
                          {disabled
                            ? section.status === 'proposed'
                              ? t('proposeForm.alreadyVoting')
                              : section.status === 'ratified'
                              ? t('proposeForm.alreadyRatified')
                              : t('proposeForm.noDraft')
                            : t('proposeForm.draftReady')}
                        </span>
                      </span>
                    </span>
                    <SpaceContextStatusChip status={section.status} />
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="flex justify-end">
            <Button type="submit" disabled={selected.length === 0}>
              {tAgreementFlow('buttons.publish')}
            </Button>
          </div>
        </form>
      </Form>
    </SpaceLoadingBackdrop>
  );
}
