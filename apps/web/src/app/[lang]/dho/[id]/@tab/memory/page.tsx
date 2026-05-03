import {
  SpaceMemorySection,
  SpaceTabAccessWrapper,
} from '@hypha-platform/epics';
import { getEnableSpaceMemory } from '@hypha-platform/feature-flags';
import { Locale } from '@hypha-platform/i18n';
import { redirect } from 'next/navigation';
import { getDhoPathAgreements } from '../agreements/constants';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function MemoryPage(props: PageProps) {
  const params = await props.params;
  const memoryEnabled = await getEnableSpaceMemory();

  if (!memoryEnabled) {
    redirect(getDhoPathAgreements(params.lang, params.id));
  }

  const { id } = params;

  return (
    <SpaceTabAccessWrapper spaceSlug={id}>
      <div className="flex flex-col gap-4 py-4">
        <SpaceMemorySection spaceSlug={id} />
      </div>
    </SpaceTabAccessWrapper>
  );
}
