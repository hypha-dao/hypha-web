export const formatDuration = (seconds: number): string => {
  const hours = seconds / 3600;
  const days = hours / 24;

  if (hours < 24) {
    return `${hours} Hour${hours !== 1 ? 's' : ''}`;
  } else {
    return `${days} Day${days !== 1 ? 's' : ''}`;
  }
};
