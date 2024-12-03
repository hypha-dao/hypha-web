import { Locale } from '@hypha-platform/i18n';
import Link from 'next/link';
import { Button } from '@hypha-platform/ui';

type PageProps = {
  params: { lang: Locale; id: string };
};

export default async function Index({ params: { lang } }: PageProps) {
  return (
    <div>
      <div>IndexPage</div>
      <div>
        <Button
          asChild
          variant="ghost"
          className="rounded-lg justify-start text-gray-400 px-0"
        >
          <Link href={`${lang}/my-spaces/`}>My Spaces</Link>
        </Button>
      </div>
    </div>
  );
}
