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
import { Space } from '@hypha-platform/core/client';
import { SpaceWithNumberOfMonthsFieldArray } from './space-with-number-of-months-array';
import { useActivateSpaces } from '../hooks/use-activate-hypha-spaces';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { RecipientField } from '../../agreements';

interface ActivateSpacesFormProps {
  spaces: Space[];
}

const RECIPIENT_SPACE_ADDRESS = '0x695f21B04B22609c4ab9e5886EB0F65cDBd464B6';

export const ActivateSpacesForm = ({ spaces }: ActivateSpacesFormProps) => {
  const recipientSpace =
    spaces?.filter((s) => s?.address === RECIPIENT_SPACE_ADDRESS) || [];
  const form = useForm<ActivateSpacesFormValues>({
    resolver: zodResolver(activateSpacesSchema),
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

  const {
    control,
    handleSubmit,
    watch,
    setValue,
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

  const onSubmit = async (data: ActivateSpacesFormValues) => {
    setShowSuccessMessage(false);
    try {
      const tx = await submitActivation();
      console.log('Activation successful:', tx);
      setShowSuccessMessage(true);
    } catch (error) {
      console.error('Activation failed:', error);
      setShowSuccessMessage(false);
    }
  };

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
        <Label>Recipient</Label>
        <RecipientField
          members={[]}
          spaces={recipientSpace}
          defaultRecipientType="space"
          readOnly={true}
        />
        <div className="flex gap-2 justify-end">
          {isActivating ? (
            <div className="flex items-center gap-2 text-sm text-neutral-10">
              <Loader2 className="animate-spin w-4 h-4" />
              Purchasing
            </div>
          ) : showSuccessMessage ? (
            <div className="text-2 text-foreground">
              The spaces you selected have been successfully activated!
            </div>
          ) : (
            <Button type="submit" disabled={isActivating}>
              Activate
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
};
