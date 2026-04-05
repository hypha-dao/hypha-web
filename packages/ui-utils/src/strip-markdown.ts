type StripMarkdownConfig = {
  codeBlocks?: boolean;
  inlineCode?: boolean;
  images?: boolean;
  links?: boolean;
  emphasis?: boolean;
  blockquotes?: boolean;
  headers?: boolean;
  horizontalRules?: boolean;
  unorderedListMarkers?: boolean;
  orderedListMarkers?: boolean;
  extraNewlines?: boolean;
};

export const stripMarkdown = (
  markdown?: string,
  config: StripMarkdownConfig = {},
) => {
  if (!markdown) return '';
  let output = markdown;

  // Remove code blocks if enabled (default: true)
  if (config.codeBlocks !== false) {
    output = output.replace(/```[\s\S]*?```/g, '');
  }
  // Remove inline code if enabled (default: true)
  if (config.inlineCode !== false) {
    output = output.replace(/`([^`]+)`/g, '$1');
  }
  // Remove images ![alt](url) and links [text](url)
  if (config.images !== false || config.links !== false) {
    const tokens: string[] = [];
    let i = 0;
    while (i < output.length) {
      const isImage = output[i] === '!' && output[i + 1] === '[';
      const isLink = output[i] === '[';
      if (isImage || isLink) {
        const start = isImage ? i + 2 : i + 1;
        const closeBracket = output.indexOf(']', start);
        if (closeBracket !== -1 && output[closeBracket + 1] === '(') {
          const closeParen = output.indexOf(')', closeBracket + 2);
          if (closeParen !== -1) {
            const alt = output.slice(start, closeBracket);
            const shouldStrip = isImage
              ? config.images !== false
              : config.links !== false;
            tokens.push(shouldStrip ? alt : output.slice(i, closeParen + 1));
            i = closeParen + 1;
            continue;
          }
        }
      }
      tokens.push(output.charAt(i));
      i++;
    }
    output = tokens.join('');
  }
  // Remove emphasis (bold, italic, strikethrough)
  if (config.emphasis !== false) {
    output = output.replace(/([*_~]{1,3})(\S.*?\S)\1/g, '$2');
  }
  // Remove blockquotes
  if (config.blockquotes !== false) {
    output = output.replace(/^>\s?/gm, '');
  }
  // Remove headers
  if (config.headers !== false) {
    output = output.replace(/^#{1,6}\s?/gm, '');
  }
  // Remove horizontal rules
  if (config.horizontalRules !== false) {
    output = output.replace(/^(-{3,}|\*{3,}|_{3,})$/gm, '');
  }
  // Remove unordered list markers
  if (config.unorderedListMarkers !== false) {
    output = output.replace(/^\s*[-*+]\s+/gm, '');
  }
  // Remove ordered list markers
  if (config.orderedListMarkers !== false) {
    output = output.replace(/^\s*\d+\.\s+/gm, '');
  }
  // Remove extra spaces and newlines
  if (config.extraNewlines !== false) {
    output = output.replace(/\n{2,}/g, '\n');
  }
  return output.trim();
};
