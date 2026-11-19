export function getDateInTimeZone(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [
      part.type,
      part.value,
    ])
  );

  return `${parts.year}-${parts.month}-${parts.day}`;
}