'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  schemaSpaceTokenPurchaseObject,
  refineSpaceTokenPurchaseWhenActive,
  useMe,
  useJwt,
  useSpaceTokenPurchaseOrchestrator,
} from '@hypha-platform/core/client';
import { z } from 'zod';
import { Button, Form, Separator } from '@hypha-platform/ui';
import React from 'react';
import { SpaceLoadingBackdrop } from '../../spaces/components/space-loading-backdrop';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  clearResubmitProposalSessionStorage,
  useClearResubmitOnSuccess,
  useResubmitProposalData,
  useScrollToErrors,
} from '../../hooks';
import { CreateAgreementBaseFields } from '../../agreements';
import { useConfig } from 'wagmi';

const STP_RESUBMIT_SEGMENT = 'space-token-purchase';

const fullSchemaSpaceTokenPurchase = schemaSpaceTokenPurchaseObject
  .extend({ label: z.string().optional() })
  .superRefine(refineSpaceTokenPurchaseWhenActive);

type FormValues = z.infer<typeof fullSchemaSpaceTokenPurchase>;

interface SpaceTokenPurchaseFormProps {
  spaceId: number | undefined | null;
  web3SpaceId: number | undefined | null;
  successfulUrl: string;
  backUrl?: string;
  closeUrl?: string;
  plugin: React.ReactNode;
}

export const SpaceTokenPurchaseForm = ({
  successfulUrl,
  backUrl,
  closeUrl,
  spaceId,
  web3SpaceId,
  plugin,
}: SpaceTokenPurchaseFormProps) => {
  const router = useRouter();
  const tSpaces = useTranslations('Spaces');
  const tAgreementFlow = useTranslations('AgreementFlow');
  const { person } = useMe();
  const { jwt } = useJwt();
  const config = useConfig();
  const {
    createSpaceTokenPurchase,
    reset,
    currentTask,
    isError,
    isPending,
    progress,
  } = useSpaceTokenPurchaseOrchestrator({ authToken: jwt, config });

  const progressMessage =
    currentTask != null
      ? tAgreementFlow(`spaceTokenPurchaseProgress.${currentTask}`)
      : null;

  const [formError, setFormError] = React.useState<string | null>(null);

  const formRef = React.useRef<HTMLFormElement>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(fullSchemaSpaceTokenPurchase),
    defaultValues: {
      title: '',
      description: '',
      leadImage: undefined,
      attachments: undefined,
      spaceId: spaceId ?? undefined,
      creatorId: person?.id,
      label: '',
      tokenAddress: '',
      activatePurchase: false,
      purchasePrice: undefined,
      purchaseCurrency: undefined,
      tokensAvailableForPurchase: undefined,
    },
    mode: 'onChange',
  });

  useScrollToErrors(form, formRef);
  const { resubmitKey } = useResubmitProposalData(
    form,
    spaceId,
    person?.id,
    STP_RESUBMIT_SEGMENT,
  );

  useClearResubmitOnSuccess(progress === 100 && !isError);

  React.useEffect(() => {
    const proposalLabel = tAgreementFlow('labels.spaceTokenPurchase');
    form.setValue('label', proposalLabel, { shouldDirty: false });
  }, [form, tAgreementFlow]);

  const handleCreate = async (data: FormValues) => {
    setFormError(null);
    try {
      await createSpaceTokenPurchase({
        ...data,
        spaceId: spaceId as number,
        web3SpaceId: web3SpaceId ?? undefined,
        label: tAgreementFlow('labels.spaceTokenPurchase'),
      });
      clearResubmitProposalSessionStorage();
      router.push(successfulUrl);
    } catch {
      setFormError(tAgreementFlow('proposalLoader.tryAgainGeneric'));
    }
  };

  const handleInvalid = () => {
    void form.trigger();
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
          <div>{progressMessage}</div>
        )
      }
    >
      <Form {...form}>
        <form
          ref={formRef}
          onSubmit={form.handleSubmit(handleCreate, handleInvalid)}
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
            label={tAgreementFlow('labels.spaceTokenPurchase')}
            progress={progress}
          />
          {React.isValidElement(plugin)
            ? React.cloneElement(
                plugin as React.ReactElement<{ resubmitKey?: number }>,
                { resubmitKey },
              )
            : plugin}
          <Separator />
          <div className="flex flex-col gap-2">
            {formError && (
              <div className="text-error-11 text-2 font-medium">
                {formError}
              </div>
            )}
            <div className="flex justify-end w-full">
              <Button type="submit">{tAgreementFlow('buttons.publish')}</Button>
            </div>
          </div>
        </form>
      </Form>
    </SpaceLoadingBackdrop>
  );
};
