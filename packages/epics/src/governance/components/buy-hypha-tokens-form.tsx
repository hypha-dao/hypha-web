'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createAgreementFiles,
  schemaBuyHyphaTokens,
} from '@hypha-platform/core/client';
import { z } from 'zod';
import { LoadingBackdrop, Form, Separator, Button } from '@hypha-platform/ui';
import { CreateAgreementBaseFields } from '../../agreements';
import { useMe } from '@hypha-platform/core/client';

const RECIPIENT_SPACE_ADDRESS = '0x695f21B04B22609c4ab9e5886EB0F65cDBd464B6';

const conbinedSchemaBuyHyphaTokens =
  schemaBuyHyphaTokens.extend(createAgreementFiles);
type FormValues = z.infer<typeof conbinedSchemaBuyHyphaTokens>;

interface BuyHyphaTokensFormProps {
  successfulUrl: string;
  backUrl?: string;
}

export const BuyHyphaTokensForm = ({
  successfulUrl,
  backUrl,
}: BuyHyphaTokensFormProps) => {
  const { person } = useMe();
  const form = useForm<FormValues>({
    resolver: zodResolver(conbinedSchemaBuyHyphaTokens),
    defaultValues: {
      title: '',
      description: '',
      leadImage: undefined,
      attachments: undefined,
      paymentToken: 'HYPHA',
      spaces: [
        {
          spaceId: 0,
          months: 0,
        },
      ],
      recipient: RECIPIENT_SPACE_ADDRESS,
    },
  });

  const handleCreate = async (data: FormValues) => {
    console.log(data);
  };

  return (
    // <LoadingBackdrop
    //   progress={progress}
    //   isLoading={isPending || isLoading}
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
          label="Buy Hypha Tokens (Rewards)"
        />
        {/* {plugin} */}
        <Separator />
        <div className="flex justify-end w-full">
          <Button type="submit">Publish</Button>
        </div>
      </form>
    </Form>
    // </LoadingBackdrop>
  );
};
