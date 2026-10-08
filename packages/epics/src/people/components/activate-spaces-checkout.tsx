'use client';

import {
  Image,
  Input,
  Label,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@hypha-platform/ui';
import type { SpaceActivationPaymentToken } from '@hypha-platform/core/client';
import { useTranslations } from 'next-intl';

type ActivateSpacesCheckoutProps = {
  paymentToken: SpaceActivationPaymentToken | undefined;
  onPaymentTokenChange: (token: SpaceActivationPaymentToken) => void;
  totalUSDC: number;
  totalHYPHA: number;
  totalEURC: number | undefined;
  eurcRateReady: boolean;
};

const TOKEN_ICON: Record<
  SpaceActivationPaymentToken,
  { src: string; altKey: 'usdcAlt' | 'eurcAlt' | 'hyphaAlt' }
> = {
  USDC: { src: '/placeholder/usdc-icon.svg', altKey: 'usdcAlt' },
  EURC: { src: '/placeholder/eurc-icon.svg', altKey: 'eurcAlt' },
  HYPHA: { src: '/placeholder/space-avatar-image.svg', altKey: 'hyphaAlt' },
};

function formatAmount(value: number | undefined): string {
  if (value == null) return '—';
  return value.toLocaleString(undefined, { minimumFractionDigits: 2 });
}

export const ActivateSpacesCheckout = ({
  paymentToken,
  onPaymentTokenChange,
  totalUSDC,
  totalHYPHA,
  totalEURC,
  eurcRateReady,
}: ActivateSpacesCheckoutProps) => {
  const tAgreementFlow = useTranslations('AgreementFlow');
  const tActions = useTranslations('ProfileActions');
  const token = paymentToken ?? 'HYPHA';
  const icon = TOKEN_ICON[token];
  const amount =
    token === 'USDC' ? totalUSDC : token === 'EURC' ? totalEURC : totalHYPHA;

  return (
    <div className="flex flex-col gap-5 w-full" data-proposal-section="payment">
      <Label>{tAgreementFlow('plugins.activateSpaces.checkOut')}</Label>
      <div className="flex w-full justify-between items-center">
        <span className="text-2 text-neutral-11 w-full">
          {tAgreementFlow('plugins.activateSpaces.totalContribution')}
        </span>
        <span className="text-2 text-neutral-11 text-nowrap">
          $ {formatAmount(totalUSDC)}
        </span>
      </div>
      <div className="flex w-full justify-between items-center">
        <span className="text-2 text-neutral-11">
          {tAgreementFlow('plugins.activateSpaces.payWith')}
        </span>
        <Tabs
          value={token}
          onValueChange={(value) =>
            onPaymentTokenChange(value as SpaceActivationPaymentToken)
          }
        >
          <TabsList triggerVariant="switch">
            <TabsTrigger variant="switch" value="HYPHA">
              HYPHA
            </TabsTrigger>
            <TabsTrigger variant="switch" value="USDC">
              USDC
            </TabsTrigger>
            <TabsTrigger variant="switch" value="EURC">
              EURC
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="flex w-full justify-between items-center">
        <span className="text-2 text-neutral-11 w-full">
          {tAgreementFlow('plugins.activateSpaces.totalAmountIn', {
            token,
          })}
        </span>
        <span className="text-2 text-neutral-11 text-nowrap">
          <Input
            leftIcon={
              <Image
                src={icon.src}
                width={24}
                height={24}
                alt={tActions(`activateSpaces.form.icons.${icon.altKey}`)}
              />
            }
            value={formatAmount(amount)}
            disabled
          />
        </span>
      </div>
      {token === 'EURC' && !eurcRateReady ? (
        <p className="text-2 text-neutral-10">
          {tAgreementFlow('plugins.activateSpaces.eurcRateUnavailable')}
        </p>
      ) : null}
      {token === 'EURC' ? (
        <p className="text-2 text-neutral-10">
          {tAgreementFlow('plugins.activateSpaces.eurcNotSupportedOnchain')}
        </p>
      ) : null}
    </div>
  );
};
