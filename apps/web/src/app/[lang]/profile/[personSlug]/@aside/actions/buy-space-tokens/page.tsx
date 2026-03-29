import {
  SidePanel,
  ButtonBack,
  ButtonClose,
  ProfilePageParams,
  PeopleBuySpaceTokens,
} from '@hypha-platform/epics';
import { tryDecodeUriPart } from '@hypha-platform/ui-utils';
import { getTranslations } from 'next-intl/server';

type PageProps = {
  params: Promise<ProfilePageParams>;
};

export default async function BuySpaceTokensProfile(props: PageProps) {
  const { lang, personSlug: personSlugRaw } = await props.params;
  const personSlug = tryDecodeUriPart(personSlugRaw);
  const closeUrl = `/${lang}/profile/${personSlug}`;
  const t = await getTranslations('ProfileActions.buySpaceTokens');

  return (
    <SidePanel>
      <div className="flex flex-col gap-5">
        <div className="flex gap-5 justify-between">
          <h2 className="text-4 text-secondary-foreground justify-start items-center">
            {t('title')}
          </h2>
          <div className="flex gap-5 justify-end items-center">
            <ButtonBack
              label={t('backLabel')}
              backUrl={`/${lang}/profile/${personSlug}/actions`}
            />
            <ButtonClose closeUrl={closeUrl} />
          </div>
        </div>
        <span className="text-2 text-neutral-11">
          {t('description')}
        </span>
        <PeopleBuySpaceTokens personSlug={personSlug} closeUrl={closeUrl} />
      </div>
    </SidePanel>
  );
}