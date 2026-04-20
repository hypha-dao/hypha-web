'use client';

import { RecipientField } from '../components/common/recipient-field';
import { TokenPayoutFieldArray } from '../components/common/token-payout-field-array';
import { Separator, Skeleton } from '@hypha-platform/ui';
import { Person, Space, useSpaceBySlug } from '@hypha-platform/core/client';
import { useTokens } from '../../../treasury';
import { useTranslations } from 'next-intl';
import { useFormContext, useWatch } from 'react-hook-form';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { useNameForAddress } from '../../../governance/hooks';

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
  const { control } = useFormContext();
  // RecipientField writes the chosen address into `recipient` by default;
  // we read it back here so the escrow notice can name the actual investor.
  const recipientAddress = useWatch({ control, name: 'recipient' }) as
    | string
    | undefined;
  const { space: activeSpace } = useSpaceBySlug(spaceSlug);
  const { label: investorLabel } = useNameForAddress(recipientAddress);
  const investorDisplay = investorLabel || 'the selected investor';
  const activeSpaceTitle = activeSpace?.title?.trim() || 'this space';

  return (
    <div className="flex flex-col gap-4">
      <RecipientField
        members={members}
        spaces={spaces}
        defaultRecipientType="member"
        label={t('investingMember')}
      />
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
      <div
        className="rounded-[8px] p-5 border border-accent-6 bg-accent-surface max-w-full flex gap-3 md:gap-5 items-center"
        role="note"
      >
        <ExclamationTriangleIcon
          width={16}
          height={16}
          className="text-foreground flex-shrink-0"
          aria-hidden
        />
        <p className="text-2 text-foreground flex-1 min-w-0">
          {t('escrowNotice', {
            investor: investorDisplay,
            activeSpace: activeSpaceTitle,
          })}
        </p>
      </div>
    </div>
  );
};
