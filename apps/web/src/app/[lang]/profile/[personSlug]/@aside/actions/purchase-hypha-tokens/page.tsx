import { SidePanel, ButtonBack, ButtonClose } from '@hypha-platform/epics';

type PageProps = {
  params: Promise<{ lang: string; personSlug: string }>;
};

export default async function PurchaseHyphaTokensProfile(props: PageProps) {
  const { lang, personSlug } = await props.params;
  return (
    <SidePanel>
      <div className="flex flex-col gap-5">
        <div className="flex gap-5 justify-between">
          <h2 className="text-4 text-secondary-foreground justify-start items-center">
            Buy Hypha Tokens (Rewards)
          </h2>
          <div className="flex gap-5 justify-end items-center">
            <ButtonBack
              label="Back to actions"
              backUrl={`/${lang}/profile/${personSlug}/actions`}
            />
            <ButtonClose closeUrl={`/${lang}/profile/${personSlug}`} />
          </div>
        </div>
      </div>
    </SidePanel>
  );
}
