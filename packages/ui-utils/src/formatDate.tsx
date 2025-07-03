export const formatDate = (dateString: string): string => {
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const dateParts = dateString.split('/');
  const year = dateParts[0];
  // @ts-ignore TODO: fix types
  const monthIndex = parseInt(dateParts[1]) - 1;
  const day = dateParts[2];
  return `${months[monthIndex]} ${day}, ${year}`;
};
