'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  schemaSpaceTokenPurchase,
  createAgreementFiles,
  useMe,
  useJwt,
  useSpaceTokenPurchaseOrchestrator,
} from '@hypha-platform/core/client';
import { z } from 'zod';
import { Button, Form, Separator } from '@hypha-platform/ui';
import React from 'react';
import { LoadingBackdrop } from '@hypha-platform/ui/server';
import { useRouter } from 'next/navigation';
import { useScrollToErrors, useResubmitProposalData } from '../../hooks';
import { CreateAgreementBaseFields } from '../../agreements';

type FormValues = z.infer<typeof schemaSpaceTokenPurchase>;

const fullSchemaSpaceTokenPurchase = schemaSpaceTokenPurchase
  .extend({ label: z.string().optional() })
  .extend(createAgreementFiles);

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
  plugin,
}: SpaceTokenPurchaseFormProps) => {
  const router = useRouter();
  const { person } = useMe();
  const { jwt } = useJwt();
  const {
    createSpaceTokenPurchase,
    reset,
    currentAction,
    isError,
    isPending,
    progress,
  } = useSpaceTokenPurchaseOrchestrator({ authToken: jwt });

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
      label: 'Token Purchase',
      tokenAddress: '',
      activatePurchase: false,
      purchasePrice: undefined,
      purchaseCurrency: undefined,
      tokensAvailableForPurchase: undefined,
    },
    mode: 'onChange',
  });

  useScrollToErrors(form, formRef);
  const { resubmitKey } = useResubmitProposalData(form, spaceId, person?.id);

  const handleCreate = async (data: FormValues) => {
    setFormError(null);
    try {
      await createSpaceTokenPurchase({
        ...data,
        spaceId: spaceId as number,
        label: 'Token Purchase',
      });
      router.push(successfulUrl);
    } catch {
      setFormError('Something went wrong. Please try again.');
    }
  };

  return (
    <LoadingBackdrop
      showKeepWindowOpenMessage={true}
      fullHeight={true}
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
            closeUrl={closeUrl || successfulUrl}
            backUrl={backUrl}
            backLabel="Back to settings"
            isLoading={false}
            label="Token Purchase"
            progress={progress}
          />
          {plugin}
          <Separator />
          <div className="flex flex-col gap-2">
            {formError && (
              <div className="text-error-11 text-2 font-medium">
                {formError}
              </div>
            )}
            <div className="flex justify-end w-full">
              <Button type="submit">Publish</Button>
            </div>
          </div>
        </form>
      </Form>
    </LoadingBackdrop>
  );
};
