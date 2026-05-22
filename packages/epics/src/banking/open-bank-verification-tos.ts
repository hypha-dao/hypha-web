import type { BankCustomerPublicStatus } from './hooks/types';

export function openBankVerificationTosLink(
  status: BankCustomerPublicStatus | null | undefined,
): boolean {
  if (!status || status.approvalRegistered) {
    return false;
  }

  const { tos } = status.procedures;
  if (!tos.link || tos.linkDisabled) {
    return false;
  }

  window.open(tos.link, '_blank', 'noopener,noreferrer');
  return true;
}
