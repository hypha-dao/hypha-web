'use client';

import {
  Address,
  createAgreementFiles,
  EntryMethodType,
  schemaChangeEntryMethod,
  useChangeEntryMethodOrchestrator,
  useJwt,
  useMe,
  useSpaceDetailsWeb3Rpc,
  type Space,
} from '@hypha-platform/core/client';
import { SpaceLoadingBackdrop } from '../../spaces/components/space-loading-backdrop';
import { useForm } from 'react-hook-form';
import { useConfig } from 'wagmi';
import { z } from 'zod';
import { Button, Form, Separator } from '@hypha-platform/ui';
import React from 'react';
import { useRouter } from 'next/navigation';
import { useSpaceTokenRequirementsByAddress } from '../hooks';
import { CreateAgreementBaseFields } from '../../agreements';
import {
  useClearResubmitOnSuccess,
  useResubmitProposalData,
  useProposalFormSectionFocus,
  useScrollToErrors,
} from '../../hooks';
import { useTranslations } from 'next-intl';
import { useLocalizedProposalResolver } from '../hooks/use-localized-proposal-resolver';
import { hasResubmitDataForTemplate } from '../../utils/resubmit-proposal-template';

const ENTRY_RESUBMIT_SEGMENT = 'change-entry-method';

const schemaCreateProposalChangeEntryMethod =
  schemaChangeEntryMethod.extend(createAgreementFiles);

type FormValues = z.infer<typeof schemaCreateProposalChangeEntryMethod>;

interface CreateProposalChangeEntryMethodFormProps {
  spaceId: number | undefined | null;
  web3SpaceId: number | undefined | null;
  successfulUrl: string;
  backUrl?: string;
  plugin: React.ReactNode;
  spaces: Space[];
}

const ENTRY_METHODS = [
  EntryMethodType.OPEN_ACCESS,
  EntryMethodType.TOKEN_BASED,
  EntryMethodType.INVITE_ONLY,
];

export const CreateProposalChangeEntryMethodForm = ({
  successfulUrl,
  backUrl,
  spaceId,
  web3SpaceId,
  plugin,
  spaces,
}: CreateProposalChangeEntryMethodFormProps) => {
  const tSpaces = useTranslations('Spaces');
  const tAgreementFlow = useTranslations('AgreementFlow');
  const router = useRouter();
  const { person } = useMe();
  const { jwt } = useJwt();
  const config = useConfig();
  const { spaceDetails, isLoading } = useSpaceDetailsWeb3Rpc({
    spaceId: web3SpaceId as number,
  });

  const { requiredToken, requiredAmount } = useSpaceTokenRequirementsByAddress({
    spaceAddress: spaceDetails?.executor,
    spaces,
  });

  const skipLiveEntrySyncForResubmit = React.useMemo(
    () => hasResubmitDataForTemplate(ENTRY_RESUBMIT_SEGMENT),
    [],
  );

  const {
    createChangeEntryMethod,
    reset,
    currentAction,
    isError,
    isPending,
    progress,
  } = useChangeEntryMethodOrchestrator({ authToken: jwt, config });
  const resolver = useLocalizedProposalResolver(
    schemaCreateProposalChangeEntryMethod,
    tAgreementFlow,
  );

  const defaultValues = React.useMemo(() => {
    if (skipLiveEntrySyncForResubmit) {
      return {
        title: '',
        description: '',
        leadImage: undefined,
        attachments: undefined,
        spaceId: spaceId ?? undefined,
        creatorId: person?.id,
        entryMethod: EntryMethodType.OPEN_ACCESS,
        tokenBase: undefined,
        label: 'Entry Method',
      };
    }
    return {
      title: '',
      description: '',
      leadImage: undefined,
      attachments: undefined,
      spaceId: spaceId ?? undefined,
      creatorId: person?.id,
      entryMethod: spaceDetails
        ? (Number(spaceDetails.joinMethod) as EntryMethodType)
        : EntryMethodType.OPEN_ACCESS,
      tokenBase: undefined,
      label: 'Entry Method',
    };
  }, [spaceId, person, spaceDetails, skipLiveEntrySyncForResubmit]);

  const formRef = React.useRef<HTMLFormElement>(null);
  const form = useForm<FormValues>({
    resolver,
    defaultValues: defaultValues,
  });

  useScrollToErrors(form, formRef);
  useProposalFormSectionFocus();
  const { resubmitKey } = useResubmitProposalData(
    form,
    spaceId,
    person?.id,
    ENTRY_RESUBMIT_SEGMENT,
  );

  useClearResubmitOnSuccess(progress === 100 && !isError);

  const hasNavigatedAfterSuccessRef = React.useRef(false);
  React.useEffect(() => {
    if (progress < 100 || isError || !successfulUrl) return;
    if (hasNavigatedAfterSuccessRef.current) return;
    hasNavigatedAfterSuccessRef.current = true;
    router.push(successfulUrl);
  }, [progress, isError, successfulUrl, router]);

  React.useEffect(() => {
    if (skipLiveEntrySyncForResubmit) {
      return;
    }
    if (spaceDetails && !isLoading) {
      const entryMethod =
        spaceDetails?.joinMethod ?? EntryMethodType.OPEN_ACCESS;
      form.setValue('entryMethod', Number(entryMethod));
    }
  }, [spaceDetails, isLoading, form, skipLiveEntrySyncForResubmit]);

  React.useEffect(() => {
    if (skipLiveEntrySyncForResubmit) {
      return;
    }
    if (requiredToken) {
      const tokenBase = requiredToken
        ? {
            amount: requiredAmount as number,
            token: requiredToken?.address as string,
          }
        : undefined;
      form.setValue('tokenBase', tokenBase);
    }
  }, [requiredToken, requiredAmount, form, skipLiveEntrySyncForResubmit]);

  const handleCreate = async (data: FormValues) => {
    if (
      !web3SpaceId ||
      spaceId === undefined ||
      !ENTRY_METHODS.includes(data.entryMethod)
    )
      return;

    try {
      await createChangeEntryMethod({
        ...data,
        spaceId: spaceId as number,
        web3SpaceId: web3SpaceId,
        entryMethod: data.entryMethod,
        tokenBase: data.tokenBase
          ? {
              amount: data.tokenBase.amount,
              token: data.tokenBase.token as Address,
            }
          : undefined,
      });
    } catch (error) {
      console.error('Error creating change entry method proposal:', error);
    }
  };

  const onInvalid = async (err: any) => {
    console.log('Invalid form:', err);
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
          onSubmit={form.handleSubmit(handleCreate, onInvalid)}
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
              backUrl={backUrl}
              backLabel={tSpaces('backToSettings')}
              closeUrl={successfulUrl}
              isLoading={false}
              label={tAgreementFlow('labels.entryMethod')}
              progress={progress}
            />
          </div>
          <div data-proposal-section="entry_method">{plugin}</div>
          <Separator />
          <div className="flex justify-end w-full">
            <Button
              type="submit"
              disabled={isPending || isLoading || progress === 100}
            >
              {tAgreementFlow('buttons.publish')}
            </Button>
          </div>
        </form>
      </Form>
    </SpaceLoadingBackdrop>
  );
};
