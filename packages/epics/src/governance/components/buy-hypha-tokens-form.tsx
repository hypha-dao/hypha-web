'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createAgreementFiles,
  schemaBuyHyphaTokens,
  useMe,
  TOKENS,
  useBuyHyphaTokensOrchestrator,
  useJwt,
  useSpaceDetailsWeb3Rpc,
} from '@hypha-platform/core/client';
import { z } from 'zod';
import { LoadingBackdrop, Form, Separator, Button } from '@hypha-platform/ui';
import { CreateAgreementBaseFields } from '../../agreements';
import { useConfig } from 'wagmi';
import { useAssets, useFundWallet } from '../../treasury';
import React from 'react';
import { useScrollToErrors, useResubmitProposalData } from '../../hooks';
import { useTranslations } from 'next-intl';

const RECIPIENT_SPACE_ADDRESS = '0x3dEf11d005F8C85c93e3374B28fcC69B25a650Af';
const PAYMENT_TOKEN = TOKENS.find((t) => t.symbol === 'USDC');

const conbinedSchemaBuyHyphaTokens = schemaBuyHyphaTokens
  .extend(createAgreementFiles)
  .extend({ buyerWeb3Id: z.number(), buyerWallet: z.string() });
type FormValues = z.infer<typeof conbinedSchemaBuyHyphaTokens>;

interface BuyHyphaTokensFormProps {
  successfulUrl: string;
  backUrl?: string;
  children: React.ReactNode;
  spaceId: number | undefined | null;
  web3SpaceId?: number | null;
}

export const BuyHyphaTokensForm = ({
  successfulUrl,
  backUrl,
  children,
  spaceId,
  web3SpaceId,
}: BuyHyphaTokensFormProps) => {
  const tSpaces = useTranslations('Spaces');
  const tAgreementFlow = useTranslations('AgreementFlow');
  const { person } = useMe();
  const { jwt } = useJwt();
  const config = useConfig();
  const { spaceDetails } = useSpaceDetailsWeb3Rpc({
    spaceId: web3SpaceId as number,
  });
  const { assets } = useAssets({ filter: { type: 'all' } });
  const paymentAsset = assets.find((a) => a.symbol === 'USDC');
  const [insufficientFunds, setInsufficientFunds] = React.useState(false);

  const { fundWallet } = useFundWallet({
    address: spaceDetails?.executor as `0x${string}`,
  });

  const { buyHyphaTokens, reset, currentAction, isError, isPending, progress } =
    useBuyHyphaTokensOrchestrator({ authToken: jwt, config });

  const formRef = React.useRef<HTMLFormElement>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(conbinedSchemaBuyHyphaTokens),
    mode: 'onChange',
    defaultValues: {
      title: '',
      description: '',
      leadImage: undefined,
      attachments: undefined,
      creatorId: person?.id,
      spaceId: spaceId ?? undefined,
      payout: {
        amount: '',
        token: PAYMENT_TOKEN?.address ?? '',
      },
      recipient: RECIPIENT_SPACE_ADDRESS,
      label: 'Buy Hypha Tokens',
    },
  });

  useScrollToErrors(form, formRef);
  const { resubmitKey } = useResubmitProposalData(form, spaceId, person?.id);

  React.useEffect(() => {
    if (spaceDetails?.executor && web3SpaceId) {
      form.setValue('buyerWeb3Id', web3SpaceId as number);
      form.setValue('buyerWallet', spaceDetails.executor as `0x${string}`);
    }
  }, [form, web3SpaceId, spaceDetails]);

  const handleCreate = async (data: FormValues) => {
    if (!web3SpaceId || spaceId === undefined) return;

    const formAmount = parseFloat(data.payout.amount);
    const walletBalance = parseFloat((paymentAsset?.value ?? 0).toString());

    if (formAmount > walletBalance) {
      setInsufficientFunds(true);
      return;
    }

    try {
      await buyHyphaTokens({
        ...data,
        spaceId: spaceId as number,
        web3SpaceId: web3SpaceId,
        payout: {
          amount: data.payout.amount,
          token: data.payout.token,
        },
        recipient: data.recipient,
      });
    } catch (error) {
      console.error('Error creating buy hypha token proposal:', error);
    }
  };

  return (
    <LoadingBackdrop
      showKeepWindowOpenMessage={true}
      fullHeight={true}
      progress={progress}
      isLoading={isPending || insufficientFunds}
      message={
        insufficientFunds ? (
          <div className="flex flex-col text-center gap-2 justify-center items-center">
            <span>
              {tAgreementFlow(
                'buyHyphaTokensForm.insufficientFunds.walletBalanceInsufficient',
              )}
              <br />{' '}
              {tAgreementFlow('buyHyphaTokensForm.insufficientFunds.please')}{' '}
              <span
                onClick={() => {
                  setInsufficientFunds(false);
                  fundWallet();
                }}
                className="font-bold cursor-pointer text-accent-9 underline"
              >
                {tAgreementFlow(
                  'buyHyphaTokensForm.insufficientFunds.topUpWith',
                  {
                    token: paymentAsset?.symbol ?? 'USDC',
                  },
                )}
              </span>{' '}
              {tAgreementFlow('buyHyphaTokensForm.insufficientFunds.toProceed')}
            </span>
            <Button
              className="w-fit"
              onClick={() => {
                setInsufficientFunds(false);
                reset();
              }}
            >
              {tSpaces('reset')}
            </Button>
          </div>
        ) : isError ? (
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
            backLabel={tSpaces('backToSettings')}
            isLoading={false}
            label={tAgreementFlow('labels.buyHyphaTokensRewards')}
            progress={progress}
          />
          {children}
          <Separator />
          <div className="flex justify-end w-full">
            <Button type="submit">{tAgreementFlow('buttons.publish')}</Button>
          </div>
        </form>
      </Form>
    </LoadingBackdrop>
  );
};
