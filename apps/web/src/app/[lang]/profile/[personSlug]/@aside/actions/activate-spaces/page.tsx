import { getAllSpaces, Space } from '@hypha-platform/core/server';
import {
  SidePanel,
  ButtonBack,
  ButtonClose,
  ActivateSpacesForm,
  ProfilePageParams,
} from '@hypha-platform/epics';
import { Separator } from '@hypha-platform/ui';
import Link from 'next/link';

type PageProps = {
  params: Promise<ProfilePageParams>;
};

export default async function ActivateSpacesProfile(props: PageProps) {
  const { lang, personSlug: personSlugRaw } = await props.params;
  const personSlug = decodeURIComponent(personSlugRaw);

  let spaces = [] as Space[];
  let error = null;

  try {
    spaces = await getAllSpaces({
      parentOnly: false,
      omitSandbox: false,
    });
  } catch (err) {
    console.error('Failed to fetch spaces:', err);
    error = err instanceof Error ? err.message : 'Failed to load spaces';
  }

  const filteredSpaces = spaces?.filter(
    (space) => space?.address && space.address.trim() !== '',
  );

  return (
    <SidePanel>
      <div className="flex flex-col gap-5">
        <div className="flex gap-5 justify-between">
          <h2 className="text-4 text-secondary-foreground justify-start items-center">
            Activate Space(s)
          </h2>
          <div className="flex gap-5 justify-end items-center">
            <ButtonBack
              label="Back to actions"
              backUrl={`/${lang}/profile/${personSlug}/actions`}
            />
            <ButtonClose closeUrl={`/${lang}/profile/${personSlug}`} />
          </div>
        </div>
        <span className="text-2 text-neutral-11">
          Sponsor and activate your favourite space(s) by contributing HYPHA or
          USDC, supporting the Hypha Network. More details in{' '}
          <Link
            className="text-accent-9 underline"
            href={
              process.env.NEXT_PUBLIC_HYPHA_TOKENOMICS_DOCS_URL ??
              'https://assets.hypha.earth/files/Tokenomics_Paper.pdf'
            }
            target="_blank"
          >
            Hypha Tokenomics
          </Link>
          .
        </span>
        {error ? (
          <div className="text-error text-sm">
            {error}. Please try again later.
          </div>
        ) : null}
        <Separator />
        <ActivateSpacesForm spaces={filteredSpaces} />
      </div>
    </SidePanel>
  );
}
