export function RsFooter() {
  return (
    <footer className="bg-[var(--rs-ink)] px-5 py-16 text-[var(--rs-white)]">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-12 md:grid-cols-[2fr_1fr_1fr]">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/media/rs-logo.webp"
              alt="Regen Sydney"
              className="h-9 w-auto"
            />
            <p className="rs-prose mt-6 max-w-md text-sm leading-relaxed text-[hsl(0_0%_100%/0.72)]">
              Regen Sydney acknowledges the living relationships of Traditional
              Custodians with the lands, skies and waters of the many places
              that make up the Sydney bioregion. Sovereignty was never ceded.
            </p>
          </div>

          <div>
            <p className="rs-eyebrow mb-4 text-[var(--rs-aqua)]">This round</p>
            <ul className="rs-ui space-y-2.5 text-sm text-[hsl(0_0%_100%/0.72)]">
              <li>
                <a
                  href="#projects"
                  className="rs-focus hover:text-[var(--rs-white)]"
                >
                  Projects
                </a>
              </li>
              <li>
                <a
                  href="#how-it-works"
                  className="rs-focus hover:text-[var(--rs-white)]"
                >
                  How it works
                </a>
              </li>
              <li>
                <a
                  href="#tally"
                  className="rs-focus hover:text-[var(--rs-white)]"
                >
                  Live tally
                </a>
              </li>
            </ul>
          </div>

          <div>
            <p className="rs-eyebrow mb-4 text-[var(--rs-aqua)]">
              Regen Sydney
            </p>
            <ul className="rs-ui space-y-2.5 text-sm text-[hsl(0_0%_100%/0.72)]">
              <li>
                <a
                  href="https://www.regen.sydney"
                  target="_blank"
                  rel="noreferrer"
                  className="rs-focus hover:text-[var(--rs-white)]"
                >
                  Main site
                </a>
              </li>
              <li>
                <a
                  href="https://www.regen.sydney/programs"
                  target="_blank"
                  rel="noreferrer"
                  className="rs-focus hover:text-[var(--rs-white)]"
                >
                  Programs
                </a>
              </li>
              <li>
                <a
                  href="https://www.regen.sydney/events"
                  target="_blank"
                  rel="noreferrer"
                  className="rs-focus hover:text-[var(--rs-white)]"
                >
                  Events
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-[hsl(0_0%_100%/0.14)] pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="rs-ui text-xs text-[hsl(0_0%_100%/0.55)]">
            Regen Sydney is endorsed for DGR1. All donations of $2 or more are
            tax-deductible for Australian taxpayers.
          </p>
          <p className="rs-ui text-xs text-[hsl(0_0%_100%/0.55)]">
            &copy; 2026 Regen Sydney Ltd &middot; Built with Hypha
          </p>
        </div>
      </div>
    </footer>
  );
}
