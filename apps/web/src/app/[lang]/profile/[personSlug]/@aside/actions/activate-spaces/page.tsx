import { getAllSpaces, Space } from '@hypha-platform/core/server';
import {
  SidePanel,
  ButtonBack,
  ButtonClose,
  ActivateSpacesForm,
  ProfilePageParams,
} from '@hypha-platform/epics';
import { Separator } from '@hypha-platform/ui';
import { tryDecodeUriPart } from '@hypha-platform/ui-utils';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

type PageProps = {
  params: Promise<ProfilePageParams>;
};

export default async function ActivateSpacesProfile(props: PageProps) {
  const { lang, personSlug: personSlugRaw } = await props.params;
  const tActions = await getTranslations('ProfileActions');
  const tFooter = await getTranslations('Footer');
  const personSlug = tryDecodeUriPart(personSlugRaw);

  let spaces = [] as Space[];
  let hasError = false;

  try {
    spaces = await getAllSpaces({
      parentOnly: false,
      omitSandbox: false,
    });
  } catch (err) {
    console.error('Failed to fetch spaces:', err);
    hasError = true;
  }

  const filteredSpaces = spaces?.filter(
    (space) => space?.address && space.address.trim() !== '',
  );

  return (
    <SidePanel>
      <div className="flex flex-col gap-5">
        <div className="flex gap-5 justify-between">
          <h2 className="text-4 text-secondary-foreground justify-start items-center">
            {tActions('activateSpaces.title')}
          </h2>
          <div className="flex gap-5 justify-end items-center">
            <ButtonBack
              label={tActions('backToActions')}
              backUrl={`/${lang}/profile/${personSlug}/actions`}
            />
            <ButtonClose closeUrl={`/${lang}/profile/${personSlug}`} />
          </div>
        </div>
        <span className="text-2 text-neutral-11">
          {tActions('activateSpaces.contentPrefix')}{' '}
          <Link
            className="text-accent-9 underline"
            href={
              process.env.NEXT_PUBLIC_HYPHA_TOKENOMICS_DOCS_URL ??
              'https://assets.hypha.earth/files/Tokenomics_Paper.pdf'
            }
            target="_blank"
          >
            {tFooter('hyphaTokenomics')}
          </Link>
          {tActions('activateSpaces.contentSuffix')}
        </span>
        {hasError ? (
          <div className="text-error text-sm">{tActions('errors.loadSpaces')}</div>
        ) : null}
        <Separator />
        <ActivateSpacesForm spaces={filteredSpaces} />
      </div>
    </SidePanel>
  );
}
