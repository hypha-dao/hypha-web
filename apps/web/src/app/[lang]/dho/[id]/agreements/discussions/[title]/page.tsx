import { Locale } from '@hypha-platform/i18n';

type PageProps = {
  params: { lang: Locale; id: string };
};

export default async function DiscussionsDetailsPage({
  params: { lang, id },
}: PageProps) {
  
  return (
    <div>
      Panel
    </div>
  )
}
