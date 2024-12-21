import { getDictionary, Locale } from '@hypha-platform/i18n';
import { AssignmentCreate } from '@hypha-platform/ui/server';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function AssignmentsPage(props: PageProps) {
  const params = await props.params;

  const { lang, id } = params;

  const t = await getDictionary(lang);
  return <AssignmentCreate title={t('Create Proposal')} />;
}
