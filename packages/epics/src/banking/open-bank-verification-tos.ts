import type { BankCustomerPublicStatus } from './hooks/types';

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

  if (tos.link && !tos.linkDisabled) {
    return openLink(tos.link);
  }

  if (kyc.link && !kyc.linkDisabled) {
    return openLink(kyc.link);
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

/**
 * Opens Bridge verification in a new tab. Prefers Terms of Service when still
 * pending; otherwise opens the KYB/KYC link. Bridge's hosted ToS flow continues
 * into the verification form after acceptance.
 */
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

/** @deprecated Use openBankVerificationFlowLink — kept for existing imports. */
export function openBankVerificationTosLink(
  status: BankCustomerPublicStatus | null | undefined,
): boolean {
  return openBankVerificationFlowLink(status);
}
