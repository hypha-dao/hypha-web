type EcosystemSpaceRow = {
  id: number;
  slug: string;
  title: string;
  parent_id: number | null;
};

const CHILD_LIMIT = 8;
const OTHER_LIMIT = 6;
const ABOUT_LIMIT = 180;

function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function articleFor(word: string): string {
  return /^[aeiou]/i.test(word) ? 'an' : 'a';
}

export function formatSignedInMemberLine(person: {
  name?: string | null;
  surname?: string | null;
  nickname?: string | null;
  description?: string | null;
  primaryOrientation?: string | null;
  networkOffer?: string | null;
}): string {
  const name =
    clean([person.name, person.surname].filter(Boolean).join(' ')) ||
    (person.nickname ? clean(person.nickname) : '') ||
    'the signed-in member';
  const orientation =
    person.primaryOrientation === 'member' ||
    person.primaryOrientation === 'builder' ||
    person.primaryOrientation === 'investor'
      ? person.primaryOrientation
      : null;
  const about = person.description ? clean(person.description) : '';
  const offer = person.networkOffer ? clean(person.networkOffer) : '';
  const parts = [`Signed-in member: ${name}.`];
  if (orientation) {
    parts.push(`They show up as ${articleFor(orientation)} ${orientation}.`);
  }
  if (orientation === 'member') {
    parts.push(
      'Stay with their contribution to the spaces they belong to. The next step is the work waiting there.',
    );
  }
  if (orientation === 'builder') {
    parts.push(
      'Help them shape a space and find the resources it seeks. The next step is that space.',
    );
  }
  if (orientation === 'investor') {
    parts.push(
      'Help them find one project to resource. The next step is a project whose seek matches what they support.',
    );
  }
  if (about) {
    const clipped =
      about.length > ABOUT_LIMIT
        ? `${about.slice(0, ABOUT_LIMIT).trim()}…`
        : about;
    parts.push(`In their own words: ${clipped}`);
  }
  if (offer) {
    const clipped =
      offer.length > ABOUT_LIMIT
        ? `${offer.slice(0, ABOUT_LIMIT).trim()}…`
        : offer;
    parts.push(`They offered this to the network: ${clipped}`);
  }
  parts.push(
    'You already know them. Do not ask their name, how they show up, or which space this is.',
  );
  return parts.join(' ');
}

export function formatEcosystemLines(input: {
  spaceSlug: string;
  rootSpaceSlug: string | null;
  spaces: EcosystemSpaceRow[];
}): string | null {
  const spaces = input.spaces.filter(
    (space) =>
      Number.isFinite(space.id) &&
      typeof space.slug === 'string' &&
      space.slug.trim() &&
      typeof space.title === 'string' &&
      space.title.trim(),
  );
  if (spaces.length === 0) return null;

  const current =
    spaces.find((space) => space.slug === input.spaceSlug) ?? null;
  const root = input.rootSpaceSlug
    ? spaces.find((space) => space.slug === input.rootSpaceSlug) ?? null
    : null;
  const parent =
    current?.parent_id != null
      ? spaces.find((space) => space.id === current.parent_id) ?? null
      : null;
  const children = current
    ? spaces
        .filter((space) => space.parent_id === current.id)
        .slice(0, CHILD_LIMIT)
    : [];
  const named = new Set(
    [
      current?.slug,
      root?.slug,
      parent?.slug,
      ...children.map((space) => space.slug),
    ].filter((slug): slug is string => Boolean(slug)),
  );
  const others = spaces
    .filter((space) => !named.has(space.slug))
    .slice(0, OTHER_LIMIT);

  const lines = [
    'Ecosystem around this space. These are records. Do not invent a space, a parent, or a person.',
  ];
  if (root && root.slug !== current?.slug) {
    lines.push(`Root: ${clean(root.title)}.`);
  }
  if (parent && parent.slug !== root?.slug) {
    lines.push(`Parent: ${clean(parent.title)}.`);
  }
  if (children.length > 0) {
    lines.push(
      `Nested here: ${children.map((space) => clean(space.title)).join(', ')}.`,
    );
  }
  if (others.length > 0) {
    lines.push(
      `Also in this organisation: ${others
        .map((space) => clean(space.title))
        .join(', ')}.`,
    );
  }
  if (spaces.length <= 1) {
    lines.push('This space stands alone in its organisation.');
  }
  lines.push(
    'The collective is these spaces and the people in them. Speak as someone who sees how they sit together.',
  );
  return lines.join('\n');
}

export function readEcosystemRows(result: unknown): {
  spaceSlug: string;
  rootSpaceSlug: string | null;
  spaces: EcosystemSpaceRow[];
} | null {
  if (!result || typeof result !== 'object') return null;
  const row = result as {
    found?: unknown;
    space_slug?: unknown;
    root_space_slug?: unknown;
    spaces?: unknown;
  };
  if (row.found !== true || typeof row.space_slug !== 'string') return null;
  if (!Array.isArray(row.spaces)) return null;
  const spaces: EcosystemSpaceRow[] = [];
  for (const entry of row.spaces) {
    if (!entry || typeof entry !== 'object') continue;
    const space = entry as {
      id?: unknown;
      slug?: unknown;
      title?: unknown;
      parent_id?: unknown;
    };
    if (typeof space.id !== 'number' || typeof space.slug !== 'string') {
      continue;
    }
    if (typeof space.title !== 'string') continue;
    spaces.push({
      id: space.id,
      slug: space.slug,
      title: space.title,
      parent_id: typeof space.parent_id === 'number' ? space.parent_id : null,
    });
  }
  return {
    spaceSlug: row.space_slug,
    rootSpaceSlug:
      typeof row.root_space_slug === 'string' ? row.root_space_slug : null,
    spaces,
  };
}
