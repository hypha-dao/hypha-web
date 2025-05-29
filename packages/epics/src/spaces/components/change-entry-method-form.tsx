'use client';

import { useParams, useRouter } from "next/navigation";
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
} from '@hypha-platform/ui';
import Link from "next/link";
import { RxCross1 } from 'react-icons/rx';
import { Text } from '@radix-ui/themes';
import {
  ALLOWED_IMAGE_FILE_SIZE,
  createAgreementFiles,
  schemaCreateChangeEntryMethodForm,
  useCreateChangeEntryMethodOrchestrator,
  useJwt,
  useMe,
} from "@hypha-platform/core/client";
import { z } from "zod";
import { LoadingBackdrop } from "@hypha-platform/ui/server";
import { useConfig } from "wagmi";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import React from "react";
import { PersonAvatar } from "../../people/components/person-avatar";

const fullSchemaCreateChangeEntryMethodForm =
  schemaCreateChangeEntryMethodForm.extend(createAgreementFiles);

type FormValues = z.infer<typeof fullSchemaCreateChangeEntryMethodForm>;

interface ChangeEntryMethodFormProps {
  spaceId: number | undefined | null;
  web3SpaceId: number | undefined | null;
  successfulUrl: string;
}

export const ChangeEntryMethodForm = ({
  successfulUrl,
  spaceId,
  web3SpaceId,
}: ChangeEntryMethodFormProps) => {
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
  } = useCreateChangeEntryMethodOrchestrator({ authToken: jwt, config });
  
  const form = useForm<FormValues>({
    resolver: zodResolver(fullSchemaCreateChangeEntryMethodForm),
    defaultValues: {
      title: '',
      description: '',
      leadImage: undefined,
      image: undefined,
      attachments: undefined,
      spaceId: spaceId ?? undefined,
      creatorId: person?.id,
      entryMethod: 0,
    },
  });

  console.log(form);

  React.useEffect(() => {
    if (progress === 100 && agreementSlug) {
      router.push(successfulUrl);
    }
  }, [progress, agreementSlug, router, successfulUrl]);

  const handleCreate = async (data: FormValues) => {
    if (![0, 1, 2].includes(data.entryMethod)) {
      console.error('Entry Method must be value of 0, 1 or 2');
    }

    console.log('deploy-funds data', {
      ...data,
      spaceId: spaceId as number,
      web3SpaceId: typeof web3SpaceId === 'number' ? web3SpaceId : undefined,
      entryMethod: data.entryMethod,
    });

    await createChangeEntryMethod({
      ...data,
      spaceId: spaceId as number,
      web3SpaceId: typeof web3SpaceId === 'number' ? web3SpaceId : undefined,
      entryMethod: data.entryMethod,
    });
  };

  console.log('form errors:', form.formState.errors);

  const creator = {
    avatar: person?.avatarUrl || '',
    name: person?.name || '',
    surname: person?.surname || '',
  };
  const isLoading = false;

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
          <div className="flex gap-5 justify-between">
            <div className="flex items-center gap-3">
              <PersonAvatar
                size="lg"
                isLoading={isLoading}
                avatarSrc={creator?.avatar}
                userName={`${creator?.name} ${creator?.surname}`}
              />
              <div className="flex justify-between items-center w-full">
                <div className="flex flex-col">
                  <Badge className="w-fit" colorVariant="accent">
                    Change Entry Method
                  </Badge>
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
                  <Text className="text-1 text-neutral-11">
                    {creator?.name} {creator?.surname}
                  </Text>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              colorVariant="neutral"
              className="flex items-center"
              asChild
            >
              <Link href={successfulUrl} scroll={false}>
                <RxCross1 className="ml-2" />
                Close
              </Link>
            </Button>
          </div>
          <Separator />
          <FormField
            control={form.control}
            name="leadImage"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <UploadLeadImage
                    onChange={field.onChange}
                    maxFileSize={ALLOWED_IMAGE_FILE_SIZE}
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
          {/* {plugin} */}
          <Separator />
          <div className="flex justify-end w-full">
            <Button type="submit">Change</Button>
          </div>
        </form>
      </Form>
    </LoadingBackdrop>
  );
};
