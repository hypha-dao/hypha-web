import {
  ProposalOverlayShell,
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
  const t = await getTranslations({
    locale: lang,
    namespace: 'ProfileActions',
  });
  const personSlug = tryDecodeUriPart(personSlugRaw);
  const closeUrl = `/${lang}/profile/${personSlug}`;

  return (
    <ProposalOverlayShell>
      <div className="flex flex-col gap-5">
        <div className="flex gap-5 justify-between">
          <h2 className="text-4 text-secondary-foreground justify-start items-center">
            {t('actions.buySpaceTokens.title')}
          </h2>
          <div className="flex gap-5 justify-end items-center">
            <ButtonBack
              label={t('actions.buySpaceTokens.backLabel')}
              backUrl={`/${lang}/profile/${personSlug}/actions`}
            />
            <ButtonClose closeUrl={closeUrl} />
          </div>
        </div>
        <span className="text-2 text-neutral-11">
          {t('actions.buySpaceTokens.description')}
        </span>
        <PeopleBuySpaceTokens personSlug={personSlug} closeUrl={closeUrl} />
      </div>
    </ProposalOverlayShell>
  );
}
