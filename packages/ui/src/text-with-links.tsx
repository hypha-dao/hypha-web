import Link from "next/link";

const TextWithLinks = ({ text }: { text: string }) => {
  const urlRegex = /((?:[a-z\-]+)?:?(?:\/\/.*\.[^\/\.\,]+))/g;
  const parts = text.split(urlRegex);

  return (
    <>
      {parts.map((part, index) => {
        if (part.match(urlRegex)) {
          return (
            <Link
              href={part} key={index} passHref
              onClick={(e) => {
                if (e.target instanceof HTMLAnchorElement) {
                  e.preventDefault();
                  window.open(e.target.href, '_blank');
                }
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
