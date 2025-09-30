export const formatDate = (
  dateInput: string | number | Date,
  withTime?: boolean,
): string => {
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

  if (isNaN(date.getTime())) {
    throw new Error('Invalid date input');
  }

  const year = date.getFullYear();
  const monthIndex = date.getMonth();
  const day = date.getDate();

  let formattedDate = `${months[monthIndex]} ${day}, ${year}`;

  if (withTime) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');

    formattedDate += ` ${hours}:${minutes}:${seconds}`;
  }

  return formattedDate;
};
