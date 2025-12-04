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

export const Footer = () => {
  return (
    <div className="bg-background-2">
      <Container>
        <div className="pt-6">
          <Logo width={140} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-0 py-8">
          <div className="flex flex-col items-start space-y-4 md:space-y-0">
            <Text style={customLabelStyles}>NETWORK</Text>
            <Button
              asChild
              variant="ghost"
              className="rounded-lg justify-start text-gray-400 px-0"
            >
              <Link
                rel="noopener noreferrer"
                style={customLinkStyles}
                target="_blank"
                href="https://discord.gg/Um9vASx8a8"
              >
                Hypha Services
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
                Hypha Tokenomics
              </Link>
            </Button>
          </div>

          <div className="flex flex-col items-start space-y-4 md:space-y-0">
            <Text style={customLabelStyles}>LEGAL</Text>
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
                Licensing policy
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
                Terms & Conditions
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
                Privacy Policy
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
};
