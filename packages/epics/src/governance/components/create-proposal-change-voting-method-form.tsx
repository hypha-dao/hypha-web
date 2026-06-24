'use client';

import { CreateAgreementBaseFields } from '../../agreements/components';
import { useForm } from 'react-hook-form';
import {
  schemaCreateProposalChangeVotingMethod,
  useMe,
  useCreateChangeVotingMethodOrchestrator,
  useTokensVotingPower,
  useJwt,
  useSpaceDetailsWeb3Rpc,
} from '@hypha-platform/core/client';
import { z } from 'zod';
import { Button, Form, Separator } from '@hypha-platform/ui';
import React from 'react';
import { useRouter } from 'next/navigation';
import { useConfig } from 'wagmi';
import { SpaceLoadingBackdrop } from '../../spaces/components/space-loading-backdrop';
import { VOTING_METHOD_TYPES } from '../hooks';
import {
  useClearResubmitOnSuccess,
  useProposalFormSectionFocus,
  useResubmitProposalData,
  useScrollToErrors,
} from '../../hooks';
import { useTranslations } from 'next-intl';
import { useLocalizedProposalResolver } from '../hooks/use-localized-proposal-resolver';
import { getResubmitPayloadForTemplate } from '../../utils/resubmit-proposal-template';

const VOTING_RESUBMIT_SEGMENT = 'change-voting-method';

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
  const tSpaces = useTranslations('Spaces');
  const tAgreementFlow = useTranslations('AgreementFlow');
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
  } = useCreateChangeVotingMethodOrchestrator({ authToken: jwt, config });
  const resolver = useLocalizedProposalResolver(
    schemaCreateProposalChangeVotingMethod,
    tAgreementFlow,
  );
  const { votingPowerToken, voicePowerToken } = useTokensVotingPower({
    spaceId: BigInt(web3SpaceId as number),
  });

  /** Re-read each render so first paint after sessionStorage write still skips live sync. */
  const resubmitPayload = getResubmitPayloadForTemplate(
    VOTING_RESUBMIT_SEGMENT,
  );
  const skipVotingMethodChainSync =
    resubmitPayload?.votingMethod !== undefined &&
    resubmitPayload.votingMethod !== null;
  const skipQuorumUnityChainSync =
    resubmitPayload?.quorumAndUnity !== undefined &&
    resubmitPayload.quorumAndUnity !== null;

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
      members: [],
      token: '',
      quorumAndUnity: {
        quorum: 0,
        unity: 0,
      },
      votingMethod: undefined,
      label: 'Voting Method',
      votingDuration: undefined,
      autoExecution: true,
    },
    mode: 'onChange',
  });

  useScrollToErrors(form, formRef);
  useProposalFormSectionFocus();
  const { resubmitKey } = useResubmitProposalData(
    form,
    spaceId,
    person?.id,
    VOTING_RESUBMIT_SEGMENT,
  );

  useClearResubmitOnSuccess(progress === 100 && !isError);

  const hasNavigatedAfterSuccessRef = React.useRef(false);
  React.useEffect(() => {
    if (progress < 100 || isError || !successfulUrl) return;
    if (hasNavigatedAfterSuccessRef.current) return;
    hasNavigatedAfterSuccessRef.current = true;
    router.push(successfulUrl);
  }, [progress, isError, successfulUrl, router]);

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

      if (!skipQuorumUnityChainSync) {
        form.setValue('quorumAndUnity.quorum', quorum);
        form.setValue('quorumAndUnity.unity', unity);
      }

      if (!skipVotingMethodChainSync) {
        const votingMethod = getVotingMethod(
          Number(spaceDetails.votingPowerSource ?? 0),
        );
        form.setValue('votingMethod', votingMethod);

        if (votingMethod === VOTING_METHOD_TYPES[1]) {
          form.setValue('token', votingPowerToken);
        } else if (votingMethod === VOTING_METHOD_TYPES[3]) {
          form.setValue('token', voicePowerToken);
        }
      }
    }
  }, [
    spaceDetails,
    isLoading,
    votingPowerToken,
    voicePowerToken,
    form,
    skipVotingMethodChainSync,
    skipQuorumUnityChainSync,
  ]);

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

  const isButtonDisabled = quorum === 0 && unity === 0;

  return (
    <SpaceLoadingBackdrop
      showKeepWindowOpenMessage={true}
      keepWindowOpenMessage={tAgreementFlow('loadingBackdrop.keepWindowOpen')}
      fullHeight={true}
      progress={progress}
      isLoading={isPending || isLoading}
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
          onSubmit={form.handleSubmit(handleCreate)}
          className="flex flex-col gap-5"
        >
          <div data-proposal-section="basics">
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
              label={tAgreementFlow('labels.votingMethod')}
              progress={progress}
            />
          </div>
          <div data-proposal-section="voting_method">
            {React.isValidElement(plugin)
              ? React.cloneElement(
                  plugin as React.ReactElement<{ resubmitKey?: number }>,
                  { resubmitKey },
                )
              : plugin}
          </div>
          <Separator />
          <div
            className="flex justify-end w-full"
            data-proposal-section="publish"
          >
            <Button type="submit" disabled={isButtonDisabled}>
              {tAgreementFlow('buttons.publish')}
            </Button>
          </div>
        </form>
      </Form>
    </SpaceLoadingBackdrop>
  );
};
