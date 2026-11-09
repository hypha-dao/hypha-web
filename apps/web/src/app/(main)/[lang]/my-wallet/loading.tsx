import { Container } from '@hypha-platform/ui';

/**
 * Instant shell on Wallet nav — without this, soft navigation waits for the
 * wallet RSC + client chunk before anything paints.
 */
export default function MyWalletLoading() {
  return (
    <div className="w-full min-w-0 overflow-x-hidden overflow-y-auto">
      <Container className="flex min-w-0 flex-col gap-4 py-3 sm:py-4 lg:py-5 xl:gap-9 xl:pt-3 xl:pb-9">
        <header className="xl:hidden">
          <div className="mb-2 h-3 w-32 animate-pulse bg-neutral-3" />
          <div className="h-8 w-44 animate-pulse bg-neutral-3" />
        </header>
        <div className="hidden flex-col items-center gap-3 xl:flex">
          <div className="h-10 w-72 animate-pulse bg-neutral-3" />
          <div className="h-10 w-52 animate-pulse bg-neutral-3" />
        </div>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 xl:grid-cols-8">
          {Array.from({ length: 8 }, (_, index) => (
            <div
              key={index}
              className="aspect-square animate-pulse bg-neutral-3"
            />
          ))}
        </div>
        <div className="grid w-full grid-cols-1 items-stretch gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          <div className="h-40 animate-pulse bg-neutral-3" />
          <div className="h-40 animate-pulse bg-neutral-3" />
          <div className="h-40 animate-pulse bg-neutral-3" />
        </div>
      </Container>
    </div>
  );
}
