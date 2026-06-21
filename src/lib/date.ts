export function getTodayDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function compareExpenseDates(left: { date: string }, right: { date: string }) {
  return right.date.localeCompare(left.date);
}
