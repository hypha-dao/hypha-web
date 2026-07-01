'use client';

import { FC, useEffect, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@hypha-platform/ui';
import { useMe, useSpaceBySlug } from '@hypha-platform/core/client';

import { useRequestBankOnboarding } from '../hooks';
import { getDefaultBankCurrencyCodes } from '../bank-currency-display';
import {
  DEFAULT_BANK_PROVIDER,
  providerFormRegistry,
} from './providers/registry';

type BankOnboardingDialogProps = {
  spaceSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (result: {
    kycLink: string | null;
    tosLink: string | null;
  }) => void;
};

export const BankOnboardingDialog: FC<BankOnboardingDialogProps> = ({
  spaceSlug,
  open,
  onOpenChange,
  onSuccess,
}) => {
  const t = useTranslations('BankingTab.onboardingDialog');
  const tCommon = useTranslations('Common');
  const formId = 'bank-onboarding-form';
  const { space } = useSpaceBySlug(spaceSlug);
  const { person } = useMe();
  const { requestOnboarding, isSubmitting, error, clearError } =
    useRequestBankOnboarding({ spaceSlug });

  const ProviderForm = providerFormRegistry[DEFAULT_BANK_PROVIDER];

  const initialValues = useMemo(
    () => ({
      legalName: space?.title?.trim() ?? '',
      contactEmail: person?.email?.trim() ?? '',
      requestedRails: getDefaultBankCurrencyCodes(),
    }),
    [space?.title, person?.email],
  );

  useEffect(() => {
    if (open) {
      clearError();
    }
  }, [open, clearError]);

  const handleSubmit = async (data: {
    legalName: string;
    contactEmail: string;
    requestedRails?: string[];
  }) => {
    try {
      const result = await requestOnboarding(data);
      onOpenChange(false);
      onSuccess?.({
        kycLink: result.kycLink,
        tosLink: result.tosLink,
      });
    } catch {
      // Error surfaced via hook state
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        {open ? (
          <ProviderForm
            key={`${spaceSlug}-bank-onboarding`}
            formId={formId}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            initialValues={initialValues}
          />
        ) : null}

        {error ? (
          <p className="text-sm text-destructive px-1" role="alert">
            {error}
          </p>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            {tCommon('close')}
          </Button>
          <Button
            type="submit"
            form={formId}
            colorVariant="accent"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('submitting')}
              </>
            ) : (
              t('submit')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
