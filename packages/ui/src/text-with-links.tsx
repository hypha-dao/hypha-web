import Link from 'next/link';

const TextWithLinks = ({ text }: { text: string }) => {
  if (text.length > 1000) {
    console.warn('Input too long. Omit parsing.')
    return <>{text}</>
  }

  const urlRegex = /((?:[a-z\-]+)?:?(?:\/\/.*\.[^\/\.\,]+))/g;
  const parts = text.split(urlRegex);

  return (
    <>
      {parts.map((part, index) => {
        if (part.match(urlRegex)) {
          return (
            <Link
              href={part}
              key={index}
              passHref
              onClick={(e) => {
                e.preventDefault();
                const tag = e.target as HTMLAnchorElement;
                window.open(tag.href, '_blank');
              }}
            >
              {part}
            </Link>
          );
        } else {
          return <span key={index}>{part}</span>;
        }
      })}
    </>
  );
};

export { TextWithLinks };
