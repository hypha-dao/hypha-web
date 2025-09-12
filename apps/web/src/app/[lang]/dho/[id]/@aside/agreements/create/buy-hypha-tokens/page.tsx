import { Locale } from '@hypha-platform/i18n';
import {
  SidePanel,
  BuyHyphaTokensForm,
} from '@hypha-platform/epics';
import { PATH_SELECT_SETTINGS_ACTION } from '@web/app/constants';
import { getDhoPathAgreements } from '../../../../@tab/agreements/constants';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function BuyHyphaTokensPage({ params }: PageProps) {
  const { lang, id } = await params;
  const successfulUrl = getDhoPathAgreements(lang as Locale, id);

  return (
    <SidePanel>
      <BuyHyphaTokensForm
        successfulUrl={successfulUrl}
        backUrl={`${successfulUrl}${PATH_SELECT_SETTINGS_ACTION}`}
      />
    </SidePanel>
  );
}
