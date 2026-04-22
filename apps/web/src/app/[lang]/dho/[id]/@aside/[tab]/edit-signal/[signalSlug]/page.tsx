import { getDhoPathCoherence } from '../../../@tab/coherence/constants';
import { Locale } from '@hypha-platform/i18n';
import { EditSignalClient } from './edit-signal-client';

type PageProps = {
  params: Promise<{
    lang: Locale;
    id: string;
    tab: string;
    signalSlug: string;
  }>;
};

export default async function EditSignalPage({ params }: PageProps) {
  const { lang, id: spaceSlug } = await params;
  const coherenceUrl = getDhoPathCoherence(lang, spaceSlug);

  return <EditSignalClient coherenceUrl={coherenceUrl} />;
}
