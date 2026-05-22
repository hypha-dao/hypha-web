import type { DatabaseInstance } from '../../common/server/types';
import type { Space } from '../../space/types';
import type { BankCustomer } from '@hypha-platform/storage-postgres';
import { DEFAULT_BANK_PROVIDER } from '../constants';
import {
  fetchBridgeKycLinkLive,
  isBridgeKycProcedureSubmitted,
  isBridgeTosProcedureSubmitted,
} from './fetch-bridge-kyc-link-live';
import { findBankCustomerBySpaceAndProvider } from './queries';

export type BankVerificationProcedurePublic = {
  status: string | null;
  isComplete: boolean;
  link: string | null;
  linkDisabled: boolean;
};

export type SpaceBankCustomerPublicStatus = {
  kycStatus: string;
  tosStatus: string | null;
  kycLink: string | null;
  tosLink: string | null;
  isApproved: boolean;
  approvalRegistered: boolean;
  procedures: {
    tos: BankVerificationProcedurePublic;
    kyc: BankVerificationProcedurePublic;
  };
};

function resolveTosStatus(
  registered: string | null,
  live: string | null | undefined,
): string | null {
  return live ?? registered;
}

function resolveKycStatus(
  registered: string,
  live: string | null | undefined,
): string {
  return live ?? registered;
}

function buildTosProcedure(
  registered: string | null,
  live: string | null | undefined,
  tosLink: string | null,
): BankVerificationProcedurePublic {
  const status = resolveTosStatus(registered, live);
  const isComplete =
    isBridgeTosProcedureSubmitted(live) ||
    isBridgeTosProcedureSubmitted(registered);

  return {
    status,
    isComplete,
    link: tosLink,
    linkDisabled: isComplete,
  };
}

function buildKycProcedure(
  registered: string,
  live: string | null | undefined,
  kycLink: string | null,
): BankVerificationProcedurePublic {
  const status = resolveKycStatus(registered, live);
  const isComplete = registered === 'approved' || live === 'approved';
  const linkDisabled =
    isComplete ||
    isBridgeKycProcedureSubmitted(live) ||
    isBridgeKycProcedureSubmitted(registered);

  return {
    status,
    isComplete,
    link: kycLink,
    linkDisabled,
  };
}

function buildProceduresFromDb(customer: BankCustomer): {
  tos: BankVerificationProcedurePublic;
  kyc: BankVerificationProcedurePublic;
} {
  return {
    tos: buildTosProcedure(customer.tosStatus, null, customer.tosLink),
    kyc: buildKycProcedure(customer.kycStatus, null, customer.kycLink),
  };
}

function buildProceduresWithLive(
  customer: BankCustomer,
  live: NonNullable<Awaited<ReturnType<typeof fetchBridgeKycLinkLive>>>,
): {
  tos: BankVerificationProcedurePublic;
  kyc: BankVerificationProcedurePublic;
} {
  return {
    tos: buildTosProcedure(customer.tosStatus, live.tosStatus, customer.tosLink),
    kyc: buildKycProcedure(customer.kycStatus, live.kycStatus, customer.kycLink),
  };
}

export async function getSpaceBankCustomerPublicStatus(
  space: Pick<Space, 'id'>,
  { db }: { db: DatabaseInstance },
): Promise<SpaceBankCustomerPublicStatus | null> {
  const customer = await findBankCustomerBySpaceAndProvider(
    { spaceId: space.id, provider: DEFAULT_BANK_PROVIDER },
    { db },
  );

  if (!customer) {
    return null;
  }

  const approvalRegistered = customer.kycStatus === 'approved';

  if (approvalRegistered) {
    return {
      kycStatus: customer.kycStatus,
      tosStatus: customer.tosStatus,
      kycLink: customer.kycLink,
      tosLink: customer.tosLink,
      isApproved: true,
      approvalRegistered: true,
      procedures: buildProceduresFromDb(customer),
    };
  }

  try {
    const live = await fetchBridgeKycLinkLive(customer);
    if (live) {
      return {
        kycStatus: customer.kycStatus,
        tosStatus: customer.tosStatus,
        kycLink: customer.kycLink,
        tosLink: customer.tosLink,
        isApproved: live.isKycApproved,
        approvalRegistered: false,
        procedures: buildProceduresWithLive(customer, live),
      };
    }
  } catch (error) {
    console.error(
      'Bridge KYC live read failed while loading bank customer status:',
      error,
    );
  }

  return {
    kycStatus: customer.kycStatus,
    tosStatus: customer.tosStatus,
    kycLink: customer.kycLink,
    tosLink: customer.tosLink,
    isApproved: false,
    approvalRegistered: false,
    procedures: buildProceduresFromDb(customer),
  };
}
