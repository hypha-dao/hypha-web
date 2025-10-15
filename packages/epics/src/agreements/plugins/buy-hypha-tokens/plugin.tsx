'use client';

import {
  Separator,
  RequirementMark,
  FormField,
  FormItem,
  FormControl,
  FormMessage,
} from '@hypha-platform/ui';
import { TokenPayoutField } from '../components/common/token-payout-field';
import { RecipientField } from '../components/common/recipient-field';
import { useFormContext, useWatch } from 'react-hook-form';
import { TOKENS, type Space } from '@hypha-platform/core/client';
import { Token } from '../components/common/token-payout-field-array';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';

type BuyHyphaTokensPluginProps = {
  spaces?: Space[];
};

const HYPHA_PRICE_USD = 0.25;
const PAYMENT_TOKEN = TOKENS.find((t) => t.symbol === 'USDC');
const RECIPIENT_SPACE_ADDRESS = '0x3dEf11d005F8C85c93e3374B28fcC69B25a650Af';

export const BuyHyphaTokensPlugin = ({ spaces }: BuyHyphaTokensPluginProps) => {
  const { control, setValue } = useFormContext();

  const payout = useWatch({
    control,
    name: 'payout',
  });

  const parsedAmount = parseFloat(payout?.amount ?? '');
  const calculatedHypha = !isNaN(parsedAmount)
    ? parsedAmount / HYPHA_PRICE_USD
    : 0;

  const tokens: Token[] = PAYMENT_TOKEN
    ? [
        {
          icon: PAYMENT_TOKEN.icon,
          symbol: PAYMENT_TOKEN.symbol,
          address: PAYMENT_TOKEN.address as `0x${string}`,
        },
      ]
    : [];

  const recipientSpace =
    spaces?.filter((s) => s?.address === RECIPIENT_SPACE_ADDRESS) || [];

  return (
    <div className="flex flex-col gap-5 w-full">
      <div className="flex flex-col gap-4 md:flex-row md:items-start w-full">
        <div className="flex gap-1">
          <label className="text-2 text-neutral-11 whitespace-nowrap md:min-w-max items-center md:pt-1">
            Purchase Amount
          </label>
          <RequirementMark className="text-2" />
        </div>
        <div className="flex flex-col gap-2 grow min-w-0">
          <div className="flex md:justify-end">
            <FormField
              control={control}
              name="payout.amount"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <TokenPayoutField
                      value={{
                        amount: field.value,
                        token: PAYMENT_TOKEN?.address ?? '',
                      }}
                      onChange={(val) => {
                        field.onChange(val.amount);
                        setValue('payout.token', val.token);
                      }}
                      tokens={tokens}
                      readOnlyDropdown={true}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
      </div>
      <div className="text-sm text-neutral-11">
        Our space will receive {formatCurrencyValue(calculatedHypha)} HYPHA
        tokens (1 HYPHA = {formatCurrencyValue(HYPHA_PRICE_USD)} USD)
      </div>
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
