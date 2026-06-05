import type { BankCustomerPublicStatus } from './hooks/types';
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
  const tosUrl = procedureLink(tos);
  const kycUrl = procedureLink(kyc);

  if (tosUrl && !tos.linkDisabled) {
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

export function openBankVerificationTosLink(
  status: BankCustomerPublicStatus | null | undefined,
): boolean {
  return openBankVerificationFlowLink(status);
}
