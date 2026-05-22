'use client';

import { FC } from 'react';
import { Card, Image } from '@hypha-platform/ui';

import { truncateAddress } from '../deposit-instruction-display';

type TreasuryDestinationCardProps = {
  address: string;
  currencyLabel: string;
};

export const TreasuryDestinationCard: FC<TreasuryDestinationCardProps> = ({
  address,
  currencyLabel,
}) => {
  return (
    <Card className="flex h-full w-full flex-row items-center gap-3 p-4">
      <div className="shrink-0">
        <Image
          className="rounded-full"
          src="/placeholder/usdc-icon.svg"
          height={40}
          width={40}
          alt={currencyLabel}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-3 font-medium text-foreground">
          {truncateAddress(address)}
        </p>
        <p className="mt-0.5 text-1 text-muted-foreground">{currencyLabel}</p>
      </div>
    </Card>
  );
};
