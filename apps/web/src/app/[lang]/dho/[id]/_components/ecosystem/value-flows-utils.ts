import type { TransferWithEntity } from '@hypha-platform/epics';
import type { MyceliumNodeKind } from './types';

export function normalizeAddress(address: string): string {
  return address.toLowerCase();
}

export function counterpartyAddress(transfer: TransferWithEntity): string {
  const raw = transfer.direction === 'outgoing' ? transfer.to : transfer.from;
  return normalizeAddress(raw);
}

export function recipientId(transfer: TransferWithEntity): string {
  const address = counterpartyAddress(transfer);
  if (transfer.space?.title) {
    return `space-${transfer.space.title}-${address}`;
  }
  if (transfer.person?.name || transfer.person?.surname) {
    return `person-${transfer.person.name ?? ''}-${
      transfer.person.surname ?? ''
    }-${address}`;
  }
  return `addr-${address}`;
}

export function recipientLabel(transfer: TransferWithEntity): string {
  if (transfer.space?.title) return transfer.space.title;
  const personName = [transfer.person?.name, transfer.person?.surname]
    .filter(Boolean)
    .join(' ');
  if (personName) return personName;
  const address = counterpartyAddress(transfer);
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function recipientKind(transfer: TransferWithEntity): MyceliumNodeKind {
  if (transfer.space?.title) return 'space';
  if (transfer.person) return 'person';
  return 'external';
}

export function recipientImage(
  transfer: TransferWithEntity,
): string | null | undefined {
  return transfer.space?.avatarUrl || transfer.person?.avatarUrl;
}

export function transferTime(transfer: TransferWithEntity): number {
  const raw = transfer.timestamp;
  if (typeof raw === 'number') {
    // Alchemy sometimes returns seconds
    return raw < 1e12 ? raw * 1000 : raw;
  }
  const parsed = new Date(raw).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export const CRYPTO_NUMBER_FORMAT = {
  maximumFractionDigits: 8,
  minimumFractionDigits: 0,
} as const;
