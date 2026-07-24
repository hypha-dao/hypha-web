'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  schemaCreateAgreementForm,
  createAgreementFiles,
  useJwt,
  useMe,
  extractRevertReason,
} from '@hypha-platform/core/client';
import { z } from 'zod';
import { Button, Form, Separator } from '@hypha-platform/ui';
import React from 'react';
import { useCreateRedeemTokensOrchestrator } from '@hypha-platform/core/client';
import { useRouter } from 'next/navigation';
import { SpaceLoadingBackdrop } from '../../spaces/components/space-loading-backdrop';
import { useTranslations } from 'next-intl';
import { useConfig } from 'wagmi';
import {
  useClearResubmitOnSuccess,
  useResubmitProposalData,
  useScrollToErrors,
} from '../../hooks';
import { CreateAgreementBaseFields } from '../../agreements';
import { schemaRedeemTokens } from '../../agreements/plugins/redeem-tokens/validation';
import {
  RedeemSubmitGuardProvider,
  useRedeemSubmitGuard,
} from '../../agreements/plugins/redeem-tokens/submit-guard-context';

const REDEEM_TOKENS_RESUBMIT_SEGMENT = 'redeem-tokens';

const fullSchemaCreateRedeemTokensForm = schemaCreateAgreementForm
  .extend(createAgreementFiles)
  .extend(schemaRedeemTokens.shape);

type FormValues = z.infer<typeof fullSchemaCreateRedeemTokensForm>;

interface CreateRedeemTokensFormProps {
  spaceId: number | undefined | null;
  web3SpaceId: number | undefined | null;
  successfulUrl: string;
  backUrl?: string;
  plugin: React.ReactNode;
}

const CreateRedeemTokensFormInner = ({
  successfulUrl,
  backUrl,
  spaceId,
  web3SpaceId,
  plugin,
}: CreateRedeemTokensFormProps) => {
  const tAgreementFlow = useTranslations('AgreementFlow');
  const { person } = useMe();
  const redeemGuard = useRedeemSubmitGuard();
  const { jwt } = useJwt();
  const config = useConfig();
  const {
    createRedeemTokens,
    reset,
    currentAction,
    isError,
    isPending,
    progress,
  } = useCreateRedeemTokensOrchestrator({ authToken: jwt, config });

  const formRef = React.useRef<HTMLFormElement>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(fullSchemaCreateRedeemTokensForm),
    defaultValues: {
      title: '',
      description: '',
      leadImage: undefined,
      attachments: undefined,
      spaceId: spaceId ?? undefined,
      creatorId: person?.id,
      redemptions: [
        {
          token: '',
          amount: '',
        },
      ],
      conversions: [
        {
          asset: '',
          percentage: '100.00',
        },
      ],
      redemptionVaultWeb3SpaceId: web3SpaceId ?? undefined,
    },
  });

  useScrollToErrors(form, formRef);
  const { resubmitKey } = useResubmitProposalData(
    form,
    spaceId,
    person?.id,
    REDEEM_TOKENS_RESUBMIT_SEGMENT,
  );

  useClearResubmitOnSuccess(progress === 100 && !isError);

  React.useEffect(() => {
    if (person?.id) {
      form.setValue('creatorId', person.id);
    }
  }, [person]);

  const handleCreate = async (data: FormValues) => {
    if (!redeemGuard.canSubmit) {
      form.setError('root', {
        message:
          redeemGuard.blockMessage ??
          'Please fix the redemption amounts before publishing.',
      });
      return;
    }

    if (!data.redemptions || data.redemptions.length === 0) {
      console.error('Redemptions are missing');
      return;
    }

    console.log('redeem-tokens data', {
      ...data,
      spaceId: spaceId as number,
      web3SpaceId: typeof web3SpaceId === 'number' ? web3SpaceId : undefined,
      redemptionVaultWeb3SpaceId:
        typeof data.redemptionVaultWeb3SpaceId === 'number'
          ? data.redemptionVaultWeb3SpaceId
          : typeof web3SpaceId === 'number'
          ? web3SpaceId
          : undefined,
      redemptions: data.redemptions.map(({ amount, token }) => ({
        amount: amount ?? '0',
        token: token ?? '',
      })),
      conversions: data.conversions.map(({ asset, percentage }) => ({
        asset: asset ?? '',
        percentage: percentage ?? '0',
      })),
    });

    const proposalWeb3SpaceId = web3SpaceId;

    if (proposalWeb3SpaceId == null) {
      form.setError('root', {
        message:
          'This space is not configured on-chain yet, so redeem proposals cannot be created.',
      });
      return;
    }

    const redemptionVaultWeb3SpaceId =
      typeof data.redemptionVaultWeb3SpaceId === 'number'
        ? data.redemptionVaultWeb3SpaceId
        : proposalWeb3SpaceId;

    const [redemption] = data.redemptions;
    if (!redemption) {
      console.error('Redemption is missing');
      return;
    }

    try {
      await createRedeemTokens({
        ...data,
        spaceId: spaceId as number,
        web3SpaceId: proposalWeb3SpaceId,
        redemption: {
          amount: redemption.amount ?? '0',
          token: redemption.token ?? '',
          vaultWeb3SpaceId: redemptionVaultWeb3SpaceId,
        },
        conversions: data.conversions.map(({ asset, percentage }) => ({
          asset: asset ?? '',
          percentage: percentage ?? '0',
        })),
        label: 'Redeem Tokens',
      });
    } catch (error) {
      console.error('Redeem tokens failed:', error);
      let errorMessage: string =
        'An error occurred while processing your redeem tokens. Please try again.';

      if (error instanceof Error) {
        if (error.message.includes('Execution reverted with reason:')) {
          const match = error.message.match(
            /Execution reverted with reason: (.*?)\./,
          );
          errorMessage =
            match && match[1]
              ? extractRevertReason(match[1])
              : 'Contract execution failed.';
        }

        console.error(errorMessage);
      }

      form.setError('root', { message: errorMessage });
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
          <div className="flex flex-col">
            <div>{tAgreementFlow('loadingBackdrop.errorTitle')}</div>
            {form.formState.errors.root?.message && (
              <div className="text-destructive">
                {form.formState.errors.root.message}
              </div>
            )}
            <Button onClick={reset}>
              {tAgreementFlow('loadingBackdrop.resetButton')}
            </Button>
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
            label={tAgreementFlow('documentBadges.redeemTokens')}
            progress={progress}
          />
          {React.isValidElement(plugin)
            ? React.cloneElement(
                plugin as React.ReactElement<{ resubmitKey?: number }>,
                { resubmitKey },
              )
            : plugin}
          <Separator />
          <div className="flex justify-end w-full">
            <Button type="submit" disabled={web3SpaceId == null}>
              {tAgreementFlow('buttons.publish')}
            </Button>
          </div>
        </form>
      </Form>
    </SpaceLoadingBackdrop>
  );
};

export const CreateRedeemTokensForm = (props: CreateRedeemTokensFormProps) => (
  <RedeemSubmitGuardProvider>
    <CreateRedeemTokensFormInner {...props} />
  </RedeemSubmitGuardProvider>
);
