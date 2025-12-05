'use client';

import { Separator, Form, Button, LoadingBackdrop } from '@hypha-platform/ui';
import { CreateAgreementBaseFields } from '../../agreements';
import {
  useMe,
  createAgreementFiles,
  schemaSpaceToSpaceMembership,
  Space,
  useSpaceToSpaceMembershipOrchestrator,
  useJwt,
} from '@hypha-platform/core/client';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useConfig } from 'wagmi';
import React from 'react';
import { useRouter } from 'next/navigation';
import { useSpaceTokenRequirementsByAddress } from '../hooks';
import { useScrollToErrors } from '../../hooks';

interface SpaceToSpaceMembershipFormProps {
  successfulUrl: string;
  backUrl?: string;
  children?: React.ReactNode;
  spaceId: number | undefined | null;
  web3SpaceId?: number | null;
  spaces?: Space[];
}

const combinedSchemaSpaceToSpaceMembership =
  schemaSpaceToSpaceMembership.extend(createAgreementFiles);
type FormValues = z.infer<typeof combinedSchemaSpaceToSpaceMembership>;

export const SpaceToSpaceMembershipForm = ({
  successfulUrl,
  backUrl,
  children,
  spaceId,
  web3SpaceId,
  spaces,
}: SpaceToSpaceMembershipFormProps) => {
  const { person } = useMe();

  const formRef = React.useRef<HTMLFormElement>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(combinedSchemaSpaceToSpaceMembership),
    mode: 'onChange',
    defaultValues: {
      title: '',
      description: '',
      leadImage: undefined,
      attachments: undefined,
      creatorId: person?.id,
      spaceId: spaceId ?? undefined,
      space: undefined,
      member: undefined,
      label: 'Space To Space',
    },
  });

  useScrollToErrors(form, formRef);

  const { jwt } = useJwt();
  const config = useConfig();
  const router = useRouter();
  const {
    spaceToSpaceAction,
    reset,
    currentAction,
    isError,
    isPending,
    progress,
  } = useSpaceToSpaceMembershipOrchestrator({ authToken: jwt, config, spaces });

  const spaceAddress = form.watch('space');

  const { hasTokenRequirements, hasEnoughTokens, missingTokenMessage } =
    useSpaceTokenRequirementsByAddress({
      spaceAddress,
      spaces,
    });

  const handleCreate = async (data: FormValues) => {
    if (!data.space || !data.member) return;

    if (hasTokenRequirements && !hasEnoughTokens) {
      console.warn('Cannot submit proposal: not enough tokens.');
      return;
    }

    try {
      await spaceToSpaceAction({
        ...data,
        spaceId: spaceId as number,
        web3SpaceId: web3SpaceId as number,
        space: data.space,
        member: data.member,
      });
    } catch (error) {
      console.error(
        'Error creating space to space membership proposal:',
        error,
      );
    }
  };

  return (
    <LoadingBackdrop
      showKeepWindowOpenMessage={true}
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
            creator={{
              avatar: person?.avatarUrl || '',
              name: person?.name || '',
              surname: person?.surname || '',
            }}
            successfulUrl={successfulUrl}
            closeUrl={successfulUrl}
            backUrl={backUrl}
            backLabel="Back to Settings"
            isLoading={false}
            label="Space To Space"
            progress={progress}
          />
          {children}

          <Separator />

          <div className="flex justify-end w-full">
            <Button
              disabled={hasTokenRequirements && !hasEnoughTokens}
              type="submit"
            >
              Publish
            </Button>
          </div>

          {hasTokenRequirements && !hasEnoughTokens && (
            <div className="text-error-11 text-2">{missingTokenMessage}</div>
          )}
        </form>
      </Form>
    </LoadingBackdrop>
  );
};
