import { describe, expect, it } from 'vitest';

import {
  BANK_OPERATION_PENDING_ACTIVATION,
  BANK_OPERATION_PENDING_KYB,
} from '../../constants';
import { resolveBankOperationLifecycle } from '../map-bank-operation-lifecycle';

describe('resolveBankOperationLifecycle', () => {
  it('returns active when Bridge resource exists', () => {
    expect(
      resolveBankOperationLifecycle({
        status: BANK_OPERATION_PENDING_KYB,
        hasProviderResource: true,
        isEndorsementApproved: false,
      }),
    ).toEqual({
      lifecycle: 'active',
      canActivate: false,
      canContinueVerification: false,
    });
  });

  it('returns pending_activation when DB status is pending_activation and customer approved', () => {
    expect(
      resolveBankOperationLifecycle({
        status: BANK_OPERATION_PENDING_ACTIVATION,
        hasProviderResource: false,
        isEndorsementApproved: true,
      }),
    ).toEqual({
      lifecycle: 'pending_activation',
      canActivate: true,
      canContinueVerification: false,
    });
  });

  it('returns pending_kyb when DB is pending_kyb and customer not approved', () => {
    expect(
      resolveBankOperationLifecycle({
        status: BANK_OPERATION_PENDING_KYB,
        hasProviderResource: false,
        isEndorsementApproved: false,
      }),
    ).toEqual({
      lifecycle: 'pending_kyb',
      canActivate: false,
      canContinueVerification: false,
    });
  });

  it('returns pending_activation when DB is pending_kyb but Bridge reports approved', () => {
    expect(
      resolveBankOperationLifecycle({
        status: BANK_OPERATION_PENDING_KYB,
        hasProviderResource: false,
        isEndorsementApproved: true,
      }),
    ).toEqual({
      lifecycle: 'pending_activation',
      canActivate: true,
      canContinueVerification: false,
    });
  });
});
