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
  FormLabel,
  RequirementMark,
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
            <div className="flex flex-col w-full justify-between gap-4">
              <div className="flex flex-row w-full">
                <Badge className="w-fit" colorVariant="accent">
                  {label}
                </Badge>
                <div className="flex grow"></div>
                {backUrl && (
                  <ButtonBack
                    label={backLabel}
                    backUrl={backUrl}
                    className="px-0 md:px-3 align-top"
                  />
                )}
                <ButtonClose
                  closeUrl={closeUrl}
                  className="px-0 md:px-3 align-top"
                />
              </div>
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
                        // rightIcon={!field.value && <RequirementMark className="text-4" />}
                        leftIcon={!field.value && <RequirementMark className="text-4" />}
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
            <FormLabel className="text-foreground">
              Proposal Content <RequirementMark />
            </FormLabel>
            <FormControl>
              <RichTextEditor
                editorRef={null}
                markdown={field.value}
                placeholder="Type your proposal content here..."
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
    </>
  );
}
