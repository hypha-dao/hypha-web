'use client';

import { Skeleton } from '@hypha-platform/ui';
import { Person, Space } from '@hypha-platform/core/client';
import { useTranslations } from 'next-intl';

import { useTokens } from '../../../treasury';
import { AirdropRecipientsFieldArray } from './airdrop-recipients-field-array';

export const AirdropPlugin = ({
  spaceSlug,
  members,
  spaces,
}: {
  spaceSlug: string;
  members: Person[];
  spaces?: Space[];
}) => {
  const tAgreementFlow = useTranslations('AgreementFlow');
  const { tokens, isLoading } = useTokens({ spaceSlug });

  return (
    <div className="flex flex-col gap-4">
      <span className="text-2 text-neutral-11">
        {tAgreementFlow('plugins.airdrop.description')}
      </span>
      <Skeleton loading={isLoading} width={'100%'} height={120}>
        <AirdropRecipientsFieldArray
          tokens={tokens}
          members={members}
          spaces={spaces}
          spaceSlug={spaceSlug}
          name="airdrop"
        />
      </Skeleton>
    </div>
  );
};
