'use client';

import { usePathname } from 'next/navigation';
import { Container } from '../container';
import { Button } from '../button';
import { Link } from '@radix-ui/themes';
import { Text } from '@radix-ui/themes';
import { Logo } from '../atoms';

const customLinkStyles: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: '400',
};

const customLabelStyles: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: '500',
  marginBottom: '12px',
};

export interface FooterProps {
  networkLabel?: string;
  legalLabel?: string;
  hyphaServicesLabel?: string;
  hyphaTokenomicsLabel?: string;
  licensingPolicyLabel?: string;
  termsAndConditionsLabel?: string;
  privacyPolicyLabel?: string;
}

function SpaceContextFooter({
  licensingPolicyLabel = 'Licensing policy',
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
            style={customLinkStyles}
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
            style={customLinkStyles}
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
            style={customLinkStyles}
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
  networkLabel = 'NETWORK',
  legalLabel = 'LEGAL',
  hyphaServicesLabel = 'Hypha Services',
  hyphaTokenomicsLabel = 'Hypha Tokenomics',
  licensingPolicyLabel = 'Licensing policy',
  termsAndConditionsLabel = 'Terms & Conditions',
  privacyPolicyLabel = 'Privacy Policy',
}: FooterProps) {
  return (
    <div className="bg-background-2">
      <Container>
        <div className="pt-6">
          <Logo width={140} />
        </div>
        {/*
          Three-column grid: two content columns + empty track (legacy layout).
          `min-w-0` on each cell prevents text from painting into the next column when
          the main column is narrow (e.g. beside open side panels).
        */}
        <div className="grid grid-cols-1 gap-8 py-8 md:grid-cols-3 md:gap-x-10 md:gap-y-0">
          <div className="flex min-w-0 flex-col items-start space-y-4 md:space-y-0">
            <Text style={customLabelStyles}>{networkLabel}</Text>
            <Button
              asChild
              variant="ghost"
              className="rounded-lg justify-start text-gray-400 px-0"
            >
              <Link
                rel="noopener noreferrer"
                style={customLinkStyles}
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
              className="rounded-lg justify-start text-gray-400 px-0"
            >
              <Link
                rel="noopener noreferrer"
                style={customLinkStyles}
                target="_blank"
                href="https://assets.hypha.earth/files/Hypha%20DAO%20Constitution.pdf?_gl=1*1firc45*_ga*MTk3MzcyMDY5LjE2OTcwMzY0NDA.*_ga_JM4W5HJMYV*czE3NTQ1ODMzMDkkbzM4MyRnMSR0MTc1NDU4MzMxNyRqNjAkbDAkaDA"
              >
                Hypha Constitution
              </Link>
            </Button> */}
            <Button
              asChild
              variant="ghost"
              className="rounded-lg justify-start text-gray-400 px-0"
            >
              <Link
                rel="noopener noreferrer"
                style={customLinkStyles}
                target="_blank"
                href={
                  process.env.NEXT_PUBLIC_HYPHA_TOKENOMICS_DOCS_URL ||
                  'https://assets.hypha.earth/files/Tokenomics_Paper.pdf'
                }
              >
                {hyphaTokenomicsLabel}
              </Link>
            </Button>
          </div>

          <div className="flex min-w-0 flex-col items-start space-y-4 md:space-y-0">
            <Text style={customLabelStyles}>{legalLabel}</Text>
            <Button
              asChild
              variant="ghost"
              className="rounded-lg justify-start text-gray-400 px-0"
            >
              <Link
                rel="noopener noreferrer"
                style={customLinkStyles}
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
              className="rounded-lg justify-start text-gray-400 px-0"
            >
              <Link
                rel="noopener noreferrer"
                style={customLinkStyles}
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
              className="rounded-lg justify-start text-gray-400 px-0"
            >
              <Link
                rel="noopener noreferrer"
                style={customLinkStyles}
                target="_blank"
                href={
                  process.env.NEXT_PUBLIC_PRIVACY_URL ||
                  'https://assets.hypha.earth/files/Hypha_Privacy_Policy.pdf'
                }
              >
                {privacyPolicyLabel}
              </Link>
            </Button>
            {/* <Button
              asChild
              variant="ghost"
              className="rounded-lg justify-start text-gray-400 px-0"
            >
              <Link
                rel="noopener noreferrer"
                style={customLinkStyles}
                target='_blank'
                href="https://hypha.earth/cookie-policy/"
              >
                Cookie Policy
              </Link>
            </Button> */}
          </div>
        </div>
      </Container>
    </div>
  );
}

export const Footer = (props: FooterProps) => {
  const pathname = usePathname();
  const isSpaceContext = pathname.includes('/dho/');

  if (isSpaceContext) {
    return <SpaceContextFooter {...props} />;
  }

  return <LegacyFooter {...props} />;
};
