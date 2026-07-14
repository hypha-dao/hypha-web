import 'server-only';

import { findPeopleByWeb3Addresses } from '../../people/server/queries';
import { findSpaceByAddresses } from '../../space/server/queries';
import type { DatabaseInstance } from '../../server';

export type EnergyParticipantDisplay = {
  displayName: string;
  avatarUrl?: string | null;
  subtitle?: string | null;
  profileSlug?: string | null;
  kind: 'person' | 'space' | 'institutional';
};

export type ResolveEnergyParticipantsInput = {
  addresses: string[];
  spaceSlug?: string;
  memberDeviceIds?: Map<string, number[] | null>;
  institutionalByDevice?: Record<
    number,
    { displayName: string; avatarUrl?: string; subtitle?: string }
  >;
};

const personFullName = (person: {
  name?: string | null;
  surname?: string | null;
  nickname?: string | null;
}) => {
  const full = [person.name, person.surname].filter(Boolean).join(' ').trim();
  return full || person.nickname || null;
};

/**
 * Resolve wallet addresses to Hypha people or spaces for Energy tab display.
 * Falls back to per-space institutional labels (by meter device id) when
 * neither a person nor a space profile exists — e.g. school / farm demo wallets.
 */
export async function resolveEnergyParticipants(
  {
    addresses,
    spaceSlug,
    memberDeviceIds,
    institutionalByDevice,
  }: ResolveEnergyParticipantsInput,
  { db }: { db: DatabaseInstance },
): Promise<Record<string, EnergyParticipantDisplay>> {
  const unique = Array.from(
    new Set(addresses.map((a) => a.toLowerCase()).filter(Boolean)),
  );
  if (unique.length === 0) return {};

  const [people, spacesResult] = await Promise.all([
    findPeopleByWeb3Addresses({ addresses: unique }, { db }),
    findSpaceByAddresses(unique, {}, { db }),
  ]);
  const spaces = spacesResult.data;

  const peopleByAddress = new Map(
    people.filter((p) => p.address).map((p) => [p.address!.toLowerCase(), p]),
  );
  const spacesByAddress = new Map(
    spaces.filter((s) => s.address).map((s) => [s.address!.toLowerCase(), s]),
  );

  const result: Record<string, EnergyParticipantDisplay> = {};

  for (const address of unique) {
    const person = peopleByAddress.get(address);
    if (person) {
      const displayName = personFullName(person);
      if (displayName) {
        result[address] = {
          displayName,
          avatarUrl: person.avatarUrl ?? null,
          subtitle: person.nickname
            ? `@${person.nickname}`
            : person.location ?? null,
          profileSlug: person.slug ?? null,
          kind: 'person',
        };
        continue;
      }
    }

    const space = spacesByAddress.get(address);
    if (space?.title) {
      result[address] = {
        displayName: space.title,
        avatarUrl: space.logoUrl ?? null,
        subtitle: space.slug ? `@${space.slug}` : null,
        profileSlug: null,
        kind: 'space',
      };
      continue;
    }

    const deviceIds = memberDeviceIds?.get(address);
    if (
      institutionalByDevice &&
      deviceIds?.length === 1 &&
      institutionalByDevice[deviceIds[0]!]
    ) {
      const inst = institutionalByDevice[deviceIds[0]!]!;
      result[address] = {
        displayName: inst.displayName,
        avatarUrl: inst.avatarUrl ?? null,
        subtitle: inst.subtitle ?? null,
        profileSlug: null,
        kind: 'institutional',
      };
      continue;
    }

    // Unused: spaceSlug kept for future per-space config from DB.
    void spaceSlug;
  }

  return result;
}

/** Ponta do Sol demo — institutional wallets without Hypha person profiles. */
export const PONTA_DO_SOL_INSTITUTIONAL_BY_DEVICE: Record<
  number,
  { displayName: string; avatarUrl?: string; subtitle?: string }
> = {
  1: {
    displayName: 'Escola Básica e Secundária da Ponta do Sol',
    subtitle: 'School consumption · meter 1',
    avatarUrl:
      'https://ui-avatars.com/api/?name=Escola+Ponta+do+Sol&background=2563eb&color=fff&size=128',
  },
  10: {
    displayName: 'Quinta da Bananeira',
    subtitle: 'Banana farm · meter 10',
    avatarUrl:
      'https://ui-avatars.com/api/?name=Quinta+Bananeira&background=ca8a04&color=fff&size=128',
  },
};

export function institutionalLabelsForSpace(
  spaceSlug: string | undefined,
):
  | Record<
      number,
      { displayName: string; avatarUrl?: string; subtitle?: string }
    >
  | undefined {
  if (spaceSlug === 'ponta-do-sol') {
    return PONTA_DO_SOL_INSTITUTIONAL_BY_DEVICE;
  }
  return undefined;
}
