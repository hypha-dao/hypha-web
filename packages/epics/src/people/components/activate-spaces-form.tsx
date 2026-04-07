'use client';

import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Form,
  Button,
  Input,
  Image,
  Separator,
  Tabs,
  TabsTrigger,
  TabsList,
  Label,
} from '@hypha-platform/ui';
import {
  activateSpacesSchema,
  ActivateSpacesFormValues,
} from '../hooks/validation';
import { extractRevertReason, Space, useMe } from '@hypha-platform/core/client';
import { SpaceWithNumberOfMonthsFieldArray } from './space-with-number-of-months-array';
import { useActivateSpaces } from '../hooks/use-activate-hypha-spaces';
import { Loader2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { RecipientField } from '../../agreements';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useFundWallet } from '../../treasury';
import { z } from 'zod';
import { isAddress } from 'ethers';
import { useScrollToErrors } from '../../hooks';
import { useTranslations } from 'next-intl';

interface ActivateSpacesFormProps {
  spaces: Space[];
}

const schema = activateSpacesSchema.extend({
  buyer: z.string().refine(isAddress, { message: 'Invalid wallet address' }),
});
type FormValues = z.infer<typeof schema>;

const RECIPIENT_SPACE_ADDRESS = '0x695f21B04B22609c4ab9e5886EB0F65cDBd464B6';

export const ActivateSpacesForm = ({ spaces }: ActivateSpacesFormProps) => {
  const tActions = useTranslations('ProfileActions');
  const tAgreementFlow = useTranslations('AgreementFlow');
  const { person, isLoading: isPersonLoading } = useMe();
  const router = useRouter();
  const { lang, personSlug } = useParams<{
    lang: string;
    personSlug: string;
  }>();
  const { fundWallet } = useFundWallet({
    address: person?.address as `0x${string}`,
  });
  const recipientSpace =
    spaces?.filter((s) => s?.address === RECIPIENT_SPACE_ADDRESS) || [];
  const formRef = useRef<HTMLFormElement>(null);
  const baseResolver = useMemo(() => zodResolver(schema), []);
  const translateActivateSpacesError = useMemo(
    () => (message: string) => {
      const normalizedMessage = message.trim();
      const map: Record<string, string> = {
        'Please select a space to activate.':
          'activateSpaces.form.errors.selectSpaceToActivate',
        'Please enter the number of months to activate.':
          'activateSpaces.form.errors.monthsRequired',
        'At least one space must be added':
          'activateSpaces.form.errors.atLeastOneSpace',
        'Please add a recipient or wallet address':
          'activateSpaces.form.errors.recipientRequired',
        'Invalid Ethereum address':
          'activateSpaces.form.errors.invalidEthereumAddress',
        'Invalid wallet address':
          'activateSpaces.form.errors.invalidWalletAddress',
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
        localized.message = translateActivateSpacesError(localized.message);
      }

      if (localized.types && typeof localized.types === 'object') {
        const localizedTypes: Record<string, unknown> = { ...localized.types };
        for (const [typeKey, typeValue] of Object.entries(localizedTypes)) {
          if (typeof typeValue === 'string') {
            localizedTypes[typeKey] = translateActivateSpacesError(typeValue);
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
  }, [baseResolver, translateActivateSpacesError]);

  const closePanelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const form = useForm<FormValues>({
    resolver,
    mode: 'onChange',
    defaultValues: {
      paymentToken: 'HYPHA',
      spaces: [
        {
          spaceId: 0,
          months: 0,
        },
      ],
      recipient: RECIPIENT_SPACE_ADDRESS,
    },
  });

  useScrollToErrors(form, formRef);

  useEffect(() => {
    if (person?.address) {
      const currentBuyer = form.getValues('buyer');
      if (currentBuyer !== person.address) {
        form.setValue('buyer', person.address);
      }
    }
  }, [person?.address]);

  const {
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors },
  } = form;

  const watchedSpaces = useWatch({ control, name: 'spaces' });
  const paymentToken = useWatch({ control, name: 'paymentToken' });

  const { totalUSDC, totalHYPHA, submitActivation, isActivating } =
    useActivateSpaces({
      spaces: watchedSpaces,
      paymentToken,
    });

  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const closePanelUrl = useMemo(
    () => `/${lang}/profile/${personSlug}`,
    [lang, personSlug],
  );

  useEffect(() => {
    return () => {
      if (closePanelTimeoutRef.current) {
        clearTimeout(closePanelTimeoutRef.current);
      }
    };
  }, []);

  const buyerMember = useMemo(() => {
    return !isPersonLoading && person ? [person] : [];
  }, [isPersonLoading, person]);

  const onSubmit = async (data: ActivateSpacesFormValues) => {
    setShowSuccessMessage(false);
    try {
      const tx = await submitActivation();
      console.log('Activation successful:', tx);
      setShowSuccessMessage(true);
      if (closePanelTimeoutRef.current) {
        clearTimeout(closePanelTimeoutRef.current);
      }
      closePanelTimeoutRef.current = setTimeout(() => {
        router.replace(closePanelUrl, { scroll: false });
      }, 3000);
      form.reset();
    } catch (error) {
      console.error('Activation failed:', error);
      let errorMessage: string = tActions(
        'activateSpaces.form.errors.activationProcessingFailed',
      );

      if (error instanceof Error) {
        if (error.message.includes('Smart wallet client not available')) {
          errorMessage = tActions(
            'activateSpaces.form.errors.smartWalletNotConnected',
          );
        } else if (
          error.message.includes('ERC20: transfer amount exceeds balance') ||
          error.message.includes('Insufficient HYPHA balance')
        ) {
          errorMessage = 'insufficient_funds';
        } else if (error.message.includes('Execution reverted with reason:')) {
          const match = error.message.match(
            /Execution reverted with reason: (.*?)\./,
          );
          errorMessage =
            match && match[1]
              ? extractRevertReason(match[1])
              : tActions('activateSpaces.form.errors.contractExecutionFailed');
        } else if (error.message.includes('user rejected')) {
          errorMessage = tActions(
            'activateSpaces.form.errors.transactionRejected',
          );
        }
      }
      setError('root', { message: errorMessage });
    }
  };

  if (!spaces || spaces.length === 0) {
    return (
      <div className="text-error text-sm">
        {tActions('activateSpaces.form.errors.noValidSpaces')}
      </div>
    );
  }

  return (
    <Form {...form}>
      <form
        ref={formRef}
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-5"
      >
        <SpaceWithNumberOfMonthsFieldArray spaces={spaces} name="spaces" />
        <Separator />
        <Label>{tAgreementFlow('plugins.activateSpaces.checkOut')}</Label>
        <div className="flex w-full justify-between items-center">
          <span className="text-2 text-neutral-11 w-full">
            {tAgreementFlow('plugins.activateSpaces.totalContribution')}
          </span>
          <span className="text-2 text-neutral-11 text-nowrap">
            $ {totalUSDC}
          </span>
        </div>
        <div className="flex w-full justify-between items-center">
          <span className="text-2 text-neutral-11">
            {tAgreementFlow('plugins.activateSpaces.payWith')}
          </span>
          <Tabs
            value={paymentToken}
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
            {tAgreementFlow('plugins.activateSpaces.totalAmountIn', {
              token: paymentToken,
            })}
          </span>
          <span className="text-2 text-neutral-11 text-nowrap">
            {paymentToken === 'USDC' ? (
              <Input
                leftIcon={
                  <Image
                    src="/placeholder/usdc-icon.svg"
                    width={24}
                    height={24}
                    alt={tActions('activateSpaces.form.icons.usdcAlt')}
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
                    alt={tActions('activateSpaces.form.icons.hyphaAlt')}
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
          label={tAgreementFlow('plugins.activateSpaces.paidBy')}
          members={buyerMember}
          defaultRecipientType="member"
          readOnly={true}
          showTabs={false}
          name="buyer"
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
        <Separator />
        <div className="flex gap-2 justify-end">
          {isActivating ? (
            <div className="flex items-center gap-2 text-sm text-neutral-10">
              <Loader2 className="animate-spin w-4 h-4" />
              {tActions('activateSpaces.form.actions.activating')}
            </div>
          ) : showSuccessMessage ? (
            <div className="text-2 font-bold text-foreground">
              {tActions('activateSpaces.form.success.activated')}
            </div>
          ) : (
            <Button type="submit" disabled={isActivating}>
              {tActions('activateSpaces.form.actions.activate')}
            </Button>
          )}
        </div>
        {errors.root && (
          <div className="text-2 text-foreground">
            {errors.root.message === 'insufficient_funds'
              ? tAgreementFlow.rich(
                  'activateSpacesForm.insufficientFunds.fullMessage',
                  {
                    token: paymentToken,
                    topUpLink: (chunks) =>
                      paymentToken === 'HYPHA' ? (
                        <Link
                          href={`/${lang}/profile/${person?.nickname}/actions/purchase-hypha-tokens`}
                          className="font-bold cursor-pointer text-accent-9 underline"
                        >
                          {chunks}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={fundWallet}
                          className="font-bold cursor-pointer text-accent-9 underline"
                        >
                          {chunks}
                        </button>
                      ),
                  },
                )
              : errors.root.message}
          </div>
        )}
      </form>
    </Form>
  );
};
