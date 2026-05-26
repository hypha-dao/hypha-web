import type { BankEndorsementPublicStatus, BankRailPublicStatus } from '../types';

const BRIDGE_ENDORSEMENT_DISPLAY_ORDER = [
  'base',
  'sepa',
  'spei',
  'pix',
  'faster_payments',
  'cop',
] as const;

function pickPrimaryRailForEndorsement(
  group: BankRailPublicStatus[],
): BankRailPublicStatus {
  return (
    group.find((rail) => rail.railKey === rail.currency) ??
    group.find((rail) => !rail.railKey.includes('-')) ??
    group[0]!
  );
}

export function mapEndorsementStatuses(
  rails: BankRailPublicStatus[],
): BankEndorsementPublicStatus[] {
  const groups = new Map<string, BankRailPublicStatus[]>();

  for (const rail of rails) {
    const list = groups.get(rail.endorsement) ?? [];
    list.push(rail);
    groups.set(rail.endorsement, list);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => {
      const leftIndex = BRIDGE_ENDORSEMENT_DISPLAY_ORDER.indexOf(
        left as (typeof BRIDGE_ENDORSEMENT_DISPLAY_ORDER)[number],
      );
      const rightIndex = BRIDGE_ENDORSEMENT_DISPLAY_ORDER.indexOf(
        right as (typeof BRIDGE_ENDORSEMENT_DISPLAY_ORDER)[number],
      );
      return (
        (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex)
      );
    })
    .map(([endorsement, group]) => {
      const primary = pickPrimaryRailForEndorsement(group);
      return {
        endorsement,
        endorsementStatus: primary.endorsementStatus,
        operationalStatus: primary.operationalStatus,
        validation: primary.validation,
      };
    });
}

export { pickPrimaryRailForEndorsement };
