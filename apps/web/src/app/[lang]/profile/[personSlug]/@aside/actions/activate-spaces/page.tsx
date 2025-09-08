import { getAllSpaces, Space } from '@hypha-platform/core/server';
import { SidePanel, ButtonBack, ButtonClose } from '@hypha-platform/epics';

type PageProps = {
  params: Promise<{ lang: string; personSlug: string }>;
};

export default async function PurchaseHyphaTokensProfile(props: PageProps) {
  const { lang, personSlug } = await props.params;

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
          Support and activate your favourite spaces by contributing in HYPHA or
          USDC for selected months.
        </span>
        {error ? (
          <div className="text-error text-sm">
            {error}. Please try again later.
          </div>
        ) : null}
      </div>
    </SidePanel>
  );
}
