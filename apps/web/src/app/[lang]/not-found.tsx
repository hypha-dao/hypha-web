import { Button } from '@hypha-platform/ui';
import { GlobeIcon } from '@radix-ui/react-icons';
import Link from 'next/link';

export default async function NotFound() {
  return (
    <div className="flex flex-col justify-center items-center gap-6 font-medium h-full py-64">
      <span className="text-9">Oooops! We couldn’t find this page</span>
      <span className="text-4 text-neutral-11">
        The page you are looking for might have been removed, had its name
        changed, or is temporarily unavailable
      </span>
      <Link href="/network">
        <Button colorVariant="accent" className="gap-2">
          <GlobeIcon />
          Explore Spaces
        </Button>
      </Link>
    </div>
  );
}
