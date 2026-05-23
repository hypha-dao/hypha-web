import type { DatabaseInstance } from '../../common/server/types';
import type { Space } from '../../space/types';
import type { BankCustomer } from '@hypha-platform/storage-postgres';
import { DEFAULT_BANK_PROVIDER } from '../constants';
import type { BankCurrencyPublicStatus } from '../types';
import { buildBankCurrencyPublicStatuses } from './build-bank-currency-public-statuses';
import {
  fetchBridgeCustomerEndorsementStatuses,
  type BridgeEndorsementStatusMap,
} from './bridge-customer-endorsements';
import {
  fetchBridgeKycLinkLive,
  isBridgeKycProcedureSubmitted,
  isBridgeTosProcedureSubmitted,
} from './fetch-bridge-kyc-link-live';
import {
  findBankCustomerBySpaceAndProvider,
  findBankVirtualAccountsByCustomer,
} from './queries';

export type BankVerificationProcedurePublic = {
  status: string | null;
  isComplete: boolean;
  link: string | null;
  linkDisabled: boolean;
};

export type SpaceBankCustomerPublicStatus = {
  name: string;
  contactEmail: string;
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
  currencyStatuses: BankCurrencyPublicStatus[];
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
    tos: buildTosProcedure(
      customer.tosStatus,
      live.tosStatus,
      customer.tosLink,
    ),
    kyc: buildKycProcedure(
      customer.kycStatus,
      live.kycStatus,
      customer.kycLink,
    ),
  };
}

async function loadCurrencyStatuses(
  customer: BankCustomer,
  { db }: { db: DatabaseInstance },
): Promise<BankCurrencyPublicStatus[]> {
  const accounts = await findBankVirtualAccountsByCustomer(
    { bankCustomerId: customer.id },
    { db },
  );

  let endorsementStatusMap: BridgeEndorsementStatusMap | undefined;
  let customerId = customer.providerCustomerId;
  if (!customerId) {
    try {
      const live = await fetchBridgeKycLinkLive(customer);
      customerId = live?.providerCustomerId ?? null;
    } catch (error) {
      console.error(
        'Bridge KYC live read failed while loading currency statuses:',
        error,
      );
    }
  }

  if (customerId) {
    try {
      endorsementStatusMap = await fetchBridgeCustomerEndorsementStatuses(
        customerId,
      );
    } catch (error) {
      console.error(
        'Bridge customer endorsement read failed while loading bank status:',
        error,
      );
    }
  }

  return buildBankCurrencyPublicStatuses({
    customer,
    accounts,
    endorsementStatusMap,
  });
}

function withCurrencyStatuses(
  base: Omit<SpaceBankCustomerPublicStatus, 'currencyStatuses'>,
  currencyStatuses: BankCurrencyPublicStatus[],
): SpaceBankCustomerPublicStatus {
  return {
    ...base,
    currencyStatuses,
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

  const currencyStatuses = await loadCurrencyStatuses(customer, { db });
  const approvalRegistered = customer.kycStatus === 'approved';

  if (approvalRegistered) {
    return withCurrencyStatuses(
      {
        name: customer.name,
        contactEmail: customer.contactEmail,
        kycStatus: customer.kycStatus,
        tosStatus: customer.tosStatus,
        kycLink: customer.kycLink,
        tosLink: customer.tosLink,
        isApproved: true,
        approvalRegistered: true,
        procedures: buildProceduresFromDb(customer),
      },
      currencyStatuses,
    );
  }

  try {
    const live = await fetchBridgeKycLinkLive(customer);
    if (live) {
      return withCurrencyStatuses(
        {
          name: customer.name,
          contactEmail: customer.contactEmail,
          kycStatus: customer.kycStatus,
          tosStatus: customer.tosStatus,
          kycLink: customer.kycLink,
          tosLink: customer.tosLink,
          isApproved: live.isKycApproved,
          approvalRegistered: false,
          procedures: buildProceduresWithLive(customer, live),
        },
        currencyStatuses,
      );
    }
  } catch (error) {
    console.error(
      'Bridge KYC live read failed while loading bank customer status:',
      error,
    );
  }

  return withCurrencyStatuses(
    {
      name: customer.name,
      contactEmail: customer.contactEmail,
      kycStatus: customer.kycStatus,
      tosStatus: customer.tosStatus,
      kycLink: customer.kycLink,
      tosLink: customer.tosLink,
      isApproved: false,
      approvalRegistered: false,
      procedures: buildProceduresFromDb(customer),
    },
    currencyStatuses,
  );
}
