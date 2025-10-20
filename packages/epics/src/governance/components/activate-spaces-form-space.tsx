'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createAgreementFiles,
  schemaActivateSpaces,
  useMe,
  TOKENS,
  useActivateSpacesOrchestrator,
  useJwt,
  useSpaceDetailsWeb3Rpc,
} from '@hypha-platform/core/client';
import { z } from 'zod';
import { LoadingBackdrop, Form, Separator, Button } from '@hypha-platform/ui';
import { CreateAgreementBaseFields } from '../../agreements';
import { useConfig } from 'wagmi';
import { useRouter, useParams } from 'next/navigation';
import { useAssets, useFundWallet } from '../../treasury';
import React from 'react';
import Link from 'next/link';
import { useActivateSpaces } from '../../people/hooks/use-activate-hypha-spaces';
import { isAddress } from 'ethers';

const RECIPIENT_SPACE_ADDRESS = '0x695f21B04B22609c4ab9e5886EB0F65cDBd464B6';
const PAYMENT_TOKEN = TOKENS.find((t) => t.symbol === 'USDC');

const combinedSchemaActivateSpaces = schemaActivateSpaces
  .extend(createAgreementFiles)
  .extend({
    buyerWeb3Id: z.number().optional(),
    buyerWallet: z
      .string()
      .refine(isAddress, { message: 'Invalid wallet address' })
      .optional(),
  });
type FormValues = z.infer<typeof combinedSchemaActivateSpaces>;

interface ActivateSpacesFormProps {
  successfulUrl: string;
  backUrl?: string;
  children: React.ReactNode;
  spaceId: number | undefined | null;
  web3SpaceId?: number | null;
}

export const ActivateSpacesFormSpace = ({
  successfulUrl,
  backUrl,
  children,
  spaceId,
  web3SpaceId,
}: ActivateSpacesFormProps) => {
  const { person } = useMe();
  const { jwt } = useJwt();
  const config = useConfig();
  const router = useRouter();
  const { lang, id: spaceSlug } = useParams<{ lang: string; id: string }>();
  const { spaceDetails } = useSpaceDetailsWeb3Rpc({
    spaceId: web3SpaceId as number,
  });
  const { assets } = useAssets({ filter: { type: 'all' } });
  const paymentAsset = assets.find(
    (a) => a.symbol === 'USDC' || a.symbol === 'HYPHA',
  );
  const [insufficientFunds, setInsufficientFunds] = React.useState(false);
  const [paymentTokenForTopUp, setPaymentTokenForTopUp] = React.useState('');

  const { fundWallet } = useFundWallet({
    address: spaceDetails?.executor as `0x${string}`,
  });

  const {
    activateSpaces,
    reset,
    currentAction,
    isError,
    isPending,
    progress,
    agreement: { slug: agreementSlug },
  } = useActivateSpacesOrchestrator({ authToken: jwt, config });

  const form = useForm<FormValues>({
    resolver: zodResolver(combinedSchemaActivateSpaces),
    mode: 'onChange',
    defaultValues: {
      title: '',
      description: '',
      leadImage: undefined,
      attachments: undefined,
      creatorId: person?.id,
      spaceId: spaceId ?? undefined,
      spaces: [{ spaceId: 0, months: 0 }],
      paymentToken: 'HYPHA',
      recipient: RECIPIENT_SPACE_ADDRESS,
      label: 'Activate Spaces',
    },
  });

  React.useEffect(() => {
    if (spaceDetails?.executor && web3SpaceId) {
      const currentBuyerWeb3Id = form.getValues('buyerWeb3Id');
      const currentBuyerWallet = form.getValues('buyerWallet');

      if (currentBuyerWeb3Id !== web3SpaceId) {
        form.setValue('buyerWeb3Id', web3SpaceId);
      }
      if (currentBuyerWallet !== spaceDetails.executor) {
        form.setValue('buyerWallet', spaceDetails.executor);
      }
    }
  }, [web3SpaceId, spaceDetails?.executor]);

  const { totalUSDC, totalHYPHA } = useActivateSpaces({
    spaces: form.watch('spaces'),
    paymentToken: form.watch('paymentToken'),
  });

  const watchedPaymentToken = form.watch('paymentToken');
  const total = watchedPaymentToken === 'USDC' ? totalUSDC : totalHYPHA;

  React.useEffect(() => {
    if (progress === 100 && agreementSlug) {
      router.push(successfulUrl);
    }
  }, [progress, agreementSlug, router, successfulUrl]);

  const handleCreate = async (data: FormValues) => {
    if (!web3SpaceId || spaceId === undefined) return;

    const walletBalance = parseFloat((paymentAsset?.value ?? 0).toString());

    if (total > walletBalance) {
      setInsufficientFunds(true);
      setPaymentTokenForTopUp(watchedPaymentToken);
      return;
    }

    try {
      await activateSpaces({
        ...data,
        spaceId: spaceId as number,
        web3SpaceId: web3SpaceId,
        spaces: data.spaces,
        paymentToken: data.paymentToken,
        recipient: data.recipient,
      });
    } catch (error) {
      console.error('Error creating activate spaces proposal:', error);
    }
  };

  return (
    <LoadingBackdrop
      progress={progress}
      isLoading={isPending || insufficientFunds}
      className="-m-4 lg:-m-7"
      message={
        insufficientFunds ? (
          <div className="flex flex-col text-center gap-2 justify-center items-center">
            <span>
              Space wallet balance is insufficient to complete this transaction.
              <br /> Please{' '}
              {paymentTokenForTopUp === 'USDC' ? (
                <span
                  onClick={() => {
                    setInsufficientFunds(false);
                    fundWallet();
                  }}
                  className="font-bold cursor-pointer text-accent-9 underline"
                >
                  top up your account with {paymentTokenForTopUp}
                </span>
              ) : (
                <Link
                  href={`/${lang}/dho/${spaceSlug}/agreements/create/buy-hypha-tokens`}
                  className="font-bold cursor-pointer text-accent-9 underline"
                >
                  buy Hypha tokens
                </Link>
              )}{' '}
              to proceed.
            </span>
            <Button
              className="w-fit"
              onClick={() => {
                setInsufficientFunds(false);
                reset();
              }}
            >
              Reset
            </Button>
          </div>
        ) : isError ? (
          <div className="flex flex-col">
            <div>Ouh Snap. There was an error</div>
            <Button onClick={reset}>Reset</Button>
          </div>
        ) : (
          <div>{currentAction}</div>
        )
      }
    >
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleCreate)}
          className="flex flex-col gap-5"
        >
          <CreateAgreementBaseFields
            creator={{
              avatar: person?.avatarUrl || '',
              name: person?.name || '',
              surname: person?.surname || '',
            }}
            closeUrl={successfulUrl}
            backUrl={backUrl}
            backLabel="Back to Settings"
            isLoading={false}
            label="Activate Spaces"
          />
          {children}
          <Separator />
          <div className="flex justify-end w-full">
            <Button type="submit">Publish</Button>
          </div>
        </form>
      </Form>
    </LoadingBackdrop>
  );
};
