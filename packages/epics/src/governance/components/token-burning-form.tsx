'use client';

import { useForm } from 'react-hook-form';
import {
  schemaTokenBurning,
  createAgreementFiles,
  useMe,
  useJwt,
  useTokenBurningOrchestrator,
  publicClient,
} from '@hypha-platform/core/client';
import { z } from 'zod';
import { Button, Form, Separator } from '@hypha-platform/ui';
import React from 'react';
import { useConfig } from 'wagmi';
import { LoadingBackdrop } from '@hypha-platform/ui/server';
import {
  useClearResubmitOnSuccess,
  useResubmitProposalData,
  useScrollToErrors,
} from '../../hooks';
import { CreateAgreementBaseFields } from '../../agreements';
import { useTranslations } from 'next-intl';
import { useLocalizedProposalResolver } from '../hooks/use-localized-proposal-resolver';
import { erc20Abi, isAddress, parseUnits } from 'viem';
import { resolveTokenDecimals } from '../utils/token-decimals';

const BURN_RESUBMIT_SEGMENT = 'token-burning';

type FormValues = z.infer<typeof schemaTokenBurning>;

const fullSchemaTokenBurning = schemaTokenBurning.extend(createAgreementFiles);
const BURN_BALANCE_ERROR_TYPE_EXCEEDS = 'burnAmountExceedsBalance';
const BURN_BALANCE_ERROR_TYPE_ZERO_ALL = 'burnAllBalanceZero';

interface TokenBurningFormProps {
  spaceId: number | undefined | null;
  web3SpaceId: number | undefined | null;
  successfulUrl: string;
  backUrl?: string;
  closeUrl?: string;
  plugin: React.ReactNode;
}

export const TokenBurningForm = ({
  successfulUrl,
  backUrl,
  closeUrl,
  spaceId,
  web3SpaceId,
  plugin,
}: TokenBurningFormProps) => {
  const tSpaces = useTranslations('Spaces');
  const tAgreementFlow = useTranslations('AgreementFlow');
  const { person } = useMe();
  const { jwt } = useJwt();
  const config = useConfig();
  const {
    createTokenBurning,
    reset,
    currentAction,
    isError,
    isPending,
    progress,
  } = useTokenBurningOrchestrator({
    authToken: jwt,
    config,
  });

  const resolver = useLocalizedProposalResolver(
    fullSchemaTokenBurning,
    tAgreementFlow,
  );

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
      label: 'Token Burning',
      tokenBurning: {
        token: '',
        burns: [
          {
            type: 'member',
            address: '',
            amount: '',
            allBalance: false,
          },
        ],
      },
    },
    mode: 'onChange',
  });
  const burnAmountExceedsBalanceMessage = tAgreementFlow(
    'plugins.tokenBurning.burnAmountExceedsBalance',
  );
  const amountGreaterThanZeroMessage = tAgreementFlow(
    'proposalErrors.amountGreaterThanZero',
  );

  const normalizeAmountInput = (amount: string) => {
    const normalizedAmountInput = amount.trim().replace(',', '.');
    if (normalizedAmountInput.startsWith('.')) {
      return `0${normalizedAmountInput}`;
    }
    if (normalizedAmountInput.endsWith('.')) {
      return `${normalizedAmountInput}0`;
    }
    return normalizedAmountInput;
  };

  const validateRecipientBurnBalances = async (data: FormValues) => {
    const tokenAddress = data.tokenBurning.token as `0x${string}`;

    if (!isAddress(tokenAddress)) {
      return false;
    }

    const decimals = resolveTokenDecimals(tokenAddress);
    let hasBlockingValidationError = false;

    await Promise.all(
      data.tokenBurning.burns.map(async (burn, index) => {
        const amountFieldPath = `tokenBurning.burns.${index}.amount` as const;
        const currentError = form.getFieldState(amountFieldPath).error;
        const hasManagedManualError =
          currentError?.type === BURN_BALANCE_ERROR_TYPE_EXCEEDS ||
          currentError?.type === BURN_BALANCE_ERROR_TYPE_ZERO_ALL;

        if (!isAddress(burn.address)) {
          if (hasManagedManualError) {
            form.clearErrors(amountFieldPath);
          }
          return;
        }

        let recipientBalance: bigint | null = null;
        try {
          recipientBalance = await publicClient.readContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [burn.address as `0x${string}`],
          });
        } catch {
          // Don't block submit on transient RPC lookup issues.
          return;
        }

        if (burn.allBalance) {
          if (recipientBalance === 0n) {
            hasBlockingValidationError = true;
            form.setError(amountFieldPath, {
              type: BURN_BALANCE_ERROR_TYPE_ZERO_ALL,
              message: amountGreaterThanZeroMessage,
            });
            return;
          }

          if (hasManagedManualError) {
            form.clearErrors(amountFieldPath);
          }
          return;
        }

        if (!burn.amount) {
          if (hasManagedManualError) {
            form.clearErrors(amountFieldPath);
          }
          return;
        }

        const normalizedAmount = normalizeAmountInput(burn.amount);
        let burnAmount: bigint;
        try {
          burnAmount = parseUnits(normalizedAmount, decimals);
        } catch {
          if (hasManagedManualError) {
            form.clearErrors(amountFieldPath);
          }
          return;
        }

        if (burnAmount > recipientBalance) {
          hasBlockingValidationError = true;
          form.setError(amountFieldPath, {
            type: BURN_BALANCE_ERROR_TYPE_EXCEEDS,
            message: burnAmountExceedsBalanceMessage,
          });
          return;
        }

        if (hasManagedManualError) {
          form.clearErrors(amountFieldPath);
        }
      }),
    );

    return hasBlockingValidationError;
  };

  useScrollToErrors(form, formRef);
  const { resubmitKey } = useResubmitProposalData(
    form,
    spaceId,
    person?.id,
    BURN_RESUBMIT_SEGMENT,
  );

  useClearResubmitOnSuccess(progress, isError);

  const handleCreate = async (data: FormValues) => {
    if (
      typeof spaceId !== 'number' ||
      !Number.isFinite(spaceId) ||
      typeof web3SpaceId !== 'number' ||
      !Number.isFinite(web3SpaceId)
    ) {
      throw new Error('Invalid space context for token burning proposal');
    }

    await createTokenBurning({
      ...data,
      spaceId,
      web3SpaceId,
    });
  };

  return (
    <LoadingBackdrop
      showKeepWindowOpenMessage={true}
      keepWindowOpenMessage={tAgreementFlow('loadingBackdrop.keepWindowOpen')}
      fullHeight={true}
      progress={progress}
      isLoading={isPending}
      message={
        isError ? (
          <div className="flex flex-col">
            <div>{tSpaces('errorOhSnap')}</div>
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
          onSubmit={form.handleSubmit(async (data) => {
            const hasBalanceErrors = await validateRecipientBurnBalances(data);
            if (hasBalanceErrors) {
              return;
            }
            await handleCreate(data);
          })}
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
            label={tAgreementFlow('labels.tokenBurning')}
            progress={progress}
          />
          {plugin}
          <Separator />
          <div className="flex justify-end w-full">
            <Button type="submit">{tAgreementFlow('buttons.publish')}</Button>
          </div>
        </form>
      </Form>
    </LoadingBackdrop>
  );
};
