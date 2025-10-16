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
  Image,
} from '@hypha-platform/ui';
import { Text } from '@radix-ui/themes';
import { PersonAvatar } from '../../people/components/person-avatar';
import { z } from 'zod';
import {
  ALLOWED_IMAGE_FILE_SIZE,
  createAgreementFiles,
  schemaCreateAgreement,
  useSpaceBySlug,
  useSpaceMinProposalDuration,
  useSpaceDetailsWeb3Rpc,
} from '@hypha-platform/core/client';
import { useParams } from 'next/navigation';

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

  const { id: spaceSlug } = useParams();

  const { space } = useSpaceBySlug(spaceSlug as string);

  const spaceIdBigInt = space?.web3SpaceId ? BigInt(space.web3SpaceId) : null;

  const { spaceDetails } = useSpaceDetailsWeb3Rpc({
    spaceId: space?.web3SpaceId as number,
  });

  const { duration } = useSpaceMinProposalDuration({
    spaceId: spaceIdBigInt as bigint,
  });

  const durationInDays = Number(duration) / (60 * 60 * 24);

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
              <div className="flex justify-between w-full gap-4">
                <div className="flex flex-col gap-4 w-full">
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
                            rightIcon={<RequirementMark className="text-4" />}
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
                {Number(duration) === 0 ? (
                  <div className="flex gap-2 h-fit items-center">
                    <Image
                      className="max-w-[32px] max-h-[32px] min-w-[32px] min-h-[32px]"
                      width={32}
                      height={32}
                      src="/placeholder/auto-execution-icon.png"
                      alt="Proposal minimum voting icon"
                    />
                    <div className="flex flex-col">
                      <span className="text-3 text-accent-9 text-nowrap font-medium">
                        Auto-Execution
                      </span>
                      <span className="text-[9px] text-accent-9 text-nowrap font-medium">
                        {spaceDetails?.quorum}% Quorum | {spaceDetails?.unity}%
                        Unity
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 h-fit items-center">
                    <Image
                      className="max-w-[32px] max-h-[32px] min-w-[32px] min-h-[32px]"
                      width={32}
                      height={32}
                      src="/placeholder/non-auto-execution-icon.png"
                      alt="Proposal minimum voting icon"
                    />
                    <div className="flex flex-col">
                      <span className="text-2 text-accent-9 text-nowrap font-medium">
                        {durationInDays} Days to Vote
                      </span>
                      <span className="text-[9px] text-accent-9 text-nowrap font-medium">
                        {spaceDetails?.quorum}% Quorum | {spaceDetails?.unity}%
                        Unity
                      </span>
                    </div>
                  </div>
                )}
              </div>
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
                enableImageResizer={true}
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
            <FormLabel className="text-foreground gap-1">
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
