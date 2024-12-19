import { Locale } from '@hypha-platform/i18n';

export default async function DetailsPanel({
}: {
  params: { id: string; lang: Locale };
}) {
  return (
    <div>Panel</div>
  );
}
