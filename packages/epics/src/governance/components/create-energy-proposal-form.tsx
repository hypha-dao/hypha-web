'use client';

import React from 'react';
import { DefaultValues, useForm, UseFormReturn } from 'react-hook-form';
import { z, ZodType } from 'zod';
import { useConfig } from 'wagmi';
import { Button, Form, Separator } from '@hypha-platform/ui';
import {
  createAgreementFiles,
  schemaCreateAgreementForm,
  useCreateAgreementOrchestrator,
  useJwt,
  useMe,
} from '@hypha-platform/core/client';
import { CreateAgreementBaseFields } from '../../agreements';
import {
  useClearResubmitOnSuccess,
  useResubmitProposalData,
  useScrollToErrors,
} from '../../hooks';
import { SpaceLoadingBackdrop } from '../../spaces/components/space-loading-backdrop';
import { useLocalizedProposalResolver } from '../hooks/use-localized-proposal-resolver';
import { appendEnergyProposalMarker } from '../utils/energy-proposal-markers';
import { useTranslations } from 'next-intl';

const fullSchema = schemaCreateAgreementForm.extend(createAgreementFiles);

export type EnergyProposalBaseFields = z.infer<typeof fullSchema>;

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type ProposalExtraTransaction = {
  target: `0x${string}`;
  value?: bigint | number;
  data: `0x${string}`;
};

interface CreateEnergyProposalFormProps<T extends EnergyProposalBaseFields> {
  schema: ZodType<T, z.ZodTypeDef, any>;
  label: string;
  stickyHeaderTitle: string;
  resubmitTemplateSegment: string;
  spaceId: number | undefined | null;
  web3SpaceId: number | undefined | null;
  successfulUrl: string;
  backUrl?: string;
  plugin: React.ReactNode;
  mapPayload: (values: T) => JsonValue;
  /**
   * Optional default values for the form. Useful when a proposal type needs to
   * pre-fill fields from on-chain reads (e.g. space executor address).
   * NOTE: `react-hook-form` consumes `defaultValues` only on first mount. For
   * values that resolve asynchronously, use {@link formRef} and `setValue` /
   * `reset` from the parent.
   */
  defaultValues?: Partial<T>;
  /**
   * Optional ref the parent can use to control the form imperatively
   * (e.g. populate fields once on-chain data resolves).
   */
  formRef?: React.MutableRefObject<UseFormReturn<T, unknown, T> | null>;
  /**
   * Optional builder that produces additional on-chain transactions to attach
   * to the DAO proposal. These execute via the space executor when the
   * proposal passes. Used by Enable Energy Community to trigger
   * `EnergyPPAv2Factory.deployCommunity`.
   */
  buildExtraTransactions?: (
    values: T,
  ) =>
    | ReadonlyArray<ProposalExtraTransaction>
    | Promise<ReadonlyArray<ProposalExtraTransaction>>;
}

export const CreateEnergyProposalForm = <T extends EnergyProposalBaseFields>({
  schema,
  label,
  stickyHeaderTitle,
  resubmitTemplateSegment,
  spaceId,
  web3SpaceId,
  successfulUrl,
  backUrl,
  plugin,
  mapPayload,
  defaultValues,
  formRef: externalFormRef,
  buildExtraTransactions,
}: CreateEnergyProposalFormProps<T>) => {
  const tSpaces = useTranslations('Spaces');
  const tAgreementFlow = useTranslations('AgreementFlow');
  const { person } = useMe();
  const { jwt } = useJwt();
  const config = useConfig();
  const {
    createAgreement,
    reset,
    currentAction,
    isError,
    isPending,
    progress,
  } = useCreateAgreementOrchestrator({ authToken: jwt, config });

  const resolver = useLocalizedProposalResolver(schema, tAgreementFlow);
  const formRef = React.useRef<HTMLFormElement>(null);

  const form = useForm<T, unknown, T>({
    resolver: resolver as any,
    defaultValues: {
      title: '',
      description: '',
      leadImage: undefined,
      attachments: undefined,
      spaceId: spaceId ?? undefined,
      creatorId: person?.id,
      label,
      ...(defaultValues ?? {}),
    } as DefaultValues<T>,
  });

  React.useEffect(() => {
    if (externalFormRef) {
      externalFormRef.current = form;
      return () => {
        if (externalFormRef.current === form) {
          externalFormRef.current = null;
        }
      };
    }
    return undefined;
  }, [externalFormRef, form]);

  useScrollToErrors(form, formRef);
  const { resubmitKey } = useResubmitProposalData(
    form as any,
    spaceId,
    person?.id,
    resubmitTemplateSegment,
  );

  useClearResubmitOnSuccess(progress === 100 && !isError);

  const handleCreate = async (data: T) => {
    if (spaceId == null) {
      form.setError('root', {
        message: 'Space is required to create a proposal.',
      });
      return;
    }

    const payload = mapPayload(data);
    const descriptionWithMarker = appendEnergyProposalMarker(
      data.description,
      label,
      payload,
    );

    const extraTransactions = buildExtraTransactions
      ? await buildExtraTransactions(data)
      : undefined;

    await createAgreement({
      ...data,
      label,
      description: descriptionWithMarker,
      spaceId,
      ...(typeof web3SpaceId === 'number' ? { web3SpaceId } : {}),
      ...(extraTransactions && extraTransactions.length > 0
        ? { extraTransactions }
        : {}),
    } as any);
  };

  return (
    <SpaceLoadingBackdrop
      showKeepWindowOpenMessage={true}
      keepWindowOpenMessage={tAgreementFlow('loadingBackdrop.keepWindowOpen')}
      progress={progress}
      isLoading={isPending}
      fullHeight={true}
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
      <Form {...(form as any)}>
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
            label={label}
            stickyHeaderTitle={stickyHeaderTitle}
            progress={progress}
          />
          {plugin}
          <Separator />
          <div className="flex justify-end w-full">
            <Button type="submit">{tAgreementFlow('buttons.publish')}</Button>
          </div>
        </form>
      </Form>
    </SpaceLoadingBackdrop>
  );
};
