import type { NetworkPerson } from './network-pulse';

export type PersonDirectorySource = {
  id?: number;
  slug?: string | null;
  name?: string | null;
  surname?: string | null;
  nickname?: string | null;
  avatarUrl?: string | null;
  avatar?: string | null;
  image?: string | null;
  networkVisible?: boolean | null;
};

function personDisplayName(person: PersonDirectorySource): string {
  return (
    [person.name, person.surname].filter(Boolean).join(' ') ||
    person.nickname ||
    person.slug ||
    ''
  );
}

export function personAvatarUrl(person: PersonDirectorySource): string | null {
  const raw = person.avatarUrl ?? person.avatar ?? person.image;
  const trimmed = raw?.trim();
  return trimmed || null;
}

export function toNetworkPerson(
  person: PersonDirectorySource,
): NetworkPerson | null {
  const slug = person.slug?.trim();
  if (!slug || person.networkVisible === false) return null;
  return {
    id: person.id,
    slug,
    name: personDisplayName(person) || slug,
    avatarUrl: personAvatarUrl(person),
    networkVisible: true,
  };
}
