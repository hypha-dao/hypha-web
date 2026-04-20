import { SalesBanner } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { NestedSpacesButton } from './nested-spaces-button';
import { SpaceHeaderActionsRow } from './space-header-actions-row';
import { SPACE_HEADER_PURPOSE_MAX_CHARS } from './space-header-constants';
import { SpaceHeaderContextBar } from './space-header-context-bar';
import { SpaceHeaderHeroCard } from './space-header-hero-card';
import { SpaceHeaderIdentityCrumbs } from './space-header-identity-crumbs';
import { SpaceHeaderMenuBridge } from './space-header-menu-bridge';
import { SpaceHeaderShell } from './space-header-shell';
import { truncateByCodePoints } from './truncate-utf16';
import { getTranslations } from 'next-intl/server';

export type SpaceHeaderProps = {
  lang: Locale;
  daoSlug: string;
  spaceId: number;
  web3SpaceId: number | null;
  title: string;
  description: string | null;
  links?: string[] | null;
  logoUrl?: string | null;
  leadImage?: string | null;
  createdAt: Date;
  flags: string[];
  spaceMembers: number;
  spaceAgreements: number;
};

export async function SpaceHeader({
  lang,
  daoSlug,
  spaceId,
  web3SpaceId,
  title,
  description,
  links,
  logoUrl,
  leadImage,
  createdAt,
  flags,
  spaceMembers,
  spaceAgreements,
}: SpaceHeaderProps) {
  const rawPurpose = description?.trim() ?? '';
  const purposeDisplay = truncateByCodePoints(
    rawPurpose,
    SPACE_HEADER_PURPOSE_MAX_CHARS,
  );
  const hasPurpose = purposeDisplay.length > 0;

  const identity = (
    <SpaceHeaderIdentityCrumbs
      lang={lang}
      title={title}
      logoUrl={logoUrl ?? null}
    />
  );

  const navLink =
    typeof web3SpaceId === 'number' ? (
      <NestedSpacesButton
        variant="compactChrome"
        web3SpaceId={web3SpaceId}
        spaceSlug={daoSlug}
      />
    ) : null;

  return (
    <header className="mb-5 space-y-3" aria-labelledby="space-title">
      <SpaceHeaderShell
        menuBridge={<SpaceHeaderMenuBridge>{null}</SpaceHeaderMenuBridge>}
      >
        <SpaceHeaderContextBar identity={identity} trailing={navLink} />

        <SpaceHeaderHeroCard
          lang={lang}
          daoSlug={daoSlug}
          title={title}
          links={links}
          logoUrl={logoUrl}
          leadImage={leadImage}
          createdAt={createdAt}
          flags={flags}
          spaceMembers={spaceMembers}
          spaceAgreements={spaceAgreements}
          web3SpaceId={web3SpaceId}
          purposeDisplay={purposeDisplay}
          rawPurpose={rawPurpose}
          hasPurpose={hasPurpose}
        />

        <div className="px-5 sm:px-7">
          <SpaceHeaderActionsRow web3SpaceId={web3SpaceId} spaceId={spaceId} />
        </div>

        <div className="flex flex-col gap-4 pt-4 sm:gap-5">
          {typeof web3SpaceId === 'number' ? (
            <SalesBanner web3SpaceId={web3SpaceId} />
          ) : null}
        </div>
      </SpaceHeaderShell>
    </header>
  );
}
