'use client';

import { useForm } from 'react-hook-form';
import {
  schemaExchangeStakesAndTokens,
  useCreateExchangeStakesAndTokensOrchestrator,
  useJwt,
  useMe,
} from '@hypha-platform/core/client';
import { z } from 'zod';
import { Button, Form, Separator } from '@hypha-platform/ui';
import React from 'react';
import { SpaceLoadingBackdrop } from '../../spaces/components/space-loading-backdrop';
import { useConfig } from 'wagmi';
import { useScrollToErrors, useResubmitProposalData } from '../../hooks';
import { CreateAgreementBaseFields } from '../../agreements';
import { useTranslations } from 'next-intl';
import { useLocalizedProposalResolver } from '../hooks/use-localized-proposal-resolver';
import {
  validateExchangeSellerLegBalances,
  EXCHANGE_SELLER_AMOUNT_TOO_SMALL,
  EXCHANGE_SELLER_BALANCE_EXCEEDED,
} from '../utils/validate-exchange-seller-balances';
import { stripExchangeDetailsBlock } from '../utils/strip-exchange-details-block';

const fullSchemaCreateExchangeStakesAndTokensForm =
  schemaExchangeStakesAndTokens;

type FormValues = z.infer<typeof fullSchemaCreateExchangeStakesAndTokensForm>;

interface CreateExchangeStakesAndTokensFormProps {
  spaceId: number | undefined | null;
  web3SpaceId: number | undefined | null;
  successfulUrl: string;
  backUrl?: string;
  plugin: React.ReactNode;
}

const EXCHANGE_DETAILS_START = '<!-- exchange-details:start -->';
const EXCHANGE_DETAILS_END = '<!-- exchange-details:end -->';
const BUYER_SETTLEMENT_PREFIX = '<!-- exchange-buyer-settlement:';
const BUYER_SETTLEMENT_SUFFIX = '-->';
const SELLER_SETTLEMENT_PREFIX = '<!-- exchange-seller-settlement:';
const SELLER_SETTLEMENT_SUFFIX = '-->';

const upsertExchangeDetailsSection = (
  description: string,
  section: string,
): string => {
  const sanitizedDescription = stripExchangeDetailsBlock(description).trimEnd();
  return `${sanitizedDescription}\n\n${section}`.trim();
};

export const CreateExchangeStakesAndTokensForm = ({
  successfulUrl,
  backUrl,
  spaceId,
  web3SpaceId,
  plugin,
}: CreateExchangeStakesAndTokensFormProps) => {
  const tSpaces = useTranslations('Spaces');
  const tAgreementFlow = useTranslations('AgreementFlow');
  const { person } = useMe();
  const { jwt } = useJwt();
  const config = useConfig();

  const {
    createExchangeStakesAndTokens,
    reset,
    currentAction,
    isError,
    isPending,
    progress,
  } = useCreateExchangeStakesAndTokensOrchestrator({ authToken: jwt, config });

  const resolver = useLocalizedProposalResolver(
    fullSchemaCreateExchangeStakesAndTokensForm,
    tAgreementFlow,
  );

  const formRef = React.useRef<HTMLFormElement>(null);
  const form = useForm<FormValues>({
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    resolver,
    defaultValues: {
      title: '',
      description: '',
      leadImage: undefined,
      attachments: undefined,
      spaceId: spaceId ?? undefined,
      creatorId: person?.id,
      sellerAddress: '',
      buyerAddress: '',
      sellerLeg: [{ amount: '', token: '' }],
      buyerLeg: [{ amount: '', token: '' }],
      label: 'Exchange',
      sellerRecipientType: 'member',
      buyerRecipientType: 'member',
      spaceExecutorAddress: '',
      buyerExecutorAddressForSettlement: '',
    },
  });

  React.useEffect(() => {
    if (person?.id) {
      form.setValue('creatorId', person.id);
    }
  }, [person?.id, form]);

  React.useEffect(() => {
    if (typeof spaceId === 'number') {
      form.setValue('spaceId', spaceId);
    }
  }, [spaceId, form]);

  useScrollToErrors(form, formRef);
  const { resubmitKey } = useResubmitProposalData(form, spaceId, person?.id);

  const handleCreate = async (data: FormValues) => {
    if (typeof spaceId !== 'number') {
      throw new Error('Space ID is required to create this proposal');
    }

    try {
      /** Member seller funds escrow only after the proposal passes; skip balance check at submit. */
      if (data.sellerRecipientType !== 'member') {
        await validateExchangeSellerLegBalances({
          sellerRecipientType: data.sellerRecipientType,
          sellerAddress: data.sellerAddress,
          sellerLeg: data.sellerLeg,
          spaceExecutorAddress: data.spaceExecutorAddress || undefined,
        });
      }
    } catch (e) {
      const err = e as Error & { legIndex?: number };
      if (err.message === EXCHANGE_SELLER_BALANCE_EXCEEDED) {
        const idx = typeof err.legIndex === 'number' ? err.legIndex : 0;
        form.setError(`sellerLeg.${idx}.amount` as const, {
          type: 'manual',
          message: tAgreementFlow(
            'plugins.exchangeStakesAndTokens.errors.sellerAmountExceedsBalance',
          ),
        });
        return;
      }
      if (err.message === EXCHANGE_SELLER_AMOUNT_TOO_SMALL) {
        const idx = typeof err.legIndex === 'number' ? err.legIndex : 0;
        form.setError(`sellerLeg.${idx}.amount` as const, {
          type: 'manual',
          message: tAgreementFlow(
            'plugins.exchangeStakesAndTokens.errors.sellerAmountTooSmall',
          ),
        });
        return;
      }
      if (err.message === 'EXCHANGE_SELLER_TREASURY_UNAVAILABLE') {
        form.setError('root', {
          type: 'manual',
          message: tAgreementFlow(
            'plugins.exchangeStakesAndTokens.errors.sellerTreasuryUnavailable',
          ),
        });
        return;
      }
      form.setError('root', {
        type: 'manual',
        message: tAgreementFlow(
          'plugins.exchangeStakesAndTokens.errors.sellerBalanceCheckFailed',
        ),
      });
      return;
    }

    const sellerLegLines = data.sellerLeg
      .map(
        (leg, index) =>
          `- ${index + 1}. ${leg.amount} | \`${leg.token as string}\``,
      )
      .join('\n');
    const buyerLegLines = data.buyerLeg
      .map(
        (leg, index) =>
          `- ${index + 1}. ${leg.amount} | \`${leg.token as string}\``,
      )
      .join('\n');

    const buyerSettlementMarker =
      data.buyerRecipientType === 'space' &&
      data.buyerExecutorAddressForSettlement?.trim()
        ? `${BUYER_SETTLEMENT_PREFIX}${data.buyerExecutorAddressForSettlement.trim()}${BUYER_SETTLEMENT_SUFFIX}`
        : '';
    const sellerSettlementMarker =
      data.sellerRecipientType === 'space' && data.spaceExecutorAddress?.trim()
        ? `${SELLER_SETTLEMENT_PREFIX}${data.spaceExecutorAddress.trim()}${SELLER_SETTLEMENT_SUFFIX}`
        : '';

    const exchangeDetailsSection = [
      EXCHANGE_DETAILS_START,
      ...(data.sellerRecipientType === 'member'
        ? ['<!-- exchange-funding:deferred -->', '']
        : []),
      ...(sellerSettlementMarker ? [sellerSettlementMarker, ''] : []),
      ...(buyerSettlementMarker ? [buyerSettlementMarker, ''] : []),
      `### ${tAgreementFlow('labels.exchange')}`,
      '',
      `**${tAgreementFlow('plugins.exchangeStakesAndTokens.seller')}:** \`${
        data.sellerAddress
      }\``,
      '',
      `**${tAgreementFlow(
        'plugins.exchangeStakesAndTokens.sellerWillSend',
      )}:**`,
      sellerLegLines,
      '',
      `**${tAgreementFlow('plugins.exchangeStakesAndTokens.buyer')}:** \`${
        data.buyerAddress
      }\``,
      '',
      `**${tAgreementFlow('plugins.exchangeStakesAndTokens.buyerWillSend')}:**`,
      buyerLegLines,
      EXCHANGE_DETAILS_END,
    ].join('\n');

    const createPayload = { ...data };
    delete createPayload.sellerRecipientType;
    delete createPayload.buyerRecipientType;
    delete createPayload.spaceExecutorAddress;
    delete createPayload.buyerExecutorAddressForSettlement;

    const buyerPartyBForEscrow =
      data.buyerRecipientType === 'space' &&
      data.buyerExecutorAddressForSettlement?.trim()
        ? data.buyerExecutorAddressForSettlement.trim()
        : data.buyerAddress;
    const sellerPartyAForEscrow =
      data.sellerRecipientType === 'space' && data.spaceExecutorAddress?.trim()
        ? data.spaceExecutorAddress.trim()
        : data.sellerAddress;

    try {
      await createExchangeStakesAndTokens({
        ...createPayload,
        sellerPartyAForEscrow,
        buyerPartyBForEscrow,
        description: upsertExchangeDetailsSection(
          data.description,
          exchangeDetailsSection,
        ),
        spaceId,
        web3SpaceId: typeof web3SpaceId === 'number' ? web3SpaceId : undefined,
        label: 'Exchange',
      });
    } catch (e) {
      const err = e as Error;
      if (err.message === 'EXCHANGE_MEMBER_SELLER_WALLET_MISMATCH') {
        form.setError('root', {
          type: 'manual',
          message: tAgreementFlow(
            'plugins.exchangeStakesAndTokens.errors.memberSellerWalletMismatch',
          ),
        });
        return;
      }
      throw e;
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
          <div className="flex flex-col gap-2">
            <div>{tSpaces('errorOhSnap')}</div>
            {form.formState.errors.root?.message ? (
              <div className="text-destructive text-2">
                {form.formState.errors.root.message}
              </div>
            ) : null}
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
            closeUrl={successfulUrl}
            backUrl={backUrl}
            isLoading={false}
            label={tAgreementFlow('labels.exchange')}
            progress={progress}
          />
          {plugin}
          <Separator />
          <div className="flex justify-end w-full">
            <Button type="submit" disabled={!person?.id || isPending}>
              {tAgreementFlow('buttons.publish')}
            </Button>
          </div>
        </form>
      </Form>
    </SpaceLoadingBackdrop>
  );
};
