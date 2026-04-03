'use client';

import { RecipientField } from '../components/common/recipient-field';
import { TokenPayoutFieldArray } from '../components/common/token-payout-field-array';
import { Separator, Skeleton } from '@hypha-platform/ui';
import {
  Person,
  Space,
  getEscrowImplementationAddress,
} from '@hypha-platform/core/client';
import { useTokens } from '../../../treasury';
import { useTranslations } from 'next-intl';
import { EthAddress } from '../../../people';

export const AcceptInvestmentPlugin = ({
  spaceSlug,
  members,
  spaces,
}: {
  spaceSlug: string;
  members: Person[];
  spaces?: Space[];
}) => {
  const { tokens, isLoading } = useTokens({ spaceSlug });
  const t = useTranslations('AgreementFlow.plugins.acceptInvestment');
  const escrowAddress = getEscrowImplementationAddress();

  return (
    <div className="flex flex-col gap-4">
      <RecipientField
        members={members}
        spaces={spaces}
        defaultRecipientType="member"
        label={t('investingMember')}
      />
      {escrowAddress ? (
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between w-full">
          <span className="text-2 text-neutral-11 shrink-0">
            {t('escrowAccountAddress')}
          </span>
          <div className="min-w-0 md:max-w-[min(100%,18rem)] md:ml-auto">
            <EthAddress address={escrowAddress} />
          </div>
        </div>
      ) : null}
      <Separator />
      <Skeleton
        loading={isLoading}
        className="w-full min-h-[90px]"
        width="100%"
      >
        <TokenPayoutFieldArray
          tokens={tokens}
          name="investorSendLegs"
          labelLines={[t('investorWillSendLine1'), t('investorWillSendLine2')]}
          allowAddOrRemove={false}
        />
      </Skeleton>
      <Separator />
      <Skeleton
        loading={isLoading}
        className="w-full min-h-[90px]"
        width="100%"
      >
        <TokenPayoutFieldArray
          tokens={tokens}
          name="spaceReceiveLegs"
          labelLines={[
            t('investorWillReceiveLine1'),
            t('investorWillReceiveLine2'),
          ]}
          allowAddOrRemove={false}
        />
      </Skeleton>
    </div>
  );
};
