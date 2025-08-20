import { Text } from '@radix-ui/themes';
import Link from 'next/link';
import { PlusIcon } from '@radix-ui/react-icons';
import { UseMembers, InnerSpaceCardWrapper } from '@hypha-platform/epics';
import { DEFAULT_SPACE_LEAD_IMAGE, Space } from '@hypha-platform/core/client';
import { Locale } from '@hypha-platform/i18n';
import { AuthenticatedLinkButton } from '../../../../../apps/web/src/app/[lang]/dho/[id]/_components/authenticated-link-button';

interface SubspaceSectionProps {
  getSpaceDetailLink: (lang: Locale, id: string) => string;
  spaces: Space[];
  lang: Locale;
  useMembers: UseMembers;
}

export const SubspaceSection = ({
  spaces,
  lang,
  getSpaceDetailLink,
  useMembers,
}: SubspaceSectionProps) => {
  return (
    <div className="flex flex-col gap-4">
      <div className="justify-between items-center flex">
        <Text className="text-4">Inner Spaces | {spaces.length}</Text>
        <div className="flex items-center">
          <AuthenticatedLinkButton href={`membership/space/create`}>
            <PlusIcon />
            Create Inner Space
          </AuthenticatedLinkButton>
        </div>
      </div>
      {!spaces.length ? (
        <span className="text-2 text-center text-neutral-11">
          {' '}
          No sub-spaces
        </span>
      ) : (
        <div
          data-testid="sub-spaces-container"
          className="grid grid-cols-1 sm:grid-cols-3 gap-3"
        >
          {spaces.map((space) => (
            <div key={space.id} className="mb-1">
              <Link href={getSpaceDetailLink(lang, space.slug as string)}>
                <InnerSpaceCardWrapper
                  spaceSlug={space.slug}
                  title={space.title}
                  description={space.description as string}
                  leadImageUrl={space.leadImage || DEFAULT_SPACE_LEAD_IMAGE}
                  useMembers={useMembers}
                />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
