import { ProfilePageParams, ProfileRedeemTokens } from '@hypha-platform/epics';
import { tryDecodeUriPart } from '@hypha-platform/ui-utils';

type PageProps = {
  params: Promise<ProfilePageParams>;
};

export default async function ProfileRedeemTokensWrapper(props: PageProps) {
  const { lang, personSlug: personSlugRaw } = await props.params;
  const personSlug = tryDecodeUriPart(personSlugRaw);

  return <ProfileRedeemTokens lang={lang} personSlug={personSlug} />;
}
