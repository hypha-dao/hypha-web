import { count, countDistinct, eq } from 'drizzle-orm';
import { Locale } from '@hypha-platform/i18n';
import { Container } from '@hypha-platform/ui';
import { findAllSpaces, readSpaceCapitals } from '@hypha-platform/core/server';
import {
  db,
  documents,
  memberships,
  spaces as spaceRows,
} from '@hypha-platform/storage-postgres';
import { NetworkExchangeView } from '@hypha-platform/epics';

async function readCount(
  query: PromiseLike<readonly { value: unknown }[]>,
): Promise<number | null> {
  try {
    const rows = await query;
    const value = Number(rows[0]?.value);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export default async function ExchangePage(props: {
  params: Promise<{ lang: Locale }>;
}) {
  const { lang } = await props.params;
  const rows = await findAllSpaces(
    { db },
    { parentOnly: false, omitArchived: true },
  ).catch(() => []);
  const [members, agreements] = await Promise.all([
    readCount(
      db
        .select({ value: countDistinct(memberships.personId) })
        .from(memberships)
        .innerJoin(spaceRows, eq(spaceRows.id, memberships.spaceId))
        .where(eq(spaceRows.isArchived, false)),
    ),
    readCount(
      db
        .select({ value: count() })
        .from(documents)
        .where(eq(documents.state, 'agreement')),
    ),
  ]);
  const shown = rows.slice(0, 48);
  const capitals = await readSpaceCapitals(
    db,
    shown.map((space) => space.id),
  ).catch(() => new Map());
  const spaces = shown.map((space) => {
    const forms = capitals.get(space.id);
    return {
      id: space.id,
      slug: space.slug,
      title: space.title,
      description: space.description ?? '',
      place: space.locationLabel ?? '',
      chatRoomId: space.chatRoomId ?? null,
      leadImage: space.leadImage ?? null,
      latitude: space.latitude ?? null,
      longitude: space.longitude ?? null,
      seeks: forms?.seeks ?? [],
      offers: forms?.offers ?? [],
    };
  });

  return (
    <Container className="flex flex-col gap-6 py-8">
      <NetworkExchangeView
        lang={lang}
        spaces={spaces}
        stats={{ spaces: rows.length, members, agreements }}
      />
    </Container>
  );
}
