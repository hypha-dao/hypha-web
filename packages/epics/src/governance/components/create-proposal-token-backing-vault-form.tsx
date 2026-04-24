'use client';

import { useForm } from 'react-hook-form';
import {
  schemaTokenBackingVault,
  createAgreementFiles,
  useMe,
  useJwt,
  useCreateTokenBackingVaultOrchestrator,
  CURRENCY_FEED_OPTIONS,
} from '@hypha-platform/core/client';
import { z } from 'zod';
import { Button, Form, Separator } from '@hypha-platform/ui';
import React from 'react';
import { SpaceLoadingBackdrop } from '../../spaces/components/space-loading-backdrop';
import { useConfig } from 'wagmi';
import {
  useClearResubmitOnSuccess,
  useResubmitProposalData,
  useScrollToErrors,
} from '../../hooks';
import { CreateAgreementBaseFields } from '../../agreements';
import { useTranslations } from 'next-intl';
import { useLocalizedProposalResolver } from '../hooks/use-localized-proposal-resolver';

const BACKING_VAULT_RESUBMIT_SEGMENT = 'token-backing-vault';

const fullSchemaTokenBackingVault =
  schemaTokenBackingVault.extend(createAgreementFiles);

type FormValues = z.infer<typeof fullSchemaTokenBackingVault>;

interface CreateProposalTokenBackingVaultFormProps {
  spaceId: number | undefined | null;
  web3SpaceId: number | undefined | null;
  successfulUrl: string;
  backUrl?: string;
  closeUrl?: string;
  plugin: React.ReactNode;
}

export const CreateProposalTokenBackingVaultForm = ({
  successfulUrl,
  backUrl,
  closeUrl,
  spaceId,
  web3SpaceId,
  plugin,
}: CreateProposalTokenBackingVaultFormProps) => {
  const tSpaces = useTranslations('Spaces');
  const tAgreementFlow = useTranslations('AgreementFlow');
  const resolver = useLocalizedProposalResolver(
    fullSchemaTokenBackingVault,
    tAgreementFlow,
  );
  const { person } = useMe();
  const { jwt } = useJwt();
  const config = useConfig();
  const {
    createTokenBackingVault,
    reset,
    currentAction,
    isError,
    isPending,
    progress,
    errors,
  } = useCreateTokenBackingVaultOrchestrator({
    authToken: jwt,
    config,
  });

  const [formError, setFormError] = React.useState<string | null>(null);

  // Aggregate every actionable message from the orchestration chain
  // (preflight validation, web2 mutation, web3 wait, etc.) so the user
  // sees the actual revert reason instead of just a generic "Oh snap".
  // The preflight hook joins multiple problems with `\n`, so split each
  // raw message into individual lines to render them as separate bullets.
  const errorMessages = React.useMemo(() => {
    const seen = new Set<string>();
    const messages: string[] = [];
    const pushLines = (raw: string) => {
      for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || seen.has(trimmed)) continue;
        seen.add(trimmed);
        messages.push(trimmed);
      }
    };
    for (const err of errors) {
      if (!err) continue;
      pushLines(err instanceof Error ? err.message : String(err));
    }
    if (formError) pushLines(formError);
    return messages;
  }, [errors, formError]);

  const formRef = React.useRef<HTMLFormElement>(null);
  const form = useForm<FormValues>({
    resolver,
    defaultValues: {
      title: '',
      description: '',
      leadImage: undefined,
      attachments: undefined,
      spaceId: spaceId ?? undefined,
      creatorId: person?.id,
      label: 'Backing Vault',
      tokenBackingVault: {
        spaceToken: '',
        activateVault: true,
        enableRedemption: false,
        addCollaterals: [],
        removeCollaterals: [],
        referenceCurrency: CURRENCY_FEED_OPTIONS[0].value,
        tokenPrice: undefined,
        minimumBackingPercent: undefined,
        maxRedemptionPercent: undefined,
        maxRedemptionPeriodDays: undefined,
        redemptionStartDate: null,
        enableAdvancedRedemptionControls: false,
        redemptionWhitelist: [],
      },
    },
    mode: 'onChange',
  });

  useScrollToErrors(form, formRef);
  const { resubmitKey } = useResubmitProposalData(
    form,
    spaceId,
    person?.id,
    BACKING_VAULT_RESUBMIT_SEGMENT,
  );

  useClearResubmitOnSuccess(progress === 100 && !isError);

  const handleCreate = async (data: FormValues) => {
    setFormError(null);

    // Runtime guards. The TS types allow `null | undefined` and we previously
    // cast with `as number`, which silently passed garbage to the orchestrator.
    // - Missing `spaceId` would blow up the web2 schema parse with a cryptic Zod error.
    // - Missing `web3SpaceId` is worse: the orchestrator silently SKIPS the web3 step
    //   while the web2 agreement still gets created, so the user thinks the proposal
    //   exists on-chain when it doesn't. Catch both up-front with a friendly message.
    if (typeof spaceId !== 'number' || !Number.isFinite(spaceId)) {
      setFormError(
        tAgreementFlow('plugins.tokenBackingVault.errors.spaceNotReady'),
      );
      return;
    }
    if (typeof web3SpaceId !== 'number' || !Number.isFinite(web3SpaceId)) {
      setFormError(
        tAgreementFlow('plugins.tokenBackingVault.errors.spaceNotOnChain'),
      );
      return;
    }

    try {
      await createTokenBackingVault({
        ...data,
        spaceId,
        web3SpaceId,
      });
    } catch (err) {
      // SWR mutation already surfaces the error via `errors`, but catching here
      // prevents an "Uncaught (in promise)" warning in the console and gives
      // us a fallback message in case the orchestrator's error channel is empty.
      setFormError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <SpaceLoadingBackdrop
      showKeepWindowOpenMessage={true}
      keepWindowOpenMessage={tAgreementFlow('loadingBackdrop.keepWindowOpen')}
      fullHeight={true}
      progress={progress}
      isLoading={isPending}
      message={
        isError ? (
          <div className="flex flex-col gap-3 max-w-lg text-left">
            {errorMessages.length > 0 && (
              <ul className="text-2 text-neutral-11 list-disc pl-4 space-y-2 whitespace-pre-wrap break-words">
                {errorMessages.map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
              </ul>
            )}
            <Button onClick={reset}>{tSpaces('reset')}</Button>
          </div>
        ) : (
          <div>{currentAction}</div>
        )
      }
    >
      <Form {...form}>
        <form
          ref={formRef}
          onSubmit={form.handleSubmit(handleCreate)}
          className="flex flex-col gap-5"
        >
          <CreateAgreementBaseFields
            key={resubmitKey}
            creator={{
              avatar: person?.avatarUrl || '',
              name: person?.name || '',
              surname: person?.surname || '',
            }}
            successfulUrl={successfulUrl}
            closeUrl={closeUrl || successfulUrl}
            backUrl={backUrl}
            backLabel={tSpaces('backToSettings')}
            isLoading={false}
            label={tAgreementFlow('labels.backingVault')}
            progress={progress}
          />
          {React.isValidElement(plugin)
            ? React.cloneElement(
                plugin as React.ReactElement<{ resubmitKey?: number }>,
                { resubmitKey },
              )
            : plugin}
          <Separator />
          <div className="flex flex-col gap-2">
            {formError && (
              <div className="text-error-11 text-2 font-medium">
                {formError}
              </div>
            )}
            <div className="flex justify-end w-full">
              <Button type="submit">{tAgreementFlow('buttons.publish')}</Button>
            </div>
          </div>
        </form>
      </Form>
    </SpaceLoadingBackdrop>
  );
};
