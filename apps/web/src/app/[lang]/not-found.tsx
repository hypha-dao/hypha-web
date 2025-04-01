'use client';

import { Button } from '@hypha-platform/ui';
import { GlobeIcon } from '@radix-ui/react-icons';
import { useParams, useRouter } from 'next/navigation';

export default function NotFound() {
  const router = useRouter();
  const { lang } = useParams();

  const transitionToExploreSpaces = () => {
    router.push(`/${lang}/my-spaces`);
  };

  return (
    <div className="flex flex-col justify-center items-center gap-6 font-medium">
      <span className="text-9">Oooops! We couldn’t find this page</span>
      <span className="text-4 text-neutral-11">
        The page you are looking for might have been removed, had its name
        changed, or is temporarily unavailable
      </span>
      <Button
        colorVariant="accent"
        className="gap-2"
        onClick={transitionToExploreSpaces}
      >
        <GlobeIcon />
        Explore Spaces
      </Button>
    </div>
  );
}
