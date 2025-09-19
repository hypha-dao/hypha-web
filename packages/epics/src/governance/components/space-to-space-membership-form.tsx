'use client';

import { Separator, Form, Button } from '@hypha-platform/ui';
import { CreateAgreementBaseFields } from '../../agreements';
import {
  useMe,
  createAgreementFiles,
  schemaSpaceToSpaceMembership,
} from '@hypha-platform/core/client';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

interface SpaceToSpaceMembershipFormProps {
  successfulUrl: string;
  backUrl?: string;
  children?: React.ReactNode;
  spaceId: number | undefined | null;
  web3SpaceId?: number | null;
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
}: SpaceToSpaceMembershipFormProps) => {
  const { person } = useMe();

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

  const handleCreate = async (data: FormValues) => {
    console.log(data);
  };

  return (
    // <LoadingBackdrop
    //   progress={progress}
    //   isLoading={isPending}
    //   message={
    //     isError ? (
    //       <div className="flex flex-col">
    //         <div>Ouh Snap. There was an error</div>
    //         <Button onClick={reset}>Reset</Button>
    //       </div>
    //     ) : (
    //       <div>{currentAction}</div>
    //     )
    //   }
    // >
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
          backUrl={backUrl}
          backLabel="Back to Settings"
          isLoading={false}
          label="Space To Space"
        />
        {children}
        <Separator />
        <div className="flex justify-end w-full">
          <Button type="submit">Publish</Button>
        </div>
      </form>
    </Form>
    // </LoadingBackdrop>
  );
};
