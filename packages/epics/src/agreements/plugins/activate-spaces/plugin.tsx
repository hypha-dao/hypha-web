'use client';

import {
  Separator,
  Tabs,
  TabsTrigger,
  TabsList,
  Label,
  Input,
  Image,
} from '@hypha-platform/ui';
import { RecipientField } from '../components/common/recipient-field';
import { useFormContext, useWatch } from 'react-hook-form';
import {
  useOrganisationSpacesBySingleSlug,
  useSpacesByWeb3Ids,
  type Space,
} from '@hypha-platform/core/client';
import { useActivateSpaces } from '../../../people/hooks/use-activate-hypha-spaces';
import { SpaceWithNumberOfMonthsFieldArray } from '../../../people';
import React, { useMemo } from 'react';

type ActivateSpacesPluginProps = {
  spaceSlug?: string;
  spaces?: Space[];
};

const RECIPIENT_SPACE_ADDRESS = '0x695f21B04B22609c4ab9e5886EB0F65cDBd464B6';

export const ActivateSpacesPlugin = ({
  spaceSlug,
  spaces,
}: ActivateSpacesPluginProps) => {
  const { control, setValue } = useFormContext();

  const watchedSpaces = useWatch({ control, name: 'spaces' });
  const watchedPaymentToken = useWatch({ control, name: 'paymentToken' });
  const spaceWeb3Id = useWatch({ control, name: 'buyerWeb3Id' });
  const {
    spaces: [space],
    isLoading: isSpacesLoading,
  } = useSpacesByWeb3Ids(spaceWeb3Id ? [spaceWeb3Id] : [], false);

  const { totalUSDC, totalHYPHA } = useActivateSpaces({
    spaces: watchedSpaces,
    paymentToken: watchedPaymentToken,
  });

  const buyerSpace: Space[] = useMemo(() => {
    return !isSpacesLoading && space ? [space] : [];
  }, [isSpacesLoading, space]);
  const recipientSpace =
    spaces?.filter((s) => s?.address === RECIPIENT_SPACE_ADDRESS) || [];

  const { spaces: organisationSpaces, isLoading: isOrganisationLoading } =
    useOrganisationSpacesBySingleSlug(spaceSlug ?? '');
  const orgSpaces = React.useMemo(
    () => (!isOrganisationLoading ? organisationSpaces ?? [] : []),
    [organisationSpaces, isOrganisationLoading],
  );

  return (
    <div className="flex flex-col gap-5 w-full">
      <SpaceWithNumberOfMonthsFieldArray
        spaces={spaces ?? []}
        organisationSpaces={orgSpaces}
        name="spaces"
      />
      <Separator />
      <Label>Check out</Label>
      <div className="flex w-full justify-between items-center">
        <span className="text-2 text-neutral-11 w-full">
          Total Contribution:
        </span>
        <span className="text-2 text-neutral-11 text-nowrap">
          $ {totalUSDC.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      </div>
      <div className="flex w-full justify-between items-center">
        <span className="text-2 text-neutral-11">Pay with:</span>
        <Tabs
          value={watchedPaymentToken}
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
          Total amount in {watchedPaymentToken}:
        </span>
        <span className="text-2 text-neutral-11 text-nowrap">
          {watchedPaymentToken === 'USDC' ? (
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
        members={[]}
        spaces={buyerSpace}
        defaultRecipientType="space"
        readOnly={true}
        showTabs={false}
        name="buyerWallet"
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
    </div>
  );
};
