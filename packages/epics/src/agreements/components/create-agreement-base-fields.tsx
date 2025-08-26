'use client';

import { useFormContext } from 'react-hook-form';
import {
  Input,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormMessage,
  UploadLeadImage,
  Separator,
  Badge,
  AddAttachment,
  RichTextEditor,
} from '@hypha-platform/ui';
import { Text } from '@radix-ui/themes';
import { PersonAvatar } from '../../people/components/person-avatar';
import { ALLOWED_IMAGE_FILE_SIZE } from '@hypha-platform/core/client';
import { z } from 'zod';
import {
  createAgreementFiles,
  schemaCreateAgreement,
} from '@hypha-platform/core/client';

import { ButtonClose, ButtonBack } from '@hypha-platform/epics';
import { AsteriskIcon } from 'lucide-react';

type Creator = { avatar: string; name: string; surname: string };

const schemaCreateAgreementForm =
  schemaCreateAgreement.extend(createAgreementFiles);

export type CreateAgreementFormData = z.infer<typeof schemaCreateAgreementForm>;

export type CreateAgreementFormProps = {
  creator?: Creator;
  isLoading?: boolean;
  closeUrl: string;
  backUrl?: string;
  backLabel?: string;
  label?: string;
};

export function CreateAgreementBaseFields({
  creator,
  isLoading = false,
  closeUrl,
  backUrl,
  backLabel = 'Back to Create',
  label = 'Agreement',
}: CreateAgreementFormProps) {
  const form = useFormContext<CreateAgreementFormData>();

  if (!form) {
    return <div>Form context is missing!</div>;
  }

  return (
    <>
      <div className="flex flex-col-reverse md:flex-row justify-between gap-4 md:gap-2">
        <div className="flex flex-grow gap-3">
          <PersonAvatar
            size="lg"
            isLoading={isLoading}
            avatarSrc={creator?.avatar}
            userName={`${creator?.name} ${creator?.surname}`}
          />
          <div className="flex w-full">
            <div className="flex flex-col w-full">
              <Badge className="w-fit" colorVariant="accent">
                {label}
              </Badge>
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        placeholder="Proposal title..."
                        className="border-0 text-4 p-0 placeholder:text-4 bg-inherit"
                        disabled={isLoading}
                        rightIcon={
                          <AsteriskIcon
                            size={12}
                            className="text-destructive w-4 h-4 left-0 align-super"
                          />
                        }
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
        <div className="flex justify-between gap-4">
          {backUrl && (
            <ButtonBack
              label={backLabel}
              backUrl={backUrl}
              className="px-0 md:px-3"
            />
          )}
          <ButtonClose closeUrl={closeUrl} className="px-0 md:px-3" />
        </div>
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
            <AsteriskIcon
              size={12}
              className="text-destructive absolute w-4 h-4 -right-4 align-super"
            />
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
    </>
  );
}
