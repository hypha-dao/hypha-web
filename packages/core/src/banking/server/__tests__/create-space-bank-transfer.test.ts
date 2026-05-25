import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const ensureSpaceBankCustomer = vi.fn();
const executeBridgeBankTransfer = vi.fn();
const insertBankTransfer = vi.fn();
const promotePendingBankOperations = vi.fn();
const findSpaceBySlug = vi.fn();
const mapBankTransferToPublic = vi.fn((transfer, isApproved) => ({
  ...transfer,
  lifecycle: isApproved ? 'active' : 'pending_kyb',
  canActivate: !isApproved,
  canContinueVerification: false,
  createdAt: transfer.createdAt?.toISOString?.() ?? new Date().toISOString(),
}));

vi.mock('../ensure-space-bank-customer', () => ({
  ensureSpaceBankCustomer: (...args: unknown[]) =>
    ensureSpaceBankCustomer(...args),
}));

vi.mock('../execute-bridge-bank-transfer', () => ({
  executeBridgeBankTransfer: (...args: unknown[]) =>
    executeBridgeBankTransfer(...args),
}));

vi.mock('../mutations', () => ({
  insertBankTransfer: (...args: unknown[]) => insertBankTransfer(...args),
}));

vi.mock('../promote-pending-bank-operations', () => ({
  promotePendingBankOperations: (...args: unknown[]) =>
    promotePendingBankOperations(...args),
}));

vi.mock('../../../space/server/queries', () => ({
  findSpaceBySlug: (...args: unknown[]) => findSpaceBySlug(...args),
}));

vi.mock('../map-bank-transfer-public', () => ({
  mapBankTransferToPublic: (...args: unknown[]) =>
    mapBankTransferToPublic(...args),
}));

import { BANK_OPERATION_PENDING_KYB } from '../../constants';
import { createSpaceBankTransfer } from '../create-space-bank-transfer';

const mockDb = {} as never;

const space = { id: 1, slug: 'acme', address: '0xtreasury' };

const approvedCustomer = {
  id: 10,
  kycStatus: 'approved',
  providerCustomerId: 'cust_1',
};

const pendingCustomer = {
  id: 11,
  kycStatus: 'incomplete',
  providerCustomerId: null,
};

describe('createSpaceBankTransfer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findSpaceBySlug.mockResolvedValue(space);
  });

  it('creates pending_kyb row when customer is not approved', async () => {
    ensureSpaceBankCustomer.mockResolvedValue({
      customer: pendingCustomer,
      isApproved: false,
    });
    insertBankTransfer.mockResolvedValue({
      id: 1,
      currency: 'usd',
      paymentRail: 'wire',
      status: BANK_OPERATION_PENDING_KYB,
      providerTransferId: null,
      createdAt: new Date(),
    });

    await createSpaceBankTransfer(
      {
        spaceSlug: 'acme',
        authToken: 'token',
        corridorKey: 'usd-wire',
      },
      { db: mockDb },
    );

    expect(insertBankTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        currency: 'usd',
        paymentRail: 'wire',
        status: BANK_OPERATION_PENDING_KYB,
        providerTransferId: null,
      }),
      { db: mockDb },
    );
    expect(executeBridgeBankTransfer).not.toHaveBeenCalled();
  });

  it('calls Bridge when customer is approved', async () => {
    ensureSpaceBankCustomer.mockResolvedValue({
      customer: approvedCustomer,
      isApproved: true,
    });
    promotePendingBankOperations.mockResolvedValue(undefined);
    executeBridgeBankTransfer.mockResolvedValue({
      providerTransferId: 'transfer_1',
      currency: 'usd',
      paymentRail: 'wire',
      amount: null,
      depositMessage: 'BRG7msg',
      depositInstructions: { deposit_message: 'BRG7msg' },
      status: 'awaiting_funds',
      destinationAddress: '0xtreasury',
    });
    insertBankTransfer.mockResolvedValue({
      id: 2,
      currency: 'usd',
      paymentRail: 'wire',
      status: 'awaiting_funds',
      providerTransferId: 'transfer_1',
      createdAt: new Date(),
    });

    await createSpaceBankTransfer(
      {
        spaceSlug: 'acme',
        authToken: 'token',
        corridorKey: 'usd-wire',
      },
      { db: mockDb },
    );

    expect(executeBridgeBankTransfer).toHaveBeenCalledWith(
      {
        customer: approvedCustomer,
        space,
        currency: 'usd',
        paymentRail: 'wire',
        amount: undefined,
      },
      { db: mockDb },
      undefined,
    );
  });

  it('rejects invalid corridor keys', async () => {
    await expect(
      createSpaceBankTransfer(
        {
          spaceSlug: 'acme',
          authToken: 'token',
          corridorKey: 'invalid',
        },
        { db: mockDb },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
});
