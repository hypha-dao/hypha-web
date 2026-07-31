'use client';

import { usePathname } from 'next/navigation';
import { Container } from '../container';
import { Button } from '../button';
import { Link } from '@radix-ui/themes';
import { Logo } from '../atoms';

const footerLinkButtonClassName =
  'h-auto min-h-0 justify-start rounded-lg px-0 py-1 text-sm font-normal text-muted-foreground hover:bg-transparent hover:text-foreground';

const footerSectionLabelClassName =
  'mb-1 text-1 font-medium uppercase tracking-[0.08em] text-foreground';

export interface FooterProps {
  networkLabel?: string;
  legalLabel?: string;
  hyphaServicesLabel?: string;
  hyphaTokenomicsLabel?: string;
  licensingPolicyLabel?: string;
  termsAndConditionsLabel?: string;
  privacyPolicyLabel?: string;
  copyrightLabel?: string;
}

function SpaceContextFooter({
  licensingPolicyLabel = 'Licensing Policy',
  termsAndConditionsLabel = 'Terms & Conditions',
  privacyPolicyLabel = 'Privacy Policy',
}: FooterProps) {
  return (
    <div className="border-t border-border/60 bg-background-2">
      <Container className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
          <span className="shrink-0">Powered by</span>
          <Logo width={92} />
        </div>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link
            rel="noopener noreferrer"
            target="_blank"
            href={
              process.env.NEXT_PUBLIC_LICENCE_URL ||
              'https://assets.hypha.earth/files/Hypha_Licensing_Policy.pdf'
            }
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {licensingPolicyLabel}
          </Link>
          <Link
            rel="noopener noreferrer"
            target="_blank"
            href={
              process.env.NEXT_PUBLIC_TERMS_URL ||
              'https://assets.hypha.earth/files/Hypha_Terms_And_Conditions.pdf'
            }
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {termsAndConditionsLabel}
          </Link>
          <Link
            rel="noopener noreferrer"
            target="_blank"
            href={
              process.env.NEXT_PUBLIC_PRIVACY_URL ||
              'https://assets.hypha.earth/files/Hypha_Privacy_Policy.pdf'
            }
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {privacyPolicyLabel}
          </Link>
        </nav>
      </Container>
    </div>
  );
}

function LegacyFooter({
  networkLabel = 'Network',
  legalLabel = 'Legal',
  hyphaServicesLabel = 'Hypha Services',
  hyphaTokenomicsLabel = 'Hypha Tokenomics',
  licensingPolicyLabel = 'Licensing Policy',
  termsAndConditionsLabel = 'Terms & Conditions',
  privacyPolicyLabel = 'Privacy Policy',
  copyrightLabel = `© ${new Date().getFullYear()} Hypha`,
}: FooterProps) {
  return (
    <footer className="border-t border-border/60 bg-background-2">
      <Container className="py-10 md:py-12">
        {/*
          Brand + two link columns across the full container width.
          Avoids the old empty third track that left a large void on the right.
        */}
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-[minmax(0,1.25fr)_repeat(2,minmax(0,1fr))] md:gap-x-12 md:gap-y-0 lg:gap-x-16">
          <div className="flex min-w-0 flex-col justify-start sm:col-span-2 md:col-span-1">
            <Logo width={108} />
          </div>

          <nav
            className="flex min-w-0 flex-col items-start gap-0.5"
            aria-label={networkLabel}
          >
            <p className={footerSectionLabelClassName}>{networkLabel}</p>
            <Button
              asChild
              variant="ghost"
              className={footerLinkButtonClassName}
            >
              <Link
                rel="noopener noreferrer"
                target="_blank"
                href="https://hypha.services/"
              >
                {hyphaServicesLabel}
              </Link>
            </Button>
            {/* NOTE: Turned off until a new constitution is provided,
                      which is still in development. */}
            {/* <Button
              asChild
              variant="ghost"
              className={footerLinkButtonClassName}
            >
              <Link
                rel="noopener noreferrer"
                target="_blank"
                href="https://assets.hypha.earth/files/Hypha%20DAO%20Constitution.pdf"
              >
                Hypha Constitution
              </Link>
            </Button> */}
            <Button
              asChild
              variant="ghost"
              className={footerLinkButtonClassName}
            >
              <Link
                rel="noopener noreferrer"
                target="_blank"
                href={
                  process.env.NEXT_PUBLIC_HYPHA_TOKENOMICS_DOCS_URL ||
                  'https://assets.hypha.earth/files/Tokenomics_Paper.pdf'
                }
              >
                {hyphaTokenomicsLabel}
              </Link>
            </Button>
          </nav>

          <nav
            className="flex min-w-0 flex-col items-start gap-0.5"
            aria-label={legalLabel}
          >
            <p className={footerSectionLabelClassName}>{legalLabel}</p>
            <Button
              asChild
              variant="ghost"
              className={footerLinkButtonClassName}
            >
              <Link
                rel="noopener noreferrer"
                target="_blank"
                href={
                  process.env.NEXT_PUBLIC_LICENCE_URL ||
                  'https://assets.hypha.earth/files/Hypha_Licensing_Policy.pdf'
                }
              >
                {licensingPolicyLabel}
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className={footerLinkButtonClassName}
            >
              <Link
                rel="noopener noreferrer"
                target="_blank"
                href={
                  process.env.NEXT_PUBLIC_TERMS_URL ||
                  'https://assets.hypha.earth/files/Hypha_Terms_And_Conditions.pdf'
                }
              >
                {termsAndConditionsLabel}
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className={footerLinkButtonClassName}
            >
              <Link
                rel="noopener noreferrer"
                target="_blank"
                href={
                  process.env.NEXT_PUBLIC_PRIVACY_URL ||
                  'https://assets.hypha.earth/files/Hypha_Privacy_Policy.pdf'
                }
              >
                {privacyPolicyLabel}
              </Link>
            </Button>
          </nav>
        </div>

        <div className="mt-10 border-t border-border/50 pt-6">
          <p className="text-1 text-muted-foreground">{copyrightLabel}</p>
        </div>
      </Container>
    </footer>
  );
}

export const Footer = (props: FooterProps) => {
  const pathname = usePathname();
  const isSpaceContext = /(^|\/)dho(?:\/|$)/.test(pathname);

  if (isSpaceContext) {
    return <SpaceContextFooter {...props} />;
  }

  return <LegacyFooter {...props} />;
};
