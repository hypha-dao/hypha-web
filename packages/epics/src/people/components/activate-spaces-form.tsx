'use client';

import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Form,
  Button,
  Input,
  Image,
  Separator,
  Tabs,
  TabsTrigger,
  TabsList,
  Label,
} from '@hypha-platform/ui';
import {
  activateSpacesSchema,
  ActivateSpacesFormValues,
} from '../hooks/validation';
import { Space, useMe } from '@hypha-platform/core/client';
import { SpaceWithNumberOfMonthsFieldArray } from './space-with-number-of-months-array';
import { useActivateSpaces } from '../hooks/use-activate-hypha-spaces';
import { Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { RecipientField } from '../../agreements';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useFundWallet } from '../../treasury';
import { z } from 'zod';
import { isAddress } from 'ethers';

interface ActivateSpacesFormProps {
  spaces: Space[];
}

const schema = activateSpacesSchema.extend({
  buyer: z.string().refine(isAddress, { message: 'Invalid wallet address' }),
});
type FormValues = z.infer<typeof schema>;

const RECIPIENT_SPACE_ADDRESS = '0x695f21B04B22609c4ab9e5886EB0F65cDBd464B6';

export const ActivateSpacesForm = ({ spaces }: ActivateSpacesFormProps) => {
  const { person, isLoading: isPersonLoading } = useMe();
  const { lang } = useParams();
  const { fundWallet } = useFundWallet({
    address: person?.address as `0x${string}`,
  });
  const recipientSpace =
    spaces?.filter((s) => s?.address === RECIPIENT_SPACE_ADDRESS) || [];
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
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

  useEffect(() => {
    if (person?.address) {
      const currentBuyer = form.getValues('buyer');
      if (currentBuyer !== person.address) {
        form.setValue('buyer', person.address);
      }
    }
  }, [person?.address]);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = form;

  const watchedSpaces = useWatch({ control, name: 'spaces' });
  const paymentToken = useWatch({ control, name: 'paymentToken' });

  const { totalUSDC, totalHYPHA, submitActivation, isActivating } =
    useActivateSpaces({
      spaces: watchedSpaces,
      paymentToken,
    });

  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  const buyerMember = useMemo(() => {
    return !isPersonLoading && person ? [person] : [];
  }, [isPersonLoading, person]);

  const onSubmit = async (data: ActivateSpacesFormValues) => {
    setShowSuccessMessage(false);
    try {
      const tx = await submitActivation();
      console.log('Activation successful:', tx);
      setShowSuccessMessage(true);
      setTimeout(() => {
        setShowSuccessMessage(false);
      }, 3000);
      form.reset();
    } catch (error) {
      console.error('Activation failed:', error);
      let errorMessage: string =
        'An error occurred while processing your activation. Please try again.';

      if (error instanceof Error) {
        if (error.message.includes('Smart wallet client not available')) {
          errorMessage =
            'Smart wallet is not connected. Please connect your wallet and try again.';
        } else if (
          error.message.includes('ERC20: transfer amount exceeds balance') ||
          error.message.includes('Insufficient HYPHA balance')
        ) {
          errorMessage = 'insufficient_funds';
        } else if (error.message.includes('Execution reverted with reason:')) {
          const match = error.message.match(
            /Execution reverted with reason: (.*?)\./,
          );
          errorMessage =
            match && match[1] ? match[1] : 'Contract execution failed.';
        } else if (error.message.includes('user rejected')) {
          errorMessage =
            'Transaction was rejected. Please approve the transaction to proceed.';
        }
      }
      setError('root', { message: errorMessage });
    }
  };

  if (!spaces || spaces.length === 0) {
    return (
      <div className="text-error text-sm">
        No valid spaces available. Please try again later.
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <SpaceWithNumberOfMonthsFieldArray spaces={spaces} name="spaces" />
        <Separator />
        <Label>Check out</Label>
        <div className="flex w-full justify-between items-center">
          <span className="text-2 text-neutral-11 w-full">
            Total Contribution:
          </span>
          <span className="text-2 text-neutral-11 text-nowrap">
            $ {totalUSDC}
          </span>
        </div>
        <div className="flex w-full justify-between items-center">
          <span className="text-2 text-neutral-11">Pay with:</span>
          <Tabs
            value={paymentToken}
            onValueChange={(value) =>
              setValue('paymentToken', value as 'HYPHA' | 'USDC')
            }
          >
            <TabsList triggerVariant="switch">
              <TabsTrigger variant="switch" value="HYPHA">
                HYPHA
              </TabsTrigger>
              <TabsTrigger variant="switch" value="USDC">
                USDC
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="flex w-full justify-between items-center">
          <span className="text-2 text-neutral-11 w-full">
            Total amount in {paymentToken}:
          </span>
          <span className="text-2 text-neutral-11 text-nowrap">
            {paymentToken === 'USDC' ? (
              <Input
                leftIcon={
                  <Image
                    src="/placeholder/usdc-icon.svg"
                    width={24}
                    height={24}
                    alt="USDC Icon"
                  />
                }
                value={totalUSDC.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
                disabled
              />
            ) : (
              <Input
                leftIcon={
                  <Image
                    src="/placeholder/space-avatar-image.svg"
                    width={24}
                    height={24}
                    alt="Hypha Token Icon"
                  />
                }
                value={totalHYPHA.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
                disabled
              />
            )}
          </span>
        </div>
        <Separator />
        <RecipientField
          label="Paid by"
          members={buyerMember}
          defaultRecipientType="member"
          readOnly={true}
          showTabs={false}
          name="buyer"
        />
        <Separator />
        <RecipientField
          label="Paid to"
          members={[]}
          spaces={recipientSpace}
          defaultRecipientType="space"
          readOnly={true}
          showTabs={false}
        />
        <Separator />
        <div className="flex gap-2 justify-end">
          {isActivating ? (
            <div className="flex items-center gap-2 text-sm text-neutral-10">
              <Loader2 className="animate-spin w-4 h-4" />
              Purchasing
            </div>
          ) : showSuccessMessage ? (
            <div className="text-2 font-bold text-foreground">
              The spaces you selected have been successfully activated!
            </div>
          ) : (
            <Button type="submit" disabled={isActivating}>
              Activate
            </Button>
          )}
        </div>
        {errors.root && (
          <div className="text-2 text-foreground">
            {errors.root.message === 'insufficient_funds' ? (
              <>
                Your wallet balance is insufficient to complete this
                transaction. Please{' '}
                {paymentToken === 'HYPHA' ? (
                  <Link
                    href={`/${lang}/profile/${person?.nickname}/actions/purchase-hypha-tokens`}
                    className="font-bold cursor-pointer text-accent-9 underline"
                  >
                    top up your account with {paymentToken}
                  </Link>
                ) : (
                  <span
                    onClick={fundWallet}
                    className="font-bold cursor-pointer text-accent-9 underline"
                  >
                    top up your account with {paymentToken}
                  </span>
                )}{' '}
                to proceed.
              </>
            ) : (
              errors.root.message
            )}
          </div>
        )}
      </form>
    </Form>
  );
};
