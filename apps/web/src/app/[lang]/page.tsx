import { Locale } from '@hypha-platform/i18n';
import Link from 'next/link';
import { Button } from '@hypha-platform/ui';
import IPFSImage from './ipfs-image';

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
      <IPFSImage
        src="Qmf5r8wKfCSXps1477uk4Y77upcui31btsuZ4dHLfqN6Jj"
        alt="IPFS Image"
        width={300}
        height={300}
        className="rounded-lg object-cover"
      />
    </div>
  );
}
