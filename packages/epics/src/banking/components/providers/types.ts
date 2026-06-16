import type { FC } from 'react';

import { DEFAULT_BANK_PROVIDER } from '@hypha-platform/core/client';
import type { BankProvider, ProviderFormData } from '../../hooks/types';

export type ProviderOnboardingFormProps = {
  formId: string;
  onSubmit: (data: ProviderFormData) => Promise<void>;
  isSubmitting: boolean;
  initialValues?: Partial<ProviderFormData>;
};

export type ProviderOnboardingFormComponent = FC<ProviderOnboardingFormProps>;

export type ProviderFormRegistry = Record<
  BankProvider,
  ProviderOnboardingFormComponent
>;

export { DEFAULT_BANK_PROVIDER };
