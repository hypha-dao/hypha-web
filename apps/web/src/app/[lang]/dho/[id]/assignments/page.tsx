import { Locale } from '@hypha-platform/i18n';
import { AssignmentsGraph } from '@hypha-platform/ui/server';
import { PATH_SEGMENT_LANG } from '../../../constants';
import { PATH_SEGMENT_DHO_ID } from '../constants';
import { PATH_ASSIGNMENTS_CREATE } from './create/constants';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function AssignmentsPage(props: PageProps) {
  const params = await props.params;

  const { lang, id } = params;

  const createAssignmentPat = PATH_ASSIGNMENTS_CREATE.replace(
    PATH_SEGMENT_LANG,
    lang
  ).replace(PATH_SEGMENT_DHO_ID, id);
  console.debug('AssignmentsPage', { createAssignmentPat });
  return <AssignmentsGraph />;
}
