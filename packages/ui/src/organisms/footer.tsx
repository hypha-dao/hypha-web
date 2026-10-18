'use client';

import { Container } from '../container';
import { Link } from '@radix-ui/themes';
import { Logo } from '../atoms';

const footerLinkClassName =
  'text-sm text-muted-foreground transition-colors hover:text-foreground';

export interface FooterProps {
  poweredByLabel?: string;
  hyphaServicesLabel?: string;
  hyphaTokenomicsLabel?: string;
  licensingPolicyLabel?: string;
  termsAndConditionsLabel?: string;
  privacyPolicyLabel?: string;
}

const SERVICES_URL = 'https://hypha.earth/services';

export const Footer = ({
  poweredByLabel = 'Powered by',
  hyphaServicesLabel = 'Hypha Services',
  hyphaTokenomicsLabel = 'Hypha Tokenomics',
  licensingPolicyLabel = 'Licensing Policy',
  termsAndConditionsLabel = 'Terms & Conditions',
  privacyPolicyLabel = 'Privacy Policy',
}: FooterProps) => {
  const links = [
    { href: SERVICES_URL, label: hyphaServicesLabel },
    {
      href:
        process.env.NEXT_PUBLIC_HYPHA_TOKENOMICS_DOCS_URL ||
        'https://assets.hypha.earth/files/Tokenomics_Paper.pdf',
      label: hyphaTokenomicsLabel,
    },
    {
      href:
        process.env.NEXT_PUBLIC_LICENCE_URL ||
        'https://assets.hypha.earth/files/Hypha_Licensing_Policy.pdf',
      label: licensingPolicyLabel,
    },
    {
      href:
        process.env.NEXT_PUBLIC_TERMS_URL ||
        'https://assets.hypha.earth/files/Hypha_Terms_And_Conditions.pdf',
      label: termsAndConditionsLabel,
    },
    {
      href:
        process.env.NEXT_PUBLIC_PRIVACY_URL ||
        'https://assets.hypha.earth/files/Hypha_Privacy_Policy.pdf',
      label: privacyPolicyLabel,
    },
  ];

  return (
    <footer className="border-t border-border/60 bg-background-2">
      <Container className="flex flex-col gap-4 py-4 lg:flex-row lg:items-center lg:gap-10">
        <div className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
          <span>{poweredByLabel}</span>
          <Logo width={92} />
        </div>
        <nav
          aria-label={poweredByLabel}
          className="flex flex-1 flex-wrap items-center justify-between gap-x-6 gap-y-2"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              rel="noopener noreferrer"
              target="_blank"
              href={link.href}
              className={footerLinkClassName}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </Container>
    </footer>
  );
};
