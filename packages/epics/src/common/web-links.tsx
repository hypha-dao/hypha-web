import { LinkIcon } from './link-icon';
import { LinkLabel } from './link-label';

interface WebLinksProps {
  links?: string[] | null;
}

export const WebLinks = ({ links }: WebLinksProps) => {
  if (!links || links.length === 0) return null;

  return (
    <div className="flex gap-5 flex-wrap">
      {links.map((link, index) => (
        <a
          key={`${link}_${index}`}
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex gap-1 text-neutral-11 hover:text-neutral-12 text-1"
        >
          <LinkIcon url={link} />
          <LinkLabel url={link} />
        </a>
      ))}
    </div>
  );
};
