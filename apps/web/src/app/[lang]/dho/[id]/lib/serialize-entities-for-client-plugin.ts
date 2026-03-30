import type { Person, Space } from '@hypha-platform/core/client';

/**
 * Server-fetched Space/Person rows include nested graphs and `Date` fields that
 * are not safe to pass from a Server Component into client components (Next.js
 * production often surfaces this as the generic "Server Components render" error).
 *
 * Issue-new-token (and similar plugins) only need a shallow subset for comboboxes.
 */
export function toClientPluginPeople(people: Person[]): Person[] {
  return people.map((p) => ({
    id: p.id,
    name: p.name,
    surname: p.surname,
    email: p.email,
    slug: p.slug,
    sub: p.sub,
    avatarUrl: p.avatarUrl,
    leadImageUrl: p.leadImageUrl,
    description: p.description,
    location: p.location,
    nickname: p.nickname,
    address: p.address,
    links: p.links ?? [],
    createdAt: new Date(0),
    updatedAt: new Date(0),
  }));
}

export function toClientPluginSpaces(spaces: Space[]): Space[] {
  return spaces.map((s) => ({
    id: s.id,
    logoUrl: s.logoUrl,
    leadImage: s.leadImage,
    title: s.title,
    description: s.description,
    slug: s.slug,
    parentId: s.parentId,
    web3SpaceId: s.web3SpaceId,
    links: s.links ?? [],
    categories: s.categories ?? [],
    address: s.address,
    flags: s.flags ?? [],
    memberCount: s.memberCount,
    memberAddresses: s.memberAddresses,
    documentCount: s.documentCount,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  }));
}
