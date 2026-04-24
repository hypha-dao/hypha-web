import { getTranslations } from 'next-intl/server';

import { Container } from '@hypha-platform/ui';
import { Locale } from '@hypha-platform/i18n';

type PageProps = {
  params: Promise<{ id: string; lang: Locale }>;
};

export default async function DhoSpacesStubPage(props: PageProps) {
  await props.params;
  const t = await getTranslations('DhoWorkspaceNav');

  return (
    <div className="w-full">
      <Container className="px-0! py-6 text-sm text-muted-foreground" size="md">
        <p className="text-base font-medium text-foreground">
          {t('spacesPageStubTitle')}
        </p>
        <p className="mt-2 max-w-prose">{t('spacesPageStubDescription')}</p>
      </Container>
    </div>
  );
}
