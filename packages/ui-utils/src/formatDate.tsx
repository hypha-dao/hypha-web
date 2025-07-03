export const formatDate = (dateInput: string | number | Date): string => {
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

  const date = new Date(dateInput);

  const year = date.getFullYear();
  const monthIndex = date.getMonth();
  const day = date.getDate();

  return `${months[monthIndex]} ${day}, ${year}`;
};
