import {
  faGithub,
  faLinkedin,
  faXTwitter,
} from '@fortawesome/free-brands-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Link2Icon } from '@radix-ui/react-icons';
import React from 'react';

const getIconForUrl = (url: string) => {
  if (!url) return null;

  try {
    const hostname = new URL(url).hostname.toLowerCase();

    if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
      return faXTwitter;
    }
    if (hostname.includes('linkedin.com')) {
      return faLinkedin;
    }
    if (hostname.includes('github.com')) {
      return faGithub;
    }
  } catch {
    // Invalid URL, return null to use fallback
    return null;
  }

  return null;
};

type LinkIconProps = {
  url: string;
};

export const LinkIcon: React.FC<LinkIconProps> = ({ url }) => {
  const icon = getIconForUrl(url);

  if (icon) {
    return <FontAwesomeIcon className="w-4" icon={icon} />;
  }

  return <Link2Icon className="w-4 h-4" />;
};
