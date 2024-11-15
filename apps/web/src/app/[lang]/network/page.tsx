import { Locale } from '@hypha-platform/i18n';

type PageProps = {
  params: { lang: Locale; id: string };
};

export default async function Index({ params: { lang } }: PageProps) {
  return (<div></div>)
}