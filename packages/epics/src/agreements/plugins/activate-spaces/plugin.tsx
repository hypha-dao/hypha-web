'use client';

import { Separator } from '@hypha-platform/ui';
import { RecipientField } from '../components/common/recipient-field';
import { useFormContext, useWatch } from 'react-hook-form';
import {
  useOrganisationSpacesBySingleSlug,
  useSpacesByWeb3Ids,
  type Space,
  type SpaceActivationPaymentToken,
} from '@hypha-platform/core/client';
import { useActivateSpaces } from '../../../people/hooks/use-activate-hypha-spaces';
import {
  ActivateSpacesCheckout,
  SpaceWithNumberOfMonthsFieldArray,
} from '../../../people';
import React from 'react';
import { useTranslations } from 'next-intl';

type ActivateSpacesPluginProps = {
  spaceSlug?: string;
  spaces?: Space[];
};

const RECIPIENT_SPACE_ADDRESS = '0x695f21B04B22609c4ab9e5886EB0F65cDBd464B6';

export const ActivateSpacesPlugin = ({
  spaceSlug,
  spaces,
}: ActivateSpacesPluginProps) => {
  const tAgreementFlow = useTranslations('AgreementFlow');
  const { control, setValue } = useFormContext();

  const watchedSpaces = useWatch({ control, name: 'spaces' });
  const watchedPaymentToken = useWatch({ control, name: 'paymentToken' });
  const spaceWeb3Id = useWatch({ control, name: 'buyerWeb3Id' });
  const {
    spaces: [space],
    isLoading: isSpacesLoading,
  } = useSpacesByWeb3Ids(spaceWeb3Id ? [spaceWeb3Id] : [], false);

  const { totalUSDC, totalHYPHA, totalEURC, eurcRateReady } = useActivateSpaces(
    {
      spaces: watchedSpaces,
      paymentToken: watchedPaymentToken,
    },
  );

  const buyerSpace: Space[] = React.useMemo(() => {
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
      <ActivateSpacesCheckout
        paymentToken={watchedPaymentToken}
        onPaymentTokenChange={(value) =>
          setValue('paymentToken', value as SpaceActivationPaymentToken)
        }
        totalUSDC={totalUSDC}
        totalHYPHA={totalHYPHA}
        totalEURC={totalEURC}
        eurcRateReady={eurcRateReady}
      />
      <Separator />
      <RecipientField
        label={tAgreementFlow('plugins.activateSpaces.paidBy')}
        members={[]}
        spaces={buyerSpace}
        defaultRecipientType="space"
        readOnly={true}
        showTabs={false}
        name="buyerWallet"
      />
      <Separator />
      <RecipientField
        label={tAgreementFlow('plugins.activateSpaces.paidTo')}
        members={[]}
        spaces={recipientSpace}
        defaultRecipientType="space"
        readOnly={true}
        showTabs={false}
      />
    </div>
  );
};
