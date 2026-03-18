// Example usage of formatRelativeDate utility

import {
  formatRelativeDate,
  formatRelativeDateShort,
} from './formatRelativeDate';

// Example dates
const now = new Date();
const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

// Basic usage
console.log(formatRelativeDate(fiveMinutesAgo)); // "5 minutes ago"
console.log(formatRelativeDate(threeHoursAgo)); // "3 hours ago"
console.log(formatRelativeDate(twoDaysAgo)); // "2 days ago"
console.log(formatRelativeDate(oneMonthAgo)); // "1 month ago"

// With custom options
console.log(formatRelativeDate(fiveMinutesAgo, { prefix: 'Posted' })); // "Posted 5 minutes ago"
console.log(formatRelativeDate(threeHoursAgo, { suffix: 'before' })); // "3 hours before"

// Short format
console.log(formatRelativeDateShort(fiveMinutesAgo)); // "5m ago"
console.log(formatRelativeDateShort(threeHoursAgo)); // "3h ago"
console.log(formatRelativeDateShort(twoDaysAgo)); // "2d ago"

// Future implementation with other languages
// console.log(formatRelativeDate(fiveMinutesAgo, { language: 'ru' })); // Will work when Russian translations are added
