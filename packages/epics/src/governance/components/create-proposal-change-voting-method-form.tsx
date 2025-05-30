'use client';

import { CreateAgreementBaseFields } from '@hypha-platform/epics';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  schemaChangeVotingMethod,
  createAgreementFiles,
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

type FormValues = z.infer<typeof schemaChangeVotingMethod>;

const schemaCreateProposalChangeVotingMethod =
  schemaChangeVotingMethod.extend(createAgreementFiles);

interface CreateProposalChangeVotingMethodFormProps {
  spaceId: number | undefined | null;
  web3SpaceId: number | undefined | null;
  successfulUrl: string;
  plugin: React.ReactNode;
}

export const CreateProposalChangeVotingMethodForm = ({
  successfulUrl,
  spaceId,
  web3SpaceId,
  plugin,
}: CreateProposalChangeVotingMethodFormProps) => {
  const router = useRouter();
  const { person } = useMe();
  const { jwt } = useJwt();
  const config = useConfig();

  const { spaceDetails } = useSpaceDetailsWeb3Rpc({
    spaceId: spaceId as number,
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
        quorum: Number(spaceDetails?.quorum),
        unity: Number(spaceDetails?.unity),
      },
      votingMethod: undefined,
    },
  });

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

  return (
    <LoadingBackdrop
      progress={progress}
      isLoading={isPending}
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
            isLoading={false}
          />
          {plugin}
          <Separator />
          <div className="flex justify-end w-full">
            <Button type="submit">Publish</Button>
          </div>
        </form>
      </Form>
    </LoadingBackdrop>
  );
};
