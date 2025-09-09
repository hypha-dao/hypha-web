'use client';

import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, Button, Input, Image, Switch } from '@hypha-platform/ui';
import {
  activateSpacesSchema,
  ActivateSpacesFormValues,
} from '../hooks/validation';
import { Space } from '@hypha-platform/core/client';
import { SpaceWithNumberOfMonthsFieldArray } from './space-with-number-of-months-array';
import { useActivateSpaces } from '../hooks/use-activate-hypha-spaces';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';

interface ActivateSpacesFormProps {
  spaces: Space[];
}

export const ActivateSpacesForm = ({ spaces }: ActivateSpacesFormProps) => {
  const form = useForm<ActivateSpacesFormValues>({
    resolver: zodResolver(activateSpacesSchema),
    defaultValues: {
      paymentToken: 'HYPHA',
      spaces: [
        {
          spaceId: 0,
          months: 0,
        },
      ],
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

        <span className="flex w-full items-center justify-between">
          <span className="text-2 text-neutral-11">Total Amount</span>
          <div className="flex gap-2">
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
                minimumFractionDigits: 4,
              })}
              disabled
            />
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
                minimumFractionDigits: 4,
              })}
              disabled
            />
          </div>
        </span>

        <div className="flex items-center justify-between">
          <span className="text-2 text-neutral-11">Pay in USDC</span>
          <Switch
            checked={paymentToken === 'USDC'}
            onCheckedChange={(checked) =>
              setValue('paymentToken', checked ? 'USDC' : 'HYPHA')
            }
          />
        </div>

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
