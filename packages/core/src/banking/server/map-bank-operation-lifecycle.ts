import {
  BANK_OPERATION_PENDING_ACTIVATION,
  BANK_OPERATION_PENDING_KYB,
} from '../constants';
import type { BankOperationLifecycle } from '../types';

export function resolveBankOperationLifecycle(input: {
  status: string;
  hasProviderResource: boolean;
  isCustomerApproved: boolean;
}): {
  lifecycle: BankOperationLifecycle;
  canActivate: boolean;
  canContinueVerification: boolean;
} {
  const { status, hasProviderResource, isCustomerApproved } = input;

  if (hasProviderResource) {
    return {
      lifecycle: 'active',
      canActivate: false,
      canContinueVerification: false,
    };
  }

  if (status === BANK_OPERATION_PENDING_ACTIVATION) {
    return {
      lifecycle: 'pending_activation',
      canActivate: isCustomerApproved,
      canContinueVerification: false,
    };
  }

  if (status === BANK_OPERATION_PENDING_KYB) {
    if (isCustomerApproved) {
      return {
        lifecycle: 'pending_activation',
        canActivate: true,
        canContinueVerification: false,
      };
    }
    return {
      lifecycle: 'pending_kyb',
      canActivate: false,
      canContinueVerification: false,
    };
  }

  if (!isCustomerApproved) {
    return {
      lifecycle: 'pending_kyb',
      canActivate: false,
      canContinueVerification: false,
    };
  }

  return {
    lifecycle: 'pending_activation',
    canActivate: isCustomerApproved,
    canContinueVerification: false,
  };
}
