import {
  ChangeSpaceDelegateForm,
  ProposalOverlayShell,
} from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { PATH_SELECT_SETTINGS_ACTION } from '@web/app/constants';
import { getDhoPathAgreements } from '../../../../@tab/agreements/constants';
import {
  getAllSpaces,
  type Space,
  findSpaceBySlug,
} from '@hypha-platform/core/server';
import { Plugin } from '../../../../_components/plugins';
import { db } from '@hypha-platform/storage-postgres';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

/**
 * Renders the page for creating a "change-space-delegate" proposal for the specified space.
 *
 * Loads translations and the current space, attempts to load other spaces for selection,
 * and renders either an inline error message (when spaces fail to load) or the
 * ChangeSpaceDelegateForm (including the `change-space-delegate` Plugin).
 *
 * @param params - A promise resolving to an object with `lang` (locale) and `id` (space slug).
 * @returns The page React element that displays the form or an error message.
 */
export default async function ChangeSpaceDelegatePage({ params }: PageProps) {
  const tAgreementFlow = await getTranslations('AgreementFlow');
  const { lang, id } = await params;
  const successfulUrl = getDhoPathAgreements(lang as Locale, id);

  const spaceFromDb = await findSpaceBySlug({ slug: id }, { db });

  if (!spaceFromDb) notFound();
  const { id: spaceId, web3SpaceId } = spaceFromDb;

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
    (space) =>
      space?.address && space.address.trim() !== '' && space.id !== spaceId,
  );

  return (
    <ProposalOverlayShell>
      {error ? (
        <div className="text-error text-sm">
          {tAgreementFlow('pageErrors.loadSpaces')}
        </div>
      ) : (
        <ChangeSpaceDelegateForm
          successfulUrl={successfulUrl}
          backUrl={`${successfulUrl}${PATH_SELECT_SETTINGS_ACTION}`}
          spaceId={spaceId}
          web3SpaceId={web3SpaceId}
          spaces={filteredSpaces}
        >
          <Plugin
            name="change-space-delegate"
            spaceSlug={id}
            spaces={filteredSpaces}
          />
        </ChangeSpaceDelegateForm>
      )}
    </ProposalOverlayShell>
  );
}
