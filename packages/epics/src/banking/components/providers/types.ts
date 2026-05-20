import type { FC } from 'react';

import type { BankProvider, ProviderFormData } from '../../hooks/types';

export type ProviderOnboardingFormProps = {
  formId: string;
  onSubmit: (data: ProviderFormData) => Promise<void>;
  isSubmitting: boolean;
  initialValues?: Partial<ProviderFormData>;
};

export type ProviderOnboardingFormComponent = FC<ProviderOnboardingFormProps>;

export type ProviderFormRegistry = Record<BankProvider, ProviderOnboardingFormComponent>;

/** Must match `DEFAULT_BANK_PROVIDER` in `@hypha-platform/core` banking constants. */
export const DEFAULT_BANK_PROVIDER: BankProvider = 'bridge';
