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
  fontWeight: '510',
  marginBottom: '12px',
};

export const Footer = () => {
  return (
    <div className="bg-zinc-900">
      <Container>
        <div className="pt-6">
          <Logo width={140} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-0 py-8">
          <div className="flex flex-col items-start space-y-4 md:space-y-0">
            <Text className="text-white" style={customLabelStyles}>
              THE NETWORK
            </Text>
            <Button
              asChild
              variant="ghost"
              className="rounded-lg justify-start text-gray-400 px-0"
            >
              <Link style={customLinkStyles} href="/">
                Explore
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="rounded-lg justify-start text-gray-400 px-0"
            >
              <Link style={customLinkStyles} href="/">
                My Network
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="rounded-lg justify-start text-gray-400 px-0"
            >
              <Link style={customLinkStyles} href="/">
                Wallet
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="rounded-lg justify-start text-gray-400 px-0"
            >
              <Link style={customLinkStyles} href="/">
                Notifications
              </Link>
            </Button>
          </div>

          <div className="flex flex-col items-start space-y-4 md:space-y-0">
            <Text className="text-white" style={customLabelStyles}>
              GET STARTED
            </Text>
            <Button
              asChild
              variant="ghost"
              className="rounded-lg justify-start text-gray-400 px-0"
            >
              <Link style={customLinkStyles} href="/">
                Create Hypha Account
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="rounded-lg justify-start text-gray-400 px-0"
            >
              <Link style={customLinkStyles} href="/">
                Create Your Space
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="rounded-lg justify-start text-gray-400 px-0"
            >
              <Link style={customLinkStyles} href="/">
                Develop With Us
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="rounded-lg justify-start text-gray-400 px-0"
            >
              <Link style={customLinkStyles} href="/">
                Join a Space
              </Link>
            </Button>
          </div>

          <div className="flex flex-col items-start space-y-4 md:space-y-0">
            <Text className="text-white" style={customLabelStyles}>
              DAO SERVICES
            </Text>
            <Button
              asChild
              variant="ghost"
              className="rounded-lg justify-start text-gray-400 px-0"
            >
              <Link style={customLinkStyles} href="/">
                Launch Programme
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="rounded-lg justify-start text-gray-400 px-0"
            >
              <Link style={customLinkStyles} href="/">
                Expert Deep Dives
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="rounded-lg justify-start text-gray-400 px-0"
            >
              <Link style={customLinkStyles} href="/">
                Founders Round Table
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="rounded-lg justify-start text-gray-400 px-0"
            >
              <Link style={customLinkStyles} href="/">
                Activation Group
              </Link>
            </Button>
          </div>
        </div>
      </Container>
    </div>
  );
};
