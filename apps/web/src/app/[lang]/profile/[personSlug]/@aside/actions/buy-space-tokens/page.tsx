import {
  ProposalOverlayShell,
  ModalStickyNavigation,
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
  const tModalAside = await getTranslations('ModalAside');
  const personSlug = tryDecodeUriPart(personSlugRaw);
  const closeUrl = `/${lang}/profile/${personSlug}`;

  return (
    <ProposalOverlayShell>
      <div className="flex flex-col gap-5">
        <ModalStickyNavigation
          contextTitle={tModalAside('buySpaceTokens')}
          closeUrl={closeUrl}
          backUrl={`/${lang}/profile/${personSlug}/actions`}
          backLabel={t('actions.buySpaceTokens.backLabel')}
        />
        <span className="text-2 text-neutral-11">
          {t('actions.buySpaceTokens.description')}
        </span>
        <PeopleBuySpaceTokens personSlug={personSlug} closeUrl={closeUrl} />
      </div>
    </ProposalOverlayShell>
  );
}
