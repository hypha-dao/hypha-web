import {
  SidePanel,
  ButtonBack,
  ButtonClose,
  ProfilePageParams,
  PeopleBuySpaceTokens,
} from '@hypha-platform/epics';
import { tryDecodeUriPart } from '@hypha-platform/ui-utils';

type PageProps = {
  params: Promise<ProfilePageParams>;
};

export default async function BuySpaceTokensProfile(props: PageProps) {
  const { lang, personSlug: personSlugRaw } = await props.params;
  const personSlug = tryDecodeUriPart(personSlugRaw);

  return (
    <SidePanel>
      <div className="flex flex-col gap-5">
        <div className="flex gap-5 justify-between">
          <h2 className="text-4 text-secondary-foreground justify-start items-center">
            Buy Space Tokens
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
          Purchase your space&apos;s native tokens using the configured payment
          currency.
        </span>
        <PeopleBuySpaceTokens personSlug={personSlug} />
      </div>
    </SidePanel>
  );
}
