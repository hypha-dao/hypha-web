'use client';

import { CreateAgreementBaseFields } from '../../agreements/components';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  schemaCreateProposalChangeVotingMethod,
  useMe,
  useCreateChangeVotingMethodOrchestrator,
} from '@hypha-platform/core/client';
import { z } from 'zod';
import { Button, Form, Separator } from '@hypha-platform/ui';
import React from 'react';
import { useJwt } from '@hypha-platform/core/client';
import { useConfig } from 'wagmi';
import { LoadingBackdrop } from '@hypha-platform/ui/server';
import { useRouter } from 'next/navigation';
import { useSpaceDetailsWeb3Rpc } from '@hypha-platform/core/client';

type FormValues = z.infer<typeof schemaCreateProposalChangeVotingMethod>;

interface CreateProposalChangeVotingMethodFormProps {
  spaceId: number | undefined | null;
  web3SpaceId?: number | null;
  successfulUrl: string;
  backUrl?: string;
  plugin: React.ReactNode;
}

export const CreateProposalChangeVotingMethodForm = ({
  successfulUrl,
  backUrl,
  spaceId,
  web3SpaceId,
  plugin,
}: CreateProposalChangeVotingMethodFormProps) => {
  const router = useRouter();
  const { person } = useMe();
  const { jwt } = useJwt();
  const config = useConfig();

  const { spaceDetails, isLoading } = useSpaceDetailsWeb3Rpc({
    spaceId: web3SpaceId as number,
  });
  const {
    createChangeVotingMethod,
    reset,
    currentAction,
    isError,
    isPending,
    progress,
    agreement: { slug: agreementSlug },
  } = useCreateChangeVotingMethodOrchestrator({ authToken: jwt, config });

  const form = useForm<FormValues>({
    resolver: zodResolver(schemaCreateProposalChangeVotingMethod),
    defaultValues: {
      title: '',
      description: '',
      leadImage: undefined,
      attachments: undefined,
      spaceId: spaceId ?? undefined,
      creatorId: person?.id,
      members: [],
      token: undefined as `0x${string}` | undefined,
      quorumAndUnity: {
        quorum: 0,
        unity: 0,
      },
      votingMethod: undefined,
      label: 'Voting Method',
      votingDuration: undefined,
    },
    mode: 'onChange',
  });

  const { quorum = 0, unity = 0 } = form.watch('quorumAndUnity') ?? {};

  const getVotingMethod = (
    votingPowerSource: number | undefined,
  ): FormValues['votingMethod'] => {
    const votingMethodMap: Record<number, FormValues['votingMethod']> = {
      1: '1t1v',
      2: '1m1v',
      3: '1v1v',
    };
    return votingPowerSource ? votingMethodMap[votingPowerSource] : undefined;
  };

  React.useEffect(() => {
    if (spaceDetails && !isLoading) {
      const quorum = Number(spaceDetails.quorum ?? 0);
      const unity = Number(spaceDetails.unity ?? 0);
      const votingMethod = getVotingMethod(
        Number(spaceDetails.votingPowerSource ?? 0),
      );

      form.setValue('quorumAndUnity.quorum', quorum);
      form.setValue('quorumAndUnity.unity', unity);
      form.setValue('votingMethod', votingMethod);
    }
  }, [spaceDetails, isLoading]);

  const handleCreate = async (data: FormValues) => {
    if (!web3SpaceId || !data.votingMethod) return;

    try {
      await createChangeVotingMethod({
        ...data,
        spaceId: spaceId as number,
        web3SpaceId: web3SpaceId,
        members: data.members ?? [],
        token: data.token?.startsWith('0x')
          ? (data.token as `0x${string}`)
          : undefined,
        quorumAndUnity: {
          quorum: BigInt(data.quorumAndUnity?.quorum ?? 0),
          unity: BigInt(data.quorumAndUnity?.unity ?? 0),
        },
        votingMethod: data.votingMethod,
        votingDuration: data.votingDuration,
      });
    } catch (error) {
      console.error('Error creating change voting method proposal:', error);
    }
  };

  React.useEffect(() => {
    if (progress === 100 && agreementSlug) {
      router.push(successfulUrl);
    }
  }, [progress, agreementSlug, router, successfulUrl]);

  const isButtonDisabled = quorum === 0 && unity === 0;

  return (
    <LoadingBackdrop
      progress={progress}
      isLoading={isPending || isLoading}
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
            label="Voting Method"
          />
          {plugin}
          <Separator />
          <div className="flex justify-end w-full">
            <Button type="submit" disabled={isButtonDisabled}>
              Publish
            </Button>
          </div>
        </form>
      </Form>
    </LoadingBackdrop>
  );
};
