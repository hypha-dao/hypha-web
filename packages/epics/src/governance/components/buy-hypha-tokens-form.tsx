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
} from '@hypha-platform/core/client';
import { z } from 'zod';
import { LoadingBackdrop, Form, Separator, Button } from '@hypha-platform/ui';
import { CreateAgreementBaseFields } from '../../agreements';
import { useConfig } from 'wagmi';
import { useRouter } from 'next/navigation';
import React from 'react';

const RECIPIENT_SPACE_ADDRESS = '0x3dEf11d005F8C85c93e3374B28fcC69B25a650Af';
const PAYMENT_TOKEN = TOKENS.find((t) => t.symbol === 'USDC');

const conbinedSchemaBuyHyphaTokens =
  schemaBuyHyphaTokens.extend(createAgreementFiles);
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
  const { person } = useMe();
  const { jwt } = useJwt();
  const config = useConfig();
  const router = useRouter();

  const {
    buyHyphaTokens,
    reset,
    currentAction,
    isError,
    isPending,
    progress,
    agreement: { slug: agreementSlug },
  } = useBuyHyphaTokensOrchestrator({ authToken: jwt, config });

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

  React.useEffect(() => {
    if (progress === 100 && agreementSlug) {
      router.push(successfulUrl);
    }
  }, [progress, agreementSlug]);

  const handleCreate = async (data: FormValues) => {
    if (!web3SpaceId || spaceId === undefined) return;

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
      progress={progress}
      isLoading={isPending}
      className="-m-4 lg:-m-7"
      message={
        isError ? (
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
            label="Buy Hypha Tokens (Rewards)"
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
