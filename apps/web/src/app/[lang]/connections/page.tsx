import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Old address. Message links and bookmarks land on /messages. */
export default async function ConnectionsPage(props: PageProps) {
  const { lang } = await props.params;
  const search = await props.searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (typeof value === 'string') query.set(key, value);
    else if (Array.isArray(value)) {
      for (const entry of value) query.append(key, entry);
    }
  }
  const suffix = query.toString();
  redirect(`/${lang}/messages${suffix ? `?${suffix}` : ''}`);
}
