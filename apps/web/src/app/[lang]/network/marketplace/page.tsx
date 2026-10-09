import { listNetworkCapitalAsks } from '@hypha-platform/core/server';
import { Locale } from '@hypha-platform/i18n';
import { db } from '@hypha-platform/storage-postgres';
import { Button } from '@hypha-platform/ui';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

export async function generateMetadata() {
  const t = await getTranslations('Marketplace');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

type PageProps = {
  params: Promise<{ lang: Locale }>;
};

export default async function NetworkMarketplacePage(props: PageProps) {
  const { lang } = await props.params;
  const t = await getTranslations('Marketplace');
  let asks: Awaited<ReturnType<typeof listNetworkCapitalAsks>> = [];
  let loadFailed = false;
  try {
    asks = await listNetworkCapitalAsks({ limit: 24 }, { db });
  } catch (error) {
    loadFailed = true;
    console.error('[marketplace] Failed to load capital asks', error);
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10 md:py-16">
      <p className="text-1 tracking-[0.16em] text-neutral-11 uppercase">
        {t('eyebrow')}
      </p>
      <h1
        className="mt-3 text-balance text-8 font-medium tracking-[-0.03em]"
        style={{ fontFamily: 'var(--font-family-heading)' }}
      >
        {t('title')}
      </h1>
      <p className="mt-4 max-w-[52ch] text-2 leading-relaxed text-neutral-11">
        {t('body')}
      </p>
      <Link
        href={`/${lang}/my-dashboard`}
        className="mt-6 inline-block text-2 text-accent-11 underline-offset-4 hover:underline"
      >
        {t('backHome')}
      </Link>

      {loadFailed ? (
        <p className="mt-10 border border-border p-5 text-2 text-error-11">
          {t('loadError')}
        </p>
      ) : asks.length === 0 ? (
        <p className="mt-10 border border-border p-5 text-2 text-neutral-11">
          {t('empty')}
        </p>
      ) : (
        <ul className="mt-10 grid gap-4">
          {asks.map((ask) => {
            const href = ask.slug
              ? `/${lang}/dho/${ask.spaceSlug}/agreements/proposal/${ask.slug}`
              : `/${lang}/dho/${ask.spaceSlug}/agreements`;
            return (
              <li key={ask.id} className="border border-border p-5">
                <p className="text-1 tracking-[0.14em] text-neutral-11 uppercase">
                  {ask.spaceTitle}
                  {' · '}
                  {ask.state === 'agreement' ? t('agreement') : t('proposal')}
                </p>
                <h2
                  className="mt-2 text-4"
                  style={{ fontFamily: 'var(--font-family-heading)' }}
                >
                  {ask.title}
                </h2>
                {ask.excerpt ? (
                  <p className="mt-2 text-2 leading-relaxed text-neutral-11">
                    {ask.excerpt}
                  </p>
                ) : null}
                <Button asChild className="mt-4">
                  <Link href={href}>{t('deploy')}</Link>
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
