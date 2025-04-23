'use client';

import { useFormContext } from 'react-hook-form';
import {
  Button,
  Textarea,
  Input,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormMessage,
  UploadLeadImage,
  Separator,
  Badge,
} from '@hypha-platform/ui';
import { RxCross1 } from 'react-icons/rx';
import { Text } from '@radix-ui/themes';
import { Creator } from '@hypha-platform/graphql/rsc';
import { PersonAvatar } from '../../people/components/person-avatar';
import { ALLOWED_IMAGE_FILE_SIZE } from '@core/space';
import { z } from 'zod';
import { createAgreementFiles, schemaCreateAgreement } from '@core/governance';

import Link from 'next/link';

import { ReactNode } from 'react';

const schemaCreateAgreementForm =
  schemaCreateAgreement.extend(createAgreementFiles);

export type CreateAgreementFormData = z.infer<typeof schemaCreateAgreementForm>;

export type CreateAgreementFormProps = {
  creator?: Creator;
  isLoading?: boolean;
  closeUrl: string;
};

export function CreateAgreementBaseFields({
  creator,
  isLoading = false,
  closeUrl,
}: CreateAgreementFormProps) {
  const form = useFormContext<CreateAgreementFormData>();

  return (
    <>
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
                Agreement
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
          <Link href={closeUrl} scroll={false}>
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
              <Textarea
                disabled={isLoading}
                placeholder="Type a brief description here..."
                {...field}
              />
            </FormControl>
            <FormDescription />
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
