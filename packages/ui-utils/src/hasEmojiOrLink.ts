export const hasEmojiOrLink = (str: string) => {
  const emojiRegex = /[\p{Emoji}]/u;
  const linkRegex = /(https?:\/\/|www\.|t\.me\/)/i;
  return emojiRegex.test(str) || linkRegex.test(str);
};
