'use client';

import React from 'react';
import { RecipientField } from '../components/common/recipient-field';
import { TokenPayoutFieldArray } from '../components/common/token-payout-field-array';
import { Separator, Skeleton } from '@hypha-platform/ui';
import { Person, Space } from '@hypha-platform/core/client';
import { useTokens } from '../../../treasury';
import { useTranslations } from 'next-intl';
import { useFormContext } from 'react-hook-form';

const emptyLeg = { amount: '', token: '' as `0x${string}` };

/**
 * Keeps spaceReceiveLegs length in sync with investorSendLegs (row i pairs for escrow).
 * Add/remove only on the send field (like a single Payment Request with + Add); receive follows.
 *
 * Important: do not call useFieldArray here — TokenPayoutFieldArray already registers those
 * names; a second useFieldArray breaks append() for the + Add button.
 */
function useMirrorReceiveLegsToSendLegs() {
  const { watch, setValue, getValues } = useFormContext();
  const sendLen = watch('investorSendLegs')?.length ?? 0;
  const recvLen = watch('spaceReceiveLegs')?.length ?? 0;

  React.useEffect(() => {
    const send = getValues('investorSendLegs') ?? [];
    const recv = getValues('spaceReceiveLegs') ?? [];
    const diff = send.length - recv.length;
    if (diff === 0) return;
    if (diff > 0) {
      const next = [...recv];
      for (let i = 0; i < diff; i++) {
        next.push({ ...emptyLeg });
      }
      setValue('spaceReceiveLegs', next, { shouldValidate: false });
    } else {
      setValue('spaceReceiveLegs', recv.slice(0, send.length), {
        shouldValidate: false,
      });
    }
  }, [sendLen, recvLen, setValue, getValues]);
}

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

  useMirrorReceiveLegsToSendLegs();

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
          label={t('investorWillSend')}
          allowAddOrRemove
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
          label={t('investorWillReceive')}
          allowAddOrRemove={false}
        />
      </Skeleton>
    </div>
  );
};
