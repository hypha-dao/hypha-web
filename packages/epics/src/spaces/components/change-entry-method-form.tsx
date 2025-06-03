'use client';

import { useParams, useRouter } from 'next/navigation';
import {
  AddAttachment,
  Button,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormMessage,
  Input,
  RichTextEditor,
  Separator,
  UploadLeadImage,
  Badge,
  FormLabel,
  Textarea,
} from '@hypha-platform/ui';
import Link from 'next/link';
import { RxCross1 } from 'react-icons/rx';
import { Text } from '@radix-ui/themes';
import {
  Address,
  ALLOWED_IMAGE_FILE_SIZE,
  schemaCreateChangeEntryMethodForm,
  TokenBase,
  useCreateChangeEntryMethodOrchestrator,
  useJwt,
  useMe,
} from '@hypha-platform/core/client';
import { z } from 'zod';
import { LoadingBackdrop } from '@hypha-platform/ui/server';
import { useConfig } from 'wagmi';
import { useForm, useFormContext } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import React, { useState } from 'react';
import clsx from 'clsx';
import { EntryMethodField } from './entry-method-field';
import { EntryMethodType } from '@hypha-platform/core/client';
import { EntryMethodTokenField } from './entry-method-token-field';
import { useTokens } from '@hypha-platform/epics';
import { useSpaceDetailsWeb3Rpc } from '@hypha-platform/core/client';

const fullSchemaCreateChangeEntryMethodForm =
  schemaCreateChangeEntryMethodForm.extend({});

type FormValues = z.infer<typeof fullSchemaCreateChangeEntryMethodForm>;

interface ChangeEntryMethodFormProps {
  spaceId: number | undefined | null;
  web3SpaceId: number | undefined | null;
  successfulUrl: string;
  submitLabel?: string;
  submitLoadingLabel?: string;
}

type EntryMethodOption = {
  name: string;
  value: number;
};

const entryMethods: EntryMethodOption[] = [
  {
    name: 'Open Access',
    value: EntryMethodType.OPEN_ACCESS,
  },
  {
    name: 'Invite Only',
    value: EntryMethodType.INVITE_ONLY,
  },
  {
    name: 'Token Based',
    value: EntryMethodType.TOKEN_BASED,
  },
];

export const ChangeEntryMethodForm = ({
  successfulUrl,
  spaceId,
  web3SpaceId,
  submitLabel,
  submitLoadingLabel,
}: ChangeEntryMethodFormProps) => {
  const [tokenBased, setTokenBased] = useState(false);
  const router = useRouter();
  const { person } = useMe();
  const { jwt, isLoadingJwt } = useJwt();
  const config = useConfig();
  const { tokens } = useTokens();
  const {
    createChangeEntryMethod,
    reset,
    currentAction,
    isError,
    isPending,
    progress,
    changeEntryMethod: { slug: agreementSlug },
  } = useCreateChangeEntryMethodOrchestrator({ authToken: jwt, config });
  const { spaceDetails } = useSpaceDetailsWeb3Rpc({
    spaceId: spaceId as number,
  });
  const entryMethod = spaceDetails?.joinMethod || EntryMethodType.OPEN_ACCESS;
  const defaultValues = {
    title: '',
    description: '',
    image: undefined,
    attachments: undefined,
    spaceId: spaceId ?? undefined,
    creatorId: person?.id,
    entryMethod: entryMethod as EntryMethodType,
    tokenBase: undefined,
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(fullSchemaCreateChangeEntryMethodForm),
    defaultValues,
  });

  console.log(form);

  React.useEffect(() => {
    if (progress === 100 && agreementSlug) {
      router.push(successfulUrl);
    }
  }, [progress, agreementSlug, router, successfulUrl]);

  const handleCreate = async (data: FormValues) => {
    if (
      ![
        EntryMethodType.OPEN_ACCESS,
        EntryMethodType.INVITE_ONLY,
        EntryMethodType.TOKEN_BASED,
      ].includes(data.entryMethod)
    ) {
      console.error('Entry Method must be value of 0, 1 or 2');
      return;
    }

    if (data.entryMethod === defaultValues.entryMethod) {
      console.error('Entry Method is not changed');
      return;
    }

    const tokenBase: TokenBase | undefined = data.tokenBase
      ? {
          amount: data.tokenBase.amount,
          token: data.tokenBase.token as Address,
        }
      : undefined;

    console.log('change-entry-method data', {
      ...data,
      spaceId: spaceId as number,
      web3SpaceId: typeof web3SpaceId === 'number' ? web3SpaceId : undefined,
      entryMethod: data.entryMethod,
      tokenBase,
    });

    await createChangeEntryMethod({
      ...data,
      spaceId: spaceId as number,
      web3SpaceId: typeof web3SpaceId === 'number' ? web3SpaceId : undefined,
      entryMethod: data.entryMethod,
      tokenBase,
    });
  };

  console.log('form errors:', form.formState.errors);

  const creator = {
    avatar: person?.avatarUrl || '',
    name: person?.name || '',
    surname: person?.surname || '',
  };
  const isLoading = isLoadingJwt;

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
          className={clsx('flex flex-col gap-5', isLoading && 'opacity-50')}
        >
          <div className="flex gap-5 justify-between">
            <div className="flex items-center gap-3">
              {/* <FormField
                control={form.control}
                name="logoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <UploadAvatar
                        {...field}
                        maxFileSize={ALLOWED_IMAGE_FILE_SIZE}
                        defaultImage={
                          typeof defaultValues?.logoUrl === 'string'
                            ? defaultValues?.logoUrl
                            : undefined
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              /> */}
              <div className="flex justify-between items-center w-full">
                <div className="flex flex-col">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            placeholder="Type a title..."
                            className="border-0 text-4 p-0 placeholder:text-4 bg-inherit"
                            disabled={isLoading}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <span className="flex items-center">
                    <Text className="text-1 text-foreground mr-1">
                      Created by
                    </Text>
                    <Text className="text-1 text-neutral-11">
                      {creator?.name} {creator?.surname}
                    </Text>
                  </span>
                </div>
              </div>
            </div>
            <Link href={successfulUrl} scroll={false}>
              <Button
                variant="ghost"
                colorVariant="neutral"
                className="flex items-center"
              >
                Close
                <RxCross1 className="ml-2" />
              </Button>
            </Link>
          </div>
          <FormField
            control={form.control}
            name="image"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <UploadLeadImage
                    {...field}
                    maxFileSize={ALLOWED_IMAGE_FILE_SIZE}
                    defaultImage={
                      typeof defaultValues?.image === 'string'
                        ? defaultValues?.image
                        : undefined
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <RichTextEditor
                    editorRef={null}
                    markdown={field.value}
                    {...field}
                  />
                </FormControl>
                <FormDescription />
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="attachments"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <AddAttachment onChange={field.onChange} />
                </FormControl>
                <FormDescription />
                <FormMessage />
              </FormItem>
            )}
          />
          <EntryMethodField
            entryMethods={entryMethods}
            value={form.getValues().entryMethod}
            onChange={(selected) => {
              console.log('selected', selected);
              setTokenBased(selected.value === EntryMethodType.TOKEN_BASED);
            }}
          />
          {tokenBased && (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <FormField
                  control={form.control}
                  name="tokenBase"
                  render={({ field: { value, onChange } }) => (
                    <FormItem>
                      <FormControl>
                        <EntryMethodTokenField
                          value={{
                            amount: value?.amount || 0,
                            token: (value?.token ||
                              tokens[0]?.address ||
                              '0x0') as Address,
                          }}
                          onChange={onChange}
                          tokens={tokens}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          )}
          <Separator />
          <div className="flex justify-end w-full">
            <Button
              type="submit"
              variant={isLoading ? 'outline' : 'default'}
              disabled={isLoading}
            >
              {isLoading ? submitLoadingLabel : submitLabel}
            </Button>
          </div>
        </form>
      </Form>
    </LoadingBackdrop>
  );
};
