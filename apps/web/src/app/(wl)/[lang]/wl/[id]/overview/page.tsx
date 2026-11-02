import { SpaceOpsHome } from '@web/app/(main)/[lang]/dho/[id]/@tab/overview/_components/space-ops-home';
export default async function P({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SpaceOpsHome spaceSlug={id} />;
}
