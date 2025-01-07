import { DiscussionDetail } from "@hypha-platform/epics";
import { getCommentsByDiscussionSlug, getDiscussionBySlug } from "@hypha-platform/graphql/rsc";
import router from "next/router";

type PageProps = {
  params: Promise<{ slug: string, id: string, lang: string }>;
};

export default async function Agreements(props: PageProps) {
  const params = await props.params;
  const { slug, id, lang } = params;
  const data = await getCommentsByDiscussionSlug({ slug });
  const discussion = await getDiscussionBySlug(slug);

  return (
    <div className="sticky p-9 top-9 h-full bg-neutral-2 w-full flex-grow">
      <DiscussionDetail
        creator={discussion?.creator}
        title={discussion?.title}
        isLoading={false}
        content={discussion?.content ?? ''}
        image={discussion?.image ?? ''}
        messages={data}
        closeUrl={`/${lang}/dho/${id}/agreements`}
      />
    </div>
  );
}
