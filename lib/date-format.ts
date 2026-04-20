const shortMonths = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function formatDisplayDate(date: string | null | undefined): string {
  if (!date) {
    return "-";
  }

  const [yearText, monthText, dayText] = date.slice(0, 10).split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return "-";
  }

  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return "-";
  }

  return `${day} ${shortMonths[month - 1]} ${year}`;
}

export function formatDisplayMonth(date: string | null | undefined): string {
  if (!date) {
    return "-";
  }

  const [yearText, monthText] = date.slice(0, 10).split("-");
  const year = Number(yearText);
  const month = Number(monthText);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    return "-";
  }

  return `${shortMonths[month - 1]} ${year}`;
}
