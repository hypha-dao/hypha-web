import React from 'react';

const getLabelFromUrl = (url: string) => {
  if (!url) return '';

  try {
    const { hostname, pathname } = new URL(url);

    // Twitter/X username extraction
    if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
      const username = pathname.split('/')[1];
      if (
        username &&
        !['home', 'search', 'explore', 'notifications'].includes(username)
      ) {
        return `@${username}`;
      }
      return 'Twitter';
    }

    // LinkedIn username/company extraction
    if (hostname.includes('linkedin.com')) {
      const paths = pathname.split('/').filter(Boolean);
      if (paths.length >= 2) {
        // Handle both /in/username and /company/name formats
        if (paths[0] === 'in' || paths[0] === 'company') {
          return `@${paths[1]}`;
        }
      }
      return 'LinkedIn';
    }

    // GitHub username/repo extraction
    if (hostname.includes('github.com')) {
      const paths = pathname.split('/').filter(Boolean);
      if (paths.length >= 1) {
        return `@${paths[0]}`;
      }
      return 'GitHub';
    }

    // For other URLs, return the full hostname and pathname
    return `${hostname}${pathname === '/' ? '' : pathname}`;
  } catch {
    // Invalid URL, return empty string
    return '';
  }
};

type LinkLabelProps = {
  url: string;
  className?: string;
};

export const LinkLabel: React.FC<LinkLabelProps> = ({ url, className }) => {
  const label = getLabelFromUrl(url);

  if (!label) {
    return null;
  }

  return <span className={className}>{label}</span>;
};
