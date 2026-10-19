'use client';

import {
  useUserAssets,
  RecipientField,
  type Token,
  useFundWallet,
  useScrollToErrors,
} from '@hypha-platform/epics';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormField,
  FormItem,
  FormControl,
  FormMessage,
  Separator,
  Button,
  RequirementMark,
} from '@hypha-platform/ui';
import { Loader2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  extractRevertReason,
  Space,
  TOKENS,
  useInvestInHyphaMutation,
  useMe,
  HYPHA_PRICE_USD,
} from '@hypha-platform/core/client';
import { TokenPayoutField } from '../../agreements/plugins/components/common/token-payout-field';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import { purchaseSchema } from '../hooks/validation';
import { useTranslations } from 'next-intl';
import {
  WalletAmountBlock,
  WalletFlowCard,
  WalletFlowLabel,
} from '../../common/wallet-flow-card';

interface PeoplePurchaseHyphaTokensProps {
  personSlug: string;
  spaces: Space[];
  closePanelUrl?: string;
  appearance?: 'default' | 'wallet';
}

const PAYMENT_TOKEN = TOKENS.find((t) => t.symbol === 'USDC');
const RECIPIENT_SPACE_ADDRESS = '0x3dEf11d005F8C85c93e3374B28fcC69B25a650Af';

const schema = purchaseSchema.extend({ buyer: z.string() });
type FormValues = z.infer<typeof schema>;

export const PeoplePurchaseHyphaTokens = ({
  personSlug,
  spaces,
  closePanelUrl,
  appearance = 'default',
}: PeoplePurchaseHyphaTokensProps) => {
  const tActions = useTranslations('ProfileActions');
  const tAgreementFlow = useTranslations('AgreementFlow');
  const tModalAside = useTranslations('ModalAside');
  const router = useRouter();
  const { lang } = useParams<{ lang: string }>();
  const { person, isLoading: isPersonLoading } = useMe();
  const { fundWallet } = useFundWallet({
    address: person?.address as `0x${string}`,
  });
  const { manualUpdate } = useUserAssets({
    personSlug,
    refreshInterval: 10000,
  });

  const { investInHypha, isInvesting, investError } =
    useInvestInHyphaMutation();

  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const closePanelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const resolvedClosePanelUrl = useMemo(
    () => closePanelUrl ?? `/${lang}/profile/${personSlug}`,
    [closePanelUrl, lang, personSlug],
  );

  const tokens: Token[] = PAYMENT_TOKEN
    ? [
        {
          icon: PAYMENT_TOKEN.icon,
          symbol: PAYMENT_TOKEN.symbol,
          address: PAYMENT_TOKEN.address as `0x${string}`,
        },
      ]
    : [];

  const buyerMember = useMemo(() => {
    return !isPersonLoading && person ? [person] : [];
  }, [isPersonLoading, person]);
  const recipientSpace =
    spaces?.filter((s) => s?.address === RECIPIENT_SPACE_ADDRESS) || [];

  const baseResolver = useMemo(() => zodResolver(schema), []);
  const translatePurchaseError = useMemo(
    () => (message: string) => {
      const normalizedMessage = message.trim();
      const map: Record<string, string> = {
        'Please enter a purchase amount.':
          'purchaseHypha.form.errors.purchaseAmountRequired',
        'Please add a recipient or wallet address':
          'purchaseHypha.form.errors.recipientRequired',
        'Invalid Ethereum address':
          'purchaseHypha.form.errors.invalidEthereumAddress',
      };

      const key = map[normalizedMessage];
      return key
        ? tActions(key as Parameters<typeof tActions>[0])
        : normalizedMessage;
    },
    [tActions],
  );
  const resolver = useMemo(() => {
    const localizeErrors = (errors: unknown): unknown => {
      if (!errors || typeof errors !== 'object') return errors;
      if (Array.isArray(errors)) return errors.map(localizeErrors);

      const localized = { ...(errors as Record<string, unknown>) };

      if (typeof localized.message === 'string') {
        localized.message = translatePurchaseError(localized.message);
      }

      if (localized.types && typeof localized.types === 'object') {
        const localizedTypes: Record<string, unknown> = { ...localized.types };
        for (const [typeKey, typeValue] of Object.entries(localizedTypes)) {
          if (typeof typeValue === 'string') {
            localizedTypes[typeKey] = translatePurchaseError(typeValue);
          }
        }
        localized.types = localizedTypes;
      }

      for (const [key, value] of Object.entries(localized)) {
        if (
          key === 'message' ||
          key === 'type' ||
          key === 'ref' ||
          key === 'types'
        )
          continue;
        if (value && typeof value === 'object') {
          localized[key] = localizeErrors(value);
        }
      }

      return localized;
    };

    return async (...args: Parameters<typeof baseResolver>) => {
      const result = await baseResolver(...args);
      return {
        ...result,
        errors: localizeErrors(result.errors) as typeof result.errors,
      };
    };
  }, [baseResolver, translatePurchaseError]);

  const formRef = useRef<HTMLFormElement>(null);
  const form = useForm<FormValues>({
    resolver,
    defaultValues: {
      payout: {
        amount: '',
        token: PAYMENT_TOKEN?.address ?? '',
      },
      recipient: RECIPIENT_SPACE_ADDRESS,
      buyer: person && person.address ? person.address : '',
    },
  });

  useScrollToErrors(form, formRef);

  useEffect(() => {
    if (person?.address) {
      form.setValue('buyer', person.address);
    }
  }, [form, person]);

  useEffect(() => {
    return () => {
      if (closePanelTimeoutRef.current) {
        clearTimeout(closePanelTimeoutRef.current);
      }
    };
  }, []);

  const amount = useWatch({
    control: form.control,
    name: 'payout.amount',
  });

  const parsedAmount = parseFloat(amount);
  const calculatedHypha = !isNaN(parsedAmount)
    ? parsedAmount / HYPHA_PRICE_USD
    : 0;

  const handlePurchase = async (data: FormValues) => {
    try {
      if (!PAYMENT_TOKEN?.address) {
        form.setError('root', {
          message: tActions(
            'purchaseHypha.form.errors.paymentTokenNotConfigured',
          ),
        });
        return;
      }
      if (data.payout.token !== PAYMENT_TOKEN.address) {
        form.setError('payout.token', {
          message: tActions('purchaseHypha.form.errors.invalidTokenSelected'),
        });
        return;
      }

      const usdcAmount = data.payout.amount;
      const result = await investInHypha({ usdcAmount });
      console.log('Purchase hash:', result);
      setShowSuccessMessage(true);
      if (closePanelTimeoutRef.current) {
        clearTimeout(closePanelTimeoutRef.current);
      }
      closePanelTimeoutRef.current = setTimeout(() => {
        router.replace(resolvedClosePanelUrl, { scroll: false });
      }, 3000);
      form.reset();
    } catch (error) {
      console.error('Purchase failed:', error);
      let errorMessage: string = tActions(
        'purchaseHypha.form.errors.purchaseProcessingFailed',
      );

      if (error instanceof Error) {
        if (error.message.includes('Smart wallet client not available')) {
          errorMessage = tActions(
            'purchaseHypha.form.errors.smartWalletNotConnected',
          );
        } else if (
          error.message.includes('ERC20: transfer amount exceeds balance')
        ) {
          errorMessage = 'insufficient_funds';
        } else if (error.message.includes('Execution reverted with reason:')) {
          const match = error.message.match(
            /Execution reverted with reason: (.*?)\./,
          );
          errorMessage =
            match && match[1]
              ? extractRevertReason(match[1])
              : tActions('purchaseHypha.form.errors.contractExecutionFailed');
        } else if (error.message.includes('user rejected')) {
          errorMessage = tActions(
            'purchaseHypha.form.errors.transactionRejected',
          );
        }
      }
      form.setError('root', { message: errorMessage });
      return;
    }

    try {
      await manualUpdate();
    } catch (refreshError) {
      console.error(
        'Asset refresh failed after successful purchase:',
        refreshError,
      );
    }
  };

  if (!spaces || spaces.length === 0) {
    const empty = (
      <div className="text-error text-sm">
        {tActions('purchaseHypha.form.errors.noValidSpaces')}
      </div>
    );
    return appearance === 'wallet' ? (
      <WalletFlowCard title={tModalAside('buyHyphaTokens')}>
        {empty}
      </WalletFlowCard>
    ) : (
      empty
    );
  }

  const wallet = appearance === 'wallet';
  const receiveLine = tActions('purchaseHypha.form.receiveHyphaTokens', {
    amount: formatCurrencyValue(calculatedHypha),
    price: formatCurrencyValue(HYPHA_PRICE_USD),
  });

  const formBody = (
    <Form {...form}>
      <form
        ref={formRef}
        onSubmit={form.handleSubmit(handlePurchase)}
        className="flex flex-col gap-4"
      >
        <div className="flex w-full flex-col gap-4">
          {wallet ? null : <Separator />}
          {wallet ? (
            <div className="flex flex-col gap-3">
              <WalletFlowLabel>
                {tAgreementFlow('plugins.buyHyphaTokens.purchaseAmount')}
              </WalletFlowLabel>
              <FormField
                control={form.control}
                name="payout.amount"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <WalletAmountBlock
                        id="buy-hypha-amount"
                        amount={field.value ?? ''}
                        onAmountChange={field.onChange}
                        amountLabel={tAgreementFlow(
                          'plugins.buyHyphaTokens.purchaseAmount',
                        )}
                        symbol={PAYMENT_TOKEN?.symbol ?? 'USDC'}
                        presets={[25, 50, 100, 250, 500]}
                        hint={receiveLine}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          ) : (
            <div className="flex w-full flex-col gap-4 md:flex-row md:items-start">
              <div className="flex gap-1">
                <label className="text-2 text-neutral-11 whitespace-nowrap md:min-w-max md:items-center md:pt-1">
                  {tAgreementFlow('plugins.buyHyphaTokens.purchaseAmount')}
                </label>
                <RequirementMark className="text-2" />
              </div>
              <div className="flex min-w-0 grow flex-col gap-2">
                <div className="flex md:justify-end">
                  <FormField
                    control={form.control}
                    name="payout.amount"
                    render={() => (
                      <FormItem>
                        <FormControl>
                          <TokenPayoutField
                            value={form.getValues('payout')}
                            onChange={(val) => form.setValue('payout', val)}
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
          )}
          {wallet ? null : (
            <div className="text-sm text-neutral-500">{receiveLine}</div>
          )}
          {wallet ? null : <Separator />}
          <RecipientField
            label={tAgreementFlow('plugins.buyHyphaTokens.hyphaSentTo')}
            members={buyerMember}
            defaultRecipientType="member"
            readOnly={true}
            showTabs={false}
            name="buyer"
          />
          {wallet ? null : <Separator />}
          <RecipientField
            label={tAgreementFlow('plugins.buyHyphaTokens.usdcPaidTo')}
            members={[]}
            spaces={recipientSpace}
            defaultRecipientType="space"
            readOnly={true}
            showTabs={false}
          />
        </div>
        {wallet ? null : <Separator />}
        <div
          className={wallet ? 'flex flex-col gap-2' : 'flex justify-end gap-2'}
        >
          {isInvesting ? (
            <div className="flex items-center gap-2 text-sm text-neutral-10">
              <Loader2 className="animate-spin w-4 h-4" />
              {tActions('purchaseHypha.form.actions.purchasing')}
            </div>
          ) : showSuccessMessage ? (
            <div className="text-2 font-medium text-foreground">
              {tActions('purchaseHypha.form.success.purchased')}
            </div>
          ) : (
            <Button
              type="submit"
              className={wallet ? 'w-full' : undefined}
              disabled={isInvesting}
            >
              {tActions('purchaseHypha.form.actions.buy')}
            </Button>
          )}
        </div>
        {form.formState.errors.root && (
          <div className="text-2 text-foreground">
            {form.formState.errors.root.message === 'insufficient_funds' ? (
              <>
                {tAgreementFlow(
                  'buyHyphaTokensForm.insufficientFunds.walletBalanceInsufficient',
                )}{' '}
                {tAgreementFlow('buyHyphaTokensForm.insufficientFunds.please')}{' '}
                <span
                  onClick={fundWallet}
                  className="font-bold cursor-pointer text-accent-9 underline"
                >
                  {tAgreementFlow(
                    'buyHyphaTokensForm.insufficientFunds.topUpWith',
                    {
                      token: PAYMENT_TOKEN?.symbol ?? 'USDC',
                    },
                  )}
                </span>{' '}
                {tAgreementFlow(
                  'buyHyphaTokensForm.insufficientFunds.toProceed',
                )}
              </>
            ) : (
              form.formState.errors.root.message
            )}
          </div>
        )}
      </form>
    </Form>
  );

  if (!wallet) return formBody;

  return (
    <WalletFlowCard title={tModalAside('buyHyphaTokens')}>
      {formBody}
    </WalletFlowCard>
  );
};
