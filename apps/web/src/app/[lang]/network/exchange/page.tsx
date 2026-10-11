import { Locale } from '@hypha-platform/i18n';
import { Container } from '@hypha-platform/ui';
import { findAllSpaces, readSpaceCapitals } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { NetworkExchangeView, NetworkSectionNav } from '@hypha-platform/epics';

export default async function ExchangePage(props: {
  params: Promise<{ lang: Locale }>;
}) {
  const { lang } = await props.params;
  const rows = await findAllSpaces(
    { db },
    { parentOnly: false, omitArchived: true },
  ).catch(() => []);
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
      seeks: forms?.seeks ?? [],
      offers: forms?.offers ?? [],
    };
  });

  return (
    <Container className="flex flex-col gap-6 py-8">
      <NetworkSectionNav lang={lang} />
      <NetworkExchangeView lang={lang} spaces={spaces} />
    </Container>
  );
}
