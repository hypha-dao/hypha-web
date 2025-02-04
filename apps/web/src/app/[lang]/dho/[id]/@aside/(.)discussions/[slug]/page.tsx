import { DiscussionDetail } from '@hypha-platform/epics';
import {
  getCommentsByDiscussionSlug,
  getDiscussionBySlug,
} from '@hypha-platform/graphql/rsc';
import { SidePanel } from '../../_components/side-panel';
import { getDhoPathAgreements } from '../../../agreements/constants';
import { Locale } from '@hypha-platform/i18n';

type PageProps = {
  params: Promise<{ slug: string; id: string; lang: string }>;
};

export default async function Agreements(props: PageProps) {
  const params = await props.params;
  const { slug, id, lang } = params;
  const data = await getCommentsByDiscussionSlug({ slug });
  const discussion = await getDiscussionBySlug(slug);

  return (
    <SidePanel>
      <DiscussionDetail
        creator={discussion?.creator}
        title={discussion?.title}
        isLoading={false}
        content={discussion?.content ?? ''}
        image={discussion?.image ?? ''}
        messages={data}
        closeUrl={getDhoPathAgreements(lang as Locale, id as string)}
      />
    </SidePanel>
  );
}
