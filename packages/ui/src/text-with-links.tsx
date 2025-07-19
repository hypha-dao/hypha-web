import Link from 'next/link';

const TextWithLinks = ({ text }: { text: string }) => {
  if (text.length > 1000) {
    console.warn('Input too long. Omit parsing.');
    return <>{text}</>;
  }

  const urlRegex = /((?:[a-z\-]+)?:?(?:\/\/[^\s]+\.[^\/\.\,]+))/g;
  const parts = text.split(urlRegex);

  return (
    <>
      {parts.map((part, index) => {
        if (part.match(urlRegex)) {
          return (
            <a
              href={part}
              key={`url-${index}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
              onClick={(e) => {
                // this allows to activate link in disabled component
                e.preventDefault();
                const tag = e.target as HTMLAnchorElement;
                window.open(tag.href, '_blank');
              }}
            >
              {part}
            </a>
          );
        } else {
          return <span key={`text-${index}`}>{part}</span>;
        }
      })}
    </>
  );
};

export { TextWithLinks };
