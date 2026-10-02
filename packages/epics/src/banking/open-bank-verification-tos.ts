import type { BankCustomerPublicStatus, BankProvider } from './hooks/types';
import { procedureLink } from './banking-ui';

export type BankVerificationLinks = {
  tosLink?: string | null;
  kycLink?: string | null;
};

function openLink(url: string): boolean {
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

function openFromStatus(status: BankCustomerPublicStatus): boolean {
  if (status.approvalRegistered) {
    return false;
  }

  const { tos, kyc } = status.procedures;
  const tosUrl = tos ? procedureLink(tos) : null;
  const kycUrl = procedureLink(kyc);

  if (tosUrl && !tos?.linkDisabled) {
    return openLink(tosUrl);
  }

  if (kycUrl && !kyc.linkDisabled) {
    return openLink(kycUrl);
  }

  return false;
}

function openFromLinks(links: BankVerificationLinks): boolean {
  if (links.tosLink) {
    return openLink(links.tosLink);
  }

  if (links.kycLink) {
    return openLink(links.kycLink);
  }

  return false;
}

export function openBankVerificationFlowLink(
  source: BankCustomerPublicStatus | null | undefined | BankVerificationLinks,
): boolean {
  if (!source) {
    return false;
  }

  if ('procedures' in source) {
    return openFromStatus(source);
  }

  return openFromLinks(source);
}

/**
 * Same as `openBankVerificationFlowLink`, but selects the entry for the provider that was just
 * submitted from a multi-provider status list (D11) instead of assuming a single Bridge-shaped
 * status. The DB query behind `statuses` defines no provider ordering, so opening "the first
 * actionable entry" could open an unrelated, older pending provider's link instead of the one the
 * caller just onboarded — `provider` pins it to the right entry.
 */
export function openBankVerificationFlowLinks(
  statuses: readonly BankCustomerPublicStatus[] | null | undefined,
  provider: BankProvider,
): boolean {
  const status = statuses?.find((entry) => entry.provider === provider);
  return status ? openFromStatus(status) : false;
}

export function openBankVerificationTosLink(
  status: BankCustomerPublicStatus | null | undefined,
): boolean {
  return openBankVerificationFlowLink(status);
}
