import { Locale } from '@hypha-platform/i18n';
import { Button } from '@hypha-platform/ui';
import Link from 'next/link';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function Index(props: PageProps) {
  const params = await props.params;

  const { lang } = params;

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
