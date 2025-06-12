'use client';

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Address,
  createAgreementFiles,
  EntryMethodType,
  schemaChangeEntryMethod,
  useChangeEntryMethodOrchestrator,
  useJwt,
  useMe,
  useSpaceDetailsWeb3Rpc,
} from "@hypha-platform/core/client";
import { LoadingBackdrop } from "@hypha-platform/ui/server";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useConfig } from "wagmi";
import { z } from "zod";
import { EntryMethod } from "../../spaces/components/entry-method";
import { CreateAgreementBaseFields } from "@hypha-platform/epics";
import { Button, Form, Separator } from "@hypha-platform/ui";
import React from "react";

const schemaCreateProposalChangeEntryMethod =
  schemaChangeEntryMethod.extend(createAgreementFiles);

type FormValues = z.infer<typeof schemaCreateProposalChangeEntryMethod>;

interface CreateProposalChangeEntryMethodFormProps {
  spaceId: number | undefined | null;
  web3SpaceId: number | undefined | null;
  successfulUrl: string;
  plugin: React.ReactNode;
}

const ENTRY_METHODS = [
  EntryMethodType.OPEN_ACCESS,
  EntryMethodType.TOKEN_BASED,
  EntryMethodType.INVITE_ONLY,
];

export const CreateProposalChangeEntryMethodForm = ({
  successfulUrl,
  spaceId,
  web3SpaceId,
  plugin,
}: CreateProposalChangeEntryMethodFormProps) => {
  const router = useRouter();
  const { person } = useMe();
  const { jwt } = useJwt();
  const config = useConfig();

  const {
    createChangeEntryMethod,
    reset,
    currentAction,
    isError,
    isPending,
    progress,
    changeEntryMethod: { slug: agreementSlug },
  } = useChangeEntryMethodOrchestrator({ authToken: jwt, config });

  const form = useForm<FormValues>({
      resolver: zodResolver(schemaCreateProposalChangeEntryMethod),
      defaultValues: {
        title: '',
        description: '',
        leadImage: undefined,
        attachments: undefined,
        spaceId: spaceId ?? undefined,
        creatorId: person?.id,
        entryMethod: EntryMethodType.OPEN_ACCESS,
        tokenBase: {
          amount: 0,
          token: undefined as `0x${string}` | undefined,
        },
      },
    });

  const handleCreate = async (data: FormValues) => {
    if (!web3SpaceId || !ENTRY_METHODS.includes(data.entryMethod)) return;

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
