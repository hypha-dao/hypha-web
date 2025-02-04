import { DiscussionDetail } from '@hypha-platform/epics';
import { getDiscussionBySlug } from '@hypha-platform/graphql/rsc';
import { getCommentsByDiscussionSlug } from '@hypha-platform/graphql/rsc';
import { Locale } from '@hypha-platform/i18n';
import { Paths } from 'apps/web/src/app/constants';

type PageProps = {
  params: Promise<{ slug: string; id: string; lang: string }>;
};

export default async function Agreements(props: PageProps) {
  const params = await props.params;
  const { slug, id, lang } = params;
  const data = await getCommentsByDiscussionSlug({ slug });
  const discussion = await getDiscussionBySlug(slug);

  return (
    <DiscussionDetail
      creator={discussion?.creator}
      title={discussion?.title}
      isLoading={false}
      content={discussion?.content ?? ''}
      image={discussion?.image ?? ''}
      messages={data}
      closeUrl={Paths.dho.agreements(lang as Locale, id as string)}
    />
  );
}
