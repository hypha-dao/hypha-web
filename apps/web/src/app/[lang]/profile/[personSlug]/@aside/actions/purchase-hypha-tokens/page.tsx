import { getAllSpaces, Space } from '@hypha-platform/core/server';
import {
  SidePanel,
  ButtonBack,
  ButtonClose,
  ProfilePageParams,
} from '@hypha-platform/epics';
import { PeoplePurchaseHyphaTokens } from '@hypha-platform/epics';
import { tryDecodeUriPart } from '@hypha-platform/ui-utils';
import { getTranslations } from 'next-intl/server';

type PageProps = {
  params: Promise<ProfilePageParams>;
};

export default async function PurchaseHyphaTokensProfile(props: PageProps) {
  const { lang, personSlug: personSlugRaw } = await props.params;
  const tActions = await getTranslations('ProfileActions');
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
            {tActions('purchaseHypha.title')}
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
          {tActions('purchaseHypha.content')}
        </span>
        {hasError ? (
          <div className="text-error text-sm">
            {tActions('errors.loadSpaces')}
          </div>
        ) : (
          <PeoplePurchaseHyphaTokens
            spaces={filteredSpaces}
            personSlug={personSlug}
          />
        )}
      </div>
    </SidePanel>
  );
}
