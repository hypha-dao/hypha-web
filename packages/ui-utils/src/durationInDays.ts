export const durationInDays = ({ duration }: { duration?: bigint }) => {
  return Number(duration) / (60 * 60 * 24);
};
