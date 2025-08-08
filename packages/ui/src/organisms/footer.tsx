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
                href="https://discord.gg/cvTgbymA"
              >
                Hypha Services
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
                href="https://assets.hypha.earth/files/Hypha%20DAO%20Constitution.pdf?_gl=1*1firc45*_ga*MTk3MzcyMDY5LjE2OTcwMzY0NDA.*_ga_JM4W5HJMYV*czE3NTQ1ODMzMDkkbzM4MyRnMSR0MTc1NDU4MzMxNyRqNjAkbDAkaDA"
              >
                Hypha Constitution
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
                href="https://docs.google.com/document/d/1wT-FHdD5AxXdzL8iuZ45aeLse18DkvHFeeL0HBle4wc/edit?tab=t.0"
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
                href="https://www.gnu.org/licenses/gpl-3.0.html"
              >
                AGPLv3 License
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
                href="https://hypha.earth/terms-conditions/"
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
                href="https://hypha.earth/privacy-policy/"
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
