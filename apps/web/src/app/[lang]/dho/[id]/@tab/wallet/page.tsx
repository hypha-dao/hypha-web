import { Locale } from '@hypha-platform/i18n';
import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function WalletPage(props: PageProps) {
  const params = await props.params;
  const { lang } = params;

  redirect(`/${lang}/my-wallet`);
}
